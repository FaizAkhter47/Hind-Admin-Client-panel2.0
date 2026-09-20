import { NextResponse } from "next/server";
import {
  createHmac,
  randomInt,
} from "node:crypto";
import { MongoClient } from "mongodb";

export const runtime = "nodejs";

type RecoveryChannel = "email" | "sms";

type AdminDocument = {
  active?: boolean;
  email?: string;
  phone?: string;
  [key: string]: unknown;
};

const OTP_TTL_SECONDS = 5 * 60;

let mongoClientPromise: Promise<MongoClient> | null =
  null;

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

function getMongoUri() {
  const uri =
    process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not configured.",
    );
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

function getAdminCollectionName() {
  return (
    process.env.MONGODB_ADMIN_COLLECTION?.trim() ||
    "admins"
  );
}

async function getMongoClient() {
  if (!mongoClientPromise) {
    const client =
      new MongoClient(
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

function isEmail(
  value: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value.trim(),
  );
}

function isPhone(
  value: string,
) {
  const normalized =
    normalizePhone(value);

  return /^\+?\d{10,15}$/.test(
    normalized,
  );
}

function signPayload(
  payload: Record<
    string,
    unknown
  >,
) {
  const encoded =
    Buffer.from(
      JSON.stringify(payload),
    ).toString(
      "base64url",
    );

  const signature =
    createHmac(
      "sha256",
      getSecret(),
    )
      .update(encoded)
      .digest("base64url");

  return `${encoded}.${signature}`;
}

function maskEmail(
  email: string,
) {
  const parts =
    email.split("@");

  if (parts.length !== 2) {
    return "***";
  }

  const local =
    parts[0];

  const domain =
    parts[1];

  if (local.length <= 2) {
    return `${local[0] ?? "*"}***@${domain}`;
  }

  return `${local.slice(
    0,
    2,
  )}***@${domain}`;
}

function maskPhone(
  phone: string,
) {
  const normalized =
    normalizePhone(phone);

  if (normalized.length < 6) {
    return "***";
  }

  return `${normalized.slice(
    0,
    Math.min(
      3,
      normalized.length,
    ),
  )}******${normalized.slice(
    -2,
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

async function findAdminByEmail(
  email: string,
) {
  const client =
    await getMongoClient();

  const db =
    client.db(
      getDatabaseName(),
    );

  const collection =
    db.collection<AdminDocument>(
      getAdminCollectionName(),
    );

  const normalized =
    normalizeEmail(email);

  return collection.findOne({
    email: {
      $regex: `^${escapeRegex(
        normalized,
      )}$`,
      $options: "i",
    },
  });
}

async function findAdminByPhone(
  phone: string,
) {
  const client =
    await getMongoClient();

  const db =
    client.db(
      getDatabaseName(),
    );

  const collection =
    db.collection<AdminDocument>(
      getAdminCollectionName(),
    );

  const normalized =
    normalizePhone(phone);

  return collection.findOne({
    $or: [
      {
        phone: normalized,
      },
      {
        phone: phone.trim(),
      },
    ],
  });
}

async function sendEmailOtp(
  email: string,
  otp: string,
) {
  const apiKey =
    process.env.RESEND_API_KEY?.trim();

  const from =
    process.env.HCS_OTP_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    return false;
  }

  const response =
    await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject:
            "HCS Admin Portal - Password Recovery OTP",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;border:1px solid #e5e5e5;border-radius:12px">
              <h2 style="margin:0 0 8px;color:#050505">
                HCS Admin Password Recovery
              </h2>

              <p style="color:#666;line-height:1.6">
                A password recovery request was made for
                your Hind Consultancy Services Admin account.
              </p>

              <div style="margin:28px 0;padding:20px;text-align:center;background:#050505;color:#fff;border-radius:10px">
                <div style="font-size:11px;letter-spacing:2px;opacity:.65">
                  ONE-TIME PASSWORD
                </div>

                <div style="font-size:34px;font-weight:800;letter-spacing:8px;margin-top:10px">
                  ${otp}
                </div>
              </div>

              <p style="color:#666;line-height:1.6">
                This OTP is valid for 5 minutes.
                Do not share it with anyone.
              </p>

              <p style="font-size:12px;color:#999">
                Hind Consultancy Services
              </p>
            </div>
          `,
        }),
      },
    );

  return response.ok;
}

async function sendSmsOtp(
  phone: string,
  otp: string,
) {
  const accountSid =
    process.env.TWILIO_ACCOUNT_SID?.trim();

  const authToken =
    process.env.TWILIO_AUTH_TOKEN?.trim();

  const from =
    process.env.TWILIO_PHONE_NUMBER?.trim();

  if (
    !accountSid ||
    !authToken ||
    !from
  ) {
    return false;
  }

  const body =
    new URLSearchParams({
      To: phone,
      From: from,
      Body:
        `HCS Admin password recovery OTP: ${otp}. ` +
        "Valid for 5 minutes. Do not share this OTP.",
    });

  const auth =
    Buffer.from(
      `${accountSid}:${authToken}`,
    ).toString(
      "base64",
    );

  const response =
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body,
      },
    );

  return response.ok;
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as {
        identifier?: string;
      };

    const identifier =
      body.identifier?.trim() ?? "";

    if (!identifier) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Recovery email or mobile number is required.",
        },
        {
          status: 400,
        },
      );
    }

    let channel: RecoveryChannel;
    let destination: string;
    let admin: AdminDocument | null =
      null;

    if (isEmail(identifier)) {
      channel = "email";
      destination =
        normalizeEmail(identifier);

      admin =
        await findAdminByEmail(
          destination,
        );
    } else if (isPhone(identifier)) {
      channel = "sms";
      destination =
        normalizePhone(identifier);

      admin =
        await findAdminByPhone(
          destination,
        );
    } else {
      return NextResponse.json(
        {
          success: false,
          message:
            "Enter a valid email address or mobile number.",
        },
        {
          status: 400,
        },
      );
    }

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No active Admin account is registered with this recovery information.",
        },
        {
          status: 404,
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

    const otp =
      String(
        randomInt(
          100000,
          1000000,
        ),
      );

    const issuedAt =
      Math.floor(
        Date.now() / 1000,
      );

    const expiresAt =
      issuedAt +
      OTP_TTL_SECONDS;

    const normalizedDestination =
      channel === "email"
        ? normalizeEmail(
            destination,
          )
        : normalizePhone(
            destination,
          );

    const otpDigest =
      createHmac(
        "sha256",
        getSecret(),
      )
        .update(
          `${normalizedDestination}:${otp}:${expiresAt}`,
        )
        .digest("hex");

    const otpSession =
      signPayload({
        kind: "admin-otp",
        identifier:
          normalizedDestination,
        channel,
        otpDigest,
        issuedAt,
        expiresAt,
      });

    let delivered = false;

    if (channel === "email") {
      delivered =
        await sendEmailOtp(
          destination,
          otp,
        );
    } else {
      delivered =
        await sendSmsOtp(
          destination,
          otp,
        );
    }

    if (!delivered) {
      if (
        process.env.NODE_ENV !==
        "production"
      ) {
        console.warn(
          `[HCS DEVELOPMENT OTP] ${channel} → ${destination} → ${otp}`,
        );

        return NextResponse.json({
          success: true,
          message:
            "Development mode: OTP generated and logged in the terminal.",
          destinationMasked:
            channel === "email"
              ? maskEmail(
                  destination,
                )
              : maskPhone(
                  destination,
                ),
          otpSession,
        });
      }

      return NextResponse.json(
        {
          success: false,
          message:
            channel === "email"
              ? "Email OTP delivery service is not configured."
              : "SMS OTP delivery service is not configured.",
        },
        {
          status: 503,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "OTP sent successfully.",
      destinationMasked:
        channel === "email"
          ? maskEmail(
              destination,
            )
          : maskPhone(
              destination,
            ),
      otpSession,
    });
  } catch (error) {
    console.error(
      "HCS send OTP error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to start password recovery.",
      },
      {
        status: 500,
      },
    );
  }
}