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
  password: string;
  loginPassword?: string;
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
  password: string;
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

const DEFAULT_NOTIFICATIONS = {
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

const DEFAULT_APPEARANCE = {
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
  version: "7.0",
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
    password: "Admin@123",
    loginPassword: "Admin@123",
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

function mergeSettings(
  incoming: GlobalAdminSettings | null | undefined,
): GlobalAdminSettings {
  const parsed = incoming ?? {};

  return {
    ...DEFAULT_GLOBAL_ADMIN_SETTINGS,
    ...parsed,
    general: {
      ...DEFAULT_GLOBAL_ADMIN_SETTINGS.general,
      ...(parsed.general ?? {}),
    },
    account: {
      ...DEFAULT_GLOBAL_ADMIN_SETTINGS.account,
      ...(parsed.account ?? {}),
      fullName:
        parsed.account?.fullName ||
        DEFAULT_GLOBAL_ADMIN_SETTINGS.account!.fullName,
      username:
        parsed.account?.username ||
        DEFAULT_GLOBAL_ADMIN_SETTINGS.account!.username,
      email:
        parsed.account?.email || DEFAULT_GLOBAL_ADMIN_SETTINGS.account!.email,
      adminId:
        parsed.account?.adminId ||
        parsed.account?.id ||
        DEFAULT_GLOBAL_ADMIN_SETTINGS.account!.adminId,
      id:
        parsed.account?.id ||
        parsed.account?.adminId ||
        DEFAULT_GLOBAL_ADMIN_SETTINGS.account!.id,
      password:
        parsed.account?.password ||
        parsed.account?.loginPassword ||
        DEFAULT_GLOBAL_ADMIN_SETTINGS.account!.password,
      loginPassword:
        parsed.account?.loginPassword ||
        parsed.account?.password ||
        DEFAULT_GLOBAL_ADMIN_SETTINGS.account!.loginPassword,
      phone:
        parsed.account?.phone || DEFAULT_GLOBAL_ADMIN_SETTINGS.account!.phone,
      jobTitle:
        parsed.account?.jobTitle ||
        DEFAULT_GLOBAL_ADMIN_SETTINGS.account!.jobTitle,
      department:
        parsed.account?.department ||
        DEFAULT_GLOBAL_ADMIN_SETTINGS.account!.department,
      role: parsed.account?.role || DEFAULT_GLOBAL_ADMIN_SETTINGS.account!.role,
      bio: parsed.account?.bio || DEFAULT_GLOBAL_ADMIN_SETTINGS.account!.bio,
      avatarInitials:
        parsed.account?.avatarInitials ||
        DEFAULT_GLOBAL_ADMIN_SETTINGS.account!.avatarInitials,
      active: parsed.account?.active ?? true,
    },
    security: {
      ...DEFAULT_GLOBAL_ADMIN_SETTINGS.security,
      ...(parsed.security ?? {}),
    },
    notifications: {
      ...DEFAULT_GLOBAL_ADMIN_SETTINGS.notifications,
      ...(parsed.notifications ?? {}),
    },
    appearance: {
      ...DEFAULT_GLOBAL_ADMIN_SETTINGS.appearance,
      ...(parsed.appearance ?? {}),
    },
    clients: Array.isArray(parsed.clients)
      ? parsed.clients.map(normalizeClientAccount).filter(Boolean) as ClientAccount[]
      : [],
  };
}

function normalizeClientAccount(value: unknown): ClientAccount | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ClientAccount> & Record<string, unknown>;
  const clientId = String(raw.clientId ?? raw.id ?? "").trim();
  const id = String(raw.id ?? clientId).trim();
  const username = String(raw.username ?? "").trim();
  const password = String(raw.password ?? raw.loginPassword ?? "").trim();

  if (!id || !clientId || !username || !password) return null;

  const status = raw.status === "Suspended" || raw.status === "Disabled" ? raw.status : "Active";
  const serviceSource = raw.services ?? raw.assignedServices ?? raw.serviceAccess ?? raw.selectedServices;

  return {
    id,
    clientId,
    username,
    name: String(raw.name ?? "").trim(),
    companyName: String(raw.companyName ?? "").trim(),
    email: String(raw.email ?? "").trim(),
    password,
    role: "client",
    status,
    active:
      raw.active !== false &&
      status === "Active" &&
      raw.clientPortalEnabled !== false,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    phone: raw.phone ? String(raw.phone) : undefined,
    website: raw.website ? String(raw.website) : undefined,
    plan: raw.plan ? String(raw.plan) : undefined,
    assignedManager: raw.assignedManager ? String(raw.assignedManager) : undefined,
    lastLogin: raw.lastLogin ? String(raw.lastLogin) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
    notes: raw.notes ? String(raw.notes) : undefined,
    clientPortalEnabled:
      raw.clientPortalEnabled !== false,
    permissions:
      raw.permissions && typeof raw.permissions === "object"
        ? Object.fromEntries(
            Object.entries(raw.permissions as Record<string, unknown>).map(
              ([key, value]) => [key, Boolean(value)],
            ),
          )
        : undefined,
    assignedWebsiteIds:
      Array.isArray(raw.assignedWebsiteIds)
        ? raw.assignedWebsiteIds.map((value) => String(value).trim()).filter(Boolean)
        : undefined,
    services:
      Array.isArray(serviceSource)
        ? serviceSource.map((value, index) => {
            if (typeof value === "string") {
              const name = value.trim();
              return name ? { id: `service-${index + 1}`, name, status: "Active" } : null;
            }
            if (!value || typeof value !== "object") return null;
            const service = value as Record<string, unknown>;
            const name = String(service.name ?? service.title ?? service.serviceName ?? "").trim();
            if (!name) return null;
            return {
              id: String(service.id ?? service.serviceId ?? service._id ?? `service-${index + 1}`).trim(),
              name,
              description: service.description ? String(service.description) : undefined,
              status: service.status ? String(service.status) : "Active",
              startedAt: service.startedAt ? String(service.startedAt) : service.startDate ? String(service.startDate) : undefined,
            };
          }).filter(Boolean) as ClientService[]
        : undefined,
    tags:
      Array.isArray(raw.tags)
        ? raw.tags.map((value) => String(value).trim()).filter(Boolean)
        : undefined,
  };
}

function browserSnapshot(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY) ?? "";
}

export function getGlobalAdminSettings(): GlobalAdminSettings {
  if (typeof window === "undefined") return mergeSettings(DEFAULT_GLOBAL_ADMIN_SETTINGS);

  try {
    const raw = window.localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY);
    if (!raw) return mergeSettings(DEFAULT_GLOBAL_ADMIN_SETTINGS);
    return mergeSettings(JSON.parse(raw) as GlobalAdminSettings);
  } catch {
    return mergeSettings(DEFAULT_GLOBAL_ADMIN_SETTINGS);
  }
}

export function saveGlobalAdminSettings(settings: GlobalAdminSettings) {
  if (typeof window === "undefined") return;

  const normalized = mergeSettings(settings);

  window.localStorage.setItem(
    ADMIN_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalized),
  );

  window.dispatchEvent(
    new CustomEvent(ADMIN_SETTINGS_EVENT, {
      detail: normalized,
    }),
  );
}

export function updateAdminPassword(password: string) {
  const current = getGlobalAdminSettings();
  const updated: GlobalAdminSettings = {
    ...current,
    account: {
      ...current.account!,
      password,
      loginPassword: password,
    },
  };

  saveGlobalAdminSettings(updated);
  return getGlobalAdminSettings();
}

export function getAdminLoginCredentials() {
  const settings = getGlobalAdminSettings();
  const account = settings.account!;

  return {
    adminId: account.adminId,
    username: account.username,
    email: account.email,
    password: account.password || account.loginPassword || "",
    name: account.fullName,
    role: account.role,
    active: account.active,
  };
}

export function getClientAccounts(): ClientAccount[] {
  return [...(getGlobalAdminSettings().clients ?? [])];
}

export function findClientAccount(identifier: string): ClientAccount | null {
  const query = identifier.trim().toLowerCase();
  if (!query) return null;

  return (
    getClientAccounts().find((client) =>
      [client.clientId, client.id, client.username, client.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase() === query),
    ) ?? null
  );
}

export function saveClientAccount(client: ClientAccount) {
  const current = getGlobalAdminSettings();
  const clients = current.clients ?? [];
  const next = clients.some((item) => item.id === client.id)
    ? clients.map((item) => (item.id === client.id ? client : item))
    : [...clients, client];

  saveGlobalAdminSettings({ ...current, clients: next });
}

export function deleteClientAccount(clientId: string) {
  const current = getGlobalAdminSettings();
  const next = (current.clients ?? []).filter(
    (client) => client.id !== clientId && client.clientId !== clientId,
  );

  saveGlobalAdminSettings({ ...current, clients: next });
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === ADMIN_SETTINGS_STORAGE_KEY) callback();
  };

  const handleCustom = () => callback();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(ADMIN_SETTINGS_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(ADMIN_SETTINGS_EVENT, handleCustom);
  };
}

export function useGlobalAdminSettings() {
  const snapshot = useSyncExternalStore(
    subscribe,
    browserSnapshot,
    () => "",
  );

  if (!snapshot) return DEFAULT_GLOBAL_ADMIN_SETTINGS;

  try {
    return mergeSettings(JSON.parse(snapshot) as GlobalAdminSettings);
  } catch {
    return DEFAULT_GLOBAL_ADMIN_SETTINGS;
  }
}
