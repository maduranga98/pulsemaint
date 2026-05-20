# PulseMaint Authentication System

This document describes the complete authentication flow for PulseMaint.

## Overview

PulseMaint uses Firebase Authentication for user management with role-based access control and multi-tenant site isolation.

## Architecture

### Components

```
src/
├── pages/auth/
│   ├── LoginPage.tsx          # Sign in form
│   ├── SignupPage.tsx         # Account creation
│   └── index.ts
├── hooks/
│   └── useAuthActions.ts      # Firebase auth operations
├── components/
│   └── ProtectedRoute.tsx     # Route guard for authenticated pages
└── store/
    └── authStore.ts           # Zustand auth state
```

### Data Flow

```
User Input
    ↓
LoginPage/SignupPage
    ↓
useAuthActions (signup/login)
    ↓
Firebase Auth (createUser/signIn)
    ↓
Firestore (create/fetch user doc)
    ↓
useAuthStore (update Zustand)
    ↓
ProtectedRoute (grant/deny access)
    ↓
Machine Pages (protected)
```

## Routes

### Public Routes
- **`/login`** - Sign in with email/password
- **`/signup`** - Create new account

### Protected Routes (require authentication)
- **`/machines`** - Machine registry list
- **`/machines/new`** - Add new machine
- **`/machines/:id`** - Machine profile
- **`/machines/:id/edit`** - Edit machine
- **`/machines/:id/qr`** - QR code view
- **`/`** - Redirects to `/machines`

## Authentication Flow

### Login
1. User navigates to `/login`
2. Enters email and password
3. `useAuthActions.login()` calls `signInWithEmailAndPassword()`
4. Firebase Auth validates credentials
5. `onAuthStateChanged()` listener fires
6. User data fetched from Firestore
7. `authStore` updated
8. Redirects to `/machines`

### Signup
1. User navigates to `/signup`
2. Fills form: name, email, password, site, role
3. `useAuthActions.signup()` calls `createUserWithEmailAndPassword()`
4. Firebase creates auth user
5. New Firestore document created in `users/{uid}`
6. Same listener flow as login
7. Redirects to `/machines`

### Access Control
1. User navigates to protected route (e.g., `/machines`)
2. `ProtectedRoute` component checks `firebaseUser`
3. If authenticated → render page
4. If not authenticated → redirect to `/login`
5. While loading → show loading spinner

### Logout
1. Call `useAuthActions.logout()`
2. Firebase Auth signs out user
3. `onAuthStateChanged()` listener fires
4. `authStore.user` set to null
5. `ProtectedRoute` redirects to `/login`

## User Data Model

### Firestore Collection: `users`

```typescript
interface AppUser {
  uid: string;                    // Firebase Auth UID
  email: string;                  // Unique email
  displayName: string;            // User's full name
  role: UserRole;                 // User's role (8 types)
  siteId: string;                 // Multi-tenant site ID
  siteName: string;               // Human-readable site name
  avatarUrl: string | null;       // Profile picture
  phoneNumber: string | null;     // Contact number
  fcmTokens: string[];            // FCM tokens for push notifications
  whatsappNumber: string | null;  // WhatsApp contact
  isActive: boolean;              // Account status
  createdAt: Timestamp;           // Account creation date
  updatedAt: Timestamp;           // Last updated date
}
```

### User Roles (8 Types)

| Role | Description | Machine Access | Capabilities |
|------|-------------|-----------------|---|
| `floor_operator` | Machine operators | None | None |
| `trainee` | New employee trainee | None | None |
| `technician` | Maintenance technician | Read-only | View machines & history |
| `store_keeper` | Inventory management | Read-only | View for part linking |
| `maintenance_supervisor` | Maintenance lead | Full | Add, edit, generate QR, upload docs |
| `plant_manager` | Plant management | Full | All + decommission + analytics |
| `hr_officer` | Human resources | Read-only | View machine list only |
| `admin` | System administrator | Full | All + delete machines |

## Hooks

### useAuthActions
```typescript
const { login, signup, logout, loading, error } = useAuthActions();

// Login
await login(email, password);

// Signup
await signup(email, password, {
  displayName: 'John Doe',
  siteId: 'site_001',
  siteName: 'Main Plant',
  role: 'technician'
});

// Logout
await logout();
```

### useAuthStore
```typescript
const user = useAuthStore((state) => state.user);              // AppUser | null
const firebaseUser = useAuthStore((state) => state.firebaseUser); // Firebase User | null
const loading = useAuthStore((state) => state.loading);        // boolean
const error = useAuthStore((state) => state.error);            // string | null
```

## Environment Setup

1. Copy environment template:
   ```bash
   cp .env.example .env
   ```

2. Get Firebase credentials from [Firebase Console](https://console.firebase.google.com/):
   - Project Settings → Your apps → Web app → Config

3. Fill in `.env`:
   ```
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=project_id
   VITE_FIREBASE_STORAGE_BUCKET=project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc...
   VITE_APP_URL=http://localhost:5173
   ```

4. Restart dev server

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection - user can only read/write their own document
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Machines collection - filter by siteId for multi-tenancy
    match /machines/{document=**} {
      allow read: if request.auth != null && 
                     resource.data.siteId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.siteId;
      allow create: if request.auth != null && 
                       hasRole(['maintenance_supervisor', 'plant_manager', 'admin']);
      allow update, delete: if request.auth != null && 
                               hasRole(['plant_manager', 'admin']);
    }
  }
}

function hasRole(roles) {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in roles;
}
```

## Demo Credentials

For testing purposes:
- **Email**: demo@pulsemaint.com
- **Password**: demo123456

Create this user via signup page or manually in Firebase Console.

## Error Handling

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `CONFIGURATION_NOT_FOUND` | Firebase key invalid | Check .env, restart server |
| `auth/user-not-found` | Email doesn't exist | Correct email or create account |
| `auth/wrong-password` | Incorrect password | Check password spelling |
| `auth/email-already-in-use` | Email taken | Use different email |
| `auth/weak-password` | Password < 6 chars | Use 6+ character password |

All errors are displayed on auth pages in red error banners.

## Security Considerations

1. **Passwords**: Firebase handles hashing/salting automatically
2. **Multi-tenancy**: All queries filter by `user.siteId`
3. **Role-based Access**: Machine operations check user role
4. **Session Management**: Firebase handles auth tokens automatically
5. **HTTPS**: Always use HTTPS in production
6. **Credentials**: Never commit `.env` with real credentials

## Testing

### Manual Testing

1. **Signup Flow**:
   - Navigate to `/signup`
   - Fill all fields
   - Verify account created in Firestore
   - Verify redirected to `/machines`

2. **Login Flow**:
   - Sign out (if logged in)
   - Navigate to `/login`
   - Enter credentials
   - Verify redirected to `/machines`

3. **Access Control**:
   - Try accessing `/machines` without auth
   - Should redirect to `/login`

4. **Role-based UI**:
   - Login as different roles
   - Verify UI changes based on permissions

## TODO / Future Enhancements

- [ ] Password reset flow
- [ ] Email verification
- [ ] Two-factor authentication (2FA)
- [ ] Social login (Google, Microsoft)
- [ ] Session timeout warning
- [ ] Remember me functionality
- [ ] Account settings page
- [ ] Change password
- [ ] Audit logs for auth events
- [ ] Rate limiting on login attempts
