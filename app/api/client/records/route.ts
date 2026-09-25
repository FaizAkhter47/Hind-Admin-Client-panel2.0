import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";

export const runtime = "nodejs";

const SESSION_COOKIE_NAME = "hcs-session";
const MODULES = [
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

type ModuleName = (typeof MODULES)[number];

type SessionPayload = {
  sub: string;
  role?: "admin" | "client";
  exp?: number;
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

  const uri = getMongoUri().replace(/^mongodb(?:\+srv)?:\/\//, "");
  const slashIndex = uri.indexOf("/");
  if (slashIndex !== -1) {
    const name = uri.slice(slashIndex + 1).split("?")[0].trim();
    if (name) return decodeURIComponent(name);
  }
  return "hcs";
}

async function getMongoClient() {
  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(getMongoUri(), {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10_000,
    }).connect();
  }
  return mongoClientPromise;
}

function getSessionSecret() {
  const secret = process.env.HCS_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("HCS_SESSION_SECRET is not configured correctly.");
  }
  return secret;
}

function decodeSession(token: string): SessionPayload {
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Invalid session token.");

  const [encoded, signature] = parts;
  const expected = createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");

  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid session signature.");
  }

  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as SessionPayload;

  if (
    payload.role !== "client" ||
    !payload.sub ||
    typeof payload.exp !== "number" ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error("Valid client session required.");
  }

  return payload;
}

function getCookie(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function isModule(value: unknown): value is ModuleName {
  return (
    typeof value === "string" &&
    (MODULES as readonly string[]).includes(value)
  );
}

function recordId(record: Record<string, unknown>) {
  return String(
    record.id ??
      record._id ??
      record.websiteId ??
      record.keywordId ??
      record.pageId ??
      record.blogId ??
      record.backlinkId ??
      record.reportId ??
      "",
  );
}

function websiteId(record: Record<string, unknown>) {
  return String(
    record.websiteId ??
      record.websiteID ??
      record.siteId ??
      "",
  );
}

export async function GET(request: Request) {
  try {
    const token = getCookie(request, SESSION_COOKIE_NAME);
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Client authentication required." },
        { status: 401 },
      );
    }

    const session = decodeSession(token);
    const moduleParam = new URL(request.url).searchParams.get("module");

    const clientMongo = await getMongoClient();
    const db = clientMongo.db(getDatabaseName());
    const clients = db.collection(
      process.env.MONGODB_CLIENT_COLLECTION?.trim() || "clients",
    );

    const candidates: (ObjectId | string)[] = [session.sub];
    if (ObjectId.isValid(session.sub)) {
      candidates.unshift(new ObjectId(session.sub));
    }

    const client = await clients.findOne({
      $or: [
        { _id: { $in: candidates.filter((x) => x instanceof ObjectId) } },
        { clientId: session.sub },
      ],
    });

    if (!client) {
      return NextResponse.json(
        { success: false, message: "Client account not found." },
        { status: 404 },
      );
    }

    if (
      client.active === false ||
      client.clientPortalEnabled === false ||
      ["Suspended", "Disabled"].includes(String(client.status))
    ) {
      return NextResponse.json(
        { success: false, message: "Client portal access is unavailable." },
        { status: 403 },
      );
    }

    const assignedWebsiteIds = Array.isArray(client.assignedWebsiteIds)
      ? client.assignedWebsiteIds.map(String)
      : [];

    const recordsCollection = db.collection(
      process.env.MONGODB_RECORDS_COLLECTION?.trim() || "portal_records",
    );

    const modules: ModuleName[] = isModule(moduleParam)
      ? [moduleParam]
      : [...MODULES];

    const documents = await recordsCollection
      .find({
        module: { $in: modules },
        scope: "global",
      })
      .toArray();

    const records: Record<string, unknown[]> = {};

    for (const module of modules) {
      const document = documents.find((item) => item.module === module);
      const all = Array.isArray(document?.records) ? document.records : [];

      records[module] = all.filter((record) => {
        if (!record || typeof record !== "object") return false;
        const item = record as Record<string, unknown>;

        if (module === "websites") {
          return assignedWebsiteIds.includes(recordId(item));
        }

        const site = websiteId(item);

        // Records tied to a website are visible only when that
        // website is assigned to the authenticated client.
        if (site) return assignedWebsiteIds.includes(site);

        // Untagged records remain available to the client when
        // their portal permission is enabled.
        return true;
      });
    }

    return NextResponse.json(
      {
        success: true,
        records,
        assignedWebsiteIds,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("HCS client records GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load client records." },
      { status: 500 },
    );
  }
}
