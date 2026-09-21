import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";

export const runtime = "nodejs";

const SESSION_COOKIE_NAME = "hcs-session";

type AuthRole = "admin" | "client";

type SessionPayload = {
  sub?: string;
  role?: AuthRole;
  iat?: number;
  exp?: number;
  nonce?: string;
};

let mongoClientPromise: Promise<MongoClient> | null = null;

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
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

  return "hcs";
}

function getAdminCollectionName(): string {
  return (
    process.env.MONGODB_ADMIN_COLLECTION?.trim() ||
    "admins"
  );
}

function getClientCollectionName(): string {
  return (
    process.env.MONGODB_CLIENT_COLLECTION?.trim() ||
    "clients"
  );
}

async function getMongoClient(): Promise<MongoClient> {
  if (!mongoClientPromise) {
    const client = new MongoClient(getMongoUri(), {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10_000,
    });

    mongoClientPromise = client.connect();
  }

  return mongoClientPromise;
}

function getSessionSecret(): string {
  const secret = process.env.HCS_SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "HCS_SESSION_SECRET is not configured.",
    );
  }

  if (secret.length < 32) {
    throw new Error(
      "HCS_SESSION_SECRET must contain at least 32 characters.",
    );
  }

  return secret;
}

function safeEqual(
  a: Buffer,
  b: Buffer,
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

function decodeSession(
  token: string,
): SessionPayload {
  const parts = token.split(".");

  if (parts.length !== 2) {
    throw new Error("Invalid session token.");
  }

  const [encoded, signature] = parts;

  if (!encoded || !signature) {
    throw new Error("Invalid session token.");
  }

  const expectedSignature = createHmac(
    "sha256",
    getSessionSecret(),
  )
    .update(encoded)
    .digest("base64url");

  const providedBuffer = Buffer.from(
    signature,
    "utf8",
  );

  const expectedBuffer = Buffer.from(
    expectedSignature,
    "utf8",
  );

  if (
    !safeEqual(
      providedBuffer,
      expectedBuffer,
    )
  ) {
    throw new Error(
      "Invalid session signature.",
    );
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(
      Buffer.from(
        encoded,
        "base64url",
      ).toString("utf8"),
    );
  } catch {
    throw new Error(
      "Invalid session payload.",
    );
  }

  if (
    !decoded ||
    typeof decoded !== "object"
  ) {
    throw new Error(
      "Invalid session payload.",
    );
  }

  return decoded as SessionPayload;
}

function isValidRole(
  value: unknown,
): value is AuthRole {
  return (
    value === "admin" ||
    value === "client"
  );
}

function getDocumentIdCandidates(
  subject: string,
): (ObjectId | string)[] {
  const candidates: (ObjectId | string)[] = [
    subject,
  ];

  if (ObjectId.isValid(subject)) {
    try {
      candidates.unshift(
        new ObjectId(subject),
      );
    } catch {
      // Keep string candidate.
    }
  }

  return candidates;
}

async function findAccount(
  role: AuthRole,
  subject: string,
) {
  const client = await getMongoClient();

  const db = client.db(
    getDatabaseName(),
  );

  const collection = db.collection(
    role === "admin"
      ? getAdminCollectionName()
      : getClientCollectionName(),
  );

  const idCandidates =
    getDocumentIdCandidates(subject);

  const objectIdCandidates =
    idCandidates.filter(
      (
        candidate,
      ): candidate is ObjectId =>
        candidate instanceof ObjectId,
    );

  const identityField =
    role === "admin"
      ? "adminId"
      : "clientId";

  return collection.findOne({
    $or: [
      ...(objectIdCandidates.length > 0
        ? [
            {
              _id: {
                $in: objectIdCandidates,
              },
            },
          ]
        : []),
      {
        [identityField]: subject,
      },
    ],
  });
}

function buildSafeUser(
  role: AuthRole,
  account: Record<string, unknown>,
) {
  if (role === "admin") {
    const id = String(
      account._id ??
        account.adminId ??
        "",
    );

    return {
      id,

      adminId: account.adminId
        ? String(account.adminId)
        : undefined,

      accountId: account._id
        ? String(account._id)
        : account.adminId
          ? String(account.adminId)
          : undefined,

      username: account.username
        ? String(account.username)
        : undefined,

      name: account.fullName
        ? String(account.fullName)
        : account.name
          ? String(account.name)
          : "HCS Administrator",

      fullName: account.fullName
        ? String(account.fullName)
        : undefined,

      email: account.email
        ? String(account.email)
        : undefined,

      phone: account.phone
        ? String(account.phone)
        : undefined,

      role: "admin" as const,
    };
  }

  const id = String(
    account._id ??
      account.clientId ??
      "",
  );

  return {
    id,

    clientId: account.clientId
      ? String(account.clientId)
      : undefined,

    accountId: account._id
      ? String(account._id)
      : account.clientId
        ? String(account.clientId)
        : undefined,

    username: account.username
      ? String(account.username)
      : undefined,

    name: account.name
      ? String(account.name)
      : account.companyName
        ? String(account.companyName)
        : "Client",

    email: account.email
      ? String(account.email)
      : undefined,

    companyName: account.companyName
      ? String(account.companyName)
      : "",

    phone: account.phone
      ? String(account.phone)
      : undefined,

    role: "client" as const,
  };
}

function clearSessionCookie(
  response: NextResponse,
) {
  response.cookies.set(
    SESSION_COOKIE_NAME,
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    },
  );
}

function unauthorizedResponse(
  message = "Not authenticated.",
) {
  const response = NextResponse.json(
    {
      success: false,
      authenticated: false,
      user: null,
      message,
    },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  return response;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const token =
      request.cookies.get(
        SESSION_COOKIE_NAME,
      )?.value;

    if (!token) {
      return unauthorizedResponse(
        "No active session.",
      );
    }

    let session: SessionPayload;

    try {
      session = decodeSession(token);
    } catch (error) {
      console.error(
        "HCS auth/me session decode error:",
        error,
      );

      const response =
        unauthorizedResponse(
          "Invalid session.",
        );

      clearSessionCookie(response);

      return response;
    }

    if (
      !session.sub ||
      !session.role ||
      !isValidRole(session.role)
    ) {
      const response =
        unauthorizedResponse(
          "Invalid session data.",
        );

      clearSessionCookie(response);

      return response;
    }

    if (
      typeof session.exp !== "number" ||
      session.exp <=
        Math.floor(Date.now() / 1000)
    ) {
      const response =
        unauthorizedResponse(
          "Session expired.",
        );

      clearSessionCookie(response);

      return response;
    }

    const account =
      await findAccount(
        session.role,
        session.sub,
      );

    if (!account) {
      const response =
        unauthorizedResponse(
          "Account not found.",
        );

      clearSessionCookie(response);

      return response;
    }

    const user = buildSafeUser(
      session.role,
      account as Record<
        string,
        unknown
      >,
    );

    return NextResponse.json(
      {
        success: true,
        authenticated: true,
        user,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "HCS auth/me error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        user: null,
        message:
          "Unable to verify session.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}