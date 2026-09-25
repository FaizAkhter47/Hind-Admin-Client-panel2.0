import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";

export const runtime = "nodejs";

const SESSION_COOKIE_NAME = "hcs-session";
const ALLOWED_MODULES = [
  "websites",
  "keywords",
  "ranking",
  "pages",
  "blogs",
  "backlinks",
  "technical",
  "reports",
  "competitors",
  "notifications",
] as const;

type ModuleName = (typeof ALLOWED_MODULES)[number];

type SessionPayload = {
  sub?: string;
  role?: "admin" | "client";
  iat?: number;
  exp?: number;
  nonce?: string;
};

let mongoClientPromise: Promise<MongoClient> | null = null;

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is not configured.");
  return uri;
}

function getDatabaseName() {
  const configured =
    process.env.MONGODB_DB?.trim() ||
    process.env.MONGODB_DATABASE?.trim();

  if (configured) return configured;

  const uri = getMongoUri();
  const withoutProtocol = uri.replace(/^mongodb(?:\+srv)?:\/\//, "");
  const slashIndex = withoutProtocol.indexOf("/");

  if (slashIndex !== -1) {
    const databaseName = withoutProtocol
      .slice(slashIndex + 1)
      .split("?")[0]
      .trim();

    if (databaseName) return decodeURIComponent(databaseName);
  }

  return "hcs";
}

function getRecordsCollectionName() {
  return (
    process.env.MONGODB_RECORDS_COLLECTION?.trim() ||
    "portal_records"
  );
}

function getAdminCollectionName() {
  return (
    process.env.MONGODB_ADMIN_COLLECTION?.trim() ||
    "admins"
  );
}

async function getMongoClient() {
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

function getSessionSecret() {
  const secret = process.env.HCS_SESSION_SECRET?.trim();
  if (!secret) throw new Error("HCS_SESSION_SECRET is not configured.");
  if (secret.length < 32) {
    throw new Error("HCS_SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function safeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

function decodeSession(token: string): SessionPayload {
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Invalid session token.");

  const [encoded, signature] = parts;
  const expected = createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");

  if (
    !safeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expected, "utf8"),
    )
  ) {
    throw new Error("Invalid session signature.");
  }

  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as SessionPayload;

  if (!payload.sub || payload.role !== "admin") {
    throw new Error("Administrator session required.");
  }

  if (
    typeof payload.exp !== "number" ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error("Session expired.");
  }

  return payload;
}

async function requireAdmin(request: Request) {
  const token = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  if (!token) return false;

  try {
    decodeSession(token);
    return true;
  } catch {
    return false;
  }
}

function isModule(value: unknown): value is ModuleName {
  return (
    typeof value === "string" &&
    (ALLOWED_MODULES as readonly string[]).includes(value)
  );
}

function sanitizeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = { ...(value as Record<string, unknown>) };
  delete record.password;
  delete record.passwordHash;
  delete record.loginPassword;

  return record;
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json(
        { success: false, message: "Administrator authentication required." },
        { status: 401 },
      );
    }

    const module = new URL(request.url).searchParams.get("module");

    if (!isModule(module)) {
      return NextResponse.json(
        { success: false, message: "Invalid records module." },
        { status: 400 },
      );
    }

    const client = await getMongoClient();
    const collection = client
      .db(getDatabaseName())
      .collection(getRecordsCollectionName());

    const document = await collection.findOne({
      module,
      scope: "global",
    });

    return NextResponse.json(
      {
        success: true,
        module,
        records: Array.isArray(document?.records)
          ? document.records
          : [],
        updatedAt: document?.updatedAt ?? null,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("HCS admin records GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load records from MongoDB." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json(
        { success: false, message: "Administrator authentication required." },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 },
      );
    }

    const payload = body as {
      module?: unknown;
      records?: unknown;
    };

    if (!isModule(payload.module)) {
      return NextResponse.json(
        { success: false, message: "Invalid records module." },
        { status: 400 },
      );
    }

    if (!Array.isArray(payload.records)) {
      return NextResponse.json(
        { success: false, message: "Records must be an array." },
        { status: 400 },
      );
    }

    if (payload.records.length > 10000) {
      return NextResponse.json(
        { success: false, message: "Too many records." },
        { status: 400 },
      );
    }

    const records = payload.records
      .map(sanitizeRecord)
      .filter(
        (record): record is Record<string, unknown> => record !== null,
      );

    const now = new Date();

    const client = await getMongoClient();
    const collection = client
      .db(getDatabaseName())
      .collection(getRecordsCollectionName());

    await collection.updateOne(
      {
        module: payload.module,
        scope: "global",
      },
      {
        $set: {
          module: payload.module,
          scope: "global",
          records,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );

    return NextResponse.json(
      {
        success: true,
        module: payload.module,
        records,
        updatedAt: now.toISOString(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("HCS admin records PUT error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save records to MongoDB." },
      { status: 500 },
    );
  }
}
