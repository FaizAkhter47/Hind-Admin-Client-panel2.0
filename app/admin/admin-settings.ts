import { useSyncExternalStore } from "react";

export const ADMIN_SETTINGS_STORAGE_KEY = "hcs-admin-settings-v6";
export const ADMIN_SETTINGS_EVENT = "hcs-admin-settings-updated";

export interface GlobalGeneralSettings {
  companyName?: string;
  companyEmail?: string;
  supportEmail?: string;
  phone?: string;
  website?: string;
  address?: string;
  timezone?: string;
  language?: string;
  currency?: string;
  dateFormat?: string;
  timeFormat?: string;
  defaultLandingPage?: string;
}

export interface GlobalAdminAccount {
  adminId: string;
  id?: string;
  fullName: string;
  username: string;
  email: string;

  /*
   * Optional admin password fields.
   * Server-side authentication remains the primary admin auth system.
   * These fields are kept here so Settings UI does not lose saved values.
   */
  password?: string;
  loginPassword?: string;
  passwordChangedAt?: string;

  phone: string;
  jobTitle: string;
  department: string;
  role: string;
  bio: string;
  avatarInitials: string;
  active: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  loginAlerts: boolean;
  suspiciousLoginAlerts: boolean;
  sessionAlerts: boolean;
  passwordExpiry: boolean;
  passwordExpiryDays: number;
  minPasswordLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecialCharacter: boolean;
  blockAfterFailedAttempts: boolean;
  failedAttemptsLimit: number;
}

export interface ClientService {
  id: string;
  name: string;
  description?: string;
  status?: string;
  startedAt?: string;
}

export interface ClientAccount {
  id: string;
  clientId: string;
  username: string;
  name: string;
  companyName: string;
  email: string;

  /*
   * IMPORTANT:
   * Password is part of the client account and must persist.
   */
  password: string;
  loginPassword?: string;

  role: "client";
  status: "Active" | "Suspended" | "Disabled";
  active: boolean;
  createdAt: string;

  phone?: string;
  website?: string;
  plan?: string;
  assignedManager?: string;
  lastLogin?: string;
  updatedAt?: string;
  notes?: string;

  clientPortalEnabled?: boolean;
  permissions?: Record<string, boolean>;
  assignedWebsiteIds?: string[];
  services?: ClientService[];
  tags?: string[];
}

export interface GlobalAdminSettings {
  general?: GlobalGeneralSettings;
  account?: GlobalAdminAccount;
  security?: Partial<SecuritySettings>;
  notifications?: Record<string, unknown>;
  appearance?: Record<string, unknown>;
  clients?: ClientAccount[];
  version?: string;
}

const DEFAULT_SECURITY: SecuritySettings = {
  twoFactorEnabled: true,
  loginAlerts: true,
  suspiciousLoginAlerts: true,
  sessionAlerts: true,
  passwordExpiry: true,
  passwordExpiryDays: 90,
  minPasswordLength: 8,
  requireUppercase: true,
  requireNumber: true,
  requireSpecialCharacter: true,
  blockAfterFailedAttempts: true,
  failedAttemptsLimit: 5,
};

const DEFAULT_NOTIFICATIONS: Record<string, unknown> = {
  emailNotifications: true,
  browserNotifications: false,
  systemNotifications: true,
  securityNotifications: true,
  reportNotifications: true,
  rankingNotifications: true,
  backlinkNotifications: true,
  technicalNotifications: true,
  competitorNotifications: false,
  blogNotifications: true,
  userNotifications: true,
  weeklyDigest: true,
  monthlyDigest: true,
  criticalOnlyMode: false,
};

const DEFAULT_APPEARANCE: Record<string, unknown> = {
  theme: "Light",
  compactMode: false,
  denseTables: false,
  showAnimations: true,
  showPageTips: true,
  collapsedSidebar: false,
  autoRefresh: false,
  autoRefreshMinutes: 15,
  dashboardGrid: "Comfortable",
};

export const DEFAULT_GLOBAL_ADMIN_SETTINGS: GlobalAdminSettings = {
  version: "8.0",

  general: {
    companyName: "Hind Consultancy Services",
    companyEmail: "info@hindconsultancyservices.com",
    supportEmail: "support@hindconsultancyservices.com",
    phone: "+91 00000 00000",
    website: "https://hindconsultancyservices.com",
    address: "",
    timezone: "Asia/Kolkata",
    language: "English",
    currency: "INR (₹)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12-hour",
    defaultLandingPage: "/admin",
  },

  account: {
    adminId: "HCS-ADMIN-001",
    id: "HCS-ADMIN-001",
    fullName: "HCS Administrator",
    username: "hcsadmin",
    email: "admin@hindconsultancyservices.com",

    phone: "+91 00000 00000",
    jobTitle: "SEO & Operations Administrator",
    department: "SEO & Digital Operations",
    role: "Administrator",
    bio: "HCS administrator responsible for websites, SEO operations, content, reports and platform configuration.",
    avatarInitials: "HC",
    active: true,
  },

  security: DEFAULT_SECURITY,
  notifications: DEFAULT_NOTIFICATIONS,
  appearance: DEFAULT_APPEARANCE,
  clients: [],
};

function cleanString(
  value: unknown,
  fallback = "",
): string {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function cleanOptionalString(
  value: unknown,
): string | undefined {
  const result = cleanString(value);

  return result || undefined;
}

function normalizeAdminAccount(
  value: unknown,
): GlobalAdminAccount {
  const raw =
    value && typeof value === "object"
      ? (value as Partial<GlobalAdminAccount>)
      : {};

  const defaults =
    DEFAULT_GLOBAL_ADMIN_SETTINGS.account!;

  return {
    adminId: cleanString(
      raw.adminId ?? raw.id,
      defaults.adminId,
    ),

    id: cleanString(
      raw.id ?? raw.adminId,
      defaults.id,
    ),

    fullName: cleanString(
      raw.fullName,
      defaults.fullName,
    ),

    username: cleanString(
      raw.username,
      defaults.username,
    ),

    email: cleanString(
      raw.email,
      defaults.email,
    ),

    /*
     * Preserve admin password fields when present.
     */
    password:
      cleanOptionalString(raw.password) ??
      cleanOptionalString(raw.loginPassword),

    loginPassword:
      cleanOptionalString(raw.loginPassword) ??
      cleanOptionalString(raw.password),

    passwordChangedAt:
      cleanOptionalString(raw.passwordChangedAt),

    phone: cleanString(
      raw.phone,
      defaults.phone,
    ),

    jobTitle: cleanString(
      raw.jobTitle,
      defaults.jobTitle,
    ),

    department: cleanString(
      raw.department,
      defaults.department,
    ),

    role: cleanString(
      raw.role,
      defaults.role,
    ),

    bio: cleanString(
      raw.bio,
      defaults.bio,
    ),

    avatarInitials: cleanString(
      raw.avatarInitials,
      defaults.avatarInitials,
    ),

    active:
      typeof raw.active === "boolean"
        ? raw.active
        : defaults.active,
  };
}

function normalizeClientAccount(
  value: unknown,
): ClientAccount | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw =
    value as Partial<ClientAccount> &
      Record<string, unknown>;

  /*
   * Basic account identity.
   */
  const clientId = cleanString(
    raw.clientId ?? raw.id,
  );

  const id = cleanString(
    raw.id ?? clientId,
  );

  const username = cleanString(
    raw.username,
  );

  /*
   * IMPORTANT FIX:
   * Preserve both password and loginPassword.
   */
  const password = cleanString(
    raw.password ?? raw.loginPassword,
  );

  /*
   * Do NOT reject old accounts only because password
   * is missing. Existing old accounts remain visible.
   * Newly created/reset accounts will contain a password.
   */
  if (!id || !clientId || !username) {
    return null;
  }

  const status: ClientAccount["status"] =
    raw.status === "Suspended"
      ? "Suspended"
      : raw.status === "Disabled"
        ? "Disabled"
        : "Active";

  /*
   * Services can come from multiple older field names.
   */
  const serviceSource =
    raw.services ??
    raw.assignedServices ??
    raw.serviceAccess ??
    raw.selectedServices;

  const services: ClientService[] | undefined =
    Array.isArray(serviceSource)
      ? serviceSource
          .map((value, index): ClientService | null => {
            /*
             * Old format:
             * ["SEO", "Web Development"]
             */
            if (typeof value === "string") {
              const name = value.trim();

              return name
                ? {
                    id: `service-${index + 1}`,
                    name,
                    status: "Active",
                  }
                : null;
            }

            /*
             * Invalid service value.
             */
            if (
              !value ||
              typeof value !== "object"
            ) {
              return null;
            }

            const service =
              value as Record<string, unknown>;

            const name = cleanString(
              service.name ??
                service.title ??
                service.serviceName,
            );

            if (!name) {
              return null;
            }

            return {
              id: cleanString(
                service.id ??
                  service.serviceId ??
                  service._id ??
                  `service-${index + 1}`,
                `service-${index + 1}`,
              ),

              name,

              description:
                cleanOptionalString(
                  service.description,
                ),

              status:
                cleanOptionalString(
                  service.status,
                ) ?? "Active",

              startedAt:
                cleanOptionalString(
                  service.startedAt,
                ) ??
                cleanOptionalString(
                  service.startDate,
                ),
            };
          })
          .filter(
            (item): item is ClientService =>
              item !== null,
          )
      : undefined;

  /*
   * Return the normalized client.
   */
  return {
    id,
    clientId,
    username,

    /*
     * THIS WAS THE MISSING PART.
     * Client password is now preserved.
     */
    password,
    loginPassword: password || undefined,

    name: cleanString(
      raw.name,
    ),

    companyName: cleanString(
      raw.companyName,
    ),

    email: cleanString(
      raw.email,
    ),

    role: "client",

    status,

    /*
     * Active only when account is active,
     * status is Active, and portal is enabled.
     */
    active:
      raw.active !== false &&
      status === "Active" &&
      raw.clientPortalEnabled !== false,

    createdAt: cleanString(
      raw.createdAt,
      new Date().toISOString(),
    ),

    phone:
      cleanOptionalString(
        raw.phone,
      ),

    website:
      cleanOptionalString(
        raw.website,
      ),

    plan:
      cleanOptionalString(
        raw.plan,
      ),

    assignedManager:
      cleanOptionalString(
        raw.assignedManager,
      ),

    lastLogin:
      cleanOptionalString(
        raw.lastLogin,
      ),

    updatedAt:
      cleanOptionalString(
        raw.updatedAt,
      ),

    notes:
      cleanOptionalString(
        raw.notes,
      ),

    clientPortalEnabled:
      raw.clientPortalEnabled !== false,

    permissions:
      raw.permissions &&
      typeof raw.permissions ===
        "object"
        ? Object.fromEntries(
            Object.entries(
              raw.permissions as Record<
                string,
                unknown
              >,
            ).map(
              ([key, item]) => [
                key,
                Boolean(item),
              ],
            ),
          )
        : undefined,

    assignedWebsiteIds:
      Array.isArray(
        raw.assignedWebsiteIds,
      )
        ? raw.assignedWebsiteIds
            .map((item) =>
              String(item).trim(),
            )
            .filter(Boolean)
        : undefined,

    services,

    tags:
      Array.isArray(raw.tags)
        ? raw.tags
            .map((item) =>
              String(item).trim(),
            )
            .filter(Boolean)
        : undefined,
  };
}

function mergeSettings(
  incoming:
    | GlobalAdminSettings
    | null
    | undefined,
): GlobalAdminSettings {
  const parsed = incoming ?? {};

  /*
   * Normalize every saved client account.
   */
  const clients = Array.isArray(
    parsed.clients,
  )
    ? parsed.clients
        .map(normalizeClientAccount)
        .filter(
          (item): item is ClientAccount =>
            item !== null,
        )
    : [];

  return {
    ...DEFAULT_GLOBAL_ADMIN_SETTINGS,

    ...parsed,

    general: {
      ...DEFAULT_GLOBAL_ADMIN_SETTINGS.general,
      ...(parsed.general ?? {}),
    },

    account: normalizeAdminAccount(
      parsed.account,
    ),

    security: {
      ...DEFAULT_SECURITY,
      ...(parsed.security ?? {}),
    },

    notifications: {
      ...DEFAULT_NOTIFICATIONS,
      ...(parsed.notifications ?? {}),
    },

    appearance: {
      ...DEFAULT_APPEARANCE,
      ...(parsed.appearance ?? {}),
    },

    clients,
  };
}

function browserSnapshot(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    window.localStorage.getItem(
      ADMIN_SETTINGS_STORAGE_KEY,
    ) ?? ""
  );
}

export function getGlobalAdminSettings(): GlobalAdminSettings {
  if (typeof window === "undefined") {
    return mergeSettings(
      DEFAULT_GLOBAL_ADMIN_SETTINGS,
    );
  }

  try {
    const raw =
      window.localStorage.getItem(
        ADMIN_SETTINGS_STORAGE_KEY,
      );

    if (!raw) {
      return mergeSettings(
        DEFAULT_GLOBAL_ADMIN_SETTINGS,
      );
    }

    return mergeSettings(
      JSON.parse(raw) as GlobalAdminSettings,
    );
  } catch {
    return mergeSettings(
      DEFAULT_GLOBAL_ADMIN_SETTINGS,
    );
  }
}

export function saveGlobalAdminSettings(
  settings: GlobalAdminSettings,
) {
  if (typeof window === "undefined") {
    return;
  }

  /*
   * Normalize BEFORE saving.
   * This guarantees password is retained inside client accounts.
   */
  const normalized =
    mergeSettings(settings);

  window.localStorage.setItem(
    ADMIN_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalized),
  );

  window.dispatchEvent(
    new CustomEvent(
      ADMIN_SETTINGS_EVENT,
      {
        detail: normalized,
      },
    ),
  );
}

export function getClientAccounts(): ClientAccount[] {
  return [
    ...(getGlobalAdminSettings().clients ??
      []),
  ];
}

export function findClientAccount(
  identifier: string,
): ClientAccount | null {
  const query =
    identifier.trim().toLowerCase();

  if (!query) {
    return null;
  }

  return (
    getClientAccounts().find(
      (client) =>
        [
          client.clientId,
          client.id,
          client.username,
          client.email,
        ]
          .filter(Boolean)
          .some(
            (value) =>
              String(value)
                .trim()
                .toLowerCase() ===
              query,
          ),
    ) ?? null
  );
}

export function saveClientAccount(
  client: ClientAccount,
) {
  const current =
    getGlobalAdminSettings();

  const clients =
    current.clients ?? [];

  /*
   * Normalize the incoming client first.
   * This ensures password/loginPassword are kept.
   */
  const normalizedClient =
    normalizeClientAccount({
      ...client,

      /*
       * Keep both fields synchronized.
       */
      password:
        client.password ??
        client.loginPassword ??
        "",

      loginPassword:
        client.loginPassword ??
        client.password ??
        "",

      role: "client",
    });

  /*
   * Invalid client object should not overwrite data.
   */
  if (!normalizedClient) {
    return;
  }

  const exists = clients.some(
    (item) =>
      item.id ===
      normalizedClient.id,
  );

  const next = exists
    ? clients.map((item) =>
        item.id ===
        normalizedClient.id
          ? normalizedClient
          : item,
      )
    : [
        ...clients,
        normalizedClient,
      ];

  saveGlobalAdminSettings({
    ...current,
    clients: next,
  });
}

export function deleteClientAccount(
  clientId: string,
) {
  const current =
    getGlobalAdminSettings();

  const next =
    (current.clients ?? []).filter(
      (client) =>
        client.id !== clientId &&
        client.clientId !== clientId,
    );

  saveGlobalAdminSettings({
    ...current,
    clients: next,
  });
}

function subscribe(
  callback: () => void,
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (
    event: StorageEvent,
  ) => {
    if (
      event.key ===
      ADMIN_SETTINGS_STORAGE_KEY
    ) {
      callback();
    }
  };

  const handleCustom = () => {
    callback();
  };

  window.addEventListener(
    "storage",
    handleStorage,
  );

  window.addEventListener(
    ADMIN_SETTINGS_EVENT,
    handleCustom,
  );

  return () => {
    window.removeEventListener(
      "storage",
      handleStorage,
    );

    window.removeEventListener(
      ADMIN_SETTINGS_EVENT,
      handleCustom,
    );
  };
}

export function useGlobalAdminSettings() {
  const snapshot =
    useSyncExternalStore(
      subscribe,
      browserSnapshot,
      () => "",
    );

  if (!snapshot) {
    return mergeSettings(
      DEFAULT_GLOBAL_ADMIN_SETTINGS,
    );
  }

  try {
    return mergeSettings(
      JSON.parse(snapshot) as GlobalAdminSettings,
    );
  } catch {
    return mergeSettings(
      DEFAULT_GLOBAL_ADMIN_SETTINGS,
    );
  }
}