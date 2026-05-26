import React, { useState } from "react";
import { auth } from "../config/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { saveAdminProfile } from "../db/firestoreService";

export default function AdminRegister({ onNavigate }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords ගැලපෙන්නේ නැත.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password එක අවම වශයෙන් අකුරු/ඉලක්කම් 6ක් විය යුතුය.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save to admins collection
      await saveAdminProfile(user.uid, {
        name,
        email,
      });

      setSuccess(true);
      setTimeout(() => {
        onNavigate("login");
      }, 2000);
    } catch (err) {
      console.error(err);
      const messages = {
        "auth/email-already-in-use": "මෙම Email ලිපිනය දැනටමත් ලියාපදිංචි වී ඇත.",
        "auth/invalid-email": "Email ලිපිනය නිවැරදි නොවේ.",
        "auth/weak-password": "Password එක දුර්වල වැඩියි.",
      };
      setError(messages[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background grid decoration */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(0,0,0,.08) 39px,rgba(0,0,0,.08) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(0,0,0,.08) 39px,rgba(0,0,0,.08) 40px)",
        }}
      />

      <div className="relative w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-xl overflow-hidden p-8 md:p-10">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-purple-600 via-violet-500 to-indigo-600" />

        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
            <span className="text-white font-black text-lg">A</span>
          </div>
          <div>
            <span className="text-slate-800 font-extrabold text-lg leading-none block">SKCHEM.COM</span>
            <span className="text-purple-600 text-[10px] font-bold uppercase tracking-wider">Admin Control Panel</span>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-slate-900">Admin Register</h1>
          <p className="text-slate-500 text-xs mt-1">Create a new administrator account</p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 bg-red-55 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 text-xs px-4 py-3 rounded-xl text-center font-bold">
            ලියාපදිංචිය සාර්ථකයි! Login පිටුවට යොමු කෙරේ...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sajith K Kumara"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@skchem.com"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed text-white font-extrabold py-3 px-6 rounded-xl transition-all text-sm shadow-lg shadow-purple-600/10 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Registering...
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            දැනටමත් ගිණුමක් තිබේද?{" "}
            <button
              onClick={() => onNavigate("login")}
              className="text-purple-600 hover:text-purple-700 font-bold hover:underline cursor-pointer bg-transparent border-0"
            >
              Sign In
            </button>
          </p>
        </div>

        {/* Custom Requested Footer */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center space-y-1.5">
          <p className="text-[11px] font-bold text-slate-500 tracking-wide uppercase">SKCHEM.COM - Sajith K Kumara</p>
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1 font-sans">
            Copyright © Theekshana Viduranga <span className="font-extrabold text-purple-600">&lt;/&gt;</span>
          </p>
        </div>
      </div>
    </div>
  );
}
