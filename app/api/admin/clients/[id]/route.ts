import { NextRequest, NextResponse } from "next/server";
import {
  MongoClient,
  ObjectId,
  type Collection,
} from "mongodb";
import {
  createHmac,
  randomBytes,
  randomInt,
  scrypt,
} from "crypto";

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

/* =====================================================
   MONGODB
===================================================== */

function getMongoUri() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  return uri;
}

async function getMongoClient() {
  if (!global.__hcsMongoClient) {
    if (!global.__hcsMongoPromise) {
      const client = new MongoClient(getMongoUri(), {
        maxPoolSize: 10,
      });

      global.__hcsMongoPromise = client.connect();
    }

    global.__hcsMongoClient =
      await global.__hcsMongoPromise;
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
  return client
    .db(getDatabaseName())
    .collection<ClientDocument>(
      process.env.MONGODB_CLIENT_COLLECTION ||
        "clients"
    );
}

/* =====================================================
   ADMIN SESSION
===================================================== */

function base64UrlToBuffer(value: string) {
  return Buffer.from(
    value.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );
}

function verifyAdminSession(
  request: NextRequest
) {
  const secret = process.env.HCS_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "HCS_SESSION_SECRET is not configured."
    );
  }

  const cookie =
    request.cookies.get("hcs-session")?.value;

  if (!cookie) {
    return null;
  }

  const parts = cookie.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [
    encodedPayload,
    encodedSignature,
  ] = parts;

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
      expectedSignature.length !==
        receivedSignature.length ||
      !expectedSignature.equals(
        receivedSignature
      )
    ) {
      return null;
    }

    const payload = JSON.parse(
      base64UrlToBuffer(
        encodedPayload
      ).toString("utf8")
    );

    if (!payload?.sub || !payload?.role) {
      return null;
    }

    if (
      typeof payload.exp !== "number" ||
      payload.exp <=
        Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    const role = String(
      payload.role
    ).toLowerCase();

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

/* =====================================================
   HELPERS
===================================================== */

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

function generateClientPassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

  let password = "";

  for (let i = 0; i < 14; i++) {
    password +=
      chars[randomInt(0, chars.length)];
  }

  return password;
}

function hashPassword(
  password: string
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const salt =
        randomBytes(16).toString("hex");

      scrypt(
        password,
        salt,
        64,
        (error, derivedKey) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(
            `scrypt:${salt}:${derivedKey.toString(
              "hex"
            )}`
          );
        }
      );
    }
  );
}

/* =====================================================
   SAFE RESPONSE
===================================================== */

function safeClient(
  client: ClientDocument
) {
  return {
    id: client._id
      ? client._id.toString()
      : client.clientId,

    clientId: client.clientId,

    username: client.username,
    email: client.email,

    name: client.name,
    fullName:
      client.fullName ||
      client.name,

    companyName:
      client.companyName || "",

    phone: client.phone || "",
    website: client.website || "",

    plan: client.plan || "",

    assignedManager:
      client.assignedManager || "",

    status: client.status,

    active: client.active,

    role: client.role,

    clientPortalEnabled:
      client.clientPortalEnabled,

    permissions:
      Array.isArray(
        client.permissions
      )
        ? client.permissions
        : [],

    assignedWebsiteIds:
      Array.isArray(
        client.assignedWebsiteIds
      )
        ? client.assignedWebsiteIds
        : [],

    tags: Array.isArray(client.tags)
      ? client.tags
      : [],

    notes: client.notes || "",

    services:
      Array.isArray(client.services)
        ? client.services
        : [],

    createdAt: client.createdAt,
    updatedAt: client.updatedAt,

    lastLogin:
      client.lastLogin || null,
  };
}

/* =====================================================
   FIND CLIENT
   Supports:
   /api/admin/clients/<mongoObjectId>
   OR
   /api/admin/clients/HCS-CL-123456
===================================================== */

async function findClient(
  collection: Collection<ClientDocument>,
  id: string
) {
  if (ObjectId.isValid(id)) {
    const byObjectId =
      await collection.findOne({
        _id: new ObjectId(id),
      });

    if (byObjectId) {
      return byObjectId;
    }
  }

  return collection.findOne({
    clientId: id,
  });
}

/* =====================================================
   PATCH
   Edit client
   Reset password
   Enable/disable portal
   Change status
===================================================== */

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const admin =
      verifyAdminSession(request);

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const { id } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Client ID is required.",
        },
        { status: 400 }
      );
    }

    const mongoClient =
      await getMongoClient();

    const collection =
      getClientsCollection(
        mongoClient
      );

    const existing =
      await findClient(
        collection,
        id
      );

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Client not found.",
        },
        { status: 404 }
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

    const action =
      cleanString(body.action).toLowerCase();

    /* =================================================
       RESET PASSWORD
    ================================================= */

    if (action === "resetpassword") {
      const newPassword =
        generateClientPassword();

      const passwordHash =
        await hashPassword(
          newPassword
        );

      const now = new Date();

      await collection.updateOne(
        { _id: existing._id },
        {
          $set: {
            passwordHash,
            updatedAt: now,
          },

          $unset: {
            password: "",
            loginPassword: "",
          },
        }
      );

      const updated =
        await collection.findOne({
          _id: existing._id,
        });

      if (!updated) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Password reset failed.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message:
            "Client password reset successfully.",

          client: safeClient(updated),

          credentials: {
            clientId:
              updated.clientId,

            username:
              updated.username,

            email:
              updated.email,

            password:
              newPassword,

            name:
              updated.name,

            companyName:
              updated.companyName ||
              "",

            status:
              updated.status,
          },
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /* =================================================
       NORMAL UPDATE
    ================================================= */

    const update: Record<
      string,
      unknown
    > = {};

    const unset: Record<
      string,
      true | "" | 1
    > = {};

    const username =
      body.username !== undefined
        ? normalizeUsername(
            body.username
          )
        : undefined;

    const email =
      body.email !== undefined
        ? normalizeEmail(
            body.email
          )
        : undefined;

    /* -----------------------------------------------
       USERNAME
    ----------------------------------------------- */

    if (username !== undefined) {
      if (!username) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Username cannot be empty.",
          },
          { status: 400 }
        );
      }

      if (
        !/^[a-z0-9._-]{3,40}$/.test(
          username
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid username format.",
          },
          { status: 400 }
        );
      }

      const duplicate =
        await collection.findOne({
          username,
          _id: {
            $ne: existing._id,
          },
        });

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This username is already in use.",
          },
          { status: 409 }
        );
      }

      update.username =
        username;
    }

    /* -----------------------------------------------
       EMAIL
    ----------------------------------------------- */

    if (email !== undefined) {
      if (!email) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Email cannot be empty.",
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
            message:
              "Invalid email address.",
          },
          { status: 400 }
        );
      }

      const duplicate =
        await collection.findOne({
          email,
          _id: {
            $ne: existing._id,
          },
        });

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This email is already registered.",
          },
          { status: 409 }
        );
      }

      update.email = email;
    }

    /* -----------------------------------------------
       NORMAL FIELDS
    ----------------------------------------------- */

    const stringFields = [
      "name",
      "fullName",
      "companyName",
      "phone",
      "website",
      "plan",
      "assignedManager",
      "notes",
    ] as const;

    for (const field of stringFields) {
      if (body[field] !== undefined) {
        update[field] =
          cleanString(
            body[field]
          );
      }
    }

    /* -----------------------------------------------
       ARRAYS
    ----------------------------------------------- */

    const arrayFields = [
      "permissions",
      "assignedWebsiteIds",
      "tags",
      "services",
    ] as const;

    for (const field of arrayFields) {
      if (body[field] !== undefined) {
        if (
          !Array.isArray(
            body[field]
          )
        ) {
          return NextResponse.json(
            {
              success: false,
              message: `${field} must be an array.`,
            },
            { status: 400 }
          );
        }

        update[field] =
          body[field]
            .filter(
              (item): item is string =>
                typeof item ===
                "string"
            )
            .map((item) =>
              item.trim()
            )
            .filter(Boolean);
      }
    }

    /* -----------------------------------------------
       STATUS
    ----------------------------------------------- */

    if (body.status !== undefined) {
      const status =
        cleanString(
          body.status
        ) || "Active";

      update.status = status;

      if (
        status.toLowerCase() !==
        "active"
      ) {
        update.active = false;
      }
    }

    /* -----------------------------------------------
       PORTAL ENABLE / DISABLE
    ----------------------------------------------- */

    if (
      body.clientPortalEnabled !==
      undefined
    ) {
      const enabled =
        Boolean(
          body.clientPortalEnabled
        );

      update.clientPortalEnabled =
        enabled;

      if (!enabled) {
        update.active = false;
      } else {
        const finalStatus =
          String(
            body.status ??
              existing.status
          ).toLowerCase();

        update.active =
          finalStatus ===
          "active";
      }
    }

    /* -----------------------------------------------
       ACTIVE
    ----------------------------------------------- */

    if (
      body.active !== undefined
    ) {
      const requestedActive =
        Boolean(body.active);

      const portalEnabled =
        body.clientPortalEnabled !==
        undefined
          ? Boolean(
              body.clientPortalEnabled
            )
          : existing.clientPortalEnabled;

      const finalStatus =
        String(
          body.status ??
            existing.status
        ).toLowerCase();

      update.active =
        requestedActive &&
        portalEnabled &&
        finalStatus ===
          "active";
    }

    /* -----------------------------------------------
       OPTIONAL PASSWORD CHANGE
       If page sends password directly.
    ----------------------------------------------- */

    if (
      body.password !== undefined
    ) {
      const password =
        cleanString(
          body.password
        );

      if (password) {
        const passwordError =
          validatePassword(
            password
          );

        if (passwordError) {
          return NextResponse.json(
            {
              success: false,
              message:
                passwordError,
            },
            { status: 400 }
          );
        }

        update.passwordHash =
          await hashPassword(
            password
          );

        unset.password = "";
        unset.loginPassword = "";
      }
    }

    update.updatedAt =
      new Date();

    /* -----------------------------------------------
       NOTHING TO UPDATE
    ----------------------------------------------- */

    if (
      Object.keys(update)
        .length === 1 &&
      update.updatedAt
    ) {
      return NextResponse.json(
        {
          success: true,
          message:
            "No changes were made.",

          client:
            safeClient(existing),
        },
        { status: 200 }
      );
    }

    const updateQuery: {
      $set?: Record<
        string,
        unknown
      >;
      $unset?: Record<
        string,
        true | "" | 1
      >;
    } = {
      $set: update,
    };

    if (
      Object.keys(unset)
        .length > 0
    ) {
      updateQuery.$unset =
        unset;
    }

    await collection.updateOne(
      {
        _id: existing._id,
      },
      updateQuery
    );

    const updated =
      await collection.findOne({
        _id: existing._id,
      });

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Client update failed.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Client updated successfully.",

        client:
          safeClient(updated),
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "PATCH /api/admin/clients/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update client right now.",
      },
      { status: 500 }
    );
  }
}

/* =====================================================
   DELETE
===================================================== */

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const admin =
      verifyAdminSession(request);

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const { id } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Client ID is required.",
        },
        { status: 400 }
      );
    }

    const mongoClient =
      await getMongoClient();

    const collection =
      getClientsCollection(
        mongoClient
      );

    const existing =
      await findClient(
        collection,
        id
      );

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Client not found.",
        },
        { status: 404 }
      );
    }

    await collection.deleteOne({
      _id: existing._id,
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Client deleted successfully.",
        clientId:
          existing.clientId,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "DELETE /api/admin/clients/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to delete client right now.",
      },
      { status: 500 }
    );
  }
}