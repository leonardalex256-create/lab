import { useCallback, useEffect, useState } from "react";
import { apiUrl, authHeaders } from "./api/baseUrl";
import { LoginPage } from "./LoginPage";
import { RegisterPage, type RegisterPayload } from "./RegisterPage";
import { PasswordResetPage } from "./PasswordResetPage";
import { Dashboard } from "./dashboards/Dashboard";
import { clearTermContextStorage } from "./context/termContextStorage";
import { TermProvider } from "./context/TermContext";
import { SchoolConfigProvider } from "./context/SchoolConfigContext";
import "./App.css";

const REMEMBER_KEY = "junior_school_remembered_email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type MeResponse = {
  user: {
    sub: string;
    name?: string;
    role: string;
    email: string;
    twoFactorEnabled?: boolean;
    permissions?: string[];
  };
};

function maskEmailFor2fa(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return email;
  const vis = local.slice(0, Math.min(2, local.length)) + "•••";
  return `${vis}@${domain}`;
}

type ReadJsonOk<T> = { ok: true; data: T };
type ReadJsonFail = { ok: false; emptyBody: boolean };

async function readJsonBody<T>(
  res: Response,
): Promise<ReadJsonOk<T> | ReadJsonFail> {
  const text = await res.text();
  if (!text.trim()) return { ok: false, emptyBody: true };
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, emptyBody: false };
  }
}

/** When the body is empty or not JSON (e.g. Vite 502 HTML while the API is down). */
function describeUnparsedApiResponse(res: Response, emptyBody: boolean): string {
  const s = res.status;
  if (s === 502 || s === 504) {
    return "Could not reach the API (bad gateway). Start the backend: npm run dev:backend from the repository root. If it stops immediately, start MySQL and check backend/.env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).";
  }
  if (s === 503) {
    return "The service is temporarily unavailable. Start MySQL and the backend, then try again.";
  }
  if (emptyBody) {
    return "The server returned an empty response. Start the backend (npm run dev:backend) and ensure MySQL is running.";
  }
  return "The server returned a non-JSON response (often an HTML error page). Confirm the backend is running and that Vite proxies /api to it (see frontend/vite.config.ts).";
}


export default function App() {
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token"),
  );
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authView, setAuthView] = useState<"login" | "reset" | "register">("login");
  const [loginBanner, setLoginBanner] = useState<string | null>(null);
  const [pending2FA, setPending2FA] = useState<{
    token: string;
    maskedEmail: string;
    rememberEmail: boolean;
  } | null>(null);

  const refreshProfile = useCallback(async () => {
    const t = localStorage.getItem("token");
    if (!t) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await fetch(apiUrl("/api/auth/me"), {
        headers: authHeaders(),
      });
      const parsed = await readJsonBody<MeResponse & { error?: string }>(res);
      if (!parsed.ok) {
        setProfile(null);
        setProfileError(
          describeUnparsedApiResponse(res, parsed.emptyBody),
        );
        return;
      }
      const data = parsed.data;
      if (!res.ok) {
        setProfile(null);
        if (res.status === 401) {
          localStorage.removeItem("token");
          setToken(null);
          setProfileError(null);
          return;
        }
        if (res.status === 503 && data.error === "Database unavailable") {
          setProfileError(
            "Could not reach the database. Start MySQL, confirm backend/.env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME), then run: cd backend && npm run db:sync — or from the repo root: npm run db:sync",
          );
          return;
        }
        setProfileError(
          data.error ?? "Something went wrong. Please try again.",
        );
        return;
      }
      setProfile(data);
    } catch {
      setProfile(null);
      setProfileError(
        "We couldn’t connect to the server. Check your internet connection and try again.",
      );
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      void refreshProfile();
    } else {
      setProfile(null);
      setProfileError(null);
    }
  }, [token, refreshProfile]);

  const login = useCallback(
    async (opts: { rememberEmail: boolean }) => {
      setError(null);
      const trimmed = email.trim();
      if (!trimmed) {
        setError("Please enter your email address.");
        return;
      }
      if (!EMAIL_RE.test(trimmed)) {
        setError("Please enter a valid email address.");
        return;
      }
      if (!password) {
        setError("Please enter your password.");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(apiUrl("/api/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmed,
            password,
            rememberMe: opts.rememberEmail,
          }),
        });

        const parsed = await readJsonBody<{
          token?: string;
          requiresTwoFactor?: boolean;
          twoFactorToken?: string;
          error?: string;
        }>(res);
        if (!parsed.ok) {

          if (res.status === 401) {
            setError("Invalid email or password.");
            return;
          }
          setError(describeUnparsedApiResponse(res, parsed.emptyBody));
          return;
        }
        const data = parsed.data;
        if (!res.ok) {

          if (res.status === 503 && data.error === "Database unavailable") {
            setError(
              "The service is temporarily unavailable. Please try again later.",
            );
            return;
          }
          if (res.status === 401) {
            setError("Invalid email or password.");
            return;
          }
          setError(data.error ?? "Sign-in failed. Please try again.");
          return;
        }
        if (data.requiresTwoFactor && data.twoFactorToken) {
          setPending2FA({
            token: data.twoFactorToken,
            maskedEmail: maskEmailFor2fa(trimmed),
            rememberEmail: opts.rememberEmail,
          });
          setLoginBanner(null);
          return;
        }
        if (!data.token) {
          setError("Sign-in failed. Please try again.");
          return;
        }

        localStorage.setItem("token", data.token);
        if (opts.rememberEmail) {
          localStorage.setItem(REMEMBER_KEY, trimmed);
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
        setToken(data.token);
        setPending2FA(null);
        setLoginBanner(null);
      } catch (err) {

        setError(
          "We couldn’t connect to the server. Check your internet connection and try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [email, password],
  );

  const verifyTwoFactor = useCallback(
    async (otp: string) => {
      if (!pending2FA) return;
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(apiUrl("/api/auth/verify-login-2fa"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            twoFactorToken: pending2FA.token,
            otp,
          }),
        });
        const parsed = await readJsonBody<{ token?: string; error?: string }>(
          res,
        );
        if (!parsed.ok) {
          setError(describeUnparsedApiResponse(res, parsed.emptyBody));
          return;
        }
        const data = parsed.data;
        if (!res.ok) {
          if (res.status === 503 && data.error === "Database unavailable") {
            setError(
              "The service is temporarily unavailable. Please try again later.",
            );
            return;
          }
          setError(data.error ?? "Verification failed. Try again.");
          return;
        }
        if (!data.token) {
          setError("Verification failed. Please try again.");
          return;
        }
        localStorage.setItem("token", data.token);
        if (pending2FA.rememberEmail) {
          localStorage.setItem(REMEMBER_KEY, email.trim());
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
        setToken(data.token);
        setPending2FA(null);
        setPassword("");
        setLoginBanner(null);
      } catch {
        setError(
          "We couldn’t connect to the server. Check your internet connection and try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [pending2FA, email],
  );

  const cancelTwoFactor = useCallback(() => {
    setPending2FA(null);
    setPassword("");
    setError(null);
  }, []);

  const logout = useCallback(() => {
    clearTermContextStorage(profile?.user?.sub);
    localStorage.removeItem("token");
    setToken(null);
    setProfile(null);
    setProfileError(null);
    setError(null);
    setPassword("");
    setPending2FA(null);
  }, [profile?.user?.sub]);

  const register = useCallback(async (payload: RegisterPayload) => {
    setError(null);
    if (!payload.name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!EMAIL_RE.test(payload.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!payload.phoneNumber.trim()) {
      setError("Please enter your phone number.");
      return;
    }
    if (!payload.gender.trim()) {
      setError("Please select gender.");
      return;
    }
    if (!payload.dateOfBirth.trim()) {
      setError("Please select date of birth.");
      return;
    }
    if (!payload.addressLine.trim()) {
      setError("Please enter your address.");
      return;
    }
    if (!payload.password) {
      setError("Please enter a password.");
      return;
    }
    if (payload.password !== payload.confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const parsed = await readJsonBody<{ message?: string; error?: string }>(res);
      if (!parsed.ok) {
        setError(describeUnparsedApiResponse(res, parsed.emptyBody));
        return;
      }
      const data = parsed.data;
      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
        return;
      }
      setAuthView("login");
      setPassword("");
      setEmail(payload.email.trim());
      setLoginBanner(
        data.message ??
          "Registration submitted. Wait for admin role assignment before signing in.",
      );
    } catch {
      setError(
        "We couldn’t connect to the server. Check your internet connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  if (!token) {
    if (authView === "reset") {
      return (
        <PasswordResetPage
          onBack={() => {
            setAuthView("login");
            setError(null);
          }}
          onSuccess={() => {
            setAuthView("login");
            setPassword("");
            setLoginBanner("Password updated. Sign in with your new password.");
          }}
        />
      );
    }
    if (authView === "register") {
      return (
        <RegisterPage
          loading={loading}
          error={error}
          onRegister={register}
          onBackToLogin={() => {
            setAuthView("login");
            setError(null);
          }}
        />
      );
    }
    return (
      <LoginPage
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        onLogin={login}
        loading={loading}
        error={error}
        defaultRememberEmail={Boolean(localStorage.getItem(REMEMBER_KEY))}
        onForgotPassword={() => {
          setAuthView("reset");
          setError(null);
        }}
        onRegister={() => {
          setAuthView("register");
          setError(null);
          setLoginBanner(null);
        }}
        successBanner={loginBanner}
        onDismissSuccessBanner={() => setLoginBanner(null)}
        twoFactorChallenge={
          pending2FA ? { maskedEmail: pending2FA.maskedEmail } : null
        }
        onVerifyTwoFactor={verifyTwoFactor}
        onCancelTwoFactor={cancelTwoFactor}
      />
    );
  }

  return (
    <SchoolConfigProvider>
      <TermProvider userSub={profile?.user?.sub ?? null} userRole={profile?.user?.role ?? null}>
        <Dashboard
          user={profile?.user ?? null}
          profileLoading={profileLoading}
          profileError={profileError}
          onRetryProfile={refreshProfile}
          onLogout={logout}
          onAccountUpdated={refreshProfile}
        />
      </TermProvider>
    </SchoolConfigProvider>
  );
}
