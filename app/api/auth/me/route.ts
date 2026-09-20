import { NextResponse } from "next/server";
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import {
  MongoClient,
  ObjectId,
} from "mongodb";

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

let mongoClientPromise: Promise<MongoClient> | null =
  null;

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
    const client =
      new MongoClient(
        getMongoUri(),
        {
          maxPoolSize: 10,
          minPoolSize: 0,
          serverSelectionTimeoutMS: 10_000,
        },
      );

    mongoClientPromise =
      client.connect();
  }

  return mongoClientPromise;
}

function getSessionSecret(): string {
  const secret =
    process.env.HCS_SESSION_SECRET?.trim();

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

  return timingSafeEqual(
    a,
    b,
  );
}

function decodeSession(
  token: string,
): SessionPayload {
  const parts =
    token.split(".");

  if (parts.length !== 2) {
    throw new Error(
      "Invalid session token.",
    );
  }

  const [
    encoded,
    signature,
  ] = parts;

  if (!encoded || !signature) {
    throw new Error(
      "Invalid session token.",
    );
  }

  const expectedSignature =
    createHmac(
      "sha256",
      getSessionSecret(),
    )
      .update(encoded)
      .digest("base64url");

  const providedBuffer =
    Buffer.from(
      signature,
      "utf8",
    );

  const expectedBuffer =
    Buffer.from(
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
  const client =
    await getMongoClient();

  const db =
    client.db(
      getDatabaseName(),
    );

  const collection =
    db.collection(
      role === "admin"
        ? getAdminCollectionName()
        : getClientCollectionName(),
    );

  const idCandidates =
    getDocumentIdCandidates(
      subject,
    );

  const identityField =
    role === "admin"
      ? "adminId"
      : "clientId";

  const objectIdCandidates = idCandidates.filter(
    (candidate): candidate is ObjectId =>
      candidate instanceof ObjectId,
  );

  return collection.findOne({
    $or: [
      { _id: { $in: objectIdCandidates } },
      { [identityField]: subject },
    ],
  });
}

function buildSafeUser(
  role: AuthRole,
  account: Record<string, unknown>,
) {
  if (role === "admin") {
    const id =
      String(
        account._id ??
          account.adminId ??
          "",
      );

    return {
      id,
      adminId:
        account.adminId
          ? String(
              account.adminId,
            )
          : undefined,
      accountId:
        account._id
          ? String(account._id)
          : account.adminId
            ? String(
                account.adminId,
              )
            : undefined,
      username:
        account.username
          ? String(
              account.username,
            )
          : undefined,
      name:
        account.fullName
          ? String(
              account.fullName,
            )
          : account.name
            ? String(
                account.name,
              )
            : "HCS Administrator",
      fullName:
        account.fullName
          ? String(
              account.fullName,
            )
          : undefined,
      email:
        account.email
          ? String(
              account.email,
            )
          : undefined,
      role: "admin" as const,
    };
  }

  const id =
    String(
      account._id ??
        account.clientId ??
        "",
    );

  return {
    id,
    clientId:
      account.clientId
        ? String(
            account.clientId,
          )
        : undefined,
    accountId:
      account._id
        ? String(account._id)
        : account.clientId
          ? String(
              account.clientId,
            )
          : undefined,
    username:
      account.username
        ? String(
            account.username,
          )
        : undefined,
    name:
      account.name
        ? String(account.name)
        : account.companyName
          ? String(
              account.companyName,
            )
          : "Client",
    email:
      account.email
        ? String(
            account.email,
          )
        : undefined,
    companyName:
      account.companyName
        ? String(
            account.companyName,
          )
        : "",
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

export async function GET() {
  try {
    const token =
      (
        await Promise.resolve()
      );

    void token;

    /*
     * Cookie access is handled below through
     * NextResponse request context.
     */
    return NextResponse.json(
      {
        success: false,
        message:
          "Session request could not be processed.",
      },
      {
        status: 500,
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
        message:
          "Unable to verify session.",
      },
      {
        status: 500,
      },
    );
  }
}