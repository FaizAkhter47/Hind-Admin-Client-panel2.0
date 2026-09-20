"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LoginResponse = {
  success?: boolean;
  message?: string;
  user?: {
    id?: string;
    adminId?: string;
    clientId?: string;
    username?: string;
    email?: string;
    name?: string;
    fullName?: string;
    role?: string;
    status?: string;
  };
};

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const checkExistingSession = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        const data = await response.json().catch(() => null);

        if (!mounted) return;

        if (response.ok && data?.success && data?.user) {
          const role = String(data.user.role || "").toLowerCase();

          if (role === "admin" || role === "administrator") {
            router.replace("/admin");
            return;
          }

          if (role === "client") {
            router.replace("/client");
            return;
          }
        }
      } catch {
        // No active session or backend unavailable.
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    };

    checkExistingSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    const cleanIdentifier = identifier.trim();

    if (!cleanIdentifier) {
      setError("Please enter your Admin ID, Client ID, username or email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password,
        }),
      });

      const data: LoginResponse = await response.json().catch(() => ({
        success: false,
        message: "Invalid server response.",
      }));

      if (!response.ok || !data.success || !data.user) {
        setError(data.message || "Invalid credentials.");
        setLoading(false);
        return;
      }

      const role = String(data.user.role || "").toLowerCase();

      if (role === "admin" || role === "administrator") {
        router.replace("/admin");
        return;
      }

      if (role === "client") {
        router.replace("/client");
        return;
      }

      setError("Your account role is not supported.");
      setLoading(false);
    } catch {
      setError(
        "Unable to sign in right now. Please check your connection and try again."
      );
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <>
        <div className="loadingScreen">
          <div className="loader" />
          <p>Checking session...</p>
        </div>

        <style jsx>{`
          .loadingScreen {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #000;
            color: #fff;
            font-family:
              Inter, Arial, Helvetica, sans-serif;
          }

          .loader {
            width: 28px;
            height: 28px;
            border: 3px solid #333;
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 14px;
          }

          p {
            margin: 0;
            color: #aaa;
            font-size: 13px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <main className="page">
        <section className="loginCard">
          <div className="brand">
            <div className="logo">HCS</div>

            <div>
              <h1>Hind Consultancy Services</h1>
              <p>Client & Admin Portal</p>
            </div>
          </div>

          <div className="heading">
            <h2>Welcome back</h2>
            <p>Sign in to continue to your portal.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="identifier">
                Admin ID / Client ID / Username / Email
              </label>

              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Enter your ID or email"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>

              <div className="passwordWrap">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                />

                <button
                  type="button"
                  className="showButton"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={loading}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div className="errorBox" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="loginButton"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="footer">
            <a href="/admin/forgot-password">Forgot password?</a>
            <span>•</span>
            <span>HCS Secure Portal</span>
          </div>
        </section>
      </main>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background:
            radial-gradient(
              circle at top left,
              rgba(255, 255, 255, 0.08),
              transparent 35%
            ),
            #050505;
          color: #fff;
          font-family:
            Inter, Arial, Helvetica, sans-serif;
        }

        .loginCard {
          width: 100%;
          max-width: 470px;
          padding: 36px;
          border: 1px solid #242424;
          border-radius: 20px;
          background: #0b0b0b;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 38px;
        }

        .logo {
          width: 54px;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #555;
          border-radius: 12px;
          background: #fff;
          color: #000;
          font-weight: 900;
          font-size: 17px;
          letter-spacing: 1px;
        }

        .brand h1 {
          margin: 0;
          font-size: 16px;
          line-height: 1.35;
          font-weight: 700;
        }

        .brand p {
          margin: 4px 0 0;
          color: #8f8f8f;
          font-size: 12px;
        }

        .heading {
          margin-bottom: 28px;
        }

        .heading h2 {
          margin: 0 0 8px;
          font-size: 30px;
          line-height: 1.15;
          font-weight: 750;
          letter-spacing: -0.7px;
        }

        .heading p {
          margin: 0;
          color: #8d8d8d;
          font-size: 14px;
          line-height: 1.6;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        label {
          font-size: 12px;
          font-weight: 650;
          color: #d7d7d7;
        }

        input {
          width: 100%;
          height: 50px;
          padding: 0 14px;
          border: 1px solid #292929;
          border-radius: 10px;
          outline: none;
          background: #111;
          color: #fff;
          font-size: 14px;
          transition:
            border-color 0.2s ease,
            background 0.2s ease;
        }

        input::placeholder {
          color: #5f5f5f;
        }

        input:focus {
          border-color: #777;
          background: #151515;
        }

        input:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .passwordWrap {
          position: relative;
        }

        .passwordWrap input {
          padding-right: 70px;
        }

        .showButton {
          position: absolute;
          top: 50%;
          right: 12px;
          transform: translateY(-50%);
          padding: 5px;
          border: 0;
          background: transparent;
          color: #aaa;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
        }

        .showButton:hover {
          color: #fff;
        }

        .showButton:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .errorBox {
          padding: 12px 13px;
          border: 1px solid #4b2525;
          border-radius: 9px;
          background: #170d0d;
          color: #ffb2b2;
          font-size: 13px;
          line-height: 1.5;
        }

        .loginButton {
          width: 100%;
          height: 50px;
          border: 1px solid #fff;
          border-radius: 10px;
          background: #fff;
          color: #000;
          cursor: pointer;
          font-size: 14px;
          font-weight: 750;
          transition:
            transform 0.15s ease,
            opacity 0.15s ease;
        }

        .loginButton:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .loginButton:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .footer {
          display: flex;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 24px;
          color: #626262;
          font-size: 11px;
        }

        .footer a {
          color: #aaa;
          text-decoration: none;
        }

        .footer a:hover {
          color: #fff;
        }

        @media (max-width: 520px) {
          .page {
            padding: 16px;
          }

          .loginCard {
            padding: 26px 20px;
            border-radius: 16px;
          }

          .heading h2 {
            font-size: 27px;
          }

          .brand {
            margin-bottom: 30px;
          }
        }
      `}</style>
    </>
  );
}