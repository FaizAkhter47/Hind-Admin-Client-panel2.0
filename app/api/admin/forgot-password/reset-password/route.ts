import { NextResponse } from "next/server";
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export const runtime = "nodejs";

type ResetPayload = {
  kind?: string;
  identifier?: string;
  issuedAt?: number;
  expiresAt?: number;
  recoveryVerified?: boolean;
};

function getSecret() {
  const secret =
    process.env.HCS_PASSWORD_RESET_SECRET;

  if (!secret) {
    throw new Error(
      "HCS_PASSWORD_RESET_SECRET is not configured.",
    );
  }

  return secret;
}

function safeEqual(
  a: string,
  b: string,
) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(
    left,
    right,
  );
}

function decodePayload(
  token: string,
) {
  const parts = token.split(".");

  if (parts.length !== 2) {
    throw new Error("Invalid token.");
  }

  const [encoded, signature] =
    parts;

  const expected =
    createHmac(
      "sha256",
      getSecret(),
    )
      .update(encoded)
      .digest("base64url");

  if (
    !safeEqual(
      signature,
      expected,
    )
  ) {
    throw new Error(
      "Invalid token signature.",
    );
  }

  return JSON.parse(
    Buffer.from(
      encoded,
      "base64url",
    ).toString("utf8"),
  ) as ResetPayload;
}

function normalizeEmail(
  value: string,
) {
  return value.trim().toLowerCase();
}

function normalizePhone(
  value: string,
) {
  return value
    .trim()
    .replace(/[^\d+]/g, "");
}

function validPassword(
  password: string,
) {
  return {
    minLength:
      password.length >= 8,
    maxLength:
      password.length <= 128,
    uppercase:
      /[A-Z]/.test(password),
    number:
      /[0-9]/.test(password),
    special:
      /[^A-Za-z0-9]/.test(password),
  };
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as {
        identifier?: string;
        resetToken?: string;
        newPassword?: string;
      };

    const identifier =
      body.identifier?.trim() ?? "";

    const resetToken =
      body.resetToken?.trim() ?? "";

    const newPassword =
      body.newPassword ?? "";

    if (
      !identifier ||
      !resetToken ||
      !newPassword
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Identifier, reset token and new password are required.",
        },
        { status: 400 },
      );
    }

    const rules =
      validPassword(newPassword);

    if (!rules.minLength) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password must contain at least 8 characters.",
        },
        { status: 400 },
      );
    }

    if (!rules.maxLength) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password cannot exceed 128 characters.",
        },
        { status: 400 },
      );
    }

    if (!rules.uppercase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password must contain an uppercase letter.",
        },
        { status: 400 },
      );
    }

    if (!rules.number) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password must contain a number.",
        },
        { status: 400 },
      );
    }

    if (!rules.special) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password must contain a special character.",
        },
        { status: 400 },
      );
    }

    let payload: ResetPayload;

    try {
      payload =
        decodePayload(
          resetToken,
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password reset token is invalid.",
        },
        { status: 401 },
      );
    }

    if (
      payload.kind !==
      "admin-password-reset"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid password reset session.",
        },
        { status: 401 },
      );
    }

    if (
      payload.recoveryVerified !== true
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Recovery verification is incomplete.",
        },
        { status: 401 },
      );
    }

    if (
      !payload.expiresAt ||
      payload.expiresAt <
        Math.floor(Date.now() / 1000)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password reset session has expired.",
        },
        { status: 410 },
      );
    }

    const normalizedIdentifier =
      payload.identifier ?? "";

    const submittedNormalized =
      normalizedIdentifier.includes(
        "@",
      )
        ? normalizeEmail(identifier)
        : normalizePhone(identifier);

    if (
      submittedNormalized !==
      normalizedIdentifier
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Recovery identity does not match.",
        },
        { status: 401 },
      );
    }

    /*
      IMPORTANT:
      The current HCS project stores admin settings
      in browser localStorage.

      Therefore this API route validates the reset
      request but cannot directly update that
      browser-local password.

      app/page.tsx must call updateAdminPassword()
      after this API responds with success.
    */

    return NextResponse.json({
      success: true,
      message:
        "Password reset verified. The new Admin password can now be saved.",
      passwordUpdateRequiredOnClient: true,
    });
  } catch (error) {
    console.error(
      "HCS reset password error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Password reset failed.",
      },
      { status: 500 },
    );
  }
}