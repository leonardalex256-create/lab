import { useState } from "react";
import { apiUrl } from "../../api/baseUrl";

interface Props {
  onBack: () => void;
}

function PasswordStrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const strength = checks.filter(Boolean).length;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "bg-red-500", "bg-amber-500", "bg-teal-500", "bg-emerald-500"];

  return (
    <div className="mt-2">
      <div className="flex gap-1 h-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`flex-1 rounded-full transition-colors duration-300 ${i <= strength ? colors[strength] : "bg-slate-200"}`} />
        ))}
      </div>
      <p className={`text-xs mt-1 font-medium ${strength >= 3 ? "text-emerald-600" : strength >= 2 ? "text-amber-600" : "text-red-500"}`}>
        {strength > 0 ? labels[strength] : ""}
      </p>
    </div>
  );
}

// ── FORGOT PASSWORD PAGE ──────────────────────────────────────────────────────
export function ForgotPasswordPage({ onBack }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setSent(true);
      } else {
        setError(json.error ?? "Something went wrong");
      }
    } catch {
      setError("Network error — please try again");
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-10 max-w-md w-full text-center text-white shadow-2xl">
          <div className="text-6xl mb-6">✉️</div>
          <h2 className="text-2xl font-bold mb-3">Check your inbox</h2>
          <p className="text-white/70 leading-relaxed mb-8">
            If <strong>{email}</strong> has an account, you'll receive a password reset link shortly.
            The link expires in <strong>1 hour</strong>.
          </p>
          <button onClick={onBack}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl font-semibold transition-all">
            ← Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-10 max-w-md w-full shadow-2xl">
        <button onClick={onBack} className="text-white/60 hover:text-white text-sm mb-6 flex items-center gap-2 transition-colors">
          ← Back to Sign In
        </button>
        <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
        <p className="text-white/60 mb-8 text-sm">Enter your email address and we'll send you a reset link.</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              placeholder="you@school.edu"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-200 text-sm">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-base shadow-lg transition-all">
            {loading ? "Sending…" : "Send Reset Link"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── RESET PASSWORD PAGE ───────────────────────────────────────────────────────
export function ResetPasswordPage({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass) { setError("Enter a new password"); return; }
    if (newPass !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: newPass, confirmPassword: confirm }),
      });
      const json = await res.json();
      if (json.success) {
        onSuccess();
      } else {
        setError(json.error ?? "Invalid or expired link");
      }
    } catch {
      setError("Network error — please try again");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-10 max-w-md w-full shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">Set New Password</h1>
        <p className="text-white/60 mb-8 text-sm">Choose a strong password for your account.</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 pr-12"
                autoFocus
              />
              <button type="button" onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 text-sm">
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
            <PasswordStrengthBar password={newPass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Confirm Password</label>
            <input
              type={showPass ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-200 text-sm">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-base shadow-lg transition-all">
            {loading ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
