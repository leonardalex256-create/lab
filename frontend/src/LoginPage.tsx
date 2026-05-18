import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";

type LoginPageProps = {
  onLogin: (opts: { rememberEmail: boolean }) => void | Promise<void>;
  loading: boolean;
  error: string | null;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  /** Initial checked state for “Remember email” (e.g. from saved preference). */
  defaultRememberEmail: boolean;
  onForgotPassword: () => void;
  successBanner: string | null;
  onDismissSuccessBanner: () => void;
  onRegister: () => void;
  /** After password login, when 2FA is required. */
  twoFactorChallenge?: { maskedEmail: string } | null;
  onVerifyTwoFactor?: (otp: string) => void | Promise<void>;
  onCancelTwoFactor?: () => void;
};

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
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 11V8a4 4 0 018 0v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
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
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="1.6"
      />
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

function SocialFacebook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function SocialTwitter({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function SocialLinkedIn({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const sliderImages = [
  "/login-slide-1.jpg",
  "/login-slide-2.jpg",
  "/login-slide-3.jpg",
  "/login-slide-4.jpg",
];

export function LoginPage({
  onLogin,
  loading,
  error,
  email,
  setEmail,
  password,
  setPassword,
  defaultRememberEmail,
  onForgotPassword,
  successBanner,
  onDismissSuccessBanner,
  onRegister,
  twoFactorChallenge,
  onVerifyTwoFactor,
  onCancelTwoFactor,
}: LoginPageProps) {
  const emailId = useId();
  const passwordId = useId();
  const rememberId = useId();
  const otpId = useId();
  const [rememberEmail, setRememberEmail] = useState(defaultRememberEmail);
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");

  useEffect(() => {
    setRememberEmail(defaultRememberEmail);
  }, [defaultRememberEmail]);
  const [shake, setShake] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderImages.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);
  const prevError = useRef<string | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      await onLogin({ rememberEmail });
    },
    [onLogin, rememberEmail],
  );

  const handle2faSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!onVerifyTwoFactor) return;
      await onVerifyTwoFactor(otp.replace(/\D/g, "").slice(0, 6));
    },
    [onVerifyTwoFactor, otp],
  );

  useEffect(() => {
    if (error && error !== prevError.current) {
      setShake(true);
      const t = window.setTimeout(() => setShake(false), 450);
      prevError.current = error;
      return () => window.clearTimeout(t);
    }
    prevError.current = error;
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f0e6] font-sans antialiased text-[#2d3436] lg:flex-row">
      {/* SVG clip definition for wave edge (desktop — see .login-hero-wave in index.css) */}
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

      {/* Left — photo + teal overlay + wave clip on large screens */}
      <div
        className="login-hero-wave relative h-[220px] w-full shrink-0 overflow-hidden rounded-b-[2.5rem] sm:h-[280px] lg:h-auto lg:min-h-screen lg:w-[46%] lg:rounded-none bg-[#e8e4dc]"
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
            Queens Nursery and Primary School, Bunamwaya
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/95">
            Staff portal — secure access to records, schedules, and school
            operations.
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div
        className={`neo-app-bg flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 xl:px-20 ${shake ? "animate-login-shake" : ""}`}
      >
        <div className="neo-card mx-auto w-full max-w-md px-8 py-9 sm:px-10 sm:py-10">
          <div className="mb-3 flex justify-center">
            <img
              src="/school-icon.png"
              alt="School badge"
              className="h-16 w-16 rounded-full border border-[#d9d0c4] object-contain shadow-sm"
            />
          </div>
          <h1 className="text-center text-3xl font-bold text-[#2d3436]">
            {twoFactorChallenge ? "Verify it’s you" : "Welcome"}
          </h1>
          <p className="mt-1 text-center text-sm font-medium text-[#636e72]">
            Queens Nursery and Primary School, Bunamwaya
          </p>
          <p className="mt-2 text-center text-sm text-[#636e72]/85">
            {twoFactorChallenge
              ? "Enter the 6-digit code we sent to your email."
              : "Log in to your account to continue"}
          </p>

          {successBanner ? (
            <div
              className="mt-6 flex items-start justify-between gap-2 rounded-xl border border-[#1a365d]/20 bg-[#f0f4f8] px-3 py-2.5 text-sm text-[#2d3436]"
              role="status"
            >
              <span>{successBanner}</span>
              <button
                type="button"
                onClick={onDismissSuccessBanner}
                className="shrink-0 rounded-lg px-1.5 text-[#1a365d] hover:underline"
                aria-label="Dismiss"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {twoFactorChallenge ? (
            <form className="mt-10 space-y-5" onSubmit={handle2faSubmit} noValidate>
              <p className="rounded-xl border border-[#ff7a00]/30 bg-[#fff8f3] px-3 py-2 text-center text-xs font-medium text-[#2d3436]">
                Code sent to{" "}
                <span className="font-semibold text-[#ff7a00]">
                  {twoFactorChallenge.maskedEmail}
                </span>
              </p>
              <div>
                <label htmlFor={otpId} className="sr-only">
                  Verification code
                </label>
                <div className="neo-inset flex h-12 items-center gap-3 px-4 transition-shadow focus-within:ring-2 focus-within:ring-[#ff7a00]/50">
                  <LockIcon className="shrink-0 text-[#636e72]" />
                  <input
                    id={otpId}
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={loading}
                    className="min-w-0 flex-1 bg-transparent text-center text-lg font-semibold tracking-[0.25em] text-[#2d3436] outline-none placeholder:text-[#636e72]/50 placeholder:tracking-normal disabled:opacity-60"
                  />
                </div>
              </div>
              {error ? (
                <div
                  className="rounded-2xl border border-[#f0c4c0]/80 bg-gradient-to-br from-[#fce8e5] to-[#f7d1cd]/50 px-3 py-2.5 text-center text-sm font-medium text-[#2d3436]"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="h-12 w-full rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#1a365d] hover:from-[#ff9f43] hover:to-[#ff7a00] text-[15px] font-bold text-white shadow-[4px_4px_12px_rgba(26,54,93,0.3),-2px_-2px_8px_rgba(255,255,255,0.85)] hover:shadow-[4px_4px_12px_rgba(255,122,0,0.3),-2px_-2px_8px_rgba(255,255,255,0.85)] transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:from-[#1e3a8a] disabled:hover:to-[#1a365d]"
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                    Verifying…
                  </span>
                ) : (
                  "Continue"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtp("");
                  onCancelTwoFactor?.();
                }}
                disabled={loading}
                className="w-full text-center text-xs font-semibold text-[#ff7a00] transition hover:text-[#1a365d] hover:underline disabled:opacity-50"
              >
                Use a different account
              </button>
            </form>
          ) : (
          <form className="mt-10 space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor={emailId} className="sr-only">
                Email
              </label>
              <div className="neo-inset flex h-12 items-center gap-2 px-4 transition-shadow focus-within:ring-2 focus-within:ring-[#ff7a00]/50">
                <UserIcon className="shrink-0 text-[#636e72]" />
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  placeholder="you@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  disabled={loading}
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-[#2d3436] outline-none placeholder:text-[#636e72]/70 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label htmlFor={passwordId} className="sr-only">
                Password
              </label>
              <div className="neo-inset flex h-12 items-center gap-2 px-4 transition-shadow focus-within:ring-2 focus-within:ring-[#ff7a00]/50">
                <LockIcon className="shrink-0 text-[#636e72]" />
                <input
                  id={passwordId}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-[#2d3436] outline-none placeholder:text-[#636e72]/70 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#636e72] transition-colors hover:bg-[#ff7a00]/10 hover:text-[#ff7a00] disabled:opacity-50"
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <label
                  className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#636e72]"
                  title="Saves your email on this device and keeps you signed in for 30 days instead of 7."
                >
                  <input
                    id={rememberId}
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(e) => setRememberEmail(e.target.checked)}
                    disabled={loading}
                    className="size-4 rounded border-[#1a365d]/30 bg-[#faf7f0] text-[#ff7a00] focus:ring-[#ff7a00]/50"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-[#636e72] transition hover:text-[#ff7a00] hover:underline"
                  onClick={onForgotPassword}
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {error ? (
              <div
                className="rounded-2xl border border-[#f0c4c0]/80 bg-gradient-to-br from-[#fce8e5] to-[#f7d1cd]/50 px-3 py-2.5 text-center text-sm font-medium text-[#2d3436]"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#1a365d] hover:from-[#ff9f43] hover:to-[#ff7a00] text-[15px] font-bold text-white shadow-[4px_4px_12px_rgba(26,54,93,0.3),-2px_-2px_8px_rgba(255,255,255,0.85)] hover:shadow-[4px_4px_12px_rgba(255,122,0,0.3),-2px_-2px_8px_rgba(255,255,255,0.85)] transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:from-[#1e3a8a] disabled:hover:to-[#1a365d]"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                  Logging in…
                </span>
              ) : (
                "Log In"
              )}
            </button>
            <button
              type="button"
              onClick={onRegister}
              disabled={loading}
              className="h-12 w-full rounded-full bg-gradient-to-br from-[#ff9f43] to-[#ff7a00] text-[15px] font-bold text-white shadow-[4px_4px_12px_rgba(255,122,0,0.3),-2px_-2px_8px_rgba(255,255,255,0.85)] transition-all duration-300 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sign Up
            </button>
          </form>
          )}

          <div className="mt-10 flex justify-center gap-3">
            <a
              href="#"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#faf7f0] to-[#ebe4d9] text-[#636e72] shadow-[3px_3px_8px_rgba(200,188,170,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] transition hover:text-[#1a365d]"
              aria-label="Facebook"
              onClick={(e) => e.preventDefault()}
            >
              <SocialFacebook className="h-4 w-4" />
            </a>
            <a
              href="#"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#faf7f0] to-[#ebe4d9] text-[#636e72] shadow-[3px_3px_8px_rgba(200,188,170,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] transition hover:text-[#1a365d]"
              aria-label="Twitter"
              onClick={(e) => e.preventDefault()}
            >
              <SocialTwitter className="h-4 w-4" />
            </a>
            <a
              href="#"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#faf7f0] to-[#ebe4d9] text-[#636e72] shadow-[3px_3px_8px_rgba(200,188,170,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] transition hover:text-[#1a365d]"
              aria-label="LinkedIn"
              onClick={(e) => e.preventDefault()}
            >
              <SocialLinkedIn className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
