import React, { useState, useEffect } from 'react';
import { auth } from './config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getAdminProfile } from './db/firestoreService';
import AdminLogin from './pages/AdminLogin';
import AdminRegister from './pages/AdminRegister';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("login"); // "login" or "register"
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setAuthError("");
      if (currentUser) {
        try {
          const profile = await getAdminProfile(currentUser.uid);
          if (profile && profile.role === "admin") {
            setUser(currentUser);
          } else {
            // Not an admin in Firestore, reject access immediately
            await signOut(auth);
            setUser(null);
            setAuthError("⚠️ ප්‍රවේශය අත්හිටුවා ඇත: මෙම ගිණුම සක්‍රීය Admin ගිණුමක් නොවේ.");
          }
        } catch (e) {
          console.error("Admin verification error:", e);
          await signOut(auth);
          setUser(null);
          setAuthError("⚠️ දත්ත පද්ධතියේ දෝෂයකි: " + e.message);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setPage("login");
      setAuthError("");
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm font-semibold">Admin Panel Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {authError && (
          <div className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white text-xs font-bold px-6 py-3 flex items-center justify-between shadow-lg">
            <span>{authError}</span>
            <button onClick={() => setAuthError("")} className="ml-4 text-white/80 hover:text-white font-bold">✕</button>
          </div>
        )}
        {page === "login" ? (
          <AdminLogin onNavigate={(target) => setPage(target === "admin-register" ? "register" : "login")} onLoginSuccess={() => {}} />
        ) : (
          <AdminRegister onNavigate={(target) => setPage(target === "login" ? "login" : "register")} />
        )}
      </>
    );
  }

  return <AdminDashboard onLogout={handleLogout} />;
}

export default App;
