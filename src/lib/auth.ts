import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithCustomToken,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  RecaptchaVerifier,
  type ConfirmationResult,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { useAuthStore } from '../store/authStore';
import type { CompanyProfile, UserProfile, UserRole } from '../types/auth';

export const authErrorMessages: Record<string, string> = {
  'auth/user-not-found': 'No account found with this email address.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/invalid-verification-code': 'Invalid OTP. Please try again.',
  'auth/code-expired': 'OTP has expired. Please request a new one.',
  'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
  PIN_CHANGE_REQUIRED: 'You must change your PIN before continuing.',
  PIN_INVALID: 'Invalid PIN. Please try again.',
  INVITE_EXPIRED: 'This invitation has expired.',
  INVITE_USED: 'This invitation has already been used.',
};

export async function registerCompany(data: {
  companyName: string;
  industry: string;
  country: string;
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  password: string;
}): Promise<void> {
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const uid = userCredential.user.uid;

    // Create Firestore company document
    const companyRef = doc(collection(db, 'companies'));
    const companyProfile: CompanyProfile = {
      id: companyRef.id,
      name: data.companyName,
      tradeName: null,
      industry: data.industry,
      country: data.country,
      logoUrl: null,
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: data.country === 'LK' ? 'LKR' : 'USD',
      status: 'trial',
      trialEndsAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      plan: 'starter',
      tenantId: '', // Will be set by Cloud Function
      createdAt: serverTimestamp() as Timestamp,
      adminUserId: uid,
      onboardingCompletedAt: null,
    };

    await setDoc(companyRef, companyProfile);

    // Create user profile document
    const userRef = doc(collection(db, `companies/${companyRef.id}/users`), uid);
    const userProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
      createdAt?: any;
      updatedAt?: any;
    } = {
      id: uid,
      companyId: companyRef.id,
      siteIds: [],
      role: 'admin',
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      employeeId: null,
      department: null,
      jobTitle: data.jobTitle,
      status: 'pending',
      loginMethod: 'email',
      hasPin: false,
      mustChangePinOnLogin: false,
      profilePhoto: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: null,
      invitedBy: null,
    };

    await setDoc(userRef, userProfile);

    // Create user mapping document for quick company lookup
    const userMapRef = doc(collection(db, 'users'), uid);
    await setDoc(userMapRef, { uid, companyId: companyRef.id });

    console.log('Company registration complete', { uid, companyId: companyRef.id });
  } catch (error) {
    console.error('Company registration failed:', error);
    throw error;
  }
}

export async function loginWithEmail(email: string, password: string): Promise<UserProfile> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Get companyId
    const companyId = await getCompanyIdFromUser(uid);
    if (!companyId) {
      throw new Error('Company not found for this user.');
    }

    // Fetch and update user profile
    const userProfile = await fetchUserProfile(uid, companyId);
    if (!userProfile) {
      throw new Error('User profile not found.');
    }

    // Update lastLoginAt
    const userRef = doc(db, `companies/${companyId}/users/${uid}`);
    await updateDoc(userRef, { lastLoginAt: serverTimestamp() });

    return userProfile;
  } catch (error) {
    throw error;
  }
}

export async function loginWithPhone(phoneNumber: string): Promise<ConfirmationResult> {
  try {
    const appVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });

    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    return confirmationResult;
  } catch (error) {
    throw error;
  }
}

export async function confirmOTP(
  confirmationResult: ConfirmationResult,
  otp: string
): Promise<UserProfile> {
  try {
    const userCredential = await confirmationResult.confirm(otp);
    const uid = userCredential.user.uid;

    // Get or create user profile
    const companyId = await getCompanyIdFromUser(uid);
    if (!companyId) {
      throw new Error('Company not found for this user.');
    }

    let userProfile = await fetchUserProfile(uid, companyId);
    if (!userProfile) {
      // Create a basic profile for phone-based signup
      const userRef = doc(collection(db, `companies/${companyId}/users`), uid);
      const newProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
        createdAt?: any;
        updatedAt?: any;
      } = {
        id: uid,
        companyId,
        siteIds: [],
        role: 'floor_operator',
        fullName: userCredential.user.displayName || 'User',
        email: userCredential.user.email || null,
        phone: userCredential.user.phoneNumber || null,
        employeeId: null,
        department: null,
        jobTitle: null,
        status: 'active',
        loginMethod: 'phone',
        hasPin: false,
        mustChangePinOnLogin: false,
        profilePhoto: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        invitedBy: null,
      };

      await setDoc(userRef, newProfile);
      userProfile = newProfile as UserProfile;

      // Create user mapping document for quick company lookup
      const userMapRef = doc(collection(db, 'users'), uid);
      await setDoc(userMapRef, { uid, companyId });
    }

    // Update lastLoginAt
    const userRef = doc(db, `companies/${companyId}/users/${uid}`);
    await updateDoc(userRef, { lastLoginAt: serverTimestamp() });

    return userProfile;
  } catch (error) {
    throw error;
  }
}

export async function loginWithGoogle(): Promise<UserProfile> {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const uid = userCredential.user.uid;

    // Get companyId
    const companyId = await getCompanyIdFromUser(uid);
    if (!companyId) {
      throw new Error('Company not found for this user.');
    }

    // Fetch user profile
    let userProfile = await fetchUserProfile(uid, companyId);
    if (!userProfile) {
      // Create profile for Google login
      const userRef = doc(collection(db, `companies/${companyId}/users`), uid);
      const newProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
        createdAt?: any;
        updatedAt?: any;
      } = {
        id: uid,
        companyId,
        siteIds: [],
        role: 'floor_operator',
        fullName: userCredential.user.displayName || 'User',
        email: userCredential.user.email || null,
        phone: null,
        employeeId: null,
        department: null,
        jobTitle: null,
        status: 'active',
        loginMethod: 'google',
        hasPin: false,
        mustChangePinOnLogin: false,
        profilePhoto: userCredential.user.photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        invitedBy: null,
      };

      await setDoc(userRef, newProfile);
      userProfile = newProfile as UserProfile;

      // Create user mapping document for quick company lookup
      const userMapRef = doc(collection(db, 'users'), uid);
      await setDoc(userMapRef, { uid, companyId });
    }

    // Update lastLoginAt
    const userRef = doc(db, `companies/${companyId}/users/${uid}`);
    await updateDoc(userRef, { lastLoginAt: serverTimestamp() });

    return userProfile;
  } catch (error) {
    throw error;
  }
}

export async function loginWithPin(companyId: string, pin: string): Promise<UserProfile> {
  try {
    // Call Cloud Function to validate PIN
    const response = await fetch('/.netlify/functions/validateEmployeePin', {
      method: 'POST',
      body: JSON.stringify({ companyId, pin }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'PIN validation failed');
    }

    const { customToken } = await response.json();

    // Sign in with custom token
    const userCredential = await signInWithCustomToken(auth, customToken);
    const uid = userCredential.user.uid;

    // Fetch user profile
    const userProfile = await fetchUserProfile(uid, companyId);
    if (!userProfile) {
      throw new Error('User profile not found.');
    }

    // Check if PIN change is required
    if (userProfile.mustChangePinOnLogin) {
      const error = new Error('You must change your PIN before continuing.');
      (error as any).code = 'PIN_CHANGE_REQUIRED';
      throw error;
    }

    // Update lastLoginAt
    const userRef = doc(db, `companies/${companyId}/users/${uid}`);
    await updateDoc(userRef, { lastLoginAt: serverTimestamp() });

    return userProfile;
  } catch (error) {
    throw error;
  }
}

export async function changePin(
  userId: string,
  companyId: string,
  newPin: string
): Promise<void> {
  try {
    // Call Cloud Function to update PIN
    const response = await fetch('/.netlify/functions/updateEmployeePin', {
      method: 'POST',
      body: JSON.stringify({ userId, companyId, newPin }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'PIN update failed');
    }

    // Update mustChangePinOnLogin in Firestore
    const userRef = doc(db, `companies/${companyId}/users/${userId}`);
    await updateDoc(userRef, { mustChangePinOnLogin: false });
  } catch (error) {
    throw error;
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    await signOut(auth);
    useAuthStore.getState().reset();
  } catch (error) {
    throw error;
  }
}

export async function fetchUserProfile(uid: string, companyId: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, `companies/${companyId}/users/${uid}`);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    return userSnap.data() as UserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export async function getCompanyIdFromUser(uid: string): Promise<string | null> {
  try {
    // Query the users collection to find which company this user belongs to
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('uid', '==', uid));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return snapshot.docs[0].data().companyId;
    }

    // Fallback: check custom claims from Firebase Auth
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === uid) {
      const claims = (await currentUser.getIdTokenResult()).claims;
      if (claims.companyId) {
        return claims.companyId as string;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting company ID:', error);
    return null;
  }
}

export function getDashboardRoute(role: UserRole): string {
  const routes: Record<UserRole, string> = {
    admin: '/app/dashboard',
    plant_manager: '/app/dashboard',
    supervisor: '/app/machines',
    technician: '/app/machines',
    store_keeper: '/app/inventory',
    hr_officer: '/app/training',
    trainee: '/app/training/my-modules',
    floor_operator: '/app/training/my-modules',
  };

  return routes[role];
}
