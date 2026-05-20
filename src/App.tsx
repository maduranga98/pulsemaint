import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import type { AppUser } from './types/user';

// Auth Pages
import { LoginPage, SignupPage } from './pages/auth';

// Machine Pages
import {
  MachineListPage,
  AddMachinePage,
  MachineProfilePage,
  EditMachinePage,
  MachineQrPage,
} from './pages/machines';

function AppRoutes() {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected Machine Routes - Module 3 */}
      <Route
        path="/machines"
        element={
          <ProtectedRoute>
            <MachineListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/machines/new"
        element={
          <ProtectedRoute>
            <AddMachinePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/machines/:id"
        element={
          <ProtectedRoute>
            <MachineProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/machines/:id/edit"
        element={
          <ProtectedRoute>
            <EditMachinePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/machines/:id/qr"
        element={
          <ProtectedRoute>
            <MachineQrPage />
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/machines" replace />} />
    </Routes>
  );
}

function AppContainer() {
  const setUser = useAuthStore((state) => state.setUser);
  const setFirebaseUser = useAuthStore((state) => state.setFirebaseUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Fetch user details from Firestore
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const appUser: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              ...userSnap.data(),
            } as AppUser;
            setUser(appUser);
          }
          setFirebaseUser(firebaseUser);
        } else {
          setUser(null);
          setFirebaseUser(null);
        }
      } catch (error) {
        console.error('Error loading user:', error);
        setUser(null);
        setFirebaseUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, setFirebaseUser, setLoading]);

  return <AppRoutes />;
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AppContainer />
    </BrowserRouter>
  );
}
