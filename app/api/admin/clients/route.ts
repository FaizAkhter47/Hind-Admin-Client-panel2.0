import { NextRequest, NextResponse } from "next/server";
import {
  MongoClient,
  ObjectId,
  type Collection,
  type Document,
} from "mongodb";
import { createHmac, randomBytes, randomInt, scrypt } from "crypto";

export const runtime = "nodejs";

type ClientDocument = {
  _id?: ObjectId;

  clientId: string;
  username: string;
  email: string;

  name: string;
  fullName?: string;
  companyName?: string;
  phone?: string;
  website?: string;

  plan?: string;
  assignedManager?: string;

  status: string;
  active: boolean;

  role: "client";

  passwordHash: string;

  clientPortalEnabled: boolean;

  permissions?: string[];
  assignedWebsiteIds?: string[];
  tags?: string[];
  notes?: string;
  services?: string[];

  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __hcsMongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var __hcsMongoPromise: Promise<MongoClient> | undefined;
}

function getMongoUri() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  return uri;
}

async function getMongoClient() {
  const uri = getMongoUri();

  if (!global.__hcsMongoClient) {
    if (!global.__hcsMongoPromise) {
      const client = new MongoClient(uri, {
        maxPoolSize: 10,
      });

      global.__hcsMongoPromise = client.connect();
    }

    global.__hcsMongoClient = await global.__hcsMongoPromise;
  }

  return global.__hcsMongoClient;
}

function getDatabaseName() {
  return (
    process.env.MONGODB_DB ||
    process.env.MONGODB_DATABASE ||
    "hcs"
  );
}

function getClientsCollection(
  client: MongoClient
): Collection<ClientDocument> {
  const db = client.db(getDatabaseName());

  return db.collection<ClientDocument>(
    process.env.MONGODB_CLIENT_COLLECTION || "clients"
  );
}

/* -------------------------------------------------------
   SESSION / ADMIN AUTH
------------------------------------------------------- */

function base64UrlToBuffer(value: string) {
  return Buffer.from(
    value.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );
}

function verifyAdminSession(request: NextRequest) {
  const secret = process.env.HCS_SESSION_SECRET;

  if (!secret) {
    throw new Error("HCS_SESSION_SECRET is not configured.");
  }

  const cookie = request.cookies.get("hcs-session")?.value;

  if (!cookie) {
    return null;
  }

  const parts = cookie.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, encodedSignature] = parts;

  try {
    const expectedSignature = createHmac(
      "sha256",
      secret
    )
      .update(encodedPayload)
      .digest();

    const receivedSignature =
      base64UrlToBuffer(encodedSignature);

    if (
      expectedSignature.length !== receivedSignature.length ||
      !expectedSignature.equals(receivedSignature)
    ) {
      return null;
    }

    const payload = JSON.parse(
      base64UrlToBuffer(encodedPayload).toString("utf8")
    );

    if (!payload?.sub || !payload?.role) {
      return null;
    }

    if (
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    const role = String(payload.role).toLowerCase();

    if (
      role !== "admin" &&
      role !== "administrator"
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------
   PASSWORD HASH
------------------------------------------------------- */

function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");

    scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(
        `scrypt:${salt}:${derivedKey.toString("hex")}`
      );
    });
  });
}

/* -------------------------------------------------------
   VALIDATION
------------------------------------------------------- */

function validatePassword(password: string) {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (password.length > 128) {
    return "Password cannot exceed 128 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character.";
  }

  return null;
}

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeEmail(value: unknown) {
  return cleanString(value).toLowerCase();
}

function normalizeUsername(value: unknown) {
  return cleanString(value).toLowerCase();
}

/* -------------------------------------------------------
   SERVER PASSWORD GENERATOR
------------------------------------------------------- */

function generateClientPassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

  let result = "";

  for (let i = 0; i < 14; i++) {
    result += chars[randomInt(0, chars.length)];
  }

  return result;
}

/* -------------------------------------------------------
   CLIENT ID
------------------------------------------------------- */

async function generateClientId(
  collection: Collection<ClientDocument>
) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const number = randomInt(100000, 1000000);

    const clientId = `HCS-CL-${number}`;

    const exists = await collection.findOne(
      { clientId },
      { projection: { _id: 1 } }
    );

    if (!exists) {
      return clientId;
    }
  }

  throw new Error(
    "Unable to generate a unique client ID."
  );
}

/* -------------------------------------------------------
   SAFE CLIENT RESPONSE
------------------------------------------------------- */

function safeClient(client: ClientDocument) {
  return {
    id: client._id
      ? client._id.toString()
      : client.clientId,

    clientId: client.clientId,
    username: client.username,
    email: client.email,

    name: client.name,
    fullName: client.fullName || client.name,

    companyName: client.companyName || "",
    phone: client.phone || "",
    website: client.website || "",

    plan: client.plan || "",
    assignedManager: client.assignedManager || "",

    status: client.status,
    active: client.active,

    role: client.role,

    clientPortalEnabled:
      client.clientPortalEnabled,

    permissions:
      Array.isArray(client.permissions)
        ? client.permissions
        : [],

    assignedWebsiteIds:
      Array.isArray(client.assignedWebsiteIds)
        ? client.assignedWebsiteIds
        : [],

    tags:
      Array.isArray(client.tags)
        ? client.tags
        : [],

    notes: client.notes || "",

    services:
      Array.isArray(client.services)
        ? client.services
        : [],

    createdAt: client.createdAt,
    updatedAt: client.updatedAt,

    lastLogin: client.lastLogin || null,
  };
}

/* -------------------------------------------------------
   GET — LOAD ALL CLIENTS
------------------------------------------------------- */

export async function GET(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const mongoClient = await getMongoClient();
    const collection = getClientsCollection(
      mongoClient
    );

    const clients = await collection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(
      {
        success: true,
        clients: clients.map(safeClient),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET /api/admin/clients error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load clients.",
      },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------
   POST — CREATE CLIENT
------------------------------------------------------- */

export async function POST(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON body.",
        },
        { status: 400 }
      );
    }

    const mongoClient = await getMongoClient();

    const collection = getClientsCollection(
      mongoClient
    );

    /* ---------------------------------------------
       BASIC FIELDS
    --------------------------------------------- */

    const name =
      cleanString(body.name) ||
      cleanString(body.fullName);

    const username = normalizeUsername(
      body.username
    );

    const email = normalizeEmail(body.email);

    const companyName = cleanString(
      body.companyName
    );

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Client name is required.",
        },
        { status: 400 }
      );
    }

    if (!username) {
      return NextResponse.json(
        {
          success: false,
          message: "Username is required.",
        },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Username can contain only lowercase letters, numbers, dots, hyphens and underscores.",
        },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          message: "Email is required.",
        },
        { status: 400 }
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter a valid email address.",
        },
        { status: 400 }
      );
    }

    /* ---------------------------------------------
       DUPLICATE CHECK
    --------------------------------------------- */

    const existing = await collection.findOne({
      $or: [
        { username },
        { email },
      ],
    });

    if (existing) {
      if (
        existing.username.toLowerCase() ===
        username
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This username is already in use.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          message:
            "This email is already registered.",
        },
        { status: 409 }
      );
    }

    /* ---------------------------------------------
       PASSWORD
    --------------------------------------------- */

    let password = cleanString(body.password);

    if (!password) {
      password = generateClientPassword();
    }

    const passwordError =
      validatePassword(password);

    if (passwordError) {
      return NextResponse.json(
        {
          success: false,
          message: passwordError,
        },
        { status: 400 }
      );
    }

    const passwordHash =
      await hashPassword(password);

    /* ---------------------------------------------
       CLIENT ID
    --------------------------------------------- */

    const clientId =
      await generateClientId(collection);

    /* ---------------------------------------------
       STATUS
    --------------------------------------------- */

    const requestedStatus =
      cleanString(body.status) || "Active";

    const status =
      requestedStatus || "Active";

    const clientPortalEnabled =
      body.clientPortalEnabled !== false;

    const active =
      body.active !== false &&
      clientPortalEnabled &&
      status.toLowerCase() === "active";

    /* ---------------------------------------------
       ARRAYS
    --------------------------------------------- */

    const permissions = Array.isArray(
      body.permissions
    )
      ? body.permissions
          .filter(
            (item): item is string =>
              typeof item === "string"
          )
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    const assignedWebsiteIds =
      Array.isArray(body.assignedWebsiteIds)
        ? body.assignedWebsiteIds
            .filter(
              (item): item is string =>
                typeof item === "string"
            )
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

    const tags = Array.isArray(body.tags)
      ? body.tags
          .filter(
            (item): item is string =>
              typeof item === "string"
          )
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    const services = Array.isArray(
      body.services
    )
      ? body.services
          .filter(
            (item): item is string =>
              typeof item === "string"
          )
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    /* ---------------------------------------------
       DOCUMENT
    --------------------------------------------- */

    const now = new Date();

    const clientDocument: ClientDocument = {
      clientId,

      username,
      email,

      name,
      fullName: name,

      companyName,

      phone: cleanString(body.phone),
      website: cleanString(body.website),

      plan: cleanString(body.plan),
      assignedManager: cleanString(
        body.assignedManager
      ),

      status,
      active,

      role: "client",

      passwordHash,

      clientPortalEnabled,

      permissions,
      assignedWebsiteIds,
      tags,

      notes: cleanString(body.notes),

      services,

      createdAt: now,
      updatedAt: now,

      lastLogin: null,
    };

    /* ---------------------------------------------
       INSERT
    --------------------------------------------- */

    const result =
      await collection.insertOne(
        clientDocument
      );

    const createdClient =
      await collection.findOne({
        _id: result.insertedId,
      });

    if (!createdClient) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Client was created but could not be loaded.",
        },
        { status: 500 }
      );
    }

    /* ---------------------------------------------
       RETURN PLAINTEXT PASSWORD ONLY ONCE
    --------------------------------------------- */

    const credentials = {
      clientId: createdClient.clientId,
      username: createdClient.username,
      email: createdClient.email,
      password,
      name: createdClient.name,
      companyName:
        createdClient.companyName || "",
      status: createdClient.status,
    };

    return NextResponse.json(
      {
        success: true,
        message: "Client created successfully.",
        client: safeClient(createdClient),
        credentials,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "POST /api/admin/clients error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to create client right now.",
      },
      { status: 500 }
    );
  }
}