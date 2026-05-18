import { useMemo, useState } from "react";
import type { FormEvent } from "react";

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export type RegisterPayload = {
  name: string;
  email: string;
  phoneNumber: string;
  gender: string;
  dateOfBirth: string;
  addressLine: string;
  password: string;
  confirmPassword: string;
};

type RegisterPageProps = {
  loading: boolean;
  error: string | null;
  onBackToLogin: () => void;
  onRegister: (payload: RegisterPayload) => void | Promise<void>;
};

function PasswordRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className={`rounded-lg px-3 py-2 text-xs font-bold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
      {ok ? "OK" : "Need"} - {label}
    </p>
  );
}

export function RegisterPage({ loading, error, onBackToLogin, onRegister }: RegisterPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const checks = useMemo(
    () => ({
      minLength: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
      matches: password.length > 0 && password === confirmPassword,
      isStrong: STRONG_PASSWORD_REGEX.test(password),
    }),
    [password, confirmPassword],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onRegister({
      name,
      email,
      phoneNumber,
      gender,
      dateOfBirth,
      addressLine,
      password,
      confirmPassword,
    });
  }

  return (
    <div className="neo-app-bg flex min-h-screen items-center justify-center px-6 py-8">
      <div className="neo-card w-full max-w-2xl px-8 py-8 sm:px-10">
        <h1 className="text-center text-3xl font-bold text-[#2d3436]">New User Registration</h1>
        <p className="mt-2 text-center text-sm text-[#636e72]">
          Complete your biodata. Your account will appear in the users list and await admin role assignment.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              placeholder="Full name"
              className="neo-inset h-11 rounded-xl px-4 text-sm outline-none"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              disabled={loading}
              placeholder="Email"
              className="neo-inset h-11 rounded-xl px-4 text-sm outline-none"
            />
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={loading}
              placeholder="Phone number"
              className="neo-inset h-11 rounded-xl px-4 text-sm outline-none"
            />
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              disabled={loading}
              className="neo-inset h-11 rounded-xl px-4 text-sm outline-none"
            >
              <option value="">Gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              disabled={loading}
              className="neo-inset h-11 rounded-xl px-4 text-sm outline-none"
            />
            <input
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              disabled={loading}
              placeholder="Address"
              className="neo-inset h-11 rounded-xl px-4 text-sm outline-none"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="Password"
              className="neo-inset h-11 rounded-xl px-4 text-sm outline-none"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              placeholder="Confirm password"
              className="neo-inset h-11 rounded-xl px-4 text-sm outline-none"
            />
          </div>

          {password.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <PasswordRule ok={checks.minLength} label="At least 8 characters" />
              <PasswordRule ok={checks.uppercase} label="At least one uppercase letter" />
              <PasswordRule ok={checks.lowercase} label="At least one lowercase letter" />
              <PasswordRule ok={checks.number} label="At least one number" />
              <PasswordRule ok={checks.symbol} label="At least one symbol" />
              <PasswordRule ok={checks.matches} label="Password confirmation matches" />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="submit"
              disabled={loading || !checks.isStrong || !checks.matches}
              className="h-12 rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#1a365d] text-sm font-bold text-white disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Create Account"}
            </button>
            <button
              type="button"
              onClick={onBackToLogin}
              disabled={loading}
              className="h-12 rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-700 disabled:opacity-60"
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
