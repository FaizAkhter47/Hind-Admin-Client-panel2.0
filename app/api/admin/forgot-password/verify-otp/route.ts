import { NextResponse } from "next/server";
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { MongoClient } from "mongodb";

export const runtime = "nodejs";

type RecoveryChannel = "email" | "sms";

type OtpPayload = {
  kind?: string;
  identifier?: string;
  channel?: RecoveryChannel;
  otpDigest?: string;
  issuedAt?: number;
  expiresAt?: number;
};

const RESET_TTL_SECONDS = 10 * 60;

let mongoClientPromise: Promise<MongoClient> | null =
  null;

function getSecret(): string {
  const secret =
    process.env.HCS_PASSWORD_RESET_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "HCS_PASSWORD_RESET_SECRET is not configured.",
    );
  }

  return secret;
}

function getMongoUri(): string {
  const uri =
    process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not configured.",
    );
  }

  return uri;
}

function getDatabaseName(): string {
  const configured =
    process.env.MONGODB_DB?.trim() ||
    process.env.MONGODB_DATABASE?.trim();

  if (configured) {
    return configured;
  }

  try {
    const uri = getMongoUri();

    const withoutProtocol =
      uri.replace(
        /^mongodb(?:\+srv)?:\/\//,
        "",
      );

    const slashIndex =
      withoutProtocol.indexOf("/");

    if (slashIndex !== -1) {
      const afterSlash =
        withoutProtocol.slice(
          slashIndex + 1,
        );

      const databaseName =
        afterSlash
          .split("?")[0]
          .trim();

      if (databaseName) {
        return decodeURIComponent(
          databaseName,
        );
      }
    }
  } catch {
    // Use default database.
  }

  return "hcs";
}

function getAdminCollectionName(): string {
  return (
    process.env.MONGODB_ADMIN_COLLECTION?.trim() ||
    "admins"
  );
}

async function getMongoClient(): Promise<MongoClient> {
  if (!mongoClientPromise) {
    const client = new MongoClient(
      getMongoUri(),
      {
        maxPoolSize: 10,
      },
    );

    mongoClientPromise =
      client.connect();
  }

  return mongoClientPromise;
}

function safeEqual(
  a: string,
  b: string,
): boolean {
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

function normalizeEmail(
  value: string,
): string {
  return value.trim().toLowerCase();
}

function normalizePhone(
  value: string,
): string {
  return value
    .trim()
    .replace(/[^\d+]/g, "");
}

function normalizeIdentifier(
  value: string,
  channel: RecoveryChannel,
): string {
  return channel === "sms"
    ? normalizePhone(value)
    : normalizeEmail(value);
}

function decodePayload(
  token: string,
): OtpPayload {
  const parts =
    token.split(".");

  if (parts.length !== 2) {
    throw new Error(
      "Invalid token.",
    );
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
): string {
  const encoded =
    Buffer.from(
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

function escapeRegex(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

async function findAdminByRecoveryIdentity(
  identifier: string,
  channel: RecoveryChannel,
) {
  const client =
    await getMongoClient();

  const db =
    client.db(
      getDatabaseName(),
    );

  const collection =
    db.collection(
      getAdminCollectionName(),
    );

  if (channel === "email") {
    const email =
      normalizeEmail(identifier);

    return collection.findOne({
      email: {
        $regex: `^${escapeRegex(
          email,
        )}$`,
        $options: "i",
      },
    });
  }

  const phone =
    normalizePhone(identifier);

  return collection.findOne({
    $or: [
      {
        phone,
      },
      {
        phone: identifier.trim(),
      },
    ],
  });
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
        {
          status: 400,
        },
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "OTP must contain exactly 6 digits.",
        },
        {
          status: 400,
        },
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
        {
          status: 401,
        },
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
        {
          status: 401,
        },
      );
    }

    if (
      payload.channel !== "email" &&
      payload.channel !== "sms"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid recovery channel.",
        },
        {
          status: 401,
        },
      );
    }

    if (
      !payload.otpDigest ||
      !payload.identifier ||
      !payload.expiresAt
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "OTP session is incomplete.",
        },
        {
          status: 401,
        },
      );
    }

    const now =
      Math.floor(
        Date.now() / 1000,
      );

    if (
      payload.expiresAt < now
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "OTP has expired. Request a new OTP.",
        },
        {
          status: 410,
        },
      );
    }

    const submittedIdentifier =
      normalizeIdentifier(
        identifier,
        payload.channel,
      );

    const sessionIdentifier =
      normalizeIdentifier(
        payload.identifier,
        payload.channel,
      );

    if (
      submittedIdentifier !==
      sessionIdentifier
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Recovery identifier does not match the OTP request.",
        },
        {
          status: 401,
        },
      );
    }

    const admin =
      await findAdminByRecoveryIdentity(
        sessionIdentifier,
        payload.channel,
      );

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Admin recovery identity could not be verified.",
        },
        {
          status: 401,
        },
      );
    }

    if (admin.active === false) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Admin account is inactive.",
        },
        {
          status: 403,
        },
      );
    }

    const expectedOtpDigest =
      createHmac(
        "sha256",
        getSecret(),
      )
        .update(
          `${sessionIdentifier}:${otp}:${payload.expiresAt}`,
        )
        .digest("hex");

    if (
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
        {
          status: 401,
        },
      );
    }

    const resetIssuedAt =
      Math.floor(
        Date.now() / 1000,
      );

    const resetToken =
      signPayload({
        kind:
          "admin-password-reset",

        identifier:
          sessionIdentifier,

        issuedAt:
          resetIssuedAt,

        expiresAt:
          resetIssuedAt +
          RESET_TTL_SECONDS,

        recoveryVerified: true,
      });

    return NextResponse.json(
      {
        success: true,
        message:
          "OTP verified successfully.",
        resetToken,
      },
      {
        status: 200,
      },
    );
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
      {
        status: 500,
      },
    );
  }
}