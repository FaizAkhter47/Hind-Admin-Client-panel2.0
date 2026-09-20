import { NextResponse } from "next/server";
import {
  createHmac,
  timingSafeEqual,
  randomBytes,
  scrypt as scryptCallback,
} from "node:crypto";
import { promisify } from "node:util";
import { MongoClient } from "mongodb";

export const runtime = "nodejs";

const scrypt = promisify(scryptCallback);

type ResetPayload = {
  kind?: string;
  identifier?: string;
  issuedAt?: number;
  expiresAt?: number;
  recoveryVerified?: boolean;
};

let mongoClientPromise: Promise<MongoClient> | null = null;

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  return uri;
}

function getDatabaseName() {
  const configured =
    process.env.MONGODB_DB?.trim() ||
    process.env.MONGODB_DATABASE?.trim();

  if (configured) {
    return configured;
  }

  try {
    const uri = getMongoUri();

    const withoutProtocol = uri.replace(
      /^mongodb(?:\+srv)?:\/\//,
      "",
    );

    const slashIndex = withoutProtocol.indexOf("/");

    if (slashIndex !== -1) {
      const afterSlash = withoutProtocol.slice(
        slashIndex + 1,
      );

      const databaseName = afterSlash
        .split("?")[0]
        .trim();

      if (databaseName) {
        return decodeURIComponent(databaseName);
      }
    }
  } catch {
    // Use default DB below.
  }

  return "hcs";
}

function getAdminCollectionName() {
  return (
    process.env.MONGODB_ADMIN_COLLECTION?.trim() ||
    "admins"
  );
}

async function getMongoClient() {
  if (!mongoClientPromise) {
    const client = new MongoClient(
      getMongoUri(),
      {
        maxPoolSize: 10,
      },
    );

    mongoClientPromise = client.connect();
  }

  return mongoClientPromise;
}

function getSecret() {
  const secret =
    process.env.HCS_PASSWORD_RESET_SECRET?.trim();

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

  return timingSafeEqual(left, right);
}

function decodePayload(
  token: string,
) {
  const parts = token.split(".");

  if (parts.length !== 2) {
    throw new Error("Invalid token.");
  }

  const [encoded, signature] = parts;

  const expected = createHmac(
    "sha256",
    getSecret(),
  )
    .update(encoded)
    .digest("base64url");

  if (!safeEqual(signature, expected)) {
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

function normalizeIdentifier(
  value: string,
) {
  const cleaned = value.trim();

  if (cleaned.includes("@")) {
    return normalizeEmail(cleaned);
  }

  return normalizePhone(cleaned);
}

function validPassword(
  password: string,
) {
  return {
    minLength: password.length >= 8,
    maxLength: password.length <= 128,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

async function hashPassword(
  password: string,
) {
  const salt =
    randomBytes(16).toString("hex");

  const derivedKey =
    (await scrypt(
      password,
      salt,
      64,
    )) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString(
    "hex",
  )}`;
}

function escapeRegex(
  value: string,
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

async function findAdminByIdentifier(
  identifier: string,
) {
  const client =
    await getMongoClient();

  const db = client.db(
    getDatabaseName(),
  );

  const collection =
    db.collection(
      getAdminCollectionName(),
    );

  const normalized =
    normalizeIdentifier(identifier);

  if (!normalized) {
    return null;
  }

  const isEmail =
    normalized.includes("@");

  if (isEmail) {
    return collection.findOne({
      email: {
        $regex: `^${escapeRegex(
          normalized,
        )}$`,
        $options: "i",
      },
    });
  }

  const normalizedPhone =
    normalizePhone(identifier);

  return collection.findOne({
    $or: [
      {
        phone: normalizedPhone,
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
      validPassword(
        newPassword,
      );

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
      payload.recoveryVerified !==
      true
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

    const now =
      Math.floor(
        Date.now() / 1000,
      );

    if (
      !payload.expiresAt ||
      payload.expiresAt < now
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

    const tokenIdentifier =
      payload.identifier?.trim() ?? "";

    if (!tokenIdentifier) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password reset identity is missing.",
        },
        { status: 401 },
      );
    }

    const submittedNormalized =
      normalizeIdentifier(
        identifier,
      );

    const tokenNormalized =
      normalizeIdentifier(
        tokenIdentifier,
      );

    if (
      submittedNormalized !==
      tokenNormalized
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

    const admin =
      await findAdminByIdentifier(
        tokenIdentifier,
      );

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Admin account was not found.",
        },
        { status: 404 },
      );
    }

    if (admin.active === false) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Admin account is inactive.",
        },
        { status: 403 },
      );
    }

    const passwordHash =
      await hashPassword(
        newPassword,
      );

    const client =
      await getMongoClient();

    const db = client.db(
      getDatabaseName(),
    );

    const collection =
      db.collection(
        getAdminCollectionName(),
      );

    const updatedAt =
      new Date();

    const result =
      await collection.updateOne(
        {
          _id: admin._id,
        },
        {
          $set: {
            passwordHash,
            passwordUpdatedAt:
              updatedAt,
            updatedAt,
          },
          $unset: {
            password: "",
            loginPassword: "",
          },
        },
      );

    if (
      !result.acknowledged ||
      result.modifiedCount !== 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password could not be updated.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Admin password has been reset successfully.",
        passwordUpdateRequiredOnClient:
          false,
      },
      { status: 200 },
    );
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