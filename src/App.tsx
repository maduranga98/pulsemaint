import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { useAuthStore } from './store/authStore';
import type { AppUser } from './types/user';

// Pages
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
      {/* Machines Module - Module 3 */}
      <Route path="/machines" element={<MachineListPage />} />
      <Route path="/machines/new" element={<AddMachinePage />} />
      <Route path="/machines/:id" element={<MachineProfilePage />} />
      <Route path="/machines/:id/edit" element={<EditMachinePage />} />
      <Route path="/machines/:id/qr" element={<MachineQrPage />} />

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
    <BrowserRouter future={{ v7_startTransition: true }}>
      <AppContainer />
    </BrowserRouter>
  );
}
