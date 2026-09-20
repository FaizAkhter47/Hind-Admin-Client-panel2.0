"use client";

import Image from "next/image";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  deleteClientAccount,
  getGlobalAdminSettings,
  saveClientAccount,
  saveGlobalAdminSettings,
  type ClientAccount,
  type GlobalAdminSettings,
} from "./admin-settings";

/* =========================================================
   HCS ADMIN PANEL v2 — single page control center
   • Admin/Client sessions are stored under SEPARATE keys,
     so both panels can stay open in different tabs.
   • Day / Night theme (shared key "hcs-theme").
   • Canonical client source = admin-settings.ts
========================================================= */

type SectionKey =
  | "dashboard" | "clients" | "websites" | "keywords" | "ranking" | "pages"
  | "blogs" | "backlinks" | "technical" | "reports" | "competitors"
  | "notifications" | "settings";

type GenericModule = Exclude<SectionKey, "dashboard" | "clients" | "settings">;
type ClientStatus = "Active" | "Suspended" | "Disabled";

type PermissionKey =
  | "dashboard" | "websites" | "keywords" | "ranking" | "pages" | "blogs"
  | "backlinks" | "technical" | "reports" | "competitors" | "notifications";

type PermissionMap = Record<PermissionKey, boolean>;
type AnyRecord = Record<string, any>;
type Theme = "light" | "dark";

type ExtendedClient = ClientAccount & {
  clientPortalEnabled?: boolean;
  permissions?: Record<string, boolean>;
  assignedWebsiteIds?: string[];
  tags?: string[];
  assignedServices?: string[];
  selectedServices?: string[];
  notes?: string;
};

type ClientForm = {
  clientId: string; username: string; email: string; password: string;
  name: string; companyName: string; phone: string; website: string;
  plan: string; assignedManager: string; status: ClientStatus;
  clientPortalEnabled: boolean; assignedWebsiteIds: string[];
  permissions: PermissionMap; tags: string; notes: string; services: string;
};

type AgencySettings = {
  legalBusinessName: string; tagline: string; registrationType: string;
  gstin: string; pan: string; cin: string; address: string; city: string;
  state: string; pincode: string; country: string; businessHours: string;
  currency: string; defaultClientPlan: string; primaryService: string;
  whatsappNumber: string; supportPhone: string; salesPhone: string;
  supportEmail: string; salesEmail: string; billingEmail: string;
  logoPath: string; faviconPath: string; brandWebsite: string;
  linkedin: string; instagram: string; facebook: string; x: string;
  youtube: string; businessDescription: string; defaultReportName: string;
  defaultReportPeriod: string; timezone: string; leadSource: string;
  defaultManager: string;
};

/* ---------- storage keys ---------- */

const SESSION_KEY = "hcs-session-admin"; // admin only — client uses "hcs-session-client"
const LEGACY_SESSION_KEY = "hcs-auth-session";
const ACTIVITY_KEY = "hcs-admin-activity";
const THEME_KEY = "hcs-theme";
const AGENCY_SETTINGS_KEY = "hcs-agency-settings-v1";
const AGENCY_SETTINGS_EVENT = "hcs-agency-settings-updated";
const PORTAL_DATA_EVENT = "hcs-admin-portal-data-updated";
const CLIENT_PANEL_URL = "/client"; // change to your real client panel route

const MODULE_KEYS: Record<GenericModule, string[]> = {
  websites: ["hcs-admin-websites-v6", "hcs-admin-websites-v5", "hcs-admin-websites-v4"],
  keywords: ["hcs-admin-keywords-v6", "hcs-admin-keywords-v5", "hcs-admin-keywords-v4"],
  ranking: ["hcs-admin-ranking-v6", "hcs-admin-ranking-v5", "hcs-admin-ranking-v4"],
  pages: ["hcs-admin-pages-v6", "hcs-admin-pages-v5", "hcs-admin-pages-v4"],
  blogs: ["hcs-admin-blogs-v6", "hcs-admin-blogs-v5", "hcs-admin-blogs-v4"],
  backlinks: ["hcs-admin-backlinks-v6", "hcs-admin-backlinks-v5", "hcs-admin-backlinks-v4"],
  technical: ["hcs-admin-technical-v6", "hcs-admin-technical-v5", "hcs-admin-technical-v4"],
  reports: ["hcs-admin-reports-v6", "hcs-admin-reports-v5", "hcs-admin-reports-v4"],
  competitors: ["hcs-admin-competitors-v6", "hcs-admin-competitors-v5", "hcs-admin-competitors-v4"],
  notifications: ["hcs-admin-notifications-v5", "hcs-admin-notifications-v4"],
};

const NAV: Array<{ key: SectionKey; label: string; icon: string }> = [
  { key: "dashboard", label: "Dashboard", icon: "⌂" },
  { key: "clients", label: "Clients", icon: "♙" },
  { key: "websites", label: "Websites", icon: "◉" },
  { key: "keywords", label: "Keywords", icon: "#" },
  { key: "ranking", label: "Ranking", icon: "↗" },
  { key: "pages", label: "Pages", icon: "▤" },
  { key: "blogs", label: "Blogs", icon: "✎" },
  { key: "backlinks", label: "Backlinks", icon: "↔" },
  { key: "technical", label: "Technical", icon: "⚙" },
  { key: "reports", label: "Reports", icon: "▥" },
  { key: "competitors", label: "Competitors", icon: "◎" },
  { key: "notifications", label: "Notifications", icon: "♢" },
  { key: "settings", label: "Settings", icon: "✱" },
];

const LABEL = Object.fromEntries(NAV.map((n) => [n.key, n.label])) as Record<SectionKey, string>;

const PERMISSIONS: Array<{ key: PermissionKey; label: string; description: string }> = [
  { key: "dashboard", label: "Dashboard", description: "Client overview" },
  { key: "websites", label: "Websites", description: "Assigned websites" },
  { key: "keywords", label: "Keywords / SEO", description: "Keyword and SEO data" },
  { key: "ranking", label: "Rankings", description: "Keyword positions" },
  { key: "pages", label: "Pages", description: "Page performance" },
  { key: "blogs", label: "Blogs", description: "Blog/content data" },
  { key: "backlinks", label: "Backlinks", description: "Backlink records" },
  { key: "technical", label: "Technical SEO", description: "Technical audits" },
  { key: "reports", label: "Reports", description: "Client reports" },
  { key: "competitors", label: "Competitors", description: "Competitor records" },
  { key: "notifications", label: "Notifications", description: "Client notifications" },
];

const allPerms = (value: boolean) =>
  Object.fromEntries(PERMISSIONS.map((p) => [p.key, value])) as PermissionMap;

const DEFAULT_PERMISSIONS: PermissionMap = {
  ...allPerms(true), technical: false, competitors: false,
};

const DEFAULT_AGENCY_SETTINGS: AgencySettings = {
  legalBusinessName: "Hind Consultancy Services",
  tagline: "Smart Technology. Better Business.",
  registrationType: "Proprietorship / Agency",
  gstin: "", pan: "", cin: "", address: "", city: "", state: "", pincode: "",
  country: "India",
  businessHours: "Monday - Saturday, 10:00 AM - 7:00 PM",
  currency: "INR",
  defaultClientPlan: "Monthly SEO",
  primaryService: "SEO & Digital Marketing",
  whatsappNumber: "", supportPhone: "", salesPhone: "",
  supportEmail: "support@hindconsultancyservices.com",
  salesEmail: "admin@hindconsultancyservices.com",
  billingEmail: "admin@hindconsultancyservices.com",
  logoPath: "/images/logo.png", faviconPath: "/images/logo.png",
  brandWebsite: "https://hindconsultancyservices.com",
  linkedin: "", instagram: "", facebook: "", x: "", youtube: "",
  businessDescription:
    "Hind Consultancy Services provides web development, SEO, digital marketing, business consultancy, documentation support and IT solutions.",
  defaultReportName: "HCS SEO Performance Report",
  defaultReportPeriod: "Monthly",
  timezone: "Asia/Kolkata",
  leadSource: "Website",
  defaultManager: "",
};

/* ---------- settings field maps (keeps JSX small) ---------- */

type AF = Array<[keyof AgencySettings, string, string?]>;

const AG_IDENTITY: AF = [
  ["legalBusinessName", "Legal Business Name"], ["tagline", "Tagline"],
  ["registrationType", "Registration Type"], ["gstin", "GSTIN"], ["pan", "PAN"],
  ["cin", "CIN / Registration Number"], ["primaryService", "Primary Service"],
  ["defaultClientPlan", "Default Client Plan"], ["businessHours", "Business Hours"],
  ["currency", "Currency"], ["timezone", "Timezone"], ["country", "Country"],
  ["city", "City"], ["state", "State"], ["pincode", "Pincode"],
];
const AG_CONTACT: AF = [
  ["whatsappNumber", "WhatsApp Number"], ["supportPhone", "Support Phone"],
  ["salesPhone", "Sales Phone"], ["supportEmail", "Support Email", "email"],
  ["salesEmail", "Sales Email", "email"], ["billingEmail", "Billing Email", "email"],
  ["brandWebsite", "Business Website", "url"],
];
const AG_SOCIAL: AF = [
  ["linkedin", "LinkedIn"], ["instagram", "Instagram"], ["facebook", "Facebook"],
  ["x", "X / Twitter"], ["youtube", "YouTube"],
];
const AG_BRAND: AF = [["logoPath", "Logo Path"], ["faviconPath", "Favicon Path"]];
const AG_OPS: AF = [
  ["defaultManager", "Default Manager"], ["leadSource", "Lead Source"],
  ["defaultReportName", "Default Report Name"],
];
const ACCOUNT_FIELDS: Array<[string, string, string?]> = [
  ["adminId", "Admin ID"], ["username", "Username"], ["fullName", "Full Name"],
  ["email", "Email", "email"], ["phone", "Phone"], ["jobTitle", "Job Title"],
];
const SECURITY_NUMBERS: Array<[string, string, number, number]> = [
  ["minPasswordLength", "Minimum Password Length", 6, 8],
  ["failedAttemptsLimit", "Failed Attempts Limit", 1, 5],
  ["sessionTimeoutMinutes", "Session Timeout (minutes)", 5, 60],
  ["passwordExpiryDays", "Password Expiry Days", 0, 0],
];
const SECURITY_TOGGLES: Array<[string, string]> = [
  ["requireUppercase", "Require uppercase"], ["requireNumber", "Require number"],
  ["requireSpecialCharacter", "Require special character"],
  ["blockAfterFailedAttempts", "Block after failed attempts"],
  ["loginAlerts", "Login alerts"], ["suspiciousLoginAlerts", "Suspicious login alerts"],
  ["sessionAlerts", "Session alerts"], ["passwordExpiry", "Password expiry"],
];
const SETTINGS_TABS = [
  { key: "account", label: "Account" }, { key: "security", label: "Security" },
  { key: "agency", label: "Agency" }, { key: "contact", label: "Contact & Social" },
  { key: "branding", label: "Branding" }, { key: "operations", label: "Operations" },
  { key: "appearance", label: "Appearance" },
] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number]["key"];

/* ---------- module form config (one config → all 10 forms) ---------- */

type FieldDef = {
  k: string; l: string;
  t?: "text" | "number" | "date" | "datetime-local" | "url" | "select" | "textarea" | "client" | "website";
  o?: string[]; req?: boolean; def?: string; min?: number; max?: number; step?: string;
};

const CLIENT_REQ: FieldDef = { k: "clientId", l: "Client", t: "client", req: true };
const CLIENT_OPT: FieldDef = { k: "clientId", l: "Client", t: "client" };
const SITE: FieldDef = { k: "websiteId", l: "Website", t: "website" };
const SITE_REQ: FieldDef = { ...SITE, req: true };
const notes = (l = "Notes"): FieldDef => ({ k: "notes", l, t: "textarea" });

const MODULE_FORMS: Record<GenericModule, { sub: string; fields: FieldDef[] }> = {
  websites: {
    sub: "Website profile",
    fields: [
      { k: "name", l: "Website Name", req: true }, { k: "domain", l: "Domain", req: true },
      { k: "url", l: "Website URL", t: "url" }, CLIENT_OPT,
      { k: "manager", l: "Manager", def: "$manager" },
      { k: "status", l: "Status", t: "select", o: ["Active", "Paused", "Completed", "Inactive"], def: "Active" },
      { k: "service", l: "Primary Service" }, { k: "startDate", l: "Start Date", t: "date" },
      { k: "targetCountry", l: "Target Country", def: "India" }, notes(),
    ],
  },
  keywords: {
    sub: "SEO keyword record",
    fields: [
      CLIENT_REQ, SITE, { k: "keyword", l: "Keyword", req: true },
      { k: "intent", l: "Search Intent", t: "select", o: ["Informational", "Commercial", "Transactional", "Navigational"] },
      { k: "searchVolume", l: "Search Volume", t: "number", min: 0 },
      { k: "difficulty", l: "Difficulty", t: "number", min: 0, max: 100 },
      { k: "targetUrl", l: "Target URL" },
      { k: "status", l: "Status", t: "select", o: ["Active", "Tracking", "Paused"], def: "Active" },
      notes("Keyword Notes"),
    ],
  },
  ranking: {
    sub: "Keyword ranking snapshot",
    fields: [
      CLIENT_REQ, SITE, { k: "keyword", l: "Keyword", req: true },
      { k: "searchEngine", l: "Search Engine", t: "select", o: ["Google", "Bing", "Yahoo"], def: "Google" },
      { k: "device", l: "Device", t: "select", o: ["Desktop", "Mobile", "Tablet"], def: "Desktop" },
      { k: "currentPosition", l: "Current Position", t: "number", min: 0 },
      { k: "previousPosition", l: "Previous Position", t: "number", min: 0 },
      { k: "date", l: "Tracking Date", t: "date", def: "$today" },
      { k: "targetUrl", l: "Target URL" }, { k: "serpFeature", l: "SERP Feature" },
      notes("Ranking Notes"),
    ],
  },
  pages: {
    sub: "Website page performance",
    fields: [
      CLIENT_REQ, SITE_REQ, { k: "title", l: "Page Title", req: true },
      { k: "url", l: "Page URL", req: true },
      { k: "clicks", l: "Clicks", t: "number", min: 0 },
      { k: "impressions", l: "Impressions", t: "number", min: 0 },
      { k: "averagePosition", l: "Average Position", t: "number", min: 0, step: "0.1" },
      { k: "status", l: "Status", t: "select", o: ["Active", "Needs Update", "Optimized"], def: "Active" },
      { k: "keyword", l: "Primary Keyword" }, { k: "lastAudited", l: "Last Audited", t: "date" },
      notes("Page Notes"),
    ],
  },
  blogs: {
    sub: "Blog / content record",
    fields: [
      CLIENT_REQ, SITE, { k: "title", l: "Blog Title", req: true }, { k: "author", l: "Author" },
      { k: "keyword", l: "Target Keyword" }, { k: "publishDate", l: "Publish Date", t: "date" },
      { k: "url", l: "Content URL" },
      { k: "status", l: "Status", t: "select", o: ["Draft", "Planned", "Published", "Updated"], def: "Draft" },
      { k: "category", l: "Category" }, { k: "wordCount", l: "Word Count", t: "number", min: 0 },
      notes("Content Notes"),
    ],
  },
  backlinks: {
    sub: "Off-page SEO record",
    fields: [
      CLIENT_REQ, { ...SITE_REQ, l: "Target Website" },
      { k: "sourceUrl", l: "Source URL", t: "url", req: true },
      { k: "targetUrl", l: "Target URL", t: "url", req: true }, { k: "anchorText", l: "Anchor Text" },
      { k: "linkType", l: "Link Type", t: "select", o: ["DoFollow", "NoFollow", "Sponsored", "UGC"] },
      { k: "status", l: "Status", t: "select", o: ["Active", "Pending", "Removed", "Lost"], def: "Active" },
      { k: "date", l: "Published Date", t: "date", def: "$today" },
      { k: "domainAuthority", l: "Domain Authority", t: "number", min: 0, max: 100 },
      { k: "domainRating", l: "Domain Rating", t: "number", min: 0, max: 100 },
      { k: "traffic", l: "Traffic Estimate", t: "number", min: 0 }, notes("Backlink Notes"),
    ],
  },
  technical: {
    sub: "Technical audit issue",
    fields: [
      CLIENT_REQ, SITE_REQ, { k: "title", l: "Issue Title", req: true },
      { k: "category", l: "Category", t: "select", o: ["Crawlability", "Indexing", "Core Web Vitals", "Meta / On-page", "Structured Data", "Mobile SEO", "Security", "Internal Links"] },
      { k: "severity", l: "Severity", t: "select", o: ["Critical", "High", "Medium", "Low"], def: "Medium" },
      { k: "url", l: "Affected URL" },
      { k: "status", l: "Status", t: "select", o: ["Open", "In Progress", "Resolved", "Ignored"], def: "Open" },
      { k: "dueDate", l: "Due Date", t: "date" },
      { k: "assignedTo", l: "Assigned To", def: "$manager" },
      { k: "recommendation", l: "Recommendation" }, notes("Audit Notes"),
    ],
  },
  reports: {
    sub: "SEO / client report",
    fields: [
      CLIENT_REQ, SITE, { k: "name", l: "Report Name", req: true, def: "$reportName" },
      { k: "type", l: "Report Type", t: "select", o: ["SEO", "Technical SEO", "Backlink", "Monthly Performance", "Competitor"], def: "SEO" },
      { k: "period", l: "Period", t: "select", o: ["Weekly", "Monthly", "Quarterly", "Yearly"], def: "$reportPeriod" },
      { k: "date", l: "Report Date", t: "date", def: "$today" },
      { k: "status", l: "Status", t: "select", o: ["Draft", "Ready", "Delivered", "Archived"], def: "Draft" },
      { k: "url", l: "Report URL" }, { k: "summary", l: "Report Summary", t: "textarea" },
    ],
  },
  competitors: {
    sub: "Competitor profile",
    fields: [
      CLIENT_REQ, SITE, { k: "name", l: "Competitor Name", req: true },
      { k: "domain", l: "Domain", req: true }, { k: "industry", l: "Industry" },
      { k: "type", l: "Competitor Type", t: "select", o: ["Direct", "Indirect", "Local", "National"], def: "Direct" },
      { k: "traffic", l: "Estimated Traffic", t: "number", min: 0 },
      { k: "status", l: "Status", t: "select", o: ["Monitoring", "Active", "Archived"], def: "Monitoring" },
      { k: "topKeyword", l: "Top Keyword" },
      { k: "domainAuthority", l: "Estimated Domain Authority", t: "number", min: 0, max: 100 },
      notes("Competitor Notes"),
    ],
  },
  notifications: {
    sub: "Client notification",
    fields: [
      CLIENT_OPT, { k: "title", l: "Title", req: true },
      { k: "type", l: "Type", t: "select", o: ["General", "SEO Update", "Report", "Website", "Payment", "Maintenance", "Important"], def: "General" },
      { k: "status", l: "Status", t: "select", o: ["Unread", "Read", "Archived"], def: "Unread" },
      { k: "date", l: "Date", t: "datetime-local", def: "$now" },
      { k: "url", l: "Action URL" },
      { k: "message", l: "Message", t: "textarea", req: true },
    ],
  },
};

const MODULES = Object.keys(MODULE_FORMS) as GenericModule[];
const isModule = (s: SectionKey): s is GenericModule => s in MODULE_FORMS;

const TITLE_KEYS: Record<GenericModule, [string[], string]> = {
  websites: [["name", "domain", "url"], "Website"],
  keywords: [["keyword", "query", "name"], "Keyword"],
  ranking: [["keyword", "query", "name"], "Keyword"],
  pages: [["title", "name", "url"], "Page"],
  blogs: [["title", "name"], "Blog"],
  backlinks: [["targetUrl", "sourceUrl", "anchorText", "name"], "Backlink"],
  technical: [["title", "issue", "name"], "Technical issue"],
  reports: [["name", "title"], "Report"],
  competitors: [["name", "domain"], "Competitor"],
  notifications: [["title", "subject", "name"], "Notification"],
};

const ID_KEYS = [
  "id", "_id", "clientId", "websiteId", "keywordId", "pageId", "blogId",
  "backlinkId", "reportId", "notificationId",
];

/* =========================================================
   HELPERS
========================================================= */

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const isRec = (v: unknown): v is AnyRecord => !!v && typeof v === "object" && !Array.isArray(v);

function parseJSON(raw: string | null): any {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function txt(value: unknown, fallback = "—") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function makeInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.length ? parts.map((p) => p[0]?.toUpperCase() ?? "").join("") : "HC";
}

function idOf(record: AnyRecord, index = 0) {
  const found = ID_KEYS.map((k) => record[k]).find((v) => String(v ?? "").trim());
  return txt(found, String(index + 1));
}

function titleOf(record: AnyRecord, section: GenericModule) {
  const [keys, fallback] = TITLE_KEYS[section];
  return txt(keys.map((k) => record[k]).find((v) => String(v ?? "").trim()), fallback);
}

function fmtDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

const localNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString();

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(name: string, rows: AnyRecord[]) {
  if (!rows.length) return;
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    let s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // CSV formula injection guard
    return `"${s.replace(/"/g, '""')}"`;
  };
  const body = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  triggerDownload(new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" }), name);
}

/* ---------- admin session (separate from client) ---------- */

function readAdminSession(): AnyRecord | null {
  const own = parseJSON(localStorage.getItem(SESSION_KEY));
  if (own?.role === "admin") return own;
  const legacy = parseJSON(localStorage.getItem(LEGACY_SESSION_KEY));
  if (legacy?.role === "admin") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(legacy));
    localStorage.removeItem(LEGACY_SESSION_KEY);
    return legacy;
  }
  return null;
}

function writeAdminSession(data: AnyRecord) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...data, role: "admin" }));
}

function clearAdminSession() {
  localStorage.removeItem(SESSION_KEY);
  if (parseJSON(localStorage.getItem(LEGACY_SESSION_KEY))?.role === "admin") {
    localStorage.removeItem(LEGACY_SESSION_KEY);
  }
}

/* ---------- theme ---------- */

function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  const apply = useCallback((next: Theme, persist = true) => {
    const root = document.documentElement;
    root.classList.add("theme-anim");
    root.dataset.theme = next;
    window.setTimeout(() => root.classList.remove("theme-anim"), 350);
    setThemeState(next);
    if (persist) { try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ } }
  }, []);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
    const system: Theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    apply(saved === "dark" || saved === "light" ? saved : system, false);
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY && (e.newValue === "dark" || e.newValue === "light")) apply(e.newValue, false);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [apply]);

  const toggle = useCallback(() => apply(theme === "dark" ? "light" : "dark"), [apply, theme]);
  return { theme, setTheme: apply, toggle };
}

/* ---------- agency + module storage ---------- */

function readAgencySettings(): AgencySettings {
  if (typeof window === "undefined") return clone(DEFAULT_AGENCY_SETTINGS);
  const parsed = parseJSON(window.localStorage.getItem(AGENCY_SETTINGS_KEY));
  return { ...clone(DEFAULT_AGENCY_SETTINGS), ...(isRec(parsed) ? parsed : {}) };
}

function saveAgencySettings(value: AgencySettings) {
  window.localStorage.setItem(AGENCY_SETTINGS_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(AGENCY_SETTINGS_EVENT));
}

function readRecords(keys: string[]): AnyRecord[] {
  if (typeof window === "undefined") return [];
  for (const key of keys) {
    const parsed = parseJSON(window.localStorage.getItem(key));
    const list = Array.isArray(parsed) ? parsed
      : Array.isArray(parsed?.items) ? parsed.items
      : Array.isArray(parsed?.data) ? parsed.data : null;
    if (list) return list.filter(isRec);
  }
  return [];
}

function writeRecords(section: GenericModule, records: AnyRecord[]) {
  window.localStorage.setItem(MODULE_KEYS[section][0], JSON.stringify(records));
  window.dispatchEvent(new CustomEvent(PORTAL_DATA_EVENT, { detail: { section, records } }));
}

/* ---------- clients / passwords ---------- */

function nextClientId(clients: ExtendedClient[]) {
  const nums = clients.map((c) => Number(String(c.clientId ?? "").match(/^HCS-CL-(\d+)$/i)?.[1] ?? 0));
  return `HCS-CL-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(6, "0")}`;
}

function rnd(n: number) {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] % n;
}

function generatePassword(security: AnyRecord) {
  const pick = (s: string) => s[rnd(s.length)];
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ", lower = "abcdefghijkmnopqrstuvwxyz";
  const nums = "23456789", spec = "@#$%&*!?";
  const u = security?.requireUppercase !== false;
  const n = security?.requireNumber !== false;
  const s = security?.requireSpecialCharacter !== false;
  const pool = lower + (u ? upper : "") + (n ? nums : "") + (s ? spec : "");
  const chars = [pick(lower), ...(u ? [pick(upper)] : []), ...(n ? [pick(nums)] : []), ...(s ? [pick(spec)] : [])];
  const min = Math.max(Number(security?.minPasswordLength ?? 8), 12);
  while (chars.length < min) chars.push(pick(pool));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function validatePassword(password: string, security: AnyRecord) {
  const min = Number(security?.minPasswordLength ?? 8);
  if (password.length < min) return `Minimum ${min} characters required.`;
  if (security?.requireUppercase && !/[A-Z]/.test(password)) return "Uppercase letter required.";
  if (security?.requireNumber && !/[0-9]/.test(password)) return "Number required.";
  if (security?.requireSpecialCharacter && !/[^A-Za-z0-9]/.test(password)) return "Special character required.";
  return "";
}

function normalizePermissions(value: unknown): PermissionMap {
  const src = isRec(value) ? value : {};
  const out = { ...DEFAULT_PERMISSIONS };
  (Object.keys(out) as PermissionKey[]).forEach((k) => {
    if (src[k] !== undefined) out[k] = Boolean(src[k]);
  });
  return out;
}

const emptyClientForm = (): ClientForm => ({
  clientId: "", username: "", email: "", password: "", name: "", companyName: "",
  phone: "", website: "", plan: "", assignedManager: "", status: "Active",
  clientPortalEnabled: true, assignedWebsiteIds: [],
  permissions: clone(DEFAULT_PERMISSIONS), tags: "", notes: "", services: "",
});

const splitList = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

function buildDefaults(section: GenericModule, agency: AgencySettings): AnyRecord {
  const now = localNow();
  const tokens: Record<string, string> = {
    $manager: agency.defaultManager, $reportName: agency.defaultReportName,
    $reportPeriod: agency.defaultReportPeriod, $today: now.slice(0, 10), $now: now.slice(0, 16),
  };
  const rec: AnyRecord = { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  MODULE_FORMS[section].fields.forEach((f) => {
    if (f.def !== undefined) rec[f.k] = f.def in tokens ? tokens[f.def] : f.def;
  });
  return rec;
}

/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function Field({ label, children, required = false, wide = false }: {
  label: string; children: ReactNode; required?: boolean; wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      {children}
    </label>
  );
}

function Panel({ eyebrow, title, span, action, children }: {
  eyebrow: string; title: string; span?: boolean; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section className={`panel ${span ? "settings-span" : ""}`}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  const tone = ["active", "enabled", "published", "ready", "delivered", "resolved", "optimized"].includes(v)
    ? "active"
    : ["suspended", "disabled", "lost", "removed", "critical", "open"].includes(v) ? "danger" : "pending";
  return <span className={`status-badge ${tone}`}>{value}</span>;
}

/* =========================================================
   ADMIN PAGE
========================================================= */

export default function AdminPage() {
  const { theme, setTheme, toggle: toggleTheme } = useTheme();

  const [section, setSection] = useState<SectionKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [settings, setSettings] = useState<GlobalAdminSettings | null>(null);
  const [draftSettings, setDraftSettings] = useState<GlobalAdminSettings | null>(null);
  const [agencySettings, setAgencySettings] = useState<AgencySettings>(clone(DEFAULT_AGENCY_SETTINGS));
  const [draftAgency, setDraftAgency] = useState<AgencySettings>(clone(DEFAULT_AGENCY_SETTINGS));
  const [records, setRecords] = useState<Record<string, AnyRecord[]>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [toast, setToast] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  const [showAdminPw, setShowAdminPw] = useState(false);
  const [clientModal, setClientModal] = useState<"create" | "edit" | null>(null);
  const [editingClient, setEditingClient] = useState<ExtendedClient | null>(null);
  const [credentials, setCredentials] = useState<AnyRecord | null>(null);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [recordModal, setRecordModal] = useState<{ section: GenericModule; record?: AnyRecord } | null>(null);
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClientForm());

  const sectionRef = useRef(section);
  sectionRef.current = section;

  const security = useMemo(() => (settings?.security ?? {}) as AnyRecord, [settings]);
  const sessionMinutes = Number(security.sessionTimeoutMinutes ?? 60) || 60;

  /* ---------- load ---------- */

  const loadEverything = useCallback((resetDrafts = true) => {
    const current = getGlobalAdminSettings();
    const agency = readAgencySettings();
    setSettings(current);
    setAgencySettings(agency);
    if (resetDrafts) {
      setDraftSettings(clone(current));
      setDraftAgency(clone(agency));
    }
    const next: Record<string, AnyRecord[]> = {};
    MODULES.forEach((m) => { next[m] = readRecords(MODULE_KEYS[m]); });
    setRecords(next);
  }, []);

  /* ---------- auth ---------- */

  useEffect(() => {
    try {
      const session = readAdminSession();
      const account = getGlobalAdminSettings().account;
      const id = String(session?.adminId ?? session?.username ?? session?.email ?? "").toLowerCase();
      const valid =
        !!session && account?.active !== false &&
        [account?.adminId, account?.username, account?.email]
          .filter(Boolean).some((v) => String(v).toLowerCase() === id);
      if (!valid) {
        clearAdminSession();
        window.location.replace("/");
        return;
      }
      setAuthorized(true);
      loadEverything();
    } catch {
      clearAdminSession();
      window.location.replace("/");
    }
  }, [loadEverything]);

  /* ---------- live sync (never wipes settings drafts) ---------- */

  useEffect(() => {
    const sync = () => loadEverything(false);
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY && !e.newValue) { window.location.replace("/"); return; }
      // client login/logout, theme and activity pings must not touch admin
      if (e.key?.startsWith("hcs-session-") || e.key === LEGACY_SESSION_KEY || e.key === THEME_KEY || e.key === ACTIVITY_KEY) return;
      sync();
    };
    const events = ["hcs-admin-settings-updated", PORTAL_DATA_EVENT, AGENCY_SETTINGS_EVENT];
    events.forEach((n) => window.addEventListener(n, sync));
    window.addEventListener("storage", onStorage);
    return () => {
      events.forEach((n) => window.removeEventListener(n, sync));
      window.removeEventListener("storage", onStorage);
    };
  }, [loadEverything]);

  /* ---------- shortcuts ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>(".search-field input")?.focus();
      }
      if (e.key === "Escape") {
        setClientModal(null); setRecordModal(null); setCredentials(null);
        setProfileOpen(false); setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- idle session timeout (multi-tab safe) ---------- */

  useEffect(() => {
    if (!authorized) return;
    const limit = sessionMinutes * 60_000;
    let timer = 0;
    let lastWrite = 0;
    const check = () => {
      const last = Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
      const idle = Date.now() - last;
      if (idle >= limit) { clearAdminSession(); window.location.replace("/"); }
      else timer = window.setTimeout(check, limit - idle);
    };
    const touch = () => {
      const now = Date.now();
      if (now - lastWrite > 15_000) {
        lastWrite = now;
        try { localStorage.setItem(ACTIVITY_KEY, String(now)); } catch { /* ignore */ }
      }
    };
    const evs = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    evs.forEach((n) => window.addEventListener(n, touch, { passive: true }));
    touch();
    timer = window.setTimeout(check, limit);
    return () => { window.clearTimeout(timer); evs.forEach((n) => window.removeEventListener(n, touch)); };
  }, [authorized, sessionMinutes]);

  /* ---------- toast ---------- */

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* ---------- memos ---------- */

  const clients = useMemo(() => (settings?.clients ?? []) as ExtendedClient[], [settings]);
  const websites = useMemo(() => records.websites ?? [], [records]);

  const currentRecords = useMemo(
    () => (isModule(section) ? records[section] ?? [] : []),
    [section, records],
  );

  const term = search.trim().toLowerCase();

  const filteredClients = useMemo(
    () => clients.filter((c) => {
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (!term) return true;
      return [c.name, c.companyName, c.email, c.username, c.clientId, c.plan, c.status]
        .some((v) => String(v ?? "").toLowerCase().includes(term));
    }),
    [clients, term, statusFilter],
  );

  const filteredRecords = useMemo(
    () => currentRecords.filter((r) => !term || JSON.stringify(r).toLowerCase().includes(term)),
    [currentRecords, term],
  );

  const latestClients = useMemo(
    () => [...clients].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))).slice(0, 8),
    [clients],
  );

  const clientByCode = useMemo(() => new Map(clients.map((c) => [String(c.clientId), c])), [clients]);
  const websiteName = useMemo(
    () => new Map(websites.map((w, i) => [idOf(w, i), titleOf(w, "websites")])),
    [websites],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { clients: clients.length };
    MODULES.forEach((m) => { c[m] = (records[m] ?? []).length; });
    return c;
  }, [clients, records]);

  const health = useMemo(() => ({
    active: clients.filter((c) => c.status === "Active").length,
    portal: clients.filter((c) => c.clientPortalEnabled !== false).length,
    suspended: clients.filter((c) => c.status === "Suspended").length,
    disabled: clients.filter((c) => c.status === "Disabled").length,
  }), [clients]);

  const dirty = useMemo(
    () => !!settings && !!draftSettings &&
      (JSON.stringify(draftSettings) !== JSON.stringify(settings) ||
        JSON.stringify(draftAgency) !== JSON.stringify(agencySettings)),
    [settings, draftSettings, draftAgency, agencySettings],
  );

  /* ---------- navigation ---------- */

  const notify = (message: string) => setToast(message);

  function navigate(next: SectionKey) {
    if (next === section && next === "settings") {
      setSidebarOpen(false);
      setProfileOpen(false);
      return;
    }
    if (section === "settings" && next !== "settings" && dirty &&
      !window.confirm("You have unsaved settings. Leave without saving?")) return;
    setSection(next);
    setSidebarOpen(false);
    setProfileOpen(false);
    setSearch("");
    setStatusFilter("All");
    setSelectedClients([]);
    loadEverything();
  }

  function logout() {
    clearAdminSession();
    window.location.replace("/");
  }

  /* ---------- clients ---------- */

  function openCreateClient() {
    setEditingClient(null);
    setClientForm({
      ...emptyClientForm(),
      clientId: nextClientId(clients),
      password: generatePassword(security),
      plan: agencySettings.defaultClientPlan,
      assignedManager: agencySettings.defaultManager,
    });
    setClientModal("create");
  }

  function openEditClient(c: ExtendedClient) {
    setEditingClient(c);
    setClientForm({
      clientId: c.clientId, username: c.username, email: c.email, password: c.password,
      name: c.name, companyName: c.companyName, phone: c.phone ?? "", website: c.website ?? "",
      plan: c.plan ?? "", assignedManager: c.assignedManager ?? "", status: c.status,
      clientPortalEnabled: c.clientPortalEnabled !== false,
      assignedWebsiteIds: c.assignedWebsiteIds ?? [],
      permissions: normalizePermissions(c.permissions),
      tags: c.tags?.join(", ") ?? "", notes: c.notes ?? "",
      services: (c.services ?? c.assignedServices ?? c.selectedServices ?? []).join(", "),
    });
    setClientModal("edit");
  }

  const credentialsOf = (c: ExtendedClient, password = c.password) => ({
    clientId: c.clientId, username: c.username, email: c.email, password,
    name: c.name, companyName: c.companyName, status: c.status,
  });

  function submitClient(event: FormEvent) {
    event.preventDefault();
    const f = clientForm;
    if (!f.name.trim() || !f.companyName.trim() || !f.email.trim() || !f.username.trim())
      return notify("Name, company, email and username are required.");
    const pwError = validatePassword(f.password, security);
    if (pwError) return notify(pwError);

    const others = clients.filter((c) => c.id !== editingClient?.id);
    if (others.some((c) => c.username.toLowerCase() === f.username.trim().toLowerCase()))
      return notify("Username already exists.");
    if (others.some((c) => c.email.toLowerCase() === f.email.trim().toLowerCase()))
      return notify("Email already exists.");

    const now = new Date().toISOString();
    const base = (editingClient
      ? { ...editingClient }
      : { id: crypto.randomUUID(), clientId: f.clientId, role: "client", createdAt: now }) as ExtendedClient;

    const saved: ExtendedClient = {
      ...base,
      clientId: editingClient?.clientId ?? f.clientId,
      username: f.username.trim(),
      email: f.email.trim(),
      password: f.password,
      name: f.name.trim(),
      companyName: f.companyName.trim(),
      phone: f.phone.trim() || undefined,
      website: f.website.trim() || undefined,
      plan: f.plan.trim() || undefined,
      assignedManager: f.assignedManager.trim() || undefined,
      status: f.status,
      active: f.status === "Active" && f.clientPortalEnabled,
      updatedAt: now,
      clientPortalEnabled: f.clientPortalEnabled,
      permissions: clone(f.permissions),
      assignedWebsiteIds: [...f.assignedWebsiteIds],
      tags: splitList(f.tags),
      notes: f.notes.trim() || undefined,
      selectedServices: splitList(f.services),
    } as ExtendedClient;

    saveClientAccount(saved);
    setClientModal(null);
    loadEverything();
    setCredentials(credentialsOf(saved));
    notify(editingClient ? "Client updated successfully." : "Client created successfully.");
  }

  function resetClientPassword(c: ExtendedClient) {
    if (!window.confirm(`Generate a new password for ${c.clientId}?`)) return;
    const password = generatePassword(security);
    const updated = { ...c, password, updatedAt: new Date().toISOString() };
    saveClientAccount(updated);
    setCredentials(credentialsOf(updated, password));
    loadEverything();
    notify("Client password reset successfully.");
  }

  function toggleClientPortal(c: ExtendedClient) {
    const enabled = c.clientPortalEnabled === false;
    saveClientAccount({
      ...c, clientPortalEnabled: enabled, active: enabled && c.status === "Active",
      updatedAt: new Date().toISOString(),
    });
    loadEverything();
    notify(enabled ? "Client portal enabled." : "Client portal disabled.");
  }

  function changeClientStatus(c: ExtendedClient, status: ClientStatus) {
    saveClientAccount({
      ...c, status, active: status === "Active" && c.clientPortalEnabled !== false,
      updatedAt: new Date().toISOString(),
    });
    loadEverything();
    notify(`Client status changed to ${status}.`);
  }

  function deleteClient(c: ExtendedClient) {
    if (!window.confirm(`Delete ${c.clientId}? This cannot be undone.`)) return;
    deleteClientAccount(c.id);
    setSelectedClients((cur) => cur.filter((id) => id !== c.id));
    loadEverything();
    notify("Client deleted successfully.");
  }

  function applyBulkAction(action: "enable" | "disable" | "suspend") {
    if (!selectedClients.length) return;
    const current = getGlobalAdminSettings();
    const selected = new Set(selectedClients);
    const next = (current.clients ?? []).map((c: ExtendedClient) => {
      if (!selected.has(c.id)) return c;
      if (action === "disable") return { ...c, status: "Disabled" as const, active: false, clientPortalEnabled: false };
      if (action === "suspend") return { ...c, status: "Suspended" as const, active: false };
      return { ...c, status: "Active" as const, active: true, clientPortalEnabled: true };
    });
    saveGlobalAdminSettings({ ...current, clients: next });
    setSelectedClients([]);
    loadEverything();
    notify("Selected client accounts updated.");
  }

  /* ---------- module records ---------- */

  function openRecordEditor(module: GenericModule, record?: AnyRecord) {
    setRecordModal({ section: module, record });
  }

  function saveModuleRecord(module: GenericModule, record: AnyRecord) {
    const current = readRecords(MODULE_KEYS[module]);
    const rid = idOf(record);
    const at = current.findIndex((item, i) => idOf(item, i) === rid);
    const next = at >= 0 ? current.map((item, i) => (i === at ? record : item)) : [...current, record];
    writeRecords(module, next);
    setRecordModal(null);
    loadEverything();
    notify(`${LABEL[module]} record saved successfully.`);
  }

  function deleteModuleRecord(module: GenericModule, record: AnyRecord) {
    if (!window.confirm(`Delete this ${LABEL[module].toLowerCase()} record?`)) return;
    const rid = idOf(record);
    writeRecords(module, readRecords(MODULE_KEYS[module]).filter((item, i) => idOf(item, i) !== rid));
    loadEverything();
    notify("Record deleted successfully.");
  }

  /* ---------- settings ---------- */

  const patchAccount = (patch: AnyRecord) =>
    setDraftSettings((c) => (c ? ({ ...c, account: { ...c.account!, ...patch } } as any) : c));
  const patchSecurity = (patch: AnyRecord) =>
    setDraftSettings((c) => (c ? ({ ...c, security: { ...c.security, ...patch } } as any) : c));
  const patchAgency = <K extends keyof AgencySettings>(key: K, value: AgencySettings[K]) =>
    setDraftAgency((c) => ({ ...c, [key]: value }));

  function saveAdminSettings() {
    if (!draftSettings) return;
    const passwordChanged = draftSettings.account?.password !== settings?.account?.password;
    if (passwordChanged) {
      const err = validatePassword(
        draftSettings.account?.password ?? "",
        { ...(draftSettings.security ?? {}) } as AnyRecord,
      );
      if (err) return notify(err);
    }
    // clamp numeric policy values
    const sec: AnyRecord = { ...draftSettings.security };
    SECURITY_NUMBERS.forEach(([k, , min, def]) => { sec[k] = Math.max(min, Number(sec[k]) || def); });
    const finalSettings = { ...draftSettings, security: sec } as GlobalAdminSettings;

    saveGlobalAdminSettings(finalSettings);
    saveAgencySettings(draftAgency);

    // keep this admin logged in even if ID / username / email were edited
    const s = readAdminSession();
    writeAdminSession({
      ...s,
      adminId: finalSettings.account?.adminId || finalSettings.account?.username,
      username: finalSettings.account?.username,
      email: finalSettings.account?.email,
    });

    setSettings(clone(finalSettings));
    setDraftSettings(clone(finalSettings));
    setAgencySettings(clone(draftAgency));
    notify("Settings saved successfully.");
  }

  function discardSettings() {
    if (settings) setDraftSettings(clone(settings));
    setDraftAgency(clone(agencySettings));
  }

  /* ---------- credentials download ---------- */

  function downloadCredentialsText(v: AnyRecord) {
    const body = [
      "HIND CONSULTANCY SERVICES", "CLIENT PORTAL CREDENTIALS", "",
      `Client ID: ${v.clientId}`, `Username: ${v.username}`, `Email: ${v.email}`,
      `Password: ${v.password}`, `Status: ${v.status}`,
    ].join("\n");
    triggerDownload(new Blob([body], { type: "text/plain;charset=utf-8" }), `${v.clientId}-credentials.txt`);
  }

  async function downloadCredentialsExe(v: AnyRecord) {
    try {
      const res = await fetch("/api/client-credentials-exe", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v),
      });
      if (!res.ok) return notify("EXE route is not available.");
      triggerDownload(await res.blob(), `${v.clientId}-credentials.exe`);
    } catch {
      notify("Could not generate EXE credentials.");
    }
  }

  function exportCurrent() {
    if (section === "clients") {
      downloadCSV("hcs-clients.csv", filteredClients.map(({ password, ...rest }) => rest));
    } else if (isModule(section)) {
      downloadCSV(`hcs-${section}.csv`, filteredRecords);
    }
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (!authorized || !settings) {
    return (
      <main className="auth-loading">
        <Image src="/images/logo.png" alt="Hind Consultancy Services" width={165} height={58} priority />
        <span>Checking administrator session…</span>
      </main>
    );
  }

  const account = settings.account;
  const overview = MODULES.map((m) => ({ key: m, label: LABEL[m], value: counts[m] ?? 0 }));
  const maxOverview = Math.max(1, ...overview.map((o) => o.value));

  const stats: Array<[string, number, string, SectionKey]> = [
    ["Clients", counts.clients, "Manage clients", "clients"],
    ["Active clients", health.active, "Active accounts", "clients"],
    ...MODULES.map((m): [string, number, string, SectionKey] => [
      LABEL[m], counts[m] ?? 0, `Saved ${LABEL[m].toLowerCase()}`, m,
    ]),
  ];

  const agencyInputs = (list: AF) => (
    <div className="form-grid">
      {list.map(([key, label, type]) => (
        <Field key={key} label={label}>
          <input type={type ?? "text"} value={draftAgency[key]} onChange={(e) => patchAgency(key, e.target.value)} />
        </Field>
      ))}
    </div>
  );

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="hcs-admin-page">
      {/* SIDEBAR */}
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Image src="/images/logo.png" alt="Hind Consultancy Services" width={165} height={58} priority />
          <button type="button" className="sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>×</button>
        </div>
        <div className="sidebar-label">HCS ADMIN PANEL</div>
        <nav className="sidebar-navigation">
          {NAV.map((item) => (
            <button
              key={item.key} type="button"
              className={`sidebar-navigation-item ${section === item.key ? "active" : ""}`}
              onClick={() => navigate(item.key)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {counts[item.key] !== undefined ? <em className="nav-count">{counts[item.key]}</em> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom"><span className="sync-dot" />Global account store synchronized</div>
      </aside>

      {sidebarOpen ? (
        <button type="button" className="sidebar-overlay" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />
      ) : null}

      {/* MAIN */}
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button type="button" className="mobile-sidebar-button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>☰</button>
            <div>
              <span className="eyebrow">HCS ADMINISTRATION</span>
              <h1>{LABEL[section]}</h1>
            </div>
          </div>

          <div className="topbar-right">
            <button type="button" className="topbar-icon-button" aria-label="Toggle day / night mode" title="Day / Night" onClick={toggleTheme}>
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <button
              type="button" className="topbar-icon-button" title="Open client panel in a new tab" aria-label="Open client panel"
              onClick={() => window.open(CLIENT_PANEL_URL, "_blank", "noopener")}
            >↗</button>
            <button type="button" className="topbar-icon-button" title="Notifications" aria-label="Notifications" onClick={() => navigate("notifications")}>♢</button>
            <button type="button" className="profile-button" onClick={() => setProfileOpen((v) => !v)}>
              <span className="profile-avatar">{makeInitials(account?.fullName ?? "HCS")}</span>
              <span className="profile-copy">
                <strong>{txt(account?.fullName, "HCS Administrator")}</strong>
                <small>{txt(account?.email, "Administrator")}</small>
              </span>
              <span>⌄</span>
            </button>

            {profileOpen ? (
              <div className="profile-popover">
                <strong>{txt(account?.fullName, "HCS Administrator")}</strong>
                <span>{txt(account?.email)}</span>
                <button type="button" onClick={() => { navigate("settings"); }}>Agency & Security</button>
                <button type="button" onClick={() => window.open(CLIENT_PANEL_URL, "_blank", "noopener")}>Open client panel (new tab)</button>
                <button type="button" onClick={logout}>Logout</button>
              </div>
            ) : null}
          </div>
        </header>

        <section className="admin-content" key={section}>
          {/* HEADING */}
          <div className="page-heading">
            <div>
              <span className="eyebrow">CONTROL CENTER</span>
              <h2>{LABEL[section]}</h2>
              <p>
                {section === "dashboard" ? "Live operational overview from saved HCS data."
                  : section === "clients" ? "Manage client accounts, access, permissions and assigned websites."
                  : section === "settings" ? "Manage HCS agency identity, business details, security and appearance."
                  : `Create, update and manage ${LABEL[section].toLowerCase()} records from this single control center.`}
              </p>
            </div>
            <div className="heading-actions">
              {section === "clients" || isModule(section) ? (
                <button type="button" className="secondary-button" onClick={exportCurrent}>Export CSV</button>
              ) : null}
              {section === "clients" ? (
                <button type="button" className="primary-button" onClick={openCreateClient}>＋ Create Client</button>
              ) : null}
              {isModule(section) ? (
                <button type="button" className="primary-button" onClick={() => openRecordEditor(section, buildDefaults(section, agencySettings))}>
                  ＋ Add {LABEL[section].replace(/s$/, "")}
                </button>
              ) : null}
            </div>
          </div>

          {/* ============ DASHBOARD ============ */}
          {section === "dashboard" ? (
            <>
              <div className="stats-grid">
                {stats.map(([label, value, sub, target], i) => (
                  <button
                    key={label} type="button" className="metric-card"
                    style={{ animationDelay: `${i * 30}ms` }}
                    onClick={() => navigate(target)}
                  >
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{sub}</small>
                  </button>
                ))}
              </div>

              <div className="dashboard-grid">
                <Panel
                  eyebrow="CLIENT ACCESS" title="Account health"
                  action={<button type="button" className="secondary-button" onClick={() => navigate("clients")}>Manage Clients</button>}
                >
                  <div className="health-list">
                    <div><span>Active</span><strong>{health.active}</strong></div>
                    <div><span>Portal Enabled</span><strong>{health.portal}</strong></div>
                    <div><span>Suspended</span><strong>{health.suspended}</strong></div>
                    <div><span>Disabled</span><strong>{health.disabled}</strong></div>
                  </div>
                </Panel>

                <Panel
                  eyebrow="DATA" title="Records overview"
                >
                  <div className="bars">
                    {overview.map((o) => (
                      <button key={o.key} type="button" className="bar-row" onClick={() => navigate(o.key)}>
                        <span>{o.label}</span>
                        <span className="bar-track"><span className="bar-fill" style={{ width: `${(o.value / maxOverview) * 100}%` }} /></span>
                        <strong>{o.value}</strong>
                      </button>
                    ))}
                  </div>
                </Panel>
              </div>

              <Panel
                eyebrow="AGENCY" title="HCS Profile"
                action={<button type="button" className="secondary-button" onClick={() => navigate("settings")}>Open Settings</button>}
              >
                <div className="hcs-profile-brand">
                  <div className="hcs-profile-logo">
                    <Image src="/images/logo.png" alt="Hind Consultancy Services" width={190} height={70} priority />
                  </div>
                  <div className="hcs-profile-brand-copy">
                    <strong>{agencySettings.legalBusinessName}</strong>
                    <span>{agencySettings.tagline}</span>
                  </div>
                </div>
                <div className="info-list">
                  <div><span>Primary Service</span><strong>{agencySettings.primaryService}</strong></div>
                  <div><span>Contact</span><strong>{txt(agencySettings.supportEmail, "Not configured")}</strong></div>
                  <div><span>Timezone</span><strong>{agencySettings.timezone}</strong></div>
                  <div><span>Currency</span><strong>{agencySettings.currency}</strong></div>
                </div>
              </Panel>

              <Panel eyebrow="QUICK ACTIONS" title="Agency operations">
                <div className="quick-actions">
                  {NAV.filter((n) => n.key !== "dashboard" && n.key !== "settings").map((item) => (
                    <button key={item.key} type="button" className="quick-action" onClick={() => navigate(item.key)}>
                      <span>{item.icon}</span>
                      <strong>{item.label}</strong>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel eyebrow="CLIENTS" title="Latest accounts">
                {latestClients.length ? (
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr><th>Client</th><th>Client ID</th><th>Company</th><th>Status</th><th>Portal</th></tr>
                      </thead>
                      <tbody>
                        {latestClients.map((c) => (
                          <tr key={c.id}>
                            <td>{txt(c.name || c.companyName)}</td>
                            <td>{c.clientId}</td>
                            <td>{txt(c.companyName)}</td>
                            <td><StatusBadge value={c.status} /></td>
                            <td><StatusBadge value={c.clientPortalEnabled === false ? "Disabled" : "Enabled"} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState title="No client accounts" detail="Create a client from the Clients module." />
                )}
              </Panel>
            </>
          ) : null}

          {/* ============ CLIENTS ============ */}
          {section === "clients" ? (
            <section>
              <div className="toolbar">
                <div className="toolbar-left">
                  <div className="search-field">
                    <span>⌕</span>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client, company, email, username…" />
                    <kbd>Ctrl K</kbd>
                  </div>
                  <select className="toolbar-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
                    {["All", "Active", "Suspended", "Disabled"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>

                {selectedClients.length > 0 ? (
                  <div className="bulk-action-bar">
                    <span>{selectedClients.length} selected</span>
                    <button type="button" onClick={() => applyBulkAction("enable")}>Enable</button>
                    <button type="button" onClick={() => applyBulkAction("disable")}>Disable</button>
                    <button type="button" onClick={() => applyBulkAction("suspend")}>Suspend</button>
                    <button type="button" onClick={() => setSelectedClients([])}>Clear</button>
                  </div>
                ) : (
                  <span className="record-count">{filteredClients.length} client{filteredClients.length === 1 ? "" : "s"}</span>
                )}
              </div>

              <section className="panel">
                {filteredClients.length ? (
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>
                            <input
                              type="checkbox" aria-label="Select all"
                              checked={filteredClients.every((c) => selectedClients.includes(c.id))}
                              onChange={(e) => setSelectedClients(e.target.checked ? filteredClients.map((c) => c.id) : [])}
                            />
                          </th>
                          <th>Client</th><th>Client ID</th><th>Company</th><th>Email</th>
                          <th>Status</th><th>Portal</th><th>Websites</th><th>Plan</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClients.map((c, i) => (
                          <tr key={c.id} style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}>
                            <td>
                              <input
                                type="checkbox" aria-label={`Select ${c.clientId}`}
                                checked={selectedClients.includes(c.id)}
                                onChange={(e) => setSelectedClients((cur) => e.target.checked ? [...cur, c.id] : cur.filter((id) => id !== c.id))}
                              />
                            </td>
                            <td>
                              <div className="table-person">
                                <span className="person-avatar">{makeInitials(c.name || c.companyName)}</span>
                                <span>
                                  <strong>{txt(c.name || c.companyName)}</strong>
                                  <small>{c.username}</small>
                                </span>
                              </div>
                            </td>
                            <td>{c.clientId}</td>
                            <td>{txt(c.companyName)}</td>
                            <td>{txt(c.email)}</td>
                            <td><StatusBadge value={c.status} /></td>
                            <td><StatusBadge value={c.clientPortalEnabled === false ? "Disabled" : "Enabled"} /></td>
                            <td>{c.assignedWebsiteIds?.length ?? 0}</td>
                            <td>{txt(c.plan)}</td>
                            <td>
                              <div className="row-actions">
                                <button type="button" onClick={() => openEditClient(c)}>Edit</button>
                                <button type="button" onClick={() => resetClientPassword(c)}>Reset</button>
                                <button type="button" onClick={() => toggleClientPortal(c)}>{c.clientPortalEnabled === false ? "Enable" : "Disable"}</button>
                                <button type="button" onClick={() => changeClientStatus(c, c.status === "Suspended" ? "Active" : "Suspended")}>
                                  {c.status === "Suspended" ? "Unsuspend" : "Suspend"}
                                </button>
                                <button type="button" onClick={() => setCredentials(credentialsOf(c))}>Credentials</button>
                                <button type="button" className="danger" onClick={() => deleteClient(c)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title={search || statusFilter !== "All" ? "No matching clients" : "No clients yet"}
                    detail={search || statusFilter !== "All" ? "Try another search or filter." : "Create the first client account."}
                  />
                )}
              </section>
            </section>
          ) : null}

          {/* ============ GENERIC MODULES ============ */}
          {isModule(section) ? (
            <section>
              <div className="toolbar">
                <div className="toolbar-left">
                  <div className="search-field">
                    <span>⌕</span>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${LABEL[section].toLowerCase()}…`} />
                    <kbd>Ctrl K</kbd>
                  </div>
                </div>
                <span className="record-count">{filteredRecords.length} record{filteredRecords.length === 1 ? "" : "s"}</span>
              </div>

              <section className="panel">
                {filteredRecords.length ? (
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr><th>Name</th><th>Client</th><th>Website / Scope</th><th>Status</th><th>Updated</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((record, i) => {
                          const realIndex = currentRecords.indexOf(record);
                          const rid = idOf(record, realIndex);
                          const editable = { ...record, id: record.id ?? rid };
                          const client = clientByCode.get(String(record.clientId));
                          const status = txt(record.status ?? record.state ?? record.priority, "Saved");
                          return (
                            <tr key={`${rid}-${realIndex}`} style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}>
                              <td><strong>{titleOf(record, section)}</strong></td>
                              <td>{client ? client.name || client.companyName : txt(record.clientId, "Unassigned")}</td>
                              <td>
                                {txt(
                                  record.website ?? record.domain ?? record.url ?? record.site ??
                                    websiteName.get(String(record.websiteId)) ?? record.websiteId,
                                )}
                              </td>
                              <td><StatusBadge value={status} /></td>
                              <td>{fmtDate(record.updatedAt ?? record.createdAt ?? record.date)}</td>
                              <td>
                                <div className="row-actions">
                                  <button type="button" onClick={() => openRecordEditor(section, editable)}>Edit</button>
                                  <button type="button" className="danger" onClick={() => deleteModuleRecord(section, editable)}>Delete</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title={`No ${LABEL[section].toLowerCase()} records`}
                    detail={search ? "Nothing matches your search." : "Create the first real record using the Add button above."}
                  />
                )}
              </section>
            </section>
          ) : null}

          {/* ============ SETTINGS ============ */}
          {section === "settings" && draftSettings ? (
            <section>
              <div className="settings-tabs" role="tablist">
                {SETTINGS_TABS.map((t) => (
                  <button
                    key={t.key} type="button" role="tab" aria-selected={settingsTab === t.key}
                    className={`settings-tab ${settingsTab === t.key ? "active" : ""}`}
                    onClick={() => setSettingsTab(t.key)}
                  >{t.label}</button>
                ))}
              </div>

              <div className="settings-grid">
                {settingsTab === "account" ? (
                  <>
                    <Panel eyebrow="ADMIN ACCOUNT" title="Administrator identity" span>
                      <div className="form-grid">
                        {ACCOUNT_FIELDS.map(([key, label, type]) => (
                          <Field key={key} label={label}>
                            <input
                              type={type ?? "text"}
                              value={(draftSettings.account as AnyRecord)?.[key] ?? ""}
                              onChange={(e) => patchAccount({ [key]: e.target.value })}
                            />
                          </Field>
                        ))}
                      </div>
                    </Panel>

                    <Panel eyebrow="SECURITY" title="Admin login" span>
                      <div className="password-field">
                        <input
                          type={showAdminPw ? "text" : "password"} autoComplete="new-password"
                          aria-label="Admin password"
                          value={draftSettings.account?.password ?? ""}
                          onChange={(e) => patchAccount({ password: e.target.value, loginPassword: e.target.value })}
                        />
                        <button type="button" onClick={() => setShowAdminPw((v) => !v)}>{showAdminPw ? "Hide" : "Show"}</button>
                      </div>
                      <p className="field-help">This password is used by the unified Admin login and follows the password policy in the Security tab.</p>
                      <label className="switch-row">
                        <input
                          type="checkbox" checked={draftSettings.account?.active !== false}
                          onChange={(e) => patchAccount({ active: e.target.checked })}
                        />
                        <span>Administrator account active</span>
                      </label>
                    </Panel>
                  </>
                ) : null}

                {settingsTab === "security" ? (
                  <Panel eyebrow="SECURITY POLICY" title="Password, login and session policy" span>
                    <div className="form-grid">
                      {SECURITY_NUMBERS.map(([key, label, min, def]) => (
                        <Field key={key} label={label}>
                          <input
                            type="number" min={min}
                            value={(draftSettings.security as AnyRecord)?.[key] ?? def}
                            onChange={(e) => patchSecurity({ [key]: e.target.value === "" ? "" : Number(e.target.value) })}
                          />
                        </Field>
                      ))}
                    </div>
                    <div className="switch-grid">
                      {SECURITY_TOGGLES.map(([key, label]) => (
                        <label className="switch-row" key={key}>
                          <input
                            type="checkbox" checked={Boolean((draftSettings.security as AnyRecord)?.[key])}
                            onChange={(e) => patchSecurity({ [key]: e.target.checked })}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </Panel>
                ) : null}

                {settingsTab === "agency" ? (
                  <Panel eyebrow="AGENCY PROFILE" title="Business identity" span>
                    {agencyInputs(AG_IDENTITY)}
                    <div className="form-grid">
                      <Field label="Registered / Office Address">
                        <textarea rows={4} value={draftAgency.address} onChange={(e) => patchAgency("address", e.target.value)} />
                      </Field>
                      <Field label="Business Description">
                        <textarea rows={4} value={draftAgency.businessDescription} onChange={(e) => patchAgency("businessDescription", e.target.value)} />
                      </Field>
                    </div>
                  </Panel>
                ) : null}

                {settingsTab === "contact" ? (
                  <>
                    <Panel eyebrow="CONTACT" title="Agency contact channels" span>{agencyInputs(AG_CONTACT)}</Panel>
                    <Panel eyebrow="SOCIAL" title="Agency social profiles" span>{agencyInputs(AG_SOCIAL)}</Panel>
                  </>
                ) : null}

                {settingsTab === "branding" ? (
                  <Panel eyebrow="BRANDING" title="Visual identity" span>
                    <div className="branding-preview">
                      <div className="branding-logo-box">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={draftAgency.logoPath || "/images/logo.png"} alt="HCS logo" width={180} height={70} />
                      </div>
                      <div>
                        <strong>{draftAgency.legalBusinessName}</strong>
                        <span>{draftAgency.tagline}</span>
                      </div>
                    </div>
                    {agencyInputs(AG_BRAND)}
                  </Panel>
                ) : null}

                {settingsTab === "operations" ? (
                  <Panel eyebrow="OPERATIONS" title="Agency defaults" span>
                    <div className="form-grid">
                      {AG_OPS.map(([key, label]) => (
                        <Field key={key} label={label}>
                          <input value={draftAgency[key]} onChange={(e) => patchAgency(key, e.target.value)} />
                        </Field>
                      ))}
                      <Field label="Default Report Period">
                        <select value={draftAgency.defaultReportPeriod} onChange={(e) => patchAgency("defaultReportPeriod", e.target.value)}>
                          {["Weekly", "Monthly", "Quarterly", "Yearly"].map((p) => <option key={p}>{p}</option>)}
                        </select>
                      </Field>
                    </div>
                  </Panel>
                ) : null}

                {settingsTab === "appearance" ? (
                  <Panel eyebrow="APPEARANCE" title="Day / Night mode" span>
                    <div className="theme-choice">
                      {(["light", "dark"] as const).map((m) => (
                        <button key={m} type="button" className={`theme-option ${theme === m ? "active" : ""}`} onClick={() => setTheme(m)}>
                          {m === "light" ? "☀ Day" : "☾ Night"}
                        </button>
                      ))}
                    </div>
                    <p className="field-help">The theme applies instantly and stays in sync across admin and client panels.</p>
                  </Panel>
                ) : null}
              </div>

              <div className="sticky-save-bar">
                <span className={`dirty-note ${dirty ? "on" : ""}`}>{dirty ? "Unsaved changes" : "All changes saved"}</span>
                <button type="button" className="secondary-button" disabled={!dirty} onClick={discardSettings}>Discard Changes</button>
                <button type="button" className="primary-button" disabled={!dirty} onClick={saveAdminSettings}>Save Settings</button>
              </div>
            </section>
          ) : null}
        </section>
      </main>

      {/* MODALS */}
      {clientModal ? (
        <ClientModal
          key={clientForm.clientId}
          mode={clientModal} form={clientForm} setForm={setClientForm}
          security={security} websites={websites}
          onClose={() => setClientModal(null)} onSubmit={submitClient}
        />
      ) : null}

      {recordModal ? (
        <ModuleRecordModal
          key={idOf(recordModal.record ?? {}, 0) + recordModal.section}
          section={recordModal.section} initial={recordModal.record}
          isNew={!recordModal.record || !currentRecords.some((r) => idOf(r) === idOf(recordModal.record!))}
          clients={clients} websites={websites}
          onClose={() => setRecordModal(null)} onSave={saveModuleRecord}
        />
      ) : null}

      {credentials ? (
        <CredentialsModal
          value={credentials} onClose={() => setCredentials(null)} onCopy={notify}
          onDownloadTxt={() => downloadCredentialsText(credentials)}
          onDownloadExe={() => downloadCredentialsExe(credentials)}
        />
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}

/* =========================================================
   CLIENT MODAL
========================================================= */

function ClientModal({ mode, form, setForm, security, websites, onClose, onSubmit }: {
  mode: "create" | "edit";
  form: ClientForm;
  setForm: React.Dispatch<React.SetStateAction<ClientForm>>;
  security: AnyRecord;
  websites: AnyRecord[];
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  const update = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) =>
    setForm((c) => ({ ...c, [key]: value }));

  const text = (key: "name" | "companyName" | "email" | "username" | "phone" | "website" | "plan" | "assignedManager", label: string, opts: { required?: boolean; type?: string } = {}) => (
    <Field label={label} required={opts.required}>
      <input required={opts.required} type={opts.type ?? "text"} value={form[key]} onChange={(e) => update(key, e.target.value)} />
    </Field>
  );

  const websiteIds = websites.map((w, i) => idOf(w, i));

  return (
    <div className="modal-layer">
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="Close client modal" />
      <section className="drawer-modal" role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">{mode === "create" ? "NEW CLIENT" : "EDIT CLIENT"}</span>
            <h2>{mode === "create" ? "Create Client" : form.clientId}</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <form className="drawer-body" onSubmit={onSubmit}>
          <section className="form-card">
            <div className="panel-heading"><div><span className="eyebrow">IDENTITY</span><h3>Client account</h3></div></div>
            <div className="form-grid">
              <Field label="Client ID"><input value={form.clientId} readOnly /></Field>
              {text("name", "Client Name", { required: true })}
              {text("companyName", "Company", { required: true })}
              {text("email", "Email", { required: true, type: "email" })}
              {text("username", "Username", { required: true })}
              {text("phone", "Phone")}
              {text("website", "Website")}
              {text("plan", "Plan")}
              {text("assignedManager", "Manager")}
              <Field label="Status">
                <select value={form.status} onChange={(e) => update("status", e.target.value as ClientStatus)}>
                  <option>Active</option><option>Suspended</option><option>Disabled</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="form-card">
            <div className="panel-heading">
              <div><span className="eyebrow">SECURITY</span><h3>Portal credentials</h3></div>
              <button type="button" className="secondary-button" onClick={() => update("password", generatePassword(security))}>Regenerate</button>
            </div>
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"} autoComplete="new-password" aria-label="Client password"
                value={form.password} onChange={(e) => update("password", e.target.value)}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? "Hide" : "Show"}</button>
            </div>
            <p className="field-help">Follows the password policy from Settings → Security.</p>
            <label className="switch-row">
              <input type="checkbox" checked={form.clientPortalEnabled} onChange={(e) => update("clientPortalEnabled", e.target.checked)} />
              <span>Client portal enabled</span>
            </label>
          </section>

          <section className="form-card">
            <div className="panel-heading">
              <div><span className="eyebrow">PERMISSIONS</span><h3>Client module access</h3></div>
              <div className="inline-actions">
                <button type="button" className="secondary-button" onClick={() => update("permissions", allPerms(true))}>Grant All</button>
                <button type="button" className="secondary-button" onClick={() => update("permissions", allPerms(false))}>Remove All</button>
                <button type="button" className="secondary-button" onClick={() => update("permissions", clone(DEFAULT_PERMISSIONS))}>Default</button>
              </div>
            </div>
            <div className="permission-grid">
              {PERMISSIONS.map((p) => {
                const enabled = form.permissions[p.key];
                return (
                  <button
                    key={p.key} type="button" aria-pressed={enabled}
                    className={`permission-card ${enabled ? "enabled" : ""}`}
                    onClick={() => update("permissions", { ...form.permissions, [p.key]: !enabled })}
                  >
                    <span className="permission-check">{enabled ? "✓" : ""}</span>
                    <span><strong>{p.label}</strong><small>{p.description}</small></span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="form-card">
            <div className="panel-heading">
              <div><span className="eyebrow">WEBSITE SCOPE</span><h3>Assign existing websites</h3></div>
              <span className="record-count">{form.assignedWebsiteIds.length} selected</span>
            </div>
            {websites.length ? (
              <>
                <div className="inline-actions">
                  <button type="button" className="secondary-button" onClick={() => update("assignedWebsiteIds", websiteIds)}>Select All</button>
                  <button type="button" className="secondary-button" onClick={() => update("assignedWebsiteIds", [])}>Clear All</button>
                </div>
                <div className="assignment-list">
                  {websites.map((w, i) => {
                    const wid = idOf(w, i);
                    return (
                      <label className="assignment-row" key={wid}>
                        <input
                          type="checkbox" checked={form.assignedWebsiteIds.includes(wid)}
                          onChange={(e) => update("assignedWebsiteIds", e.target.checked
                            ? [...form.assignedWebsiteIds, wid]
                            : form.assignedWebsiteIds.filter((id) => id !== wid))}
                        />
                        <span>
                          <strong>{titleOf(w, "websites")}</strong>
                          <small>{txt(w.domain ?? w.url ?? w.website)}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyState title="No website records available" detail="Create real website records first." />
            )}
          </section>

          <section className="form-card">
            <div className="panel-heading"><div><span className="eyebrow">SERVICES</span><h3>Service scope</h3></div></div>
            <div className="form-grid">
              <Field label="Services">
                <input value={form.services} onChange={(e) => update("services", e.target.value)} placeholder="SEO, Web Development, Content, Backlinks" />
              </Field>
              <Field label="Tags">
                <input value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="premium, ecommerce, monthly" />
              </Field>
              <Field label="Notes" wide>
                <textarea rows={4} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Internal HCS notes…" />
              </Field>
            </div>
          </section>

          <div className="drawer-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button">{mode === "create" ? "Create Client" : "Save Client Access"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* =========================================================
   MODULE RECORD MODAL (config-driven)
========================================================= */

function ModuleRecordModal({ section, initial, isNew, clients, websites, onClose, onSave }: {
  section: GenericModule;
  initial?: AnyRecord;
  isNew: boolean;
  clients: ExtendedClient[];
  websites: AnyRecord[];
  onClose: () => void;
  onSave: (section: GenericModule, record: AnyRecord) => void;
}) {
  const config = MODULE_FORMS[section];
  const [form, setForm] = useState<AnyRecord>(() => clone(initial ?? { id: crypto.randomUUID() }));
  const [error, setError] = useState("");

  const set = (key: string, value: unknown) => setForm((c) => ({ ...c, [key]: value }));

  const clientOptions = clients.map((c) => ({ value: c.clientId, label: `${c.name || c.companyName} — ${c.clientId}` }));
  const websiteOptions = websites.map((w, i) => ({
    value: idOf(w, i), label: `${titleOf(w, "websites")} — ${txt(w.domain ?? w.url)}`,
  }));

  function selectClient(clientId: string) {
    const client = clients.find((c) => c.clientId === clientId);
    setForm((c) => ({
      ...c, clientId,
      ...(client && !c.clientEmail ? { clientEmail: client.email } : {}),
      ...(client && !c.manager ? { manager: client.assignedManager ?? "" } : {}),
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!String(form.id ?? "").trim()) return setError("Record ID is required.");
    const needsClient = config.fields.some((f) => f.t === "client" && f.req);
    if (needsClient && !String(form.clientId ?? "").trim()) return setError("Please select a client.");
    onSave(section, { ...form, updatedAt: new Date().toISOString() });
  }

  function renderField(f: FieldDef) {
    const value = form[f.k] ?? "";
    const isSelect = f.t === "select" || f.t === "client" || f.t === "website";
    let control: ReactNode;

    if (f.t === "textarea") {
      control = <textarea rows={4} required={f.req} value={value} onChange={(e) => set(f.k, e.target.value)} />;
    } else if (isSelect) {
      const options = f.t === "client" ? clientOptions
        : f.t === "website" ? websiteOptions
        : (f.o ?? []).map((o) => ({ value: o, label: o }));
      control = (
        <select
          required={f.req} value={value}
          onChange={(e) => (f.t === "client" ? selectClient(e.target.value) : set(f.k, e.target.value))}
        >
          <option value="">Select {f.l}</option>
          {value && !options.some((o) => o.value === String(value)) ? <option value={value}>{value}</option> : null}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    } else {
      control = (
        <input
          type={f.t ?? "text"} required={f.req} min={f.min} max={f.max} step={f.step}
          value={value} onChange={(e) => set(f.k, e.target.value)}
        />
      );
    }

    return <Field key={f.k} label={f.l} required={f.req} wide={f.t === "textarea"}>{control}</Field>;
  }

  return (
    <div className="modal-layer">
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="Close form" />
      <section className="drawer-modal" role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">{LABEL[section]}</span>
            <h2>{isNew ? "Create Record" : "Edit Record"}</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <form className="drawer-body" onSubmit={submit}>
          <section className="form-card">
            <div className="panel-heading"><div><span className="eyebrow">{LABEL[section]}</span><h3>{config.sub}</h3></div></div>
            <div className="form-grid">{config.fields.map(renderField)}</div>
          </section>

          {error ? <div className="form-error" role="alert">{error}</div> : null}

          <div className="drawer-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button">
              {isNew ? `Create ${LABEL[section].replace(/s$/, "")}` : "Save Changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* =========================================================
   CREDENTIALS MODAL
========================================================= */

function CredentialsModal({ value, onClose, onCopy, onDownloadTxt, onDownloadExe }: {
  value: AnyRecord;
  onClose: () => void;
  onCopy: (message: string) => void;
  onDownloadTxt: () => void;
  onDownloadExe: () => void;
}) {
  const [reveal, setReveal] = useState(false);

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      onCopy(message);
    } catch {
      onCopy("Clipboard access is unavailable.");
    }
  }

  const rows: Array<[string, string]> = [
    ["Client ID", value.clientId], ["Username", value.username], ["Email", value.email],
  ];

  return (
    <div className="modal-layer">
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="Close credentials" />
      <section className="credentials-modal" role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">CLIENT CREDENTIALS</span>
            <h2>{value.clientId}</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <div className="credentials-body">
          {rows.map(([label, v]) => (
            <div className="credential-row" key={label}><span>{label}</span><strong>{v}</strong></div>
          ))}
          <div className="credential-row">
            <span>Password</span>
            <strong>
              {reveal ? value.password : "•".repeat(Math.min(String(value.password).length, 14))}{" "}
              <button type="button" className="secondary-button" style={{ minHeight: 26, padding: "0 8px", marginLeft: 6 }} onClick={() => setReveal((v) => !v)}>
                {reveal ? "Hide" : "Show"}
              </button>
            </strong>
          </div>
          <div className="credential-row"><span>Status</span><strong>{value.status}</strong></div>

          <div className="credential-actions">
            <button type="button" className="secondary-button" onClick={() => copy(String(value.clientId), "Client ID copied.")}>Copy Client ID</button>
            <button type="button" className="secondary-button" onClick={() => copy(String(value.password), "Password copied.")}>Copy Password</button>
            <button
              type="button" className="secondary-button"
              onClick={() => copy(
                [`Client ID: ${value.clientId}`, `Username: ${value.username}`, `Email: ${value.email}`, `Password: ${value.password}`].join("\n"),
                "Credentials copied.",
              )}
            >Copy Credentials</button>
            <button type="button" className="secondary-button" onClick={onDownloadTxt}>Download TXT</button>
            <button type="button" className="secondary-button" onClick={onDownloadExe}>Download EXE</button>
          </div>
        </div>
      </section>
    </div>
  );
}