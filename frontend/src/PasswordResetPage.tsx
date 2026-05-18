import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { apiUrl } from "./api/baseUrl";

type PasswordResetPageProps = {
  onBack: () => void;
  onSuccess: () => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10.4 10.4 0 0112 5c4 0 7.5 2.5 10 7-1 1.7-2.1 3.1-3.4 4.2M6.4 6.4C4.6 7.9 3 9.8 2 12c2.5 4.5 6 7 10 7 1.2 0 2.4-.2 3.5-.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8.6 8.6C7.1 9.8 5.8 11.3 5 13c2.1 3.8 5.6 6 7 6 1 0 2.1-.4 3.2-1.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const sliderImages = [
  "/login-slide-1.jpg",
  "/login-slide-2.jpg",
  "/login-slide-3.jpg",
  "/login-slide-4.jpg",
];

export function PasswordResetPage({ onBack, onSuccess }: PasswordResetPageProps) {
  const emailId = useId();
  const otpId = useId();
  const passId = useId();
  const confirmId = useId();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastAutoVerifiedOtp = useRef<string | null>(null);
  const [shake, setShake] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const prevError = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderImages.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (error && error !== prevError.current) {
      setShake(true);
      const t = window.setTimeout(() => setShake(false), 450);
      prevError.current = error;
      return () => window.clearTimeout(t);
    }
    prevError.current = error;
  }, [error]);

  const sendCode = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setInfo(null);
      const trimmed = email.trim();
      if (!trimmed) {
        setError("Enter your email address.");
        return;
      }
      if (!EMAIL_RE.test(trimmed)) {
        setError("Please enter a valid email address.");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(apiUrl("/api/auth/request-password-reset"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        });
        const data = await readJson<{ message?: string; error?: string }>(res);
        if (res.status === 404) {
          setError(
            data?.error ?? "No account is registered with this email address.",
          );
          return;
        }
        if (res.status === 400) {
          setError(data?.error ?? "Check the email address and try again.");
          return;
        }
        if (!res.ok) {
          if (res.status === 503 || data?.error === "Database unavailable") {
            setError(
              "The service is temporarily unavailable. Please try again later.",
            );
            return;
          }
          setError(data?.error ?? "Could not send code. Try again.");
          return;
        }
        setInfo(
          data?.message ?? "Verification code sent. Check your email.",
        );
        lastAutoVerifiedOtp.current = null;
        setStep(2);
      } catch {
        setError(
          "We couldn’t connect to the server. Check your internet connection and try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [email],
  );

  const submitVerify = useCallback(async (digits: string) => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address.");
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (digits.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/verify-password-reset-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, otp: digits }),
      });
      const data = await readJson<{ resetToken?: string; error?: string }>(
        res,
      );
      if (res.status === 400) {
        setError(data?.error ?? "Invalid or expired verification code.");
        return;
      }
      if (res.status === 503 || data?.error === "Database unavailable") {
        setError(
          "The service is temporarily unavailable. Please try again later.",
        );
        return;
      }
      if (!res.ok || !data?.resetToken) {
        setError(data?.error ?? "Could not verify code. Try again.");
        return;
      }
      setResetToken(data.resetToken);
      setInfo("Code confirmed. Choose your new password below.");
      setStep(3);
    } catch {
      setError(
        "We couldn’t connect to the server. Check your internet connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (step !== 2) return;
    const digits = otp.replace(/\D/g, "");
    if (digits.length < 6) {
      lastAutoVerifiedOtp.current = null;
      return;
    }
    if (loading) return;
    if (lastAutoVerifiedOtp.current === digits) return;
    lastAutoVerifiedOtp.current = digits;
    void submitVerify(digits);
  }, [step, otp, loading, submitVerify]);

  const verifyCode = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void submitVerify(otp.replace(/\D/g, ""));
    },
    [otp, submitVerify],
  );

  const resetPassword = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!resetToken) {
        setError("Your reset session expired. Start again from your email.");
        return;
      }
      if (newPassword.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(apiUrl("/api/auth/reset-password-with-token"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resetToken, newPassword }),
        });
        const data = await readJson<{ message?: string; error?: string }>(res);
        if (res.status === 400) {
          setError(data?.error ?? "Could not reset password.");
          return;
        }
        if (!res.ok) {
          if (res.status === 503 || data?.error === "Database unavailable") {
            setError(
              "The service is temporarily unavailable. Please try again later.",
            );
            return;
          }
          setError(data?.error ?? "Could not reset password.");
          return;
        }
        onSuccess();
      } catch {
        setError(
          "We couldn’t connect to the server. Check your internet connection and try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [resetToken, newPassword, confirmPassword, onSuccess],
  );

  const goDifferentEmail = useCallback(() => {
    lastAutoVerifiedOtp.current = null;
    setStep(1);
    setOtp("");
    setResetToken(null);
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setInfo(null);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f0e6] font-sans antialiased text-[#2d3436] lg:flex-row">
      <svg
        className="pointer-events-none fixed h-0 w-0 overflow-hidden"
        aria-hidden
        focusable="false"
      >
        <defs>
          <clipPath id="queensLoginWaveClip" clipPathUnits="objectBoundingBox">
            <path d="M0,0 H0.88 C0.96,0.18 0.98,0.38 0.9,0.5 C0.98,0.62 0.96,0.82 0.88,1 H0 V0 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Left — Hero section (matches Login) */}
      <div
        className="login-hero-wave relative h-[200px] w-full shrink-0 overflow-hidden rounded-b-[2.5rem] sm:h-[240px] lg:h-auto lg:min-h-screen lg:w-[46%] lg:rounded-none bg-[#e8e4dc]"
      >
        {sliderImages.map((src, index) => {
          const isActive = index === currentSlide;
          return (
            <img
              key={index}
              src={src}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-[1500ms] ease-in-out ${
                isActive ? "opacity-100 scale-100" : "opacity-0 scale-110"
              }`}
            />
          );
        })}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#1a365d]/85 via-[#1e3a8a]/60 to-[#ff7a00]/50"
          aria-hidden
        />
        <div className="relative z-10 hidden h-full min-h-[220px] flex-col justify-end p-8 text-[#fffcf7] lg:flex lg:justify-center lg:p-14">
          <p className="text-3xl font-bold tracking-tight drop-shadow-sm">
            Queens Nursery and Primary School
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/95">
            Security first — follow the steps to safely regain access to your staff account.
          </p>
        </div>
      </div>

      {/* Right — form section */}
      <div
        className={`neo-app-bg flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 xl:px-20 ${shake ? "animate-login-shake" : ""}`}
      >
        <div className="neo-card relative mx-auto w-full max-w-md px-8 py-9 sm:px-10 sm:py-10">
          <button
            type="button"
            onClick={onBack}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#f5a8a0] to-[#e85d4c] text-white shadow-[2px_3px_8px_rgba(200,90,80,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:brightness-110 active:scale-95"
            aria-label="Go back"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="mb-4 flex justify-center lg:justify-start">
            <img
              src="/school-icon.png"
              alt="School badge"
              className="h-14 w-14 rounded-full border border-[#d9d0c4] object-contain shadow-sm"
            />
          </div>

          <h1 className="text-2xl font-bold text-[#2d3436]">
            {step === 1 ? "Reset Password" : step === 2 ? "Verify Code" : "Create New Password"}
          </h1>
          <p className="mt-2 text-sm text-[#636e72] leading-relaxed">
            {step === 1
              ? "Enter your registered email address and we'll send you a verification code."
              : step === 2
                ? "We've sent a 6-digit code to your email. Enter it below to continue."
                : "Your identity is verified. Please choose a strong new password."}
          </p>

          {step === 1 ? (
            <form className="mt-8 space-y-5" onSubmit={sendCode} noValidate>
              <div>
                <label htmlFor={emailId} className="mb-1.5 block text-xs font-semibold text-[#636e72] ml-1">
                  Email Address
                </label>
                <div className="neo-inset flex h-12 items-center gap-3 px-4 transition-shadow focus-within:ring-2 focus-within:ring-[#ff7a00]/50">
                  <UserIcon className="shrink-0 text-[#636e72]" />
                  <input
                    id={emailId}
                    type="email"
                    autoComplete="email"
                    placeholder="you@school.edu"
                    value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                    disabled={loading}
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-[#2d3436] outline-none placeholder:text-[#636e72]/70 disabled:opacity-60"
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-[#f0c4c0]/80 bg-gradient-to-br from-[#fce8e5] to-[#f7d1cd]/50 px-3 py-2.5 text-center text-sm font-medium text-[#2d3436]" role="alert">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#1a365d] hover:from-[#ff9f43] hover:to-[#ff7a00] text-[15px] font-bold text-white shadow-[4px_4px_12px_rgba(26,54,93,0.3),-2px_-2px_8px_rgba(255,255,255,0.85)] hover:shadow-[4px_4px_12px_rgba(255,122,0,0.3),-2px_-2px_8px_rgba(255,255,255,0.85)] transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                    Sending…
                  </span>
                ) : (
                  "Send Code"
                )}
              </button>
            </form>
          ) : step === 2 ? (
            <form className="mt-8 space-y-5" onSubmit={verifyCode} noValidate>
              <div className="rounded-xl border border-[#ebe4d9] bg-[#faf7f0] px-4 py-3 text-sm text-[#2d3436] shadow-sm">
                <span className="font-semibold text-[#636e72] block mb-0.5">Sending code to:</span>
                <span className="font-medium text-[#1a365d]">{email.trim()}</span>
              </div>

              <div>
                <label htmlFor={otpId} className="mb-1.5 block text-xs font-semibold text-[#636e72] ml-1">
                  6-Digit Verification Code
                </label>
                <div className="neo-inset flex h-12 items-center px-4 transition-shadow focus-within:ring-2 focus-within:ring-[#ff7a00]/50">
                  <LockIcon className="shrink-0 text-[#636e72] mr-3" />
                  <input
                    id={otpId}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={loading}
                    className="min-w-0 flex-1 bg-transparent text-center text-lg font-bold tracking-[0.4em] text-[#2d3436] outline-none placeholder:text-[#636e72]/50 placeholder:tracking-normal disabled:opacity-60"
                  />
                </div>
              </div>

              {info ? (
                <div className="rounded-xl bg-[#e8f2ec] px-3 py-2 text-sm text-[#2d3436] border border-[#d1e7dd]">
                  {info}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-[#f0c4c0]/80 bg-gradient-to-br from-[#fce8e5] to-[#f7d1cd]/50 px-3 py-2.5 text-center text-sm font-medium text-[#2d3436]" role="alert">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="h-12 w-full rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#1a365d] hover:from-[#ff9f43] hover:to-[#ff7a00] text-[15px] font-bold text-white shadow-[4px_4px_12px_rgba(26,54,93,0.3),-2px_-2px_8px_rgba(255,255,255,0.85)] hover:shadow-[4px_4px_12px_rgba(255,122,0,0.3),-2px_-2px_8px_rgba(255,255,255,0.85)] transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                    Verifying…
                  </span>
                ) : (
                  "Verify & Continue"
                )}
              </button>

              <button
                type="button"
                onClick={goDifferentEmail}
                className="w-full text-center text-xs font-semibold text-[#ff7a00] transition hover:text-[#1a365d] hover:underline disabled:opacity-50"
              >
                Use a different email address
              </button>
            </form>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={resetPassword} noValidate>
              <div>
                <label htmlFor={passId} className="mb-1.5 block text-xs font-semibold text-[#636e72] ml-1">
                  New Password
                </label>
                <div className="neo-inset flex h-12 items-center gap-3 px-4 transition-shadow focus-within:ring-2 focus-within:ring-[#ff7a00]/50">
                  <LockIcon className="shrink-0 text-[#636e72]" />
                  <input
                    id={passId}
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-[#2d3436] outline-none placeholder:text-[#636e72]/70 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#636e72] transition-colors hover:bg-[#ff7a00]/10 hover:text-[#ff7a00]"
                  >
                    {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor={confirmId} className="mb-1.5 block text-xs font-semibold text-[#636e72] ml-1">
                  Confirm Password
                </label>
                <div className="neo-inset flex h-12 items-center gap-3 px-4 transition-shadow focus-within:ring-2 focus-within:ring-[#ff7a00]/50">
                  <LockIcon className="shrink-0 text-[#636e72]" />
                  <input
                    id={confirmId}
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-[#2d3436] outline-none placeholder:text-[#636e72]/70 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#636e72] transition-colors hover:bg-[#ff7a00]/10 hover:text-[#ff7a00]"
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-[#f0c4c0]/80 bg-gradient-to-br from-[#fce8e5] to-[#f7d1cd]/50 px-3 py-2.5 text-center text-sm font-medium text-[#2d3436]" role="alert">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#1a365d] hover:from-[#ff9f43] hover:to-[#ff7a00] text-[15px] font-bold text-white shadow-[4px_4px_12px_rgba(26,54,93,0.3),-2px_-2px_8px_rgba(255,255,255,0.85)] hover:shadow-[4px_4px_12px_rgba(255,122,0,0.3),-2px_-2px_8px_rgba(255,255,255,0.85)] transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                    Updating…
                  </span>
                ) : (
                  "Update Password"
                )}
              </button>
            </form>
          )}

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-semibold text-[#636e72] transition hover:text-[#1a365d] hover:underline"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
