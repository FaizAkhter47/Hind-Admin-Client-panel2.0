"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
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

type LocalClient = {
  id?: string;
  clientId?: string;
  username?: string;
  email?: string;
  password?: string;
  loginPassword?: string;
  name?: string;
  companyName?: string;
  phone?: string;
  role?: string;
  status?: string;
  active?: boolean;
  clientPortalEnabled?: boolean;
};

const ADMIN_SETTINGS_STORAGE_KEY = "hcs-admin-settings-v6";
const CLIENT_SESSION_KEY = "hcs-auth-session";

/*
 * These are the current server-authenticated Admin identifiers.
 * Client identifiers will NEVER be sent to /api/auth/login.
 */
const KNOWN_ADMIN_IDENTIFIERS = [
  "hcs-admin-001",
  "hcsadmin",
  "admin@hindconsultancyservices.com",
  "faizakhter47@gmail.com",
];

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  /*
   * =====================================================
   * FIND LOCAL CLIENT
   * =====================================================
   *
   * Admin-created clients are currently stored in:
   *
   * hcs-admin-settings-v6
   *
   * This function reads the browser storage directly.
   */
  const findLocalClient = (
    value: string,
  ): LocalClient | null => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(
        ADMIN_SETTINGS_STORAGE_KEY,
      );

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);

      const clients = Array.isArray(
        parsed?.clients,
      )
        ? parsed.clients
        : [];

      const query = value
        .trim()
        .toLowerCase();

      if (!query) {
        return null;
      }

      const client =
        clients.find((item: LocalClient) => {
          const identifiers = [
            item?.clientId,
            item?.id,
            item?.username,
            item?.email,
          ]
            .map((itemValue) =>
              String(itemValue ?? "")
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean);

          return identifiers.includes(query);
        }) ?? null;

      return client;
    } catch (storageError) {
      console.error(
        "Unable to read local HCS client accounts:",
        storageError,
      );

      return null;
    }
  };

  /*
   * =====================================================
   * CREATE CLIENT SESSION
   * =====================================================
   */
  const createClientSession = (
    client: LocalClient,
  ) => {
    const clientId = String(
      client.clientId ??
        client.id ??
        "",
    ).trim();

    const accountId = String(
      client.id ??
        client.clientId ??
        "",
    ).trim();

    const username = String(
      client.username ?? "",
    ).trim();

    const email = String(
      client.email ?? "",
    ).trim();

    const name = String(
      client.name ??
        client.companyName ??
        client.username ??
        "Client",
    ).trim();

    const companyName = String(
      client.companyName ?? "",
    ).trim();

    const session = {
      authenticated: true,
      role: "client",
      id: clientId || accountId,
      clientId,
      accountId,
      username,
      email,
      name,
      companyName,
      loggedInAt:
        new Date().toISOString(),
      sessionId:
        `client-${Date.now()}-` +
        Math.random()
          .toString(36)
          .slice(2, 10),
    };

    window.localStorage.setItem(
      CLIENT_SESSION_KEY,
      JSON.stringify(session),
    );
  };

  /*
   * =====================================================
   * EXISTING SESSION CHECK
   * =====================================================
   */
  useEffect(() => {
    let mounted = true;

    const checkExistingSession = async () => {
      /*
       * -----------------------------------------------
       * 1. CHECK SERVER ADMIN SESSION
       * -----------------------------------------------
       */
      try {
        const response = await fetch(
          "/api/auth/me",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const data: LoginResponse =
          await response
            .json()
            .catch(() => null);

        if (!mounted) {
          return;
        }

        if (
          response.ok &&
          data?.success === true &&
          data?.user
        ) {
          const role = String(
            data.user.role ?? "",
          )
            .trim()
            .toLowerCase();

          if (
            role === "admin" ||
            role === "administrator"
          ) {
            router.replace("/admin");
            return;
          }

          if (role === "client") {
            router.replace("/client");
            return;
          }
        }
      } catch (serverError) {
        console.error(
          "Server session check failed:",
          serverError,
        );
      }

      /*
       * -----------------------------------------------
       * 2. CHECK LOCAL CLIENT SESSION
       * -----------------------------------------------
       */
      try {
        const sessionRaw =
          window.localStorage.getItem(
            CLIENT_SESSION_KEY,
          );

        if (!sessionRaw) {
          return;
        }

        const session = JSON.parse(
          sessionRaw,
        );

        const role = String(
          session?.role ?? "",
        )
          .trim()
          .toLowerCase();

        if (
          session?.authenticated !== true ||
          role !== "client"
        ) {
          window.localStorage.removeItem(
            CLIENT_SESSION_KEY,
          );
          return;
        }

        const client = findLocalClient(
          String(
            session?.clientId ??
              session?.id ??
              session?.username ??
              session?.email ??
              "",
          ),
        );

        if (!client) {
          window.localStorage.removeItem(
            CLIENT_SESSION_KEY,
          );
          return;
        }

        const status = String(
          client.status ?? "Active",
        )
          .trim()
          .toLowerCase();

        const accountActive =
          client.active !== false;

        const portalEnabled =
          client.clientPortalEnabled !==
          false;

        if (
          status === "active" &&
          accountActive &&
          portalEnabled
        ) {
          router.replace("/client");
          return;
        }

        window.localStorage.removeItem(
          CLIENT_SESSION_KEY,
        );
      } catch (clientSessionError) {
        console.error(
          "Local client session check failed:",
          clientSessionError,
        );

        window.localStorage.removeItem(
          CLIENT_SESSION_KEY,
        );
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

  /*
   * =====================================================
   * LOGIN SUBMIT
   * =====================================================
   */
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");

    const cleanIdentifier =
      identifier.trim();

    const normalizedIdentifier =
      cleanIdentifier.toLowerCase();

    const cleanPassword = password;

    if (!cleanIdentifier) {
      setError(
        "Please enter your Admin ID, Client ID, username or email.",
      );
      return;
    }

    if (!cleanPassword) {
      setError(
        "Please enter your password.",
      );
      return;
    }

    setLoading(true);

    try {
      /*
       * =================================================
       * 1. CLIENT LOGIN
       * =================================================
       *
       * IMPORTANT:
       * Client login does NOT call /api/auth/login.
       */
      const client =
        findLocalClient(
          cleanIdentifier,
        );

      if (client) {
        const savedPassword =
          String(
            client.password ??
              client.loginPassword ??
              "",
          );

        const status =
          String(
            client.status ??
              "Active",
          )
            .trim()
            .toLowerCase();

        const accountActive =
          client.active !== false;

        const portalEnabled =
          client.clientPortalEnabled !==
          false;

        /*
         * Client account disabled
         */
        if (
          status !== "active" ||
          !accountActive ||
          !portalEnabled
        ) {
          setError(
            "Client account is inactive or portal access is disabled.",
          );
          setLoading(false);
          return;
        }

        /*
         * Client password
         */
        if (
          !savedPassword ||
          savedPassword !==
            cleanPassword
        ) {
          setError(
            "Invalid credentials.",
          );
          setLoading(false);
          return;
        }

        /*
         * Client login successful
         */
        createClientSession(
          client,
        );

        router.replace("/client");
        return;
      }

      /*
       * =================================================
       * 2. UNKNOWN NON-ADMIN IDENTIFIER
       * =================================================
       *
       * Do NOT send random Client IDs/usernames to
       * /api/auth/login.
       */
      const isKnownAdmin =
        KNOWN_ADMIN_IDENTIFIERS.includes(
          normalizedIdentifier,
        );

      if (!isKnownAdmin) {
        setError(
          "Invalid credentials.",
        );
        setLoading(false);
        return;
      }

      /*
       * =================================================
       * 3. ADMIN LOGIN
       * =================================================
       */
      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            identifier:
              cleanIdentifier,
            password:
              cleanPassword,
          }),
        },
      );

      const data: LoginResponse =
        await response
          .json()
          .catch(() => ({
            success: false,
            message:
              "Invalid server response.",
          }));

      if (
        !response.ok ||
        data.success !== true ||
        !data.user
      ) {
        setError(
          data.message ||
            "Invalid credentials.",
        );
        setLoading(false);
        return;
      }

      const role = String(
        data.user.role ?? "",
      )
        .trim()
        .toLowerCase();

      if (
        role === "admin" ||
        role === "administrator"
      ) {
        router.replace("/admin");
        return;
      }

      if (role === "client") {
        router.replace("/client");
        return;
      }

      setError(
        "Your account role is not supported.",
      );

      setLoading(false);
    } catch (loginError) {
      console.error(
        "Login error:",
        loginError,
      );

      setError(
        "Unable to sign in right now. Please check your connection and try again.",
      );

      setLoading(false);
    }
  };

  /*
   * =====================================================
   * CHECKING SESSION SCREEN
   * =====================================================
   */
  if (checkingSession) {
    return (
      <>
        <div className="loadingScreen">
          <div className="loader" />
          <p>
            Checking session...
          </p>
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
              Inter,
              Arial,
              Helvetica,
              sans-serif;
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

  /*
   * =====================================================
   * LOGIN UI
   * =====================================================
   */
  return (
    <>
      <main className="page">
        <section className="loginCard">
          <div className="brand">
            <div className="logo">
              HCS
            </div>

            <div>
              <h1>
                Hind Consultancy Services
              </h1>

              <p>
                Client & Admin Portal
              </p>
            </div>
          </div>

          <div className="heading">
            <h2>
              Welcome back
            </h2>

            <p>
              Sign in to continue to
              your portal.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="field">
              <label htmlFor="identifier">
                Admin ID / Client ID /
                Username / Email
              </label>

              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(
                  event,
                ) => {
                  setIdentifier(
                    event.target.value,
                  );

                  if (error) {
                    setError("");
                  }
                }}
                placeholder="Enter your ID or email"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className="field">
              <label htmlFor="password">
                Password
              </label>

              <div className="passwordWrap">
                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(
                    event,
                  ) => {
                    setPassword(
                      event.target.value,
                    );

                    if (error) {
                      setError("");
                    }
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                />

                <button
                  type="button"
                  className="showButton"
                  onClick={() =>
                    setShowPassword(
                      (value) =>
                        !value,
                    )
                  }
                  disabled={loading}
                >
                  {showPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="errorBox"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="loginButton"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Sign In"}
            </button>
          </form>

          <div className="footer">
            <a href="/admin/forgot-password">
              Forgot password?
            </a>

            <span>
              •
            </span>

            <span>
              HCS Secure Portal
            </span>
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
              rgba(
                255,
                255,
                255,
                0.08
              ),
              transparent 35%
            ),
            #050505;
          color: #fff;
          font-family:
            Inter,
            Arial,
            Helvetica,
            sans-serif;
        }

        .loginCard {
          width: 100%;
          max-width: 470px;
          padding: 36px;
          border: 1px solid #242424;
          border-radius: 20px;
          background: #0b0b0b;
          box-shadow:
            0 24px 80px
              rgba(
                0,
                0,
                0,
                0.45
              );
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
          transform:
            translateY(-50%);
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
          transform:
            translateY(-1px);
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
