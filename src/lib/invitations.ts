import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { nanoid } from 'nanoid';
import { auth, db, functions } from './firebase';
import { useAuthStore } from '../store/authStore';
import type { Invitation, UserProfile, UserRole } from '../types/auth';
import { defaultNotificationPrefs } from '../types/notificationPrefs';

const INVITE_EXPIRY_DAYS = 7;

export async function createInvitation(data: {
  companyId: string;
  companyName: string;
  email: string;
  role: UserRole;
  fullName: string;
  department: string | null;
  jobTitle: string | null;
  invitedBy: string;
  invitedByName: string;
}): Promise<Invitation> {
  const existing = await getDocs(
    query(
      collection(db, `companies/${data.companyId}/invitations`),
      where('email', '==', data.email.toLowerCase().trim()),
      where('status', '==', 'pending'),
    ),
  );

  if (!existing.empty) {
    throw new Error('An active invitation already exists for this email.');
  }

  const token = nanoid(32);
  const id = nanoid();
  const expiresAt = Timestamp.fromDate(
    new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  );

  const invitation: Omit<Invitation, 'createdAt'> & { createdAt: any } = {
    id,
    companyId: data.companyId,
    companyName: data.companyName,
    email: data.email.toLowerCase().trim(),
    role: data.role,
    fullName: data.fullName.trim(),
    department: data.department,
    jobTitle: data.jobTitle,
    token,
    status: 'pending',
    invitedBy: data.invitedBy,
    invitedByName: data.invitedByName,
    createdAt: serverTimestamp(),
    expiresAt,
    acceptedAt: null,
    acceptedUserId: null,
  };

  await setDoc(doc(db, `companies/${data.companyId}/invitations/${id}`), invitation);

  const tokenRef = doc(db, `inviteTokens/${token}`);
  await setDoc(tokenRef, {
    token,
    companyId: data.companyId,
    invitationId: id,
  });

  const result = { ...invitation, createdAt: Timestamp.now() } as Invitation;

  try {
    const sendEmail = httpsCallable(functions, 'sendInvitationEmail');
    await sendEmail({ invitationId: id, companyId: data.companyId });
  } catch (err) {
    console.warn('Email send failed (invitation still created):', err);
  }

  return result;
}

export async function validateInviteToken(
  token: string,
): Promise<{ valid: true; invitation: Invitation } | { valid: false; reason: 'expired' | 'used' | 'not_found' }> {
  const tokenSnap = await getDoc(doc(db, `inviteTokens/${token}`));
  if (!tokenSnap.exists()) {
    return { valid: false, reason: 'not_found' };
  }

  const { companyId, invitationId } = tokenSnap.data() as {
    companyId: string;
    invitationId: string;
  };

  const invSnap = await getDoc(doc(db, `companies/${companyId}/invitations/${invitationId}`));
  if (!invSnap.exists()) {
    return { valid: false, reason: 'not_found' };
  }

  const invitation = invSnap.data() as Invitation;

  if (invitation.status === 'accepted') {
    return { valid: false, reason: 'used' };
  }

  if (
    invitation.status === 'expired' ||
    invitation.status === 'revoked' ||
    invitation.expiresAt.toDate() < new Date()
  ) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, invitation };
}

export async function acceptInviteWithPassword(
  invitation: Invitation,
  password: string,
  fullName: string,
): Promise<UserProfile> {
  const userCredential = await createUserWithEmailAndPassword(auth, invitation.email, password);
  const uid = userCredential.user.uid;

  const profile = await createUserFromInvitation(uid, invitation, fullName);

  useAuthStore.getState().setUser(userCredential.user);
  useAuthStore.getState().setUserProfile(profile);

  return profile;
}

export async function acceptInviteWithGoogle(invitation: Invitation): Promise<UserProfile> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ login_hint: invitation.email });
  const userCredential = await signInWithPopup(auth, provider);
  const uid = userCredential.user.uid;

  if (
    userCredential.user.email?.toLowerCase() !== invitation.email.toLowerCase()
  ) {
    throw new Error(
      `Please sign in with ${invitation.email}. You signed in with ${userCredential.user.email}.`,
    );
  }

  const profile = await createUserFromInvitation(
    uid,
    invitation,
    userCredential.user.displayName || invitation.fullName,
    userCredential.user.photoURL,
  );

  useAuthStore.getState().setUser(userCredential.user);
  useAuthStore.getState().setUserProfile(profile);

  return profile;
}

async function createUserFromInvitation(
  uid: string,
  invitation: Invitation,
  fullName: string,
  photoURL?: string | null,
): Promise<UserProfile> {
  const userRef = doc(db, `companies/${invitation.companyId}/users/${uid}`);
  const userProfile: Omit<UserProfile, 'createdAt' | 'updatedAt' | 'lastLoginAt'> & {
    createdAt: any;
    updatedAt: any;
    lastLoginAt: any;
  } = {
    id: uid,
    companyId: invitation.companyId,
    siteIds: [],
    role: invitation.role,
    fullName: fullName.trim(),
    email: invitation.email,
    phone: null,
    employeeId: null,
    department: invitation.department,
    jobTitle: invitation.jobTitle,
    status: 'active',
    loginMethod: photoURL ? 'google' : 'email',
    hasPin: false,
    mustChangePinOnLogin: false,
    profilePhoto: photoURL || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    invitedBy: invitation.invitedBy,
  };

  await setDoc(userRef, userProfile);

  await setDoc(doc(db, `users/${uid}`), {
    uid,
    companyId: invitation.companyId,
    role: invitation.role,
    siteId: null,
    // Default: push+email for high-severity events, push-only for the rest.
    notificationPrefs: defaultNotificationPrefs(),
  });

  await updateDoc(doc(db, `companies/${invitation.companyId}/invitations/${invitation.id}`), {
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    acceptedUserId: uid,
  });

  return { ...userProfile, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), lastLoginAt: Timestamp.now() } as UserProfile;
}

export async function getCompanyInvitations(companyId: string): Promise<Invitation[]> {
  const q = query(
    collection(db, `companies/${companyId}/invitations`),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Invitation);
}

export async function revokeInvitation(companyId: string, invitationId: string): Promise<void> {
  await updateDoc(doc(db, `companies/${companyId}/invitations/${invitationId}`), {
    status: 'revoked',
  });
}

export async function resendInvitation(companyId: string, invitationId: string): Promise<Invitation> {
  const invSnap = await getDoc(doc(db, `companies/${companyId}/invitations/${invitationId}`));
  if (!invSnap.exists()) throw new Error('Invitation not found.');

  const old = invSnap.data() as Invitation;

  await updateDoc(doc(db, `companies/${companyId}/invitations/${invitationId}`), {
    status: 'revoked',
  });

  return createInvitation({
    companyId: old.companyId,
    companyName: old.companyName,
    email: old.email,
    role: old.role,
    fullName: old.fullName,
    department: old.department,
    jobTitle: old.jobTitle,
    invitedBy: old.invitedBy,
    invitedByName: old.invitedByName,
  });
}

export async function sendInvitationEmailManually(companyId: string, invitationId: string): Promise<void> {
  const sendEmail = httpsCallable(functions, 'sendInvitationEmail');
  await sendEmail({ invitationId, companyId });
}

export function getInviteLink(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}
