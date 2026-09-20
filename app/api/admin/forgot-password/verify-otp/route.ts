import { NextResponse } from "next/server";
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export const runtime = "nodejs";

type OtpPayload = {
  kind?: string;
  identifier?: string;
  channel?: "email" | "sms";
  otpDigest?: string;
  issuedAt?: number;
  expiresAt?: number;
};

const RESET_TTL_SECONDS =
  10 * 60;

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

function normalizeIdentifier(
  value: string,
) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value
    .trim()
    .replace(/[^\d+]/g, "");
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

  const expectedSignature =
    createHmac(
      "sha256",
      getSecret(),
    )
      .update(encoded)
      .digest("base64url");

  if (
    !safeEqual(
      signature,
      expectedSignature,
    )
  ) {
    throw new Error(
      "Invalid token signature.",
    );
  }

  const decoded =
    Buffer.from(
      encoded,
      "base64url",
    ).toString("utf8");

  return JSON.parse(
    decoded,
  ) as OtpPayload;
}

function signPayload(
  payload: Record<string, unknown>,
) {
  const encoded = Buffer.from(
    JSON.stringify(payload),
  ).toString("base64url");

  const signature =
    createHmac(
      "sha256",
      getSecret(),
    )
      .update(encoded)
      .digest("base64url");

  return `${encoded}.${signature}`;
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as {
        identifier?: string;
        otp?: string;
        otpSession?: string;
      };

    const identifier =
      body.identifier?.trim() ?? "";

    const otp =
      body.otp?.trim() ?? "";

    const otpSession =
      body.otpSession?.trim() ?? "";

    if (
      !identifier ||
      !otp ||
      !otpSession
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Recovery identifier, OTP and OTP session are required.",
        },
        { status: 400 },
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "OTP must contain exactly 6 digits.",
        },
        { status: 400 },
      );
    }

    let payload: OtpPayload;

    try {
      payload =
        decodePayload(
          otpSession,
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "OTP session is invalid.",
        },
        { status: 401 },
      );
    }

    if (
      payload.kind !==
      "admin-otp"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid recovery session.",
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
            "OTP has expired. Request a new OTP.",
        },
        { status: 410 },
      );
    }

    const submittedIdentifier =
      payload.channel === "sms"
        ? normalizePhone(
            identifier,
          )
        : normalizeIdentifier(
            identifier,
          );

    if (
      submittedIdentifier !==
      payload.identifier
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Recovery identifier does not match the OTP request.",
        },
        { status: 401 },
      );
    }

    const configuredDestination =
      payload.channel === "sms"
        ? normalizePhone(
            process.env
              .HCS_ADMIN_RECOVERY_PHONE ??
              "",
          )
        : normalizeIdentifier(
            process.env
              .HCS_ADMIN_RECOVERY_EMAIL ??
              "",
          );

    if (
      !configuredDestination ||
      submittedIdentifier !==
        configuredDestination
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Admin recovery identity could not be verified.",
        },
        { status: 401 },
      );
    }

    const expectedOtpDigest =
      createHmac(
        "sha256",
        getSecret(),
      )
        .update(
          `${normalizeIdentifier(
            configuredDestination,
          )}:${otp}:${payload.expiresAt}`,
        )
        .digest("hex");

    if (
      !payload.otpDigest ||
      !safeEqual(
        expectedOtpDigest,
        payload.otpDigest,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid OTP.",
        },
        { status: 401 },
      );
    }

    const now =
      Math.floor(
        Date.now() / 1000,
      );

    const resetToken =
      signPayload({
        kind: "admin-password-reset",
        identifier:
          submittedIdentifier,
        issuedAt: now,
        expiresAt:
          now + RESET_TTL_SECONDS,
        recoveryVerified: true,
      });

    return NextResponse.json({
      success: true,
      message:
        "OTP verified successfully.",
      resetToken,
    });
  } catch (error) {
    console.error(
      "HCS verify OTP error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "OTP verification failed.",
      },
      { status: 500 },
    );
  }
}