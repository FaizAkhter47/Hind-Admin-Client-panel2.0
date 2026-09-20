import { NextRequest, NextResponse } from "next/server";
import {
  MongoClient,
  ObjectId,
  type Collection,
} from "mongodb";
import {
  createHmac,
  randomBytes,
  scrypt,
} from "crypto";

export const runtime = "nodejs";

type ClientDocument = {
  _id?: ObjectId;
  clientId: string;
  username: string;
  email: string;
  role: "client";
  passwordHash: string;
  status: string;
  active: boolean;
  clientPortalEnabled: boolean;
  updatedAt?: Date;
};

declare global {
  var __hcsMongoClient: MongoClient | undefined;
  var __hcsMongoPromise: Promise<MongoClient> | undefined;
}

function base64UrlToBuffer(value: string) {
  return Buffer.from(
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/"),
    "base64",
  );
}

async function getMongoClient() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not configured.",
    );
  }

  if (!global.__hcsMongoClient) {
    if (!global.__hcsMongoPromise) {
      const client =
        new MongoClient(uri);

      global.__hcsMongoPromise =
        client.connect();
    }

    global.__hcsMongoClient =
      await global.__hcsMongoPromise;
  }

  return global.__hcsMongoClient;
}

function getCollection(
  client: MongoClient,
): Collection<ClientDocument> {
  return client
    .db(
      process.env.MONGODB_DB ||
        process.env.MONGODB_DATABASE ||
        "hcs",
    )
    .collection<ClientDocument>(
      process.env
        .MONGODB_CLIENT_COLLECTION ||
        "clients",
    );
}

function verifyClientSession(
  request: NextRequest,
) {
  const secret =
    process.env.HCS_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "HCS_SESSION_SECRET is not configured.",
    );
  }

  const cookie =
    request.cookies.get(
      "hcs-session",
    )?.value;

  if (!cookie) {
    return null;
  }

  const parts =
    cookie.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [
    encodedPayload,
    encodedSignature,
  ] = parts;

  try {
    const expected =
      createHmac(
        "sha256",
        secret,
      )
        .update(
          encodedPayload,
        )
        .digest();

    const received =
      base64UrlToBuffer(
        encodedSignature,
      );

    if (
      expected.length !==
        received.length ||
      !expected.equals(
        received,
      )
    ) {
      return null;
    }

    const payload =
      JSON.parse(
        base64UrlToBuffer(
          encodedPayload,
        ).toString(
          "utf8",
        ),
      );

    if (
      !payload?.sub ||
      !payload?.role
    ) {
      return null;
    }

    if (
      typeof payload.exp !==
        "number" ||
      payload.exp <=
        Math.floor(
          Date.now() / 1000,
        )
    ) {
      return null;
    }

    if (
      String(
        payload.role,
      ).toLowerCase() !==
      "client"
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  return new Promise(
    (resolve) => {
      const parts =
        storedHash.split(":");

      if (
        parts.length !== 3 ||
        parts[0] !== "scrypt"
      ) {
        resolve(false);
        return;
      }

      const salt = parts[1];
      const expectedKey =
        parts[2];

      scrypt(
        password,
        salt,
        64,
        (
          error,
          derivedKey,
        ) => {
          if (error) {
            resolve(false);
            return;
          }

          resolve(
            derivedKey.toString(
              "hex",
            ) ===
              expectedKey,
          );
        },
      );
    },
  );
}

function hashPassword(
  password: string,
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const salt =
        randomBytes(16).toString(
          "hex",
        );

      scrypt(
        password,
        salt,
        64,
        (
          error,
          derivedKey,
        ) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(
            `scrypt:${salt}:${derivedKey.toString(
              "hex",
            )}`,
          );
        },
      );
    },
  );
}

function cleanString(
  value: unknown,
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function getPasswordError(
  password: string,
) {
  if (
    password.length < 8
  ) {
    return "Password must be at least 8 characters.";
  }

  if (
    password.length > 128
  ) {
    return "Password cannot exceed 128 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain an uppercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain a number.";
  }

  if (
    !/[^A-Za-z0-9]/.test(
      password,
    )
  ) {
    return "Password must contain a special character.";
  }

  return null;
}

export async function POST(
  request: NextRequest,
) {
  try {
    const session =
      verifyClientSession(
        request,
      );

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized.",
        },
        { status: 401 },
      );
    }

    const body =
      await request
        .json()
        .catch(() => null);

    const currentPassword =
      cleanString(
        body?.currentPassword,
      );

    const newPassword =
      cleanString(
        body?.newPassword,
      );

    if (
      !currentPassword ||
      !newPassword
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Current password and new password are required.",
        },
        { status: 400 },
      );
    }

    const passwordError =
      getPasswordError(
        newPassword,
      );

    if (passwordError) {
      return NextResponse.json(
        {
          success: false,
          message:
            passwordError,
        },
        { status: 400 },
      );
    }

    if (
      currentPassword ===
      newPassword
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "New password must be different from the current password.",
        },
        { status: 400 },
      );
    }

    const mongoClient =
      await getMongoClient();

    const collection =
      getCollection(
        mongoClient,
      );

    const sub =
      String(session.sub);

    let client:
      | ClientDocument
      | null = null;

    if (
      ObjectId.isValid(sub)
    ) {
      client =
        await collection.findOne(
          {
            _id:
              new ObjectId(sub),
          },
        );
    }

    if (!client) {
      client =
        await collection.findOne(
          {
            clientId: sub,
          },
        );
    }

    if (!client) {
      client =
        await collection.findOne(
          {
            $or: [
              {
                username: sub.toLowerCase(),
              },
              {
                email: sub.toLowerCase(),
              },
            ],
          },
        );
    }

    if (!client) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Client account not found.",
        },
        { status: 404 },
      );
    }

    if (
      client.active === false ||
      client.clientPortalEnabled ===
        false ||
      String(
        client.status,
      ).toLowerCase() !==
        "active"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Client portal access is disabled.",
        },
        { status: 403 },
      );
    }

    const currentMatches =
      await verifyPassword(
        currentPassword,
        client.passwordHash,
      );

    if (!currentMatches) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Current password is incorrect.",
        },
        { status: 400 },
      );
    }

    const newHash =
      await hashPassword(
        newPassword,
      );

    await collection.updateOne(
      {
        _id: client._id,
      },
      {
        $set: {
          passwordHash:
            newHash,
          updatedAt:
            new Date(),
        },
        $unset: {
          password: "",
          loginPassword: "",
        },
      },
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Password changed successfully.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "POST /api/auth/change-password error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to change password right now.",
      },
      { status: 500 },
    );
  }
}