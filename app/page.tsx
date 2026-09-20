"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthRole = "admin" | "client";

type AuthScreen =
  | "login"
  | "forgot"
  | "otp"
  | "reset"
  | "success";

type AuthUser = {
  id?: string;
  adminId?: string;
  clientId?: string;
  accountId?: string;
  username?: string;
  name?: string;
  fullName?: string;
  email?: string;
  companyName?: string;
  role?: AuthRole | string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  destinationMasked?: string;
  resetToken?: string;
  otpSession?: string;
  role?: AuthRole;
  user?: AuthUser;
  admin?: AuthUser;
  client?: AuthUser;
};

const AUTH_SESSION_KEY = "hcs-auth-session";

function passwordRules(password: string) {
  return {
    minLength: password.length >= 8,
    maxLength: password.length <= 128,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function FieldIcon({
  type,
}: {
  type:
    | "user"
    | "lock"
    | "mail"
    | "phone"
    | "shield";
}) {
  if (type === "user") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5.5 20c.8-3.2 3.1-5 6.5-5s5.7 1.8 6.5 5" />
      </svg>
    );
  }

  if (type === "lock") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7.7a4 4 0 0 1 8 0V10" />
      </svg>
    );
  }

  if (type === "mail") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5.5" width="16" height="13" rx="2" />
        <path d="m5.5 7 6.5 5 6.5-5" />
      </svg>
    );
  }

  if (type === "phone") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.5 4.5h2l1.2 4-2 1.7c1 2.1 2.4 3.3 4.6 4.4l1.7-2 4 1.2v2c0 1-.8 1.8-1.8 1.8C10.7 19.6 4.4 13.3 4.4 7.1c0-1.5 1.6-2.6 3.1-2.6Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 19 6v5.2c0 4.1-2.8 7.5-7 9.8-4.2-2.3-7-5.7-7-9.8V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function EyeIcon({
  hidden,
}: {
  hidden: boolean;
}) {
  return hidden ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3 21 21" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.3A10.7 10.7 0 0 1 12 5c5.3 0 8.9 4.6 9.8 7-.3.9-1.1 2.1-2.4 3.2" />
      <path d="M6.2 8C4.5 9.2 3.3 10.8 2.5 12c.9 2.4 4.5 7 9.5 7 1 0 2-.2 2.8-.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.7 12s3.3-6.5 9.3-6.5S21.3 12 21.3 12 18 18.5 12 18.5 2.7 12 2.7 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export default function Page() {
  const router = useRouter();

  const [role, setRole] =
    useState<AuthRole>("admin");

  const [screen, setScreen] =
    useState<AuthScreen>("login");

  const [identifier, setIdentifier] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [recoveryIdentifier, setRecoveryIdentifier] =
    useState("");

  const [otp, setOtp] =
    useState("");

  const [otpSession, setOtpSession] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [resetToken, setResetToken] =
    useState("");

  const [destinationMasked, setDestinationMasked] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [cooldown, setCooldown] =
    useState(0);

  const [showLoginPassword, setShowLoginPassword] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const rules = useMemo(
    () => passwordRules(newPassword),
    [newPassword],
  );

  useEffect(() => {
    let cancelled = false;

    async function restoreServerSession() {
      try {
        const response = await fetch(
          "/api/auth/me",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as ApiResponse;

        if (
          cancelled ||
          !data.success ||
          !data.role
        ) {
          return;
        }

        const user =
          data.user ??
          data.admin ??
          data.client;

        if (!user) {
          return;
        }

        saveAuthSession(
          data.role,
          user,
        );

        router.replace(
          data.role === "admin"
            ? "/admin"
            : "/client",
        );
      } catch {
        // No active server session.
      }
    }

    restoreServerSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer =
      window.setInterval(() => {
        setCooldown(
          (value) =>
            value > 0
              ? value - 1
              : 0,
        );
      }, 1000);

    return () =>
      window.clearInterval(timer);
  }, [cooldown]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function clearRecoveryData() {
    setRecoveryIdentifier("");
    setOtp("");
    setOtpSession("");
    setNewPassword("");
    setConfirmPassword("");
    setResetToken("");
    setDestinationMasked("");
    setCooldown(0);
  }

  function backToLogin() {
    clearMessages();
    clearRecoveryData();
    setIdentifier("");
    setPassword("");
    setRole("admin");
    setScreen("login");
  }

  function changeRole(
    nextRole: AuthRole,
  ) {
    setRole(nextRole);
    setIdentifier("");
    setPassword("");
    clearMessages();
  }

  function startForgotPassword() {
    clearMessages();
    clearRecoveryData();
    setRole("admin");
    setScreen("forgot");
  }

  function saveAuthSession(
    sessionRole: AuthRole,
    user: AuthUser,
  ) {
    if (typeof window === "undefined") {
      return;
    }

    const userId =
      user.id ??
      user.adminId ??
      user.clientId ??
      user.accountId ??
      "";

    const session = {
      authenticated: true,
      role: sessionRole,
      id: userId,
      adminId:
        user.adminId ?? undefined,
      clientId:
        user.clientId ?? undefined,
      accountId:
        user.accountId ??
        user.id ??
        undefined,
      username:
        user.username ?? "",
      name:
        user.name ??
        user.fullName ??
        user.companyName ??
        (sessionRole === "admin"
          ? "HCS Administrator"
          : "Client"),
      companyName:
        user.companyName ?? "",
      email:
        user.email ?? "",
      loggedInAt:
        new Date().toISOString(),
    };

    window.localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify(session),
    );
  }

  async function handleLogin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();

    const cleanIdentifier =
      identifier.trim();

    if (!cleanIdentifier) {
      setError(
        role === "admin"
          ? "Enter your Admin ID, username or email."
          : "Enter your username or email.",
      );
      return;
    }

    if (!password) {
      setError(
        "Enter your password.",
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/auth/login",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              role,
              identifier:
                cleanIdentifier,
              password,
            }),
          },
        );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        setError(
          data.message ??
            "Invalid credentials.",
        );
        return;
      }

      const user =
        data.user ??
        data.admin ??
        data.client;

      const authenticatedRole =
        data.role ?? role;

      if (!user) {
        setError(
          "Login succeeded but user session data was not returned.",
        );
        return;
      }

      if (
        authenticatedRole !==
          "admin" &&
        authenticatedRole !==
          "client"
      ) {
        setError(
          "Invalid authentication response.",
        );
        return;
      }

      saveAuthSession(
        authenticatedRole,
        user,
      );

      setIdentifier("");
      setPassword("");

      router.replace(
        authenticatedRole ===
          "admin"
          ? "/admin"
          : "/client",
      );
    } catch (loginError) {
      console.error(
        "HCS login error:",
        loginError,
      );

      setError(
        "Unable to connect to the authentication server.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendOtp(
    event?: FormEvent<HTMLFormElement>,
  ) {
    event?.preventDefault();

    clearMessages();

    const cleanIdentifier =
      recoveryIdentifier.trim();

    if (!cleanIdentifier) {
      setError(
        "Enter your registered email or mobile number.",
      );
      return;
    }

    if (cooldown > 0) {
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/admin/forgot-password/send-otp",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              identifier:
                cleanIdentifier,
            }),
          },
        );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        setError(
          data.message ??
            "OTP could not be sent.",
        );
        return;
      }

      if (!data.otpSession) {
        setError(
          "OTP service did not return a valid recovery session.",
        );
        return;
      }

      setDestinationMasked(
        data.destinationMasked ??
          "your registered contact",
      );

      setOtpSession(
        data.otpSession,
      );

      setSuccess(
        data.message ??
          "OTP sent successfully.",
      );

      setOtp("");
      setCooldown(60);
      setScreen("otp");
    } catch (sendOtpError) {
      console.error(
        "HCS send OTP error:",
        sendOtpError,
      );

      setError(
        "Forgot password service is not available.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();

    if (!otpSession) {
      setError(
        "OTP session is missing. Please request a new OTP.",
      );
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError(
        "Enter the 6-digit OTP.",
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/admin/forgot-password/verify-otp",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              identifier:
                recoveryIdentifier.trim(),
              otp,
              otpSession,
            }),
          },
        );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.resetToken
      ) {
        setError(
          data.message ??
            "Invalid or expired OTP.",
        );
        return;
      }

      setResetToken(
        data.resetToken,
      );

      setOtp("");

      setSuccess(
        "OTP verified successfully.",
      );

      setScreen("reset");
    } catch (verifyError) {
      console.error(
        "HCS verify OTP error:",
        verifyError,
      );

      setError(
        "OTP verification failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();

    if (!rules.minLength) {
      setError(
        "Password must contain at least 8 characters.",
      );
      return;
    }

    if (!rules.maxLength) {
      setError(
        "Password cannot exceed 128 characters.",
      );
      return;
    }

    if (!rules.uppercase) {
      setError(
        "Password must contain an uppercase letter.",
      );
      return;
    }

    if (!rules.number) {
      setError(
        "Password must contain a number.",
      );
      return;
    }

    if (!rules.special) {
      setError(
        "Password must contain a special character.",
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setError(
        "New password and confirmation do not match.",
      );
      return;
    }

    if (!resetToken) {
      setError(
        "Password recovery session has expired.",
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/admin/forgot-password/reset-password",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              identifier:
                recoveryIdentifier.trim(),
              resetToken,
              newPassword,
            }),
          },
        );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        setError(
          data.message ??
            "Password reset failed.",
        );
        return;
      }

      /*
       * Password has already been updated in MongoDB
       * by the server-side reset-password API.
       *
       * DO NOT save it to localStorage.
       */

      setSuccess(
        data.message ??
          "Password reset successfully.",
      );

      setNewPassword("");
      setConfirmPassword("");
      setResetToken("");
      setOtpSession("");
      setOtp("");
      setScreen("success");
    } catch (resetError) {
      console.error(
        "HCS reset password error:",
        resetError,
      );

      setError(
        "Password reset service is not available.",
      );
    } finally {
      setLoading(false);
    }
  }

  function PasswordButton({
    visible,
    onClick,
  }: {
    visible: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        className="hcs-eye-button"
        onClick={onClick}
        aria-label={
          visible
            ? "Hide password"
            : "Show password"
        }
      >
        <EyeIcon hidden={visible} />
      </button>
    );
  }

  return (
    <>
      <main className="hcs-auth-page">
        <div
          className="hcs-auth-grid"
          aria-hidden="true"
        />

        <div
          className="hcs-auth-orbit orbit-one"
          aria-hidden="true"
        />

        <div
          className="hcs-auth-orbit orbit-two"
          aria-hidden="true"
        />

        <div
          className="hcs-auth-diagonal diagonal-one"
          aria-hidden="true"
        />

        <div
          className="hcs-auth-diagonal diagonal-two"
          aria-hidden="true"
        />

        <section className="hcs-auth-shell">
          <aside className="hcs-brand-panel">
            <div className="brand-panel-overlay" />

            <div className="brand-panel-top">
              <div className="brand-logo-box">
                <Image
                  src="/images/logo.png"
                  alt="Hind Consultancy Services official logo"
                  width={330}
                  height={130}
                  priority
                  className="brand-logo"
                />
              </div>

              <div className="brand-mini-meta">
                <span>HCS PORTAL</span>
                <span>01 / 01</span>
              </div>
            </div>

            <div className="brand-panel-main">
              <div className="brand-kicker">
                TECHNOLOGY • DIGITAL • CONSULTANCY
              </div>

              <h1>
                Smart Technology.
                <br />
                <span>Better Business.</span>
              </h1>

              <p className="brand-description">
                A centralized and secure workspace
                for HCS operations, clients,
                websites, SEO activities and
                digital services.
              </p>

              <div className="brand-stat-row">
                <div>
                  <strong>01</strong>
                  <span>ADMIN</span>
                </div>

                <div>
                  <strong>02</strong>
                  <span>CLIENT</span>
                </div>

                <div>
                  <strong>24/7</strong>
                  <span>ACCESS</span>
                </div>
              </div>

              <div className="brand-feature-list">
                <div className="brand-feature">
                  <div className="feature-icon">
                    <FieldIcon type="shield" />
                  </div>

                  <div>
                    <strong>
                      Controlled Access
                    </strong>

                    <small>
                      Role-based entry keeps Admin
                      and Client access separated.
                    </small>
                  </div>
                </div>

                <div className="brand-feature">
                  <div className="feature-icon">
                    <FieldIcon type="lock" />
                  </div>

                  <div>
                    <strong>
                      Secure Recovery
                    </strong>

                    <small>
                      Admin password recovery uses
                      OTP verification.
                    </small>
                  </div>
                </div>

                <div className="brand-feature">
                  <div className="feature-icon">
                    <FieldIcon type="user" />
                  </div>

                  <div>
                    <strong>
                      One HCS Workspace
                    </strong>

                    <small>
                      Manage the HCS portal from
                      one central entry point.
                    </small>
                  </div>
                </div>
              </div>
            </div>

            <div className="brand-panel-bottom">
              <span>
                HIND CONSULTANCY SERVICES
              </span>

              <span>
                SMART TECHNOLOGY. BETTER BUSINESS.
              </span>
            </div>
          </aside>

          <section className="hcs-auth-panel">
            <div className="auth-panel-header">
              <div className="mobile-logo">
                <Image
                  src="/images/logo.png"
                  alt="Hind Consultancy Services"
                  width={230}
                  height={90}
                  priority
                />
              </div>

              <div className="auth-header-meta">
                <span>HCS SECURE ACCESS</span>

                <div className="live-status">
                  <i />
                  SYSTEM READY
                </div>
              </div>
            </div>

            {screen === "login" && (
              <div className="auth-card">
                <div className="auth-heading">
                  <div>
                    <span className="section-eyebrow">
                      PORTAL LOGIN
                    </span>

                    <h2>
                      Welcome
                      <br />
                      back.
                    </h2>

                    <p>
                      Sign in to access your HCS
                      workspace.
                    </p>
                  </div>

                  <div className="heading-mark">
                    HCS
                  </div>
                </div>

                <div className="role-tabs">
                  <button
                    type="button"
                    className={
                      role === "admin"
                        ? "role-tab active"
                        : "role-tab"
                    }
                    onClick={() =>
                      changeRole("admin")
                    }
                  >
                    <div className="role-tab-icon">
                      A
                    </div>

                    <div>
                      <strong>Admin</strong>
                      <span>
                        Full control
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={
                      role === "client"
                        ? "role-tab active"
                        : "role-tab"
                    }
                    onClick={() =>
                      changeRole("client")
                    }
                  >
                    <div className="role-tab-icon">
                      C
                    </div>

                    <div>
                      <strong>Client</strong>
                      <span>
                        Assigned access
                      </span>
                    </div>
                  </button>
                </div>

                <form
                  className="auth-form"
                  onSubmit={handleLogin}
                >
                  <div className="form-group">
                    <div className="form-label-row">
                      <label>
                        {role === "admin"
                          ? "Admin ID / Username / Email"
                          : "Username / Email"}
                      </label>

                      <span>
                        REQUIRED
                      </span>
                    </div>

                    <div className="input-box">
                      <span className="input-symbol">
                        <FieldIcon type="user" />
                      </span>

                      <input
                        type="text"
                        value={identifier}
                        onChange={(event) =>
                          setIdentifier(
                            event.target.value,
                          )
                        }
                        placeholder={
                          role === "admin"
                            ? "Enter Admin ID, username or email"
                            : "Enter username or email"
                        }
                        autoComplete="username"
                        spellCheck={false}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="form-label-row">
                      <label>
                        Password
                      </label>

                      {role === "admin" && (
                        <button
                          type="button"
                          className="inline-action"
                          onClick={
                            startForgotPassword
                          }
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>

                    <div className="input-box">
                      <span className="input-symbol">
                        <FieldIcon type="lock" />
                      </span>

                      <input
                        type={
                          showLoginPassword
                            ? "text"
                            : "password"
                        }
                        value={password}
                        onChange={(event) =>
                          setPassword(
                            event.target.value,
                          )
                        }
                        placeholder="Enter your password"
                        autoComplete="current-password"
                      />

                      <PasswordButton
                        visible={
                          showLoginPassword
                        }
                        onClick={() =>
                          setShowLoginPassword(
                            (value) => !value,
                          )
                        }
                      />
                    </div>
                  </div>

                  {role === "client" && (
                    <div className="info-strip">
                      <div className="info-strip-icon">
                        i
                      </div>

                      <div>
                        <strong>
                          Client access
                        </strong>

                        <p>
                          Client accounts are created
                          and managed by HCS Admin.
                        </p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="message-box error">
                      <span>!</span>
                      <p>{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="button-loader" />
                        <span>
                          AUTHENTICATING
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          CONTINUE TO{" "}
                          {role === "admin"
                            ? "ADMIN"
                            : "CLIENT"}
                        </span>

                        <span className="button-arrow">
                          <ArrowIcon />
                        </span>
                      </>
                    )}
                  </button>
                </form>

                <div className="auth-card-bottom">
                  <span>
                    ENCRYPTED SESSION
                  </span>

                  <span>
                    HCS-
                    {new Date().getFullYear()}
                  </span>
                </div>
              </div>
            )}

            {screen === "forgot" && (
              <div className="auth-card">
                <button
                  type="button"
                  className="back-action"
                  onClick={backToLogin}
                >
                  <span>←</span>
                  Back to login
                </button>

                <div className="recovery-heading">
                  <div>
                    <span className="section-eyebrow">
                      ADMIN RECOVERY
                    </span>

                    <h2>
                      Recover
                      <br />
                      your access.
                    </h2>

                    <p>
                      Enter your registered email
                      address or mobile number.
                    </p>
                  </div>

                  <div className="step-number">
                    01
                  </div>
                </div>

                <div className="recovery-progress">
                  <div className="progress-step active">
                    <span>01</span>
                    <b>IDENTIFY</b>
                  </div>

                  <div className="progress-line" />

                  <div className="progress-step">
                    <span>02</span>
                    <b>VERIFY</b>
                  </div>

                  <div className="progress-line" />

                  <div className="progress-step">
                    <span>03</span>
                    <b>RESET</b>
                  </div>
                </div>

                <form
                  className="auth-form"
                  onSubmit={sendOtp}
                >
                  <div className="form-group">
                    <div className="form-label-row">
                      <label>
                        Registered Email / Mobile
                      </label>

                      <span>
                        REQUIRED
                      </span>
                    </div>

                    <div className="input-box">
                      <span className="input-symbol">
                        <FieldIcon type="mail" />
                      </span>

                      <input
                        type="text"
                        value={
                          recoveryIdentifier
                        }
                        onChange={(event) =>
                          setRecoveryIdentifier(
                            event.target.value,
                          )
                        }
                        placeholder="Enter email or mobile number"
                        autoComplete="email"
                      />
                    </div>

                    <small className="field-help">
                      OTP will be sent to the
                      registered recovery contact.
                    </small>
                  </div>

                  {error && (
                    <div className="message-box error">
                      <span>!</span>
                      <p>{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="button-loader" />
                        <span>
                          SENDING OTP
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          SEND OTP
                        </span>

                        <span className="button-arrow">
                          <ArrowIcon />
                        </span>
                      </>
                    )}
                  </button>
                </form>

                <div className="recovery-security">
                  <div className="security-icon">
                    <FieldIcon type="shield" />
                  </div>

                  <div>
                    <strong>
                      Secure recovery
                    </strong>

                    <p>
                      Your current password is
                      never displayed during recovery.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {screen === "otp" && (
              <div className="auth-card">
                <button
                  type="button"
                  className="back-action"
                  onClick={() => {
                    clearMessages();
                    setScreen("forgot");
                  }}
                >
                  <span>←</span>
                  Change recovery contact
                </button>

                <div className="recovery-heading">
                  <div>
                    <span className="section-eyebrow">
                      ADMIN RECOVERY
                    </span>

                    <h2>
                      Verify
                      <br />
                      one-time code.
                    </h2>

                    <p>
                      Enter the 6-digit OTP sent to{" "}
                      <strong>
                        {destinationMasked ||
                          "your registered contact"}
                      </strong>
                      .
                    </p>
                  </div>

                  <div className="step-number">
                    02
                  </div>
                </div>

                <div className="recovery-progress">
                  <div className="progress-step completed">
                    <span>✓</span>
                    <b>IDENTIFY</b>
                  </div>

                  <div className="progress-line completed" />

                  <div className="progress-step active">
                    <span>02</span>
                    <b>VERIFY</b>
                  </div>

                  <div className="progress-line" />

                  <div className="progress-step">
                    <span>03</span>
                    <b>RESET</b>
                  </div>
                </div>

                <form
                  className="auth-form"
                  onSubmit={verifyOtp}
                >
                  <div className="form-group">
                    <div className="form-label-row">
                      <label>
                        One-Time Password
                      </label>

                      <span>
                        6 DIGITS
                      </span>
                    </div>

                    <input
                      className="otp-input"
                      value={otp}
                      onChange={(event) =>
                        setOtp(
                          event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6),
                        )
                      }
                      placeholder="000000"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                    />

                    <small className="field-help">
                      Enter the OTP received on your
                      registered email or mobile.
                    </small>
                  </div>

                  {success && (
                    <div className="message-box success">
                      <span>✓</span>
                      <p>{success}</p>
                    </div>
                  )}

                  {error && (
                    <div className="message-box error">
                      <span>!</span>
                      <p>{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="button-loader" />
                        <span>
                          VERIFYING OTP
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          VERIFY OTP
                        </span>

                        <span className="button-arrow">
                          <ArrowIcon />
                        </span>
                      </>
                    )}
                  </button>
                </form>

                <div className="resend-row">
                  <span>
                    Didn't receive the OTP?
                  </span>

                  <button
                    type="button"
                    disabled={
                      loading ||
                      cooldown > 0
                    }
                    onClick={() =>
                      sendOtp()
                    }
                  >
                    {cooldown > 0
                      ? `RESEND IN ${cooldown}s`
                      : "RESEND OTP"}
                  </button>
                </div>
              </div>
            )}

            {screen === "reset" && (
              <div className="auth-card">
                <button
                  type="button"
                  className="back-action"
                  onClick={() => {
                    clearMessages();
                    setScreen("otp");
                  }}
                >
                  <span>←</span>
                  Back to OTP
                </button>

                <div className="recovery-heading">
                  <div>
                    <span className="section-eyebrow">
                      ADMIN RECOVERY
                    </span>

                    <h2>
                      Create a
                      <br />
                      new password.
                    </h2>

                    <p>
                      Your OTP has been verified.
                      Create a strong new password.
                    </p>
                  </div>

                  <div className="step-number">
                    03
                  </div>
                </div>

                <div className="recovery-progress">
                  <div className="progress-step completed">
                    <span>✓</span>
                    <b>IDENTIFY</b>
                  </div>

                  <div className="progress-line completed" />

                  <div className="progress-step completed">
                    <span>✓</span>
                    <b>VERIFY</b>
                  </div>

                  <div className="progress-line completed" />

                  <div className="progress-step active">
                    <span>03</span>
                    <b>RESET</b>
                  </div>
                </div>

                <form
                  className="auth-form"
                  onSubmit={resetPassword}
                >
                  <div className="form-group">
                    <label>
                      New Password
                    </label>

                    <div className="input-box">
                      <span className="input-symbol">
                        <FieldIcon type="lock" />
                      </span>

                      <input
                        type={
                          showNewPassword
                            ? "text"
                            : "password"
                        }
                        value={newPassword}
                        onChange={(event) =>
                          setNewPassword(
                            event.target.value,
                          )
                        }
                        placeholder="Create a new password"
                        autoComplete="new-password"
                      />

                      <PasswordButton
                        visible={
                          showNewPassword
                        }
                        onClick={() =>
                          setShowNewPassword(
                            (value) => !value,
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>
                      Confirm New Password
                    </label>

                    <div className="input-box">
                      <span className="input-symbol">
                        <FieldIcon type="lock" />
                      </span>

                      <input
                        type={
                          showConfirmPassword
                            ? "text"
                            : "password"
                        }
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(
                            event.target.value,
                          )
                        }
                        placeholder="Confirm your new password"
                        autoComplete="new-password"
                      />

                      <PasswordButton
                        visible={
                          showConfirmPassword
                        }
                        onClick={() =>
                          setShowConfirmPassword(
                            (value) => !value,
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="password-panel">
                    <div className="password-panel-title">
                      <span>
                        PASSWORD REQUIREMENTS
                      </span>

                      <b>
                        {
                          Object.values(
                            rules,
                          ).filter(Boolean)
                            .length
                        }
                        /5
                      </b>
                    </div>

                    <div className="password-rules">
                      <span
                        className={
                          rules.minLength
                            ? "password-rule valid"
                            : "password-rule"
                        }
                      >
                        <i>
                          {rules.minLength
                            ? "✓"
                            : "○"}
                        </i>
                        8+ characters
                      </span>

                      <span
                        className={
                          rules.uppercase
                            ? "password-rule valid"
                            : "password-rule"
                        }
                      >
                        <i>
                          {rules.uppercase
                            ? "✓"
                            : "○"}
                        </i>
                        Uppercase letter
                      </span>

                      <span
                        className={
                          rules.number
                            ? "password-rule valid"
                            : "password-rule"
                        }
                      >
                        <i>
                          {rules.number
                            ? "✓"
                            : "○"}
                        </i>
                        Number
                      </span>

                      <span
                        className={
                          rules.special
                            ? "password-rule valid"
                            : "password-rule"
                        }
                      >
                        <i>
                          {rules.special
                            ? "✓"
                            : "○"}
                        </i>
                        Special character
                      </span>

                      <span
                        className={
                          rules.maxLength
                            ? "password-rule valid"
                            : "password-rule"
                        }
                      >
                        <i>
                          {rules.maxLength
                            ? "✓"
                            : "○"}
                        </i>
                        Maximum 128 characters
                      </span>
                    </div>
                  </div>

                  {error && (
                    <div className="message-box error">
                      <span>!</span>
                      <p>{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="button-loader" />
                        <span>
                          UPDATING PASSWORD
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          RESET PASSWORD
                        </span>

                        <span className="button-arrow">
                          <ArrowIcon />
                        </span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {screen === "success" && (
              <div className="auth-card success-card">
                <div className="success-ring">
                  <div>✓</div>
                </div>

                <span className="section-eyebrow">
                  RECOVERY COMPLETE
                </span>

                <h2>
                  Password
                  <br />
                  updated.
                </h2>

                <p>
                  Your Admin password has been
                  successfully changed. You can now
                  sign in using your new password.
                </p>

                {success && (
                  <div className="message-box success">
                    <span>✓</span>
                    <p>{success}</p>
                  </div>
                )}

                <button
                  type="button"
                  className="primary-button"
                  onClick={backToLogin}
                >
                  <span>
                    CONTINUE TO LOGIN
                  </span>

                  <span className="button-arrow">
                    <ArrowIcon />
                  </span>
                </button>
              </div>
            )}

            <div className="auth-footer">
              <span>
                TECHNOLOGY • DIGITAL • CONSULTANCY
              </span>

              <span>
                HIND CONSULTANCY SERVICES
              </span>
            </div>
          </section>
        </section>
      </main>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          min-height: 100%;
        }

        body {
          background: #f3f3f3;
          color: #050505;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        button,
        input {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .hcs-auth-page {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          display: flex;
          align-items: center;
          padding: 20px;
          background:
            radial-gradient(
              circle at 75% 10%,
              rgba(0, 0, 0, 0.055),
              transparent 26%
            ),
            linear-gradient(
              135deg,
              #ededed 0%,
              #ffffff 47%,
              #f0f0f0 100%
            );
        }

        .hcs-auth-grid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.35;
          background-image:
            linear-gradient(
              rgba(0, 0, 0, 0.025) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.025) 1px,
              transparent 1px
            );
          background-size: 44px 44px;
        }

        .hcs-auth-orbit {
          position: fixed;
          pointer-events: none;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 50%;
        }

        .orbit-one {
          width: 620px;
          height: 620px;
          top: -310px;
          right: -230px;
        }

        .orbit-two {
          width: 430px;
          height: 430px;
          bottom: -260px;
          left: -190px;
        }

        .hcs-auth-diagonal {
          position: fixed;
          width: 760px;
          height: 1px;
          background: rgba(0, 0, 0, 0.06);
          pointer-events: none;
        }

        .diagonal-one {
          right: -190px;
          top: 22%;
          transform: rotate(-24deg);
        }

        .diagonal-two {
          left: -260px;
          bottom: 20%;
          transform: rotate(27deg);
        }

        .hcs-auth-shell {
          position: relative;
          z-index: 2;
          width: min(1480px, 100%);
          min-height: calc(100vh - 40px);
          margin: 0 auto;
          display: grid;
          grid-template-columns:
            minmax(400px, 0.92fr)
            minmax(540px, 1.08fr);
          overflow: hidden;
          border: 1px solid #e4e4e4;
          border-radius: 30px;
          background: #ffffff;
          box-shadow:
            0 30px 90px rgba(0, 0, 0, 0.105),
            0 2px 6px rgba(0, 0, 0, 0.03);
        }

        .hcs-brand-panel {
          position: relative;
          min-height: 800px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 42px;
          overflow: hidden;
          background: #050505;
          color: #fff;
        }

        .brand-panel-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              135deg,
              rgba(255,255,255,0.035),
              transparent 35%
            ),
            radial-gradient(
              circle at 85% 15%,
              rgba(255,255,255,0.08),
              transparent 28%
            );
        }

        .brand-panel-overlay::before,
        .brand-panel-overlay::after {
          content: "";
          position: absolute;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 50%;
        }

        .brand-panel-overlay::before {
          width: 530px;
          height: 530px;
          top: -270px;
          right: -240px;
        }

        .brand-panel-overlay::after {
          width: 330px;
          height: 330px;
          bottom: -210px;
          left: -170px;
        }

        .brand-panel-top,
        .brand-panel-main,
        .brand-panel-bottom {
          position: relative;
          z-index: 2;
        }

        .brand-logo-box {
          width: 270px;
          min-height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 13px 19px;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 16px;
          background:
            linear-gradient(
              135deg,
              rgba(255,255,255,0.055),
              rgba(255,255,255,0.02)
            );
        }

        .brand-logo {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
        }

        .brand-mini-meta {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-top: 15px;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.18em;
          color: rgba(255,255,255,0.36);
        }

        .brand-panel-main {
          margin-top: 55px;
        }

        .brand-kicker {
          margin-bottom: 15px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.19em;
          color: rgba(255,255,255,0.45);
        }

        .brand-panel-main h1 {
          margin: 0;
          font-size: clamp(42px, 4.3vw, 70px);
          line-height: 0.96;
          letter-spacing: -0.065em;
          font-weight: 760;
        }

        .brand-panel-main h1 span {
          color: rgba(255,255,255,0.46);
        }

        .brand-description {
          max-width: 480px;
          margin: 25px 0 0;
          font-size: 14px;
          line-height: 1.7;
          color: rgba(255,255,255,0.6);
        }

        .brand-stat-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          max-width: 500px;
          margin-top: 38px;
          border-top: 1px solid rgba(255,255,255,0.12);
          border-bottom: 1px solid rgba(255,255,255,0.12);
        }

        .brand-stat-row > div {
          padding: 14px 14px 14px 0;
          border-right: 1px solid rgba(255,255,255,0.12);
        }

        .brand-stat-row > div:last-child {
          border-right: 0;
          padding-left: 14px;
        }

        .brand-stat-row > div:nth-child(2) {
          padding-left: 14px;
        }

        .brand-stat-row strong {
          display: block;
          font-size: 19px;
          letter-spacing: -0.05em;
        }

        .brand-stat-row span {
          display: block;
          margin-top: 4px;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.16em;
          color: rgba(255,255,255,0.34);
        }

        .brand-feature-list {
          display: grid;
          margin-top: 33px;
          max-width: 530px;
        }

        .brand-feature {
          display: grid;
          grid-template-columns: 35px 1fr;
          gap: 13px;
          padding: 14px 0;
          border-top: 1px solid rgba(255,255,255,0.1);
        }

        .feature-icon {
          display: flex;
          width: 30px;
          height: 30px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 8px;
        }

        .feature-icon svg {
          width: 15px;
          height: 15px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.4;
        }

        .brand-feature strong {
          display: block;
          font-size: 11px;
          font-weight: 750;
        }

        .brand-feature small {
          display: block;
          max-width: 390px;
          margin-top: 5px;
          font-size: 9px;
          line-height: 1.55;
          color: rgba(255,255,255,0.44);
        }

        .brand-panel-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.11);
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.17em;
          color: rgba(255,255,255,0.28);
        }

        .hcs-auth-panel {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          padding: 40px 72px 28px;
          background: #fff;
        }

        .auth-panel-header {
          width: min(100%, 590px);
          margin: 0 auto 18px;
        }

        .mobile-logo {
          display: none;
        }

        .auth-header-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.16em;
          color: #aaa;
        }

        .live-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .live-status i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #111;
          box-shadow: 0 0 0 4px #eee;
        }

        .auth-card {
          width: min(100%, 590px);
          margin: 0 auto;
          padding: 38px;
          border: 1px solid #e8e8e8;
          border-radius: 22px;
          background: #fff;
          box-shadow:
            0 10px 40px rgba(0,0,0,0.035),
            0 1px 2px rgba(0,0,0,0.02);
        }

        .auth-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 27px;
        }

        .section-eyebrow {
          display: block;
          margin-bottom: 10px;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.18em;
          color: #929292;
        }

        .auth-heading h2,
        .recovery-heading h2 {
          margin: 0;
          font-size: 34px;
          line-height: 0.97;
          letter-spacing: -0.055em;
        }

        .auth-heading p,
        .recovery-heading p {
          max-width: 390px;
          margin: 12px 0 0;
          font-size: 11px;
          line-height: 1.65;
          color: #6d6d6d;
        }

        .heading-mark {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 55px;
          height: 55px;
          flex: 0 0 auto;
          border: 1px solid #ddd;
          border-radius: 14px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.1em;
          color: #919191;
        }

        .role-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
          margin-bottom: 25px;
          padding: 5px;
          border: 1px solid #e7e7e7;
          border-radius: 14px;
          background: #fafafa;
        }

        .role-tab {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
          padding: 12px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          color: #666;
          text-align: left;
          transition: 160ms ease;
        }

        .role-tab:hover {
          color: #111;
        }

        .role-tab.active {
          border-color: #050505;
          background: #050505;
          color: #fff;
        }

        .role-tab-icon {
          display: flex;
          width: 30px;
          height: 30px;
          align-items: center;
          justify-content: center;
          border: 1px solid currentColor;
          border-radius: 8px;
          font-size: 9px;
          font-weight: 900;
        }

        .role-tab strong {
          display: block;
          font-size: 10px;
          font-weight: 800;
        }

        .role-tab span {
          display: block;
          margin-top: 3px;
          font-size: 8px;
          opacity: 0.6;
        }

        .auth-form {
          display: grid;
          gap: 18px;
        }

        .form-group {
          display: grid;
          gap: 8px;
        }

        .form-group > label,
        .form-label-row label {
          font-size: 9px;
          font-weight: 850;
          color: #111;
        }

        .form-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .form-label-row > span {
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.1em;
          color: #aaa;
        }

        .input-box {
          display: flex;
          align-items: center;
          min-height: 51px;
          border: 1px solid #d7d7d7;
          border-radius: 10px;
          background: #fff;
          transition: 160ms ease;
        }

        .input-box:focus-within {
          border-color: #050505;
          box-shadow:
            0 0 0 3px rgba(0,0,0,0.045);
        }

        .input-symbol {
          display: flex;
          width: 43px;
          height: 49px;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          color: #8b8b8b;
        }

        .input-symbol svg {
          width: 15px;
          height: 15px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.5;
        }

        .input-box input {
          width: 100%;
          min-width: 0;
          height: 49px;
          border: 0;
          outline: 0;
          background: transparent;
          padding: 0 8px 0 0;
          font-size: 11px;
          color: #050505;
        }

        .input-box input::placeholder {
          color: #b5b5b5;
        }

        .hcs-eye-button {
          display: flex;
          width: 34px;
          height: 34px;
          align-items: center;
          justify-content: center;
          margin-right: 6px;
          flex: 0 0 auto;
          border: 0;
          background: transparent;
          color: #777;
        }

        .hcs-eye-button:hover {
          color: #000;
        }

        .hcs-eye-button svg {
          width: 15px;
          height: 15px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.5;
        }

        .inline-action {
          padding: 0;
          border: 0;
          background: transparent;
          color: #111;
          font-size: 8px;
          font-weight: 850;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .inline-action:hover {
          color: #777;
        }

        .primary-button {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          width: 100%;
          min-height: 53px;
          padding: 12px 15px 12px 18px;
          border: 1px solid #050505;
          border-radius: 10px;
          background: #050505;
          color: #fff;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.12em;
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        .primary-button:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #151515;
          box-shadow:
            0 10px 26px rgba(0,0,0,0.13);
        }

        .button-arrow {
          display: flex;
          width: 30px;
          height: 30px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.17);
          border-radius: 8px;
        }

        .button-arrow svg {
          width: 14px;
          height: 14px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.6;
        }

        .button-loader {
          width: 13px;
          height: 13px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: hcs-spin 0.7s linear infinite;
        }

        @keyframes hcs-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .info-strip {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 11px 12px;
          border-left: 2px solid #050505;
          background: #fafafa;
        }

        .info-strip-icon {
          display: flex;
          width: 20px;
          height: 20px;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border: 1px solid #d7d7d7;
          border-radius: 50%;
          font-size: 8px;
          font-weight: 850;
        }

        .info-strip strong {
          display: block;
          font-size: 8px;
          font-weight: 850;
        }

        .info-strip p {
          margin: 4px 0 0;
          font-size: 8px;
          line-height: 1.5;
          color: #777;
        }

        .message-box {
          display: grid;
          grid-template-columns: 23px 1fr;
          gap: 9px;
          align-items: start;
          padding: 10px 11px;
          border: 1px solid #e2e2e2;
          border-radius: 9px;
          background: #fafafa;
        }

        .message-box > span {
          display: flex;
          width: 21px;
          height: 21px;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: #efefef;
          font-size: 8px;
          font-weight: 900;
        }

        .message-box p {
          margin: 2px 0 0;
          font-size: 8px;
          line-height: 1.55;
          color: #555;
        }

        .message-box.success > span {
          background: #111;
          color: #fff;
        }

        .back-action {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 24px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #767676;
          font-size: 8px;
          font-weight: 800;
        }

        .back-action:hover {
          color: #111;
        }

        .recovery-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 27px;
        }

        .step-number {
          display: flex;
          width: 52px;
          height: 52px;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border: 1px solid #e1e1e1;
          border-radius: 13px;
          font-size: 17px;
          font-weight: 900;
          letter-spacing: -0.08em;
          color: #b2b2b2;
        }

        .recovery-progress {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 28px;
        }

        .progress-step {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          color: #b6b6b6;
        }

        .progress-step span {
          display: flex;
          width: 21px;
          height: 21px;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border: 1px solid #ddd;
          border-radius: 50%;
          font-size: 7px;
          font-weight: 850;
        }

        .progress-step b {
          font-size: 6px;
          font-weight: 850;
          letter-spacing: 0.12em;
        }

        .progress-step.active {
          color: #050505;
        }

        .progress-step.active span,
        .progress-step.completed span {
          border-color: #050505;
          background: #050505;
          color: #fff;
        }

        .progress-step.completed {
          color: #050505;
        }

        .progress-line {
          height: 1px;
          flex: 1;
          background: #e5e5e5;
        }

        .progress-line.completed {
          background: #050505;
        }

        .field-help {
          font-size: 8px;
          line-height: 1.55;
          color: #888;
        }

        .otp-input {
          width: 100%;
          height: 67px;
          border: 1px solid #d7d7d7;
          border-radius: 11px;
          outline: 0;
          text-align: center;
          font-size: 25px;
          font-weight: 850;
          letter-spacing: 0.4em;
          color: #050505;
        }

        .otp-input:focus {
          border-color: #050505;
          box-shadow:
            0 0 0 3px rgba(0,0,0,0.045);
        }

        .resend-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-top: 18px;
          font-size: 8px;
          color: #888;
        }

        .resend-row button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #111;
          font-size: 8px;
          font-weight: 850;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .recovery-security {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-top: 21px;
          padding-top: 17px;
          border-top: 1px solid #e8e8e8;
        }

        .security-icon {
          display: flex;
          width: 29px;
          height: 29px;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border: 1px solid #ddd;
          border-radius: 8px;
        }

        .security-icon svg {
          width: 14px;
          height: 14px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.5;
        }

        .recovery-security strong {
          display: block;
          font-size: 8px;
          font-weight: 850;
        }

        .recovery-security p {
          margin: 4px 0 0;
          font-size: 8px;
          line-height: 1.5;
          color: #888;
        }

        .password-panel {
          padding: 13px;
          border: 1px solid #e8e8e8;
          border-radius: 11px;
          background: #fafafa;
        }

        .password-panel-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.12em;
          color: #777;
        }

        .password-panel-title b {
          color: #111;
        }

        .password-rules {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .password-rule {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 8px;
          color: #999;
        }

        .password-rule i {
          display: flex;
          width: 18px;
          height: 18px;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border: 1px solid #ddd;
          border-radius: 50%;
          font-style: normal;
          font-size: 7px;
        }

        .password-rule.valid {
          color: #111;
        }

        .password-rule.valid i {
          border-color: #050505;
          background: #050505;
          color: #fff;
        }

        .success-card {
          text-align: center;
        }

        .success-ring {
          display: flex;
          width: 82px;
          height: 82px;
          align-items: center;
          justify-content: center;
          margin: 0 auto 23px;
          border: 1px solid #dcdcdc;
          border-radius: 50%;
        }

        .success-ring div {
          display: flex;
          width: 58px;
          height: 58px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #050505;
          color: #fff;
          font-size: 22px;
          font-weight: 900;
        }

        .success-card h2 {
          margin: 0;
          font-size: 34px;
          line-height: 0.96;
          letter-spacing: -0.055em;
        }

        .success-card > p {
          max-width: 390px;
          margin: 15px auto 23px;
          font-size: 10px;
          line-height: 1.65;
          color: #777;
        }

        .auth-card-bottom {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-top: 24px;
          padding-top: 17px;
          border-top: 1px solid #ebebeb;
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.12em;
          color: #aaa;
        }

        .auth-footer {
          width: min(100%, 590px);
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin: 18px auto 0;
          padding: 0 3px;
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.13em;
          color: #aaa;
        }

        @media (max-width: 1120px) {
          .hcs-auth-shell {
            grid-template-columns:
              minmax(350px, 0.88fr)
              minmax(500px, 1.12fr);
          }

          .hcs-brand-panel {
            padding: 32px;
          }

          .hcs-auth-panel {
            padding: 35px 38px 26px;
          }

          .auth-card {
            padding: 31px;
          }
        }

        @media (max-width: 860px) {
          .hcs-auth-page {
            padding: 0;
          }

          .hcs-auth-shell {
            width: 100%;
            min-height: 100vh;
            grid-template-columns: 1fr;
            margin: 0;
            border: 0;
            border-radius: 0;
            box-shadow: none;
          }

          .hcs-brand-panel {
            display: none;
          }

          .hcs-auth-panel {
            min-height: 100vh;
            padding: 22px 16px 18px;
            justify-content: center;
          }

          .auth-panel-header {
            margin-bottom: 14px;
          }

          .mobile-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
          }

          .mobile-logo img {
            width: 170px;
            height: auto;
            object-fit: contain;
          }

          .auth-header-meta {
            justify-content: center;
          }

          .auth-card {
            width: 100%;
            max-width: 590px;
            padding: 24px 20px 20px;
            border-radius: 18px;
          }
        }

        @media (max-width: 560px) {
          .hcs-auth-panel {
            padding: 17px 10px 13px;
          }

          .mobile-logo img {
            width: 145px;
          }

          .auth-header-meta {
            font-size: 7px;
          }

          .auth-card {
            padding: 20px 15px 17px;
            border-radius: 15px;
          }

          .auth-heading h2,
          .recovery-heading h2 {
            font-size: 28px;
          }

          .heading-mark,
          .step-number {
            width: 45px;
            height: 45px;
          }

          .role-tabs {
            grid-template-columns: 1fr;
          }

          .password-rules {
            display: block;
          }

          .password-rule {
            margin-top: 8px;
          }

          .password-rule:first-child {
            margin-top: 0;
          }

          .auth-card-bottom,
          .auth-footer {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }

          .recovery-heading > .step-number {
            display: none;
          }

          .recovery-progress {
            gap: 5px;
          }

          .progress-step b {
            display: none;
          }

          .otp-input {
            height: 59px;
            font-size: 22px;
            letter-spacing: 0.29em;
          }
        }

        @media (max-width: 380px) {
          .hcs-auth-panel {
            padding: 12px 7px;
          }

          .auth-card {
            padding: 17px 12px;
          }

          .auth-heading h2,
          .recovery-heading h2 {
            font-size: 25px;
          }

          .input-box input {
            font-size: 10px;
          }

          .primary-button {
            min-height: 49px;
          }
        }

        button:focus-visible,
        input:focus-visible {
          outline: 2px solid #050505;
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </>
  );
}