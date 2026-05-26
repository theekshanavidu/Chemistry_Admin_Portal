import React, { useState } from "react";
import { auth } from "../config/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

export default function AdminLogin({ onLoginSuccess, onNavigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess();
    } catch (err) {
      const msgs = {
        "auth/user-not-found":       "මෙම Admin Email ලියාපදිංචි නොවී ඇත.",
        "auth/wrong-password":       "Password නිවැරදි නොවේ.",
        "auth/invalid-credential":   "Email හෝ Password වැරදිය.",
        "auth/too-many-requests":    "ඉතා වාර ගණනාවක් උත්සාහ කළා. ටිකක් රැඳෙන්න.",
        "auth/network-request-failed": "Network සම්බන්ධතාව පරීක්ෂා කරන්න.",
      };
      setError(msgs[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("කරුණාකර ඔබගේ Email ලිපිනය ඇතුලත් කරන්න.");
      return;
    }
    setLoading(true);
    setError("");
    setResetSuccess("");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSuccess("මුරපදය නැවත සැකසීමේ සබැඳිය (Password reset link) ඔබගේ Email ලිපිනයට සාර්ථකව යවා ඇත. කරුණාකර ඔබගේ Inbox/Spam පරීක්ෂා කරන්න.");
    } catch (err) {
      const msgs = {
        "auth/user-not-found": "මෙම Email ලිපිනය සහිත ගිණුමක් සොයාගත නොහැක.",
        "auth/invalid-email": "Email ලිපිනය නිවැරදි නොවේ.",
        "auth/network-request-failed": "Network සම්බන්ධතාව පරීක්ෂා කරන්න.",
      };
      setError(msgs[err.code] || err.message);
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

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white border border-slate-100 rounded-3xl shadow-xl overflow-hidden p-8 md:p-10">
          {/* Top accent bar */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-purple-600 via-violet-500 to-indigo-600" />

          <div className="relative">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-slate-800 font-extrabold text-lg leading-none">SKCHEM.COM</h1>
                <p className="text-purple-600 text-xs font-semibold tracking-wider uppercase mt-0.5">Admin Control Panel</p>
              </div>
            </div>

            {!forgotMode ? (
              <>
                <div className="mb-6">
                  <h2 className="text-slate-900 text-2xl font-black">Admin Sign In</h2>
                  <p className="text-slate-500 text-sm mt-1">Authorized personnel only. All access is logged.</p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-5 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Admin Email
                    </label>
                    <input
                      id="admin-email"
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
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotMode(true);
                          setError("");
                          setResetSuccess("");
                        }}
                        className="text-xs text-purple-600 hover:text-purple-700 font-bold hover:underline cursor-pointer bg-transparent border-0"
                      >
                        Forget Password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="admin-password"
                        type={showPass ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPass ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    id="admin-login-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed text-white font-extrabold py-3 px-6 rounded-xl transition-all text-sm shadow-lg shadow-purple-600/10 flex items-center justify-center gap-2 mt-2"
                  >
                    {loading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Signing in...
                      </>
                    ) : (
                      "Sign In to Admin Panel"
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-xs text-slate-500 font-sans">
                    පරිපාලක ගිණුමක් නොමැතිද?{" "}
                    <button
                      type="button"
                      onClick={() => onNavigate("admin-register")}
                      className="text-purple-600 hover:text-purple-700 font-bold hover:underline cursor-pointer bg-transparent border-0"
                    >
                      Sign Up (Register)
                    </button>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-slate-900 text-2xl font-black">Reset Password</h2>
                  <p className="text-slate-500 text-sm mt-1">Enter your admin email address to receive a password reset link.</p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-5 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                {/* Success Message */}
                {resetSuccess && (
                  <div className="mb-5 bg-green-50 border border-green-200 text-green-700 text-xs px-4 py-3 rounded-xl font-bold leading-relaxed">
                    {resetSuccess}
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Admin Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@skchem.com"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed text-white font-extrabold py-3 px-6 rounded-xl transition-all text-sm shadow-lg shadow-purple-600/10 flex items-center justify-center gap-2 mt-2"
                  >
                    {loading ? "Sending link..." : "Send Password Reset Link"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(false);
                      setError("");
                      setResetSuccess("");
                    }}
                    className="text-xs text-purple-600 hover:text-purple-700 font-bold hover:underline cursor-pointer bg-transparent border-0"
                  >
                    Back to Sign In
                  </button>
                </div>
              </>
            )}

            {/* Custom Requested Footer */}
            <div className="mt-8 pt-6 border-t border-slate-100 text-center space-y-1.5">
              <p className="text-[11px] font-bold text-slate-500 tracking-wide uppercase">SKCHEM.COM - Sajith K Kumara</p>
              <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1 font-sans">
                Copyright © Theekshana Viduranga <span className="font-extrabold text-purple-600">&lt;/&gt;</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
