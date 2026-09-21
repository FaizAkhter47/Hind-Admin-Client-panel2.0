import { NextRequest, NextResponse } from "next/server";
import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  MongoClient,
  ObjectId,
  type Document,
} from "mongodb";

export const runtime = "nodejs";

const scrypt = promisify(scryptCallback);

const SESSION_COOKIE_NAME = "hcs-session";

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

  const uri = getMongoUri();

  const withoutProtocol = uri.replace(
    /^mongodb(?:\+srv)?:\/\//,
    "",
  );

  const slashIndex = withoutProtocol.indexOf("/");

  if (slashIndex !== -1) {
    const databaseName = withoutProtocol
      .slice(slashIndex + 1)
      .split("?")[0]
      .trim();

    if (databaseName) {
      return decodeURIComponent(databaseName);
    }
  }

  return "hcs";
}

function getAdminCollectionName() {
  return (
    process.env.MONGODB_ADMIN_COLLECTION?.trim() ||
    "admins"
  );
}

function getClientCollectionName() {
  return (
    process.env.MONGODB_CLIENT_COLLECTION?.trim() ||
    "clients"
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
) {
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

  const expectedSignature = createHmac(
    "sha256",
    getSessionSecret(),
  )
    .update(encoded)
    .digest("base64url");

  if (
    !safeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expectedSignature, "utf8"),
    )
  ) {
    throw new Error("Invalid session signature.");
  }

  const payload = JSON.parse(
    Buffer.from(
      encoded,
      "base64url",
    ).toString("utf8"),
  );

  if (
    !payload ||
    typeof payload !== "object"
  ) {
    throw new Error("Invalid session payload.");
  }

  return payload as SessionPayload;
}

async function requireAdmin(
  request: NextRequest,
) {
  const token =
    request.cookies.get(
      SESSION_COOKIE_NAME,
    )?.value;

  if (!token) {
    return false;
  }

  try {
    const session =
      decodeSession(token);

    if (
      session.role !== "admin" ||
      !session.sub ||
      !session.exp ||
      session.exp <=
        Math.floor(Date.now() / 1000)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function hashPassword(
  password: string,
) {
  const salt =
    randomBytes(16).toString(
      "base64url",
    );

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

function cleanClient(
  client: Document,
) {
  return {
    id: String(client._id),
    clientId: String(
      client.clientId ?? "",
    ),
    username: String(
      client.username ?? "",
    ),
    email: String(
      client.email ?? "",
    ),
    name: String(
      client.name ??
        client.companyName ??
        "Client",
    ),
    fullName: String(
      client.fullName ??
        client.name ??
        client.companyName ??
        "Client",
    ),
    companyName: String(
      client.companyName ?? "",
    ),
    phone:
      client.phone
        ? String(client.phone)
        : undefined,
    website:
      client.website
        ? String(client.website)
        : undefined,
    plan:
      client.plan
        ? String(client.plan)
        : undefined,
    assignedManager:
      client.assignedManager
        ? String(client.assignedManager)
        : undefined,
    status: String(
      client.status ?? "Active",
    ),
    active:
      client.active !== false,
    role: "client",
    clientPortalEnabled:
      client.clientPortalEnabled !== false,
    permissions:
      client.permissions ?? {},
    assignedWebsiteIds:
      Array.isArray(
        client.assignedWebsiteIds,
      )
        ? client.assignedWebsiteIds
        : [],
    tags:
      Array.isArray(client.tags)
        ? client.tags
        : [],
    notes:
      client.notes
        ? String(client.notes)
        : undefined,
    services:
      Array.isArray(client.services)
        ? client.services
        : [],
    assignedServices:
      Array.isArray(
        client.assignedServices,
      )
        ? client.assignedServices
        : [],
    selectedServices:
      Array.isArray(
        client.selectedServices,
      )
        ? client.selectedServices
        : [],
    portalData:
      client.portalData ?? undefined,
    createdAt:
      client.createdAt instanceof Date
        ? client.createdAt.toISOString()
        : client.createdAt,
    updatedAt:
      client.updatedAt instanceof Date
        ? client.updatedAt.toISOString()
        : client.updatedAt,
    lastLogin:
      client.lastLogin instanceof Date
        ? client.lastLogin.toISOString()
        : client.lastLogin ?? null,
  };
}

async function getClientsCollection() {
  const client =
    await getMongoClient();

  const db =
    client.db(getDatabaseName());

  return db.collection(
    getClientCollectionName(),
  );
}

function normalizeId(
  value: unknown,
) {
  return String(
    value ?? "",
  ).trim();
}

/* =========================================================
   GET CLIENTS
========================================================= */

export async function GET(
  request: NextRequest,
) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json(
        {
          success: false,
          message: "Admin authentication required.",
        },
        { status: 401 },
      );
    }

    const collection =
      await getClientsCollection();

    const clients =
      await collection
        .find({})
        .sort({
          createdAt: -1,
        })
        .toArray();

    return NextResponse.json({
      success: true,
      clients:
        clients.map(cleanClient),
    });
  } catch (error) {
    console.error(
      "HCS get clients error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load client accounts.",
      },
      { status: 500 },
    );
  }
}

/* =========================================================
   CREATE / UPDATE / RESET / IMPORT
========================================================= */

export async function POST(
  request: NextRequest,
) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json(
        {
          success: false,
          message: "Admin authentication required.",
        },
        { status: 401 },
      );
    }

    const body =
      (await request.json()) as {
        action?: string;
        client?: Record<string, unknown>;
        clients?: Record<string, unknown>[];
        id?: string;
        password?: string;
      };

    const collection =
      await getClientsCollection();

    /* -----------------------------------------------------
       RESET PASSWORD
    ----------------------------------------------------- */

    if (
      body.action ===
      "resetPassword"
    ) {
      const id =
        normalizeId(body.id);

      const password =
        String(
          body.password ?? "",
        );

      if (!id || !password) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Client ID and password are required.",
          },
          { status: 400 },
        );
      }

      const passwordHash =
        await hashPassword(
          password,
        );

      const filter =
        ObjectId.isValid(id)
          ? {
              _id: new ObjectId(id),
            }
          : {
              clientId: id,
            };

      const result =
        await collection.updateOne(
          filter,
          {
            $set: {
              passwordHash,
              updatedAt: new Date(),
            },
          },
        );

      if (!result.matchedCount) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Client account not found.",
          },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        generatedPassword:
          password,
      });
    }

    /* -----------------------------------------------------
       IMPORT OLD LOCAL CLIENTS
    ----------------------------------------------------- */

    if (
      body.action ===
      "import"
    ) {
      const oldClients =
        Array.isArray(body.clients)
          ? body.clients
          : [];

      let imported = 0;

      for (
        const client of oldClients
      ) {
        const password =
          String(
            client.password ??
              client.loginPassword ??
              "",
          );

        if (!password) {
          continue;
        }

        const passwordHash =
          await hashPassword(
            password,
          );

        const clientId =
          String(
            client.clientId ?? "",
          ).trim();

        if (!clientId) {
          continue;
        }

        const existing =
          await collection.findOne({
            clientId,
          });

        if (existing) {
          await collection.updateOne(
            {
              _id: existing._id,
            },
            {
              $set: {
                ...client,
                passwordHash,
                role: "client",
                updatedAt:
                  new Date(),
              },
              $unset: {
                password: "",
                loginPassword: "",
              },
            },
          );
        } else {
          const {
            password: _password,
            loginPassword:
              _loginPassword,
            id: _id,
            ...safeClient
          } = client;

          await collection.insertOne({
            ...safeClient,
            clientId,
            role: "client",
            passwordHash,
            createdAt:
              client.createdAt
                ? new Date(
                    String(
                      client.createdAt,
                    ),
                  )
                : new Date(),
            updatedAt:
              new Date(),
          });
        }

        imported += 1;
      }

      return NextResponse.json({
        success: true,
        imported,
      });
    }

    /* -----------------------------------------------------
       CREATE / UPDATE
    ----------------------------------------------------- */

    const client =
      body.client;

    if (
      !client ||
      typeof client !== "object"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Client data is required.",
        },
        { status: 400 },
      );
    }

    const id =
      normalizeId(client.id);

    const clientId =
      normalizeId(
        client.clientId,
      );

    const username =
      normalizeId(
        client.username,
      );

    const email =
      normalizeId(
        client.email,
      ).toLowerCase();

    if (
      !clientId ||
      !username ||
      !email
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Client ID, username and email are required.",
        },
        { status: 400 },
      );
    }

    const existingByUsername =
      await collection.findOne({
        username: {
          $regex:
            `^${escapeRegex(username)}$`,
          $options: "i",
        },
      });

    if (
      existingByUsername &&
      String(existingByUsername._id) !== id
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Username already exists.",
        },
        { status: 409 },
      );
    }

    const existingByEmail =
      await collection.findOne({
        email: {
          $regex:
            `^${escapeRegex(email)}$`,
          $options: "i",
        },
      });

    if (
      existingByEmail &&
      String(existingByEmail._id) !== id
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Email already exists.",
        },
        { status: 409 },
      );
    }

    let passwordHash:
      | string
      | undefined;

    const password =
      String(
        client.password ?? "",
      );

    if (password) {
      if (
        password.length < 8 ||
        password.length > 128
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Password must contain 8 to 128 characters.",
          },
          { status: 400 },
        );
      }

      passwordHash =
        await hashPassword(
          password,
        );
    }

    const {
      password:
        _password,
      loginPassword:
        _loginPassword,
      id:
        _clientIdForMongo,
      ...rest
    } = client;

    const document: Document = {
      ...rest,
      clientId,
      username,
      email,
      role: "client",
      active:
        client.active !== false,
      clientPortalEnabled:
        client.clientPortalEnabled !==
        false,
      status:
        client.status ??
        "Active",
      updatedAt:
        new Date(),
    };

    if (passwordHash) {
      document.passwordHash =
        passwordHash;
    }

    /* UPDATE */
    if (id) {
      const filter =
        ObjectId.isValid(id)
          ? {
              _id: new ObjectId(id),
            }
          : {
              clientId: id,
            };

      const current =
        await collection.findOne(
          filter,
        );

      if (!current) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Client account not found.",
          },
          { status: 404 },
        );
      }

      await collection.updateOne(
        filter,
        {
          $set: document,
          ...(!passwordHash
            ? {}
            : {
                $setOnInsert: {},
              }),
        },
      );

      const updated =
        await collection.findOne(
          filter,
        );

      return NextResponse.json({
        success: true,
        client:
          updated
            ? cleanClient(updated)
            : null,
        password:
          password || undefined,
      });
    }

    /* CREATE */
    if (!passwordHash) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password is required when creating a client.",
        },
        { status: 400 },
      );
    }

    document.createdAt =
      new Date();

    const inserted =
      await collection.insertOne(
        document,
      );

    const created =
      await collection.findOne({
        _id: inserted.insertedId,
      });

    return NextResponse.json(
      {
        success: true,
        client:
          created
            ? cleanClient(created)
            : null,
        password,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "HCS admin client API error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to save client account.",
      },
      { status: 500 },
    );
  }
}

function escapeRegex(
  value: string,
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

/* =========================================================
   DELETE
========================================================= */

export async function DELETE(
  request: NextRequest,
) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json(
        {
          success: false,
          message: "Admin authentication required.",
        },
        { status: 401 },
      );
    }

    const body =
      (await request.json()) as {
        id?: string;
      };

    const id =
      normalizeId(body.id);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Client ID is required.",
        },
        { status: 400 },
      );
    }

    const collection =
      await getClientsCollection();

    const filter =
      ObjectId.isValid(id)
        ? {
            _id: new ObjectId(id),
          }
        : {
            clientId: id,
          };

    const result =
      await collection.deleteOne(
        filter,
      );

    if (!result.deletedCount) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Client account not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "HCS delete client error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to delete client account.",
      },
      { status: 500 },
    );
  }
}