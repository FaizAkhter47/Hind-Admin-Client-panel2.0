"use client";

import Image from "next/image";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

/* =========================================================
   TYPES
========================================================= */

type ClientStatus =
  | "Active"
  | "Suspended"
  | "Disabled";

type AnyRecord = Record<string, any>;

type ClientAccount = AnyRecord & {
  id: string;
  clientId: string;
  username: string;
  email: string;
  name?: string;
  companyName?: string;
  status: ClientStatus;
  services?: string[];
};

type GlobalAdminSettings = AnyRecord & {
  clients: ClientAccount[];
  account?: AnyRecord;
  security: AnyRecord;
};

type AdminAccountWithPassword =
  NonNullable<
    GlobalAdminSettings["account"]
  > & {
    password?: string;
    loginPassword?: string;
  };

type ExtendedClient = Omit<
  ClientAccount,
  "services"
> & {
  password?: string;
  clientPortalEnabled?: boolean;
  permissions?: Record<
    string,
    boolean
  >;
  assignedWebsiteIds?: string[];
  tags?: string[];
  services?: string[];
  assignedServices?: string[];
  selectedServices?: string[];
};

type SectionKey =
  | "dashboard"
  | "clients"
  | "websites"
  | "keywords"
  | "ranking"
  | "pages"
  | "blogs"
  | "backlinks"
  | "technical"
  | "reports"
  | "competitors"
  | "notifications"
  | "settings";

type PermissionKey =
  | "dashboard"
  | "websites"
  | "keywords"
  | "ranking"
  | "pages"
  | "blogs"
  | "backlinks"
  | "technical"
  | "reports"
  | "competitors"
  | "notifications";

type PermissionMap =
  Record<
    PermissionKey,
    boolean
  >;

type ClientForm = {
  clientId: string;
  username: string;
  email: string;
  password: string;
  name: string;
  companyName: string;
  phone: string;
  website: string;
  plan: string;
  assignedManager: string;
  status: ClientStatus;
  clientPortalEnabled: boolean;
  assignedWebsiteIds: string[];
  permissions: PermissionMap;
  tags: string;
  notes: string;
  services: string[];
};

type GenericModule = Exclude<
  SectionKey,
  "dashboard" | "clients" | "settings"
>;

/* =========================================================
   CONSTANTS
========================================================= */

const ADMIN_SETTINGS_KEY =
  "hcs-admin-settings";

const AUTH_KEY =
  "hcs-auth-session";

const MODULE_KEYS: Record<
  GenericModule,
  string[]
> = {
  websites: [
    "hcs-admin-websites-v6",
    "hcs-admin-websites-v5",
    "hcs-admin-websites-v4",
  ],
  keywords: [
    "hcs-admin-keywords-v6",
    "hcs-admin-keywords-v5",
    "hcs-admin-keywords-v4",
  ],
  ranking: [
    "hcs-admin-ranking-v6",
    "hcs-admin-ranking-v5",
    "hcs-admin-ranking-v4",
  ],
  pages: [
    "hcs-admin-pages-v6",
    "hcs-admin-pages-v5",
    "hcs-admin-pages-v4",
  ],
  blogs: [
    "hcs-admin-blogs-v6",
    "hcs-admin-blogs-v5",
    "hcs-admin-blogs-v4",
  ],
  backlinks: [
    "hcs-admin-backlinks-v6",
    "hcs-admin-backlinks-v5",
    "hcs-admin-backlinks-v4",
  ],
  technical: [
    "hcs-admin-technical-v6",
    "hcs-admin-technical-v5",
    "hcs-admin-technical-v4",
  ],
  reports: [
    "hcs-admin-reports-v6",
    "hcs-admin-reports-v5",
    "hcs-admin-reports-v4",
  ],
  competitors: [
    "hcs-admin-competitors-v6",
    "hcs-admin-competitors-v5",
    "hcs-admin-competitors-v4",
  ],
  notifications: [
    "hcs-admin-notifications-v5",
    "hcs-admin-notifications-v4",
  ],
};

const NAV: Array<{
  key: SectionKey;
  label: string;
  icon: string;
}> = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "⌂",
  },
  {
    key: "clients",
    label: "Clients",
    icon: "♙",
  },
  {
    key: "websites",
    label: "Websites",
    icon: "◉",
  },
  {
    key: "keywords",
    label: "Keywords",
    icon: "#",
  },
  {
    key: "ranking",
    label: "Ranking",
    icon: "↗",
  },
  {
    key: "pages",
    label: "Pages",
    icon: "▤",
  },
  {
    key: "blogs",
    label: "Blogs",
    icon: "✎",
  },
  {
    key: "backlinks",
    label: "Backlinks",
    icon: "↔",
  },
  {
    key: "technical",
    label: "Technical",
    icon: "⚙",
  },
  {
    key: "reports",
    label: "Reports",
    icon: "▥",
  },
  {
    key: "competitors",
    label: "Competitors",
    icon: "◎",
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: "♢",
  },
  {
    key: "settings",
    label: "Settings",
    icon: "⚙",
  },
];

const PERMISSIONS: Array<{
  key: PermissionKey;
  label: string;
}> = [
  {
    key: "dashboard",
    label: "Dashboard",
  },
  {
    key: "websites",
    label: "Websites",
  },
  {
    key: "keywords",
    label: "Keywords / SEO",
  },
  {
    key: "ranking",
    label: "Rankings",
  },
  {
    key: "pages",
    label: "Pages",
  },
  {
    key: "blogs",
    label: "Blogs",
  },
  {
    key: "backlinks",
    label: "Backlinks",
  },
  {
    key: "technical",
    label: "Technical SEO",
  },
  {
    key: "reports",
    label: "Reports",
  },
  {
    key: "competitors",
    label: "Competitors",
  },
  {
    key: "notifications",
    label: "Notifications",
  },
];

const ALL_PERMISSIONS: PermissionMap =
  Object.fromEntries(
    PERMISSIONS.map((x) => [
      x.key,
      true,
    ]),
  ) as PermissionMap;

const DEFAULT_PERMISSIONS: PermissionMap =
  {
    dashboard: true,
    websites: true,
    keywords: true,
    ranking: true,
    pages: true,
    blogs: true,
    backlinks: true,
    technical: false,
    reports: true,
    competitors: false,
    notifications: true,
  };

const CLIENT_SERVICES = [
  'Web & App Development',
  'SEO & Digital Marketing',
  'Business Consultancy',
  'Documentation & Compliance',
  'IT Solutions',
];

const LABEL: Record<
  SectionKey,
  string
> = Object.fromEntries(
  NAV.map((x) => [
    x.key,
    x.label,
  ]),
) as Record<
  SectionKey,
  string
>;

/* =========================================================
   ADVANCED MODULE FORM SYSTEM
   ---------------------------------------------------------
   Every SEO module is edited through a structured form.
   Custom key/value fields preserve legacy data without
   exposing a raw JSON editor to the admin.
========================================================= */

type ModuleFieldType =
  | "text"
  | "url"
  | "email"
  | "number"
  | "date"
  | "datetime-local"
  | "select"
  | "textarea"
  | "checkbox";

type ModuleField = {
  key: string;
  label: string;
  type?: ModuleFieldType;
  placeholder?: string;
  required?: boolean;
  wide?: boolean;
  options?: string[];
  help?: string;
};

const MODULE_FORM_FIELDS: Record<GenericModule, ModuleField[]> = {
  websites: [
    { key: "name", label: "Website Name", required: true },
    { key: "domain", label: "Domain", placeholder: "example.com", required: true },
    { key: "url", label: "Website URL", type: "url", placeholder: "https://example.com" },
    { key: "clientId", label: "Client ID" },
    { key: "status", label: "Status", type: "select", options: ["Active", "Paused", "Archived", "Pending"] },
    { key: "category", label: "Business Category" },
    { key: "targetCountry", label: "Target Country" },
    { key: "targetCity", label: "Target City" },
    { key: "primaryKeyword", label: "Primary Keyword" },
    { key: "manager", label: "Assigned Manager" },
    { key: "notes", label: "Notes", type: "textarea", wide: true },
  ],
  keywords: [
    { key: "keyword", label: "Keyword", required: true },
    { key: "websiteId", label: "Website ID" },
    { key: "clientId", label: "Client ID" },
    { key: "targetUrl", label: "Target URL", type: "url" },
    { key: "searchVolume", label: "Search Volume", type: "number" },
    { key: "difficulty", label: "Keyword Difficulty", type: "number" },
    { key: "currentRank", label: "Current Rank", type: "number" },
    { key: "targetRank", label: "Target Rank", type: "number" },
    { key: "intent", label: "Search Intent", type: "select", options: ["Informational", "Commercial", "Transactional", "Navigational", "Local"] },
    { key: "status", label: "Status", type: "select", options: ["Active", "Tracking", "Won", "Dropped", "Paused"] },
    { key: "tags", label: "Tags", placeholder: "seo, local, primary" },
    { key: "notes", label: "Notes", type: "textarea", wide: true },
  ],
  ranking: [
    { key: "keyword", label: "Keyword", required: true },
    { key: "websiteId", label: "Website ID" },
    { key: "clientId", label: "Client ID" },
    { key: "searchEngine", label: "Search Engine", type: "select", options: ["Google", "Bing", "Yahoo", "Other"] },
    { key: "location", label: "Location" },
    { key: "device", label: "Device", type: "select", options: ["Desktop", "Mobile", "Tablet"] },
    { key: "previousPosition", label: "Previous Position", type: "number" },
    { key: "currentPosition", label: "Current Position", type: "number" },
    { key: "searchVolume", label: "Search Volume", type: "number" },
    { key: "checkedAt", label: "Checked At", type: "date" },
    { key: "status", label: "Status", type: "select", options: ["Tracked", "Improved", "Declined", "Stable"] },
    { key: "notes", label: "Notes", type: "textarea", wide: true },
  ],
  pages: [
    { key: "title", label: "Page Title", required: true },
    { key: "url", label: "Page URL", type: "url", required: true },
    { key: "clientId", label: "Client ID" },
    { key: "websiteId", label: "Website ID" },
    { key: "type", label: "Page Type", type: "select", options: ["Landing Page", "Service", "Product", "Category", "Blog", "Other"] },
    { key: "status", label: "Status", type: "select", options: ["Draft", "Published", "Needs Update", "Archived"] },
    { key: "indexability", label: "Indexability", type: "select", options: ["Index", "Noindex", "Blocked"] },
    { key: "metaTitle", label: "Meta Title" },
    { key: "metaDescription", label: "Meta Description", type: "textarea", wide: true },
    { key: "canonical", label: "Canonical URL", type: "url" },
    { key: "wordCount", label: "Word Count", type: "number" },
    { key: "notes", label: "Notes", type: "textarea", wide: true },
  ],
  blogs: [
    { key: "title", label: "Blog Title", required: true },
    { key: "slug", label: "Slug" },
    { key: "url", label: "Blog URL", type: "url" },
    { key: "clientId", label: "Client ID" },
    { key: "websiteId", label: "Website ID" },
    { key: "author", label: "Author" },
    { key: "status", label: "Status", type: "select", options: ["Draft", "Scheduled", "Published", "Archived"] },
    { key: "publishedAt", label: "Published At", type: "date" },
    { key: "category", label: "Category" },
    { key: "tags", label: "Tags", placeholder: "ayurveda, allergy, wellness" },
    { key: "metaTitle", label: "Meta Title" },
    { key: "metaDescription", label: "Meta Description", type: "textarea", wide: true },
    { key: "content", label: "Article Content", type: "textarea", wide: true },
    { key: "notes", label: "Notes", type: "textarea", wide: true },
  ],
  backlinks: [
    { key: "targetUrl", label: "Target URL", type: "url", required: true },
    { key: "sourceUrl", label: "Source URL", type: "url", required: true },
    { key: "anchorText", label: "Anchor Text" },
    { key: "clientId", label: "Client ID" },
    { key: "websiteId", label: "Website ID" },
    { key: "linkType", label: "Link Type", type: "select", options: ["Editorial", "Profile", "Forum", "Social", "Bookmarking", "Directory", "Guest Post", "Other"] },
    { key: "status", label: "Status", type: "select", options: ["Live", "Pending", "Removed", "Rejected", "To Verify"] },
    { key: "domainAuthority", label: "Domain Authority", type: "number" },
    { key: "pageAuthority", label: "Page Authority", type: "number" },
    { key: "nofollow", label: "Nofollow", type: "checkbox" },
    { key: "placedAt", label: "Placed At", type: "date" },
    { key: "notes", label: "Notes", type: "textarea", wide: true },
  ],
  technical: [
    { key: "issue", label: "Issue", required: true },
    { key: "affectedUrl", label: "Affected URL", type: "url" },
    { key: "websiteId", label: "Website ID" },
    { key: "clientId", label: "Client ID" },
    { key: "category", label: "Issue Category", type: "select", options: ["Crawl", "Indexing", "Performance", "On-Page", "Schema", "Security", "Mobile", "Other"] },
    { key: "severity", label: "Severity", type: "select", options: ["Critical", "High", "Medium", "Low"] },
    { key: "priority", label: "Priority", type: "select", options: ["Urgent", "High", "Normal", "Low"] },
    { key: "status", label: "Status", type: "select", options: ["Open", "In Progress", "Resolved", "Ignored"] },
    { key: "recommendation", label: "Recommended Fix", type: "textarea", wide: true },
    { key: "assignedTo", label: "Assigned To" },
    { key: "dueDate", label: "Due Date", type: "date" },
    { key: "notes", label: "Notes", type: "textarea", wide: true },
  ],
  reports: [
    { key: "name", label: "Report Name", required: true },
    { key: "clientId", label: "Client ID" },
    { key: "websiteId", label: "Website ID" },
    { key: "type", label: "Report Type", type: "select", options: ["SEO Performance", "Backlink", "Ranking", "Technical Audit", "Client Summary", "Monthly Report"] },
    { key: "periodFrom", label: "Period From", type: "date" },
    { key: "periodTo", label: "Period To", type: "date" },
    { key: "status", label: "Status", type: "select", options: ["Draft", "Generated", "Delivered", "Archived"] },
    { key: "summary", label: "Executive Summary", type: "textarea", wide: true },
    { key: "findings", label: "Key Findings", type: "textarea", wide: true },
    { key: "recommendations", label: "Recommendations", type: "textarea", wide: true },
    { key: "notes", label: "Internal Notes", type: "textarea", wide: true },
  ],
  competitors: [
    { key: "name", label: "Competitor Name", required: true },
    { key: "domain", label: "Competitor Domain", required: true },
    { key: "websiteId", label: "Your Website ID" },
    { key: "clientId", label: "Client ID" },
    { key: "status", label: "Status", type: "select", options: ["Tracking", "Active", "Ignored", "Archived"] },
    { key: "keywordsCount", label: "Tracked Keywords", type: "number" },
    { key: "estimatedTraffic", label: "Estimated Traffic", type: "number" },
    { key: "visibility", label: "Visibility %", type: "number" },
    { key: "notes", label: "Notes", type: "textarea", wide: true },
  ],
  notifications: [
    { key: "title", label: "Notification Title", required: true },
    { key: "clientId", label: "Client ID" },
    { key: "type", label: "Type", type: "select", options: ["Task", "Ranking", "Backlink", "Report", "Technical", "Account", "General"] },
    { key: "priority", label: "Priority", type: "select", options: ["Low", "Normal", "High", "Urgent"] },
    { key: "channel", label: "Channel", type: "select", options: ["In-App", "Email", "Both"] },
    { key: "status", label: "Status", type: "select", options: ["Unread", "Read", "Delivered", "Failed"] },
    { key: "message", label: "Message", type: "textarea", wide: true, required: true },
  ],
};

function defaultModuleRecord(section: GenericModule): AnyRecord {
  const base: AnyRecord = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `REC-${Date.now()}`,
    status: section === "reports" ? "Draft" : section === "notifications" ? "Unread" : "Active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const fields = MODULE_FORM_FIELDS[section] ?? [];
  for (const field of fields) {
    if (field.key === "nofollow") base[field.key] = false;
    else if (field.type === "number") base[field.key] = "";
    else if (field.type === "select") base[field.key] = field.options?.[0] ?? "";
    else base[field.key] = "";
  }
  return base;
}


/* =========================================================
   ADMIN SETTINGS
   ---------------------------------------------------------
   IMPORTANT:
   Client accounts are NOT stored here anymore.
   MongoDB is the source of truth for clients.
========================================================= */

function getGlobalAdminSettings(): GlobalAdminSettings {
  return {
    clients: [],
    security: {},
    account: {},
  };
}

/* Settings persistence is handled by /api/admin/settings. */
async function saveGlobalAdminSettings(
  settings: GlobalAdminSettings,
) {
  const {
    clients: _clients,
    ...adminOnlySettings
  } = settings;

  const response = await fetch("/api/admin/settings", {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      settings: {
        ...adminOnlySettings,
        clients: [],
      },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success === false) {
    throw new Error(data?.message ?? "Unable to save admin settings.");
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("hcs-admin-settings-updated"),
    );
  }

  return data;
}

/* =========================================================
   HELPERS
========================================================= */

function clone<T>(
  value: T,
): T {
  return JSON.parse(
    JSON.stringify(value),
  );
}

function makeInitials(
  value: string,
) {
  const parts =
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

  return parts.length
    ? parts
        .map(
          (x: string) =>
            x[0].toUpperCase(),
        )
        .join("")
    : "HC";
}

function txt(
  value: unknown,
  fallback = "—",
) {
  const text =
    String(
      value ?? "",
    ).trim();

  return text || fallback;
}

function idOf(
  record: AnyRecord,
  index = 0,
) {
  return txt(
    record.id ??
      record._id ??
      record.clientId ??
      record.websiteId ??
      record.keywordId ??
      record.pageId ??
      record.blogId ??
      record.backlinkId ??
      record.reportId,
    String(index + 1),
  );
}

function titleOf(
  record: AnyRecord,
  section: GenericModule,
) {
  if (
    section ===
    "websites"
  ) {
    return txt(
      record.name ??
        record.domain ??
        record.url,
      "Website",
    );
  }

  if (
    section ===
      "keywords" ||
    section === "ranking"
  ) {
    return txt(
      record.keyword ??
        record.query ??
        record.name,
      "Keyword",
    );
  }

  if (
    section === "pages"
  ) {
    return txt(
      record.title ??
        record.name ??
        record.url,
      "Page",
    );
  }

  if (
    section === "blogs"
  ) {
    return txt(
      record.title ??
        record.name,
      "Blog",
    );
  }

  if (
    section ===
    "backlinks"
  ) {
    return txt(
      record.targetUrl ??
        record.sourceUrl ??
        record.anchorText ??
        record.name,
      "Backlink",
    );
  }

  if (
    section ===
    "technical"
  ) {
    return txt(
      record.title ??
        record.issue ??
        record.name,
      "Technical issue",
    );
  }

  if (
    section === "reports"
  ) {
    return txt(
      record.name ??
        record.title,
      "Report",
    );
  }

  if (
    section ===
    "competitors"
  ) {
    return txt(
      record.name ??
        record.domain,
      "Competitor",
    );
  }

  return txt(
    record.title ??
      record.subject ??
      record.name,
    "Notification",
  );
}

const recordCache: Record<GenericModule, AnyRecord[]> = {
  websites: [],
  keywords: [],
  ranking: [],
  pages: [],
  blogs: [],
  backlinks: [],
  technical: [],
  reports: [],
  competitors: [],
  notifications: [],
};

const moduleFromKeys = (keys: string[]) => {
  return (Object.keys(MODULE_KEYS) as GenericModule[]).find(
    (module) => MODULE_KEYS[module] === keys,
  ) as GenericModule | undefined;
};

const cloneRecords = (records: AnyRecord[]) =>
  records.map((record) => ({ ...record }));

const recordsApi = async (
  module: GenericModule,
  options: RequestInit = {},
) => {
  const separator =
    options.method === 'GET' || !options.method
      ? '?'
      : '';
  const url = `/api/admin/records${separator}${
    separator
      ? `module=${encodeURIComponent(module)}`
      : ''
  }`;

  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success === false) {
    throw new Error(
      data?.message ?? `Unable to save ${module} records.`,
    );
  }

  return data;
};

function readRecords(keys: string[]) {
  const module = moduleFromKeys(keys);
  if (!module) return [] as AnyRecord[];
  return cloneRecords(recordCache[module]);
}

async function writeRecords(
  section: GenericModule,
  records: AnyRecord[],
) {
  const normalized = cloneRecords(records);
  recordCache[section] = normalized;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('hcs-admin-portal-data-updated', {
        detail: { section, records: normalized },
      }),
    );
  }

  await recordsApi(section, {
    method: 'PUT',
    body: JSON.stringify({
      module: section,
      records: normalized,
    }),
  });
}

function nextClientId(
  clients: ExtendedClient[],
) {
  const numbers =
    clients
      .map((client) =>
        Number(
          String(
            client.clientId ??
              "",
          ).match(
            /^HCS-CL-(\d+)$/i,
          )?.[1] ?? 0,
        ),
      )
      .filter(
        Number.isFinite,
      );

  return `HCS-CL-${String(
    (
      numbers.length
        ? Math.max(
            ...numbers,
          )
        : 0
    ) + 1,
  ).padStart(6, "0")}`;
}

function passwordFor(
  security: GlobalAdminSettings["security"],
) {
  const upper =
    "ABCDEFGHJKLMNPQRSTUVWXYZ";

  const lower =
    "abcdefghijkmnopqrstuvwxyz";

  const numbers =
    "23456789";

  const special =
    "@#$%&*!?";

  const required = [
    security?.requireUppercase !==
    false
      ? upper[
          Math.floor(
            Math.random() *
              upper.length,
          )
        ]
      : "",

    security?.requireNumber !==
    false
      ? numbers[
          Math.floor(
            Math.random() *
              numbers.length,
          )
        ]
      : "",

    security?.requireSpecialCharacter !==
    false
      ? special[
          Math.floor(
            Math.random() *
              special.length,
          )
        ]
      : "",
  ].filter(Boolean);

  const source =
    lower +
    (security?.requireUppercase !==
    false
      ? upper
      : "") +
    (security?.requireNumber !==
    false
      ? numbers
      : "") +
    (security?.requireSpecialCharacter !==
    false
      ? special
      : "");

  while (
    required.length <
    Math.max(
      Number(
        security?.minPasswordLength ??
          8,
      ),
      8,
    )
  ) {
    required.push(
      source[
        Math.floor(
          Math.random() *
            source.length,
        )
      ],
    );
  }

  return required
    .sort(
      () =>
        Math.random() -
        0.5,
    )
    .join("");
}

function validatePassword(
  password: string,
  security: GlobalAdminSettings["security"],
) {
  const minimum =
    Number(
      security?.minPasswordLength ??
        8,
    );

  if (
    password.length <
    minimum
  ) {
    return `Minimum ${minimum} characters required.`;
  }

  if (
    security?.requireUppercase &&
    !/[A-Z]/.test(password)
  ) {
    return "Uppercase letter required.";
  }

  if (
    security?.requireNumber &&
    !/[0-9]/.test(password)
  ) {
    return "Number required.";
  }

  if (
    security?.requireSpecialCharacter &&
    !/[^A-Za-z0-9]/.test(
      password,
    )
  ) {
    return "Special character required.";
  }

  return "";
}

function normalizePermissions(
  value: unknown,
): PermissionMap {
  if (
    Array.isArray(value)
  ) {
    const enabled = new Set(
      value
        .filter(
          (
            item,
          ): item is string =>
            typeof item ===
            "string",
        )
        .map(
          (item) =>
            item.trim(),
        ),
    );

    return Object.fromEntries(
      PERMISSIONS.map(
        (permission) => [
          permission.key,
          enabled.has(
            permission.key,
          ),
        ],
      ),
    ) as PermissionMap;
  }

  const record =
    value &&
    typeof value ===
      "object"
      ? (value as Record<
          string,
          unknown
        >)
      : {};

  return Object.fromEntries(
    PERMISSIONS.map(
      (permission) => [
        permission.key,
        record[
          permission.key
        ] !== undefined
          ? Boolean(
              record[
                permission.key
              ],
            )
          : DEFAULT_PERMISSIONS[
              permission.key
            ],
      ],
    ),
  ) as PermissionMap;
}

/* =========================================================
   UI
========================================================= */

function Empty({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="empty-state">
      <strong>
        {title}
      </strong>

      <span>
        {detail}
      </span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>
        {label}
      </span>

      {children}
    </label>
  );
}

/* =========================================================
   MAIN
========================================================= */

export default function AdminPage() {
  const [
    section,
    setSection,
  ] =
    useState<SectionKey>(
      "dashboard",
    );

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    authorized,
    setAuthorized,
  ] = useState(false);

  const [
    settings,
    setSettings,
  ] =
    useState<GlobalAdminSettings | null>(
      null,
    );

  const [
    draftSettings,
    setDraftSettings,
  ] =
    useState<GlobalAdminSettings | null>(
      null,
    );

  const [
    records,
    setRecords,
  ] =
    useState<
      Record<
        string,
        AnyRecord[]
      >
    >({});

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    toast,
    setToast,
  ] = useState("");

  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false);

  const [
    drawer,
    setDrawer,
  ] =
    useState<
      "create" | "edit" | null
    >(null);

  const [
    editingClient,
    setEditingClient,
  ] =
    useState<ExtendedClient | null>(
      null,
    );

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    credentials,
    setCredentials,
  ] =
    useState<AnyRecord | null>(
      null,
    );

  const [
    modal,
    setModal,
  ] =
    useState<{
      section: GenericModule;
      record?: AnyRecord;
    } | null>(null);

  const [
    selected,
    setSelected,
  ] = useState<string[]>(
    [],
  );

  const [
    clientForm,
    setClientForm,
  ] =
    useState<ClientForm>({
      clientId: "",
      username: "",
      email: "",
      password: "",
      name: "",
      companyName: "",
      phone: "",
      website: "",
      plan: "",
      assignedManager: "",
      status: "Active",
      clientPortalEnabled: true,
      assignedWebsiteIds: [],
      permissions:
        clone(
          DEFAULT_PERMISSIONS,
        ),
      tags: "",
      notes: "",
      services: [],
    });

  /* =======================================================
     LOAD ADMIN SETTINGS + MONGODB CLIENTS
  ======================================================== */

  const load =
    useCallback(
      async () => {
        let adminSettings: GlobalAdminSettings = getGlobalAdminSettings();
        let mongoClients: ClientAccount[] = [];

        try {
          const [clientsResponse, settingsResponse] =
            await Promise.all([
              fetch('/api/admin/clients', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
              }),
              fetch('/api/admin/settings', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
              }),
            ]);

          const clientsData = await clientsResponse.json().catch(() => ({}));
          const settingsData = await settingsResponse.json().catch(() => ({}));

          if (
            clientsResponse.ok &&
            clientsData?.success &&
            Array.isArray(clientsData.clients)
          ) {
            mongoClients = clientsData.clients;
          } else {
            console.error('Client API error:', clientsData?.message);
          }

          if (
            settingsResponse.ok &&
            settingsData?.success &&
            settingsData?.settings
          ) {
            adminSettings = {
              ...adminSettings,
              ...settingsData.settings,
              clients: [],
            };
          }
        } catch (error) {
          console.error('MongoDB admin data load failed:', error);
        }

        const mergedSettings: GlobalAdminSettings = {
          ...adminSettings,
          clients: mongoClients,
        };

        setSettings(mergedSettings);
        setDraftSettings(clone(mergedSettings));

        const modules = Object.keys(MODULE_KEYS) as GenericModule[];

        await Promise.all(
          modules.map(async (module) => {
            try {
              const data = await recordsApi(module, { method: 'GET' });
              const moduleRecords = Array.isArray(data?.records)
                ? data.records
                : [];
              recordCache[module] = moduleRecords.map((record: AnyRecord) => ({
                ...record,
              }));
            } catch (error) {
              console.error(
                `Failed to load ${module} from MongoDB:`,
                error,
              );
              recordCache[module] = [];
            }
          }),
        );

        const next: Record<string, AnyRecord[]> = {};
        modules.forEach((module) => {
          next[module] = cloneRecords(recordCache[module]);
        });
        setRecords(next);
      },
      [],
    );

  /* =======================================================
     VERIFY ADMIN SESSION
  ======================================================== */

  useEffect(() => {
    let cancelled =
      false;

    async function verifySession() {
      try {
        const response =
          await fetch(
            "/api/auth/me",
            {
              method: "GET",
              credentials:
                "include",
              cache:
                "no-store",
            },
          );

        const data =
          await response
            .json()
            .catch(
              () => null,
            );

        if (
          cancelled
        ) {
          return;
        }

        if (
          response.ok &&
          data?.success ===
            true &&
          data?.authenticated ===
            true &&
          data?.user?.role ===
            "admin" &&
          data?.user
        ) {
          const serverUser =
            data.user;

          const currentRaw =
            localStorage.getItem(
              AUTH_KEY,
            );

          let currentSession:
            Record<
              string,
              unknown
            > = {};

          try {
            currentSession =
              currentRaw
                ? JSON.parse(
                    currentRaw,
                  )
                : {};
          } catch {
            currentSession =
              {};
          }

          const userId =
            serverUser.id ??
            serverUser.adminId ??
            serverUser.accountId ??
            "";

          localStorage.setItem(
            AUTH_KEY,
            JSON.stringify({
              ...currentSession,
              authenticated:
                true,
              role: "admin",
              id: userId,
              adminId:
                serverUser.adminId ??
                userId,
              accountId:
                serverUser.accountId ??
                userId,
              username:
                serverUser.username ??
                "",
              email:
                serverUser.email ??
                "",
              name:
                serverUser.name ??
                serverUser.fullName ??
                "HCS Administrator",
              phone:
                serverUser.phone ??
                "",
            }),
          );

          setAuthorized(
            true,
          );

          return;
        }

        localStorage.removeItem(
          AUTH_KEY,
        );

        window.location.replace(
          "/",
        );
      } catch (error) {
        if (
          cancelled
        ) {
          return;
        }

        console.error(
          "Admin session verification failed:",
          error,
        );

        localStorage.removeItem(
          AUTH_KEY,
        );

        window.location.replace(
          "/",
        );
      }
    }

    verifySession();

    return () => {
      cancelled =
        true;
    };
  }, []);

  useEffect(() => {
    if (!authorized) {
      return;
    }

    void load();
  }, [
    authorized,
    load,
  ]);

  useEffect(() => {
    const sync =
      () => {
        void load();
      };

    window.addEventListener(
      "hcs-admin-settings-updated",
      sync,
    );

    window.addEventListener(
      "hcs-admin-portal-data-updated",
      sync,
    );

    window.addEventListener(
      "storage",
      sync,
    );

    return () => {
      window.removeEventListener(
        "hcs-admin-settings-updated",
        sync,
      );

      window.removeEventListener(
        "hcs-admin-portal-data-updated",
        sync,
      );

      window.removeEventListener(
        "storage",
        sync,
      );
    };
  }, [load]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer =
      setTimeout(
        () =>
          setToast(""),
        2500,
      );

    return () =>
      clearTimeout(
        timer,
      );
  }, [toast]);

  /* =======================================================
     DATA
  ======================================================== */

  const clients =
    useMemo(
      () =>
        (settings?.clients ??
          []) as ExtendedClient[],
      [settings],
    );

  const websites =
    records.websites ??
    [];

  const currentRecords =
    section !==
      "dashboard" &&
    section !== "clients" &&
    section !== "settings"
      ? records[
          section
        ] ?? []
      : [];

  const filteredClients =
    clients.filter(
      (client) =>
        !search.trim() ||
        JSON.stringify(
          client,
        )
          .toLowerCase()
          .includes(
            search.toLowerCase(),
          ),
    );

  const filteredRecords =
    currentRecords.filter(
      (record) =>
        !search.trim() ||
        JSON.stringify(
          record,
        )
          .toLowerCase()
          .includes(
            search.toLowerCase(),
          ),
    );

  const metrics =
    useMemo(
      () => ({
        clients:
          clients.length,

        active:
          clients.filter(
            (client) =>
              client.status ===
              "Active",
          ).length,

        portal:
          clients.filter(
            (client) =>
              client.clientPortalEnabled !==
              false,
          ).length,

        suspended:
          clients.filter(
            (client) =>
              client.status ===
              "Suspended",
          ).length,

        disabled:
          clients.filter(
            (client) =>
              client.status ===
              "Disabled",
          ).length,

        websites:
          websites.length,

        keywords:
          (
            records.keywords ??
            []
          ).length,

        ranking:
          (
            records.ranking ??
            []
          ).length,

        pages:
          (
            records.pages ??
            []
          ).length,

        blogs:
          (
            records.blogs ??
            []
          ).length,

        backlinks:
          (
            records.backlinks ??
            []
          ).length,

        technical:
          (
            records.technical ??
            []
          ).length,

        reports:
          (
            records.reports ??
            []
          ).length,

        competitors:
          (
            records.competitors ??
            []
          ).length,

        notifications:
          (
            records.notifications ??
            []
          ).length,
      }),
      [
        clients,
        websites,
        records,
      ],
    );

  /* =======================================================
     NAVIGATION
  ======================================================== */

  function nav(
    key: SectionKey,
  ) {
    setSection(key);
    setSidebarOpen(
      false,
    );
    setProfileOpen(
      false,
    );
    setSearch("");
  }

  function note(
    message: string,
  ) {
    setToast(message);
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
    } catch {
      // Redirect even if the logout endpoint cannot be reached.
    } finally {
      localStorage.removeItem(AUTH_KEY);
      window.location.replace('/');
    }
  }

  /* =======================================================
     CREATE
  ======================================================== */

  function openCreate() {
    const security =
      settings?.security ??
      {};

    setEditingClient(
      null,
    );

    setShowPassword(
      false,
    );

    setClientForm({
      clientId:
        nextClientId(
          clients,
        ),

      username:
        "",

      email:
        "",

      password:
        passwordFor(
          security,
        ),

      name:
        "",

      companyName:
        "",

      phone:
        "",

      website:
        "",

      plan:
        "",

      assignedManager:
        "",

      status:
        "Active",

      clientPortalEnabled:
        true,

      assignedWebsiteIds:
        [],

      permissions:
        clone(
          DEFAULT_PERMISSIONS,
        ),

      tags:
        "",

      notes:
        "",

      services:
        [],
    });

    setDrawer(
      "create",
    );
  }

  /* =======================================================
     EDIT
  ======================================================== */

  function openEdit(
    client: ExtendedClient,
  ) {
    setEditingClient(
      client,
    );

    setShowPassword(
      false,
    );

    setClientForm({
      clientId:
        client.clientId,

      username:
        client.username,

      email:
        client.email,

      /*
       * MongoDB stores only passwordHash.
       * Existing password is never exposed.
       * Empty means "keep current password".
       */
      password:
        "",

      name:
        client.name ??
        "",

      companyName:
        client.companyName ??
        "",

      phone:
        client.phone ??
        "",

      website:
        client.website ??
        "",

      plan:
        client.plan ??
        "",

      assignedManager:
        client.assignedManager ??
        "",

      status:
        client.status,

      clientPortalEnabled:
        client.clientPortalEnabled !==
        false,

      assignedWebsiteIds:
        client.assignedWebsiteIds ??
        [],

      permissions:
        normalizePermissions(
          client.permissions,
        ),

      tags:
        (
          client.tags ??
          []
        ).join(", "),

      notes:
        client.notes ??
        "",

      services:
        client.services ??
        client.assignedServices ??
        client.selectedServices ??
        [],
    });

    setDrawer(
      "edit",
    );
  }

  function updateForm<
    K extends keyof ClientForm,
  >(
    key: K,
    value: ClientForm[K],
  ) {
    setClientForm(
      (
        previous,
      ) => ({
        ...previous,
        [key]:
          value,
      }),
    );
  }

  /* =======================================================
     CREATE / UPDATE CLIENT
  ======================================================== */

  async function submitClient(
    event: FormEvent,
  ) {
    event.preventDefault();

    const security =
      settings?.security ??
      {};

    if (
      !clientForm.name.trim() ||
      !clientForm.companyName.trim() ||
      !clientForm.email.trim() ||
      !clientForm.username.trim()
    ) {
      return note(
        "Name, company, email and username are required.",
      );
    }

    /*
     * Create requires password.
     * Edit allows empty password,
     * which means keep existing password.
     */
    if (
      !editingClient ||
      clientForm.password.trim()
    ) {
      const passwordError =
        validatePassword(
          clientForm.password,
          security,
        );

      if (passwordError) {
        return note(
          passwordError,
        );
      }
    }

    try {
      const payload: Record<
        string,
        unknown
      > = {
        clientId:
          editingClient?.clientId ??
          clientForm.clientId,

        username:
          clientForm.username.trim(),

        email:
          clientForm.email
            .trim()
            .toLowerCase(),

        name:
          clientForm.name.trim(),

        fullName:
          clientForm.name.trim(),

        companyName:
          clientForm.companyName.trim(),

        phone:
          clientForm.phone.trim(),

        website:
          clientForm.website.trim(),

        plan:
          clientForm.plan.trim(),

        assignedManager:
          clientForm.assignedManager.trim(),

        status:
          clientForm.status,

        active:
          clientForm.status ===
            "Active" &&
          clientForm.clientPortalEnabled,

        role:
          "client",

        clientPortalEnabled:
          clientForm.clientPortalEnabled,

        /*
         * CREATE route accepts permission map.
         * Existing [id] PATCH route expects an array.
         */
        permissions:
          editingClient
            ? Object.entries(
                clientForm.permissions,
              )
                .filter(
                  ([, enabled]) =>
                    Boolean(
                      enabled,
                    ),
                )
                .map(
                  ([key]) =>
                    key,
                )
            : clientForm.permissions,

        assignedWebsiteIds:
          clientForm.assignedWebsiteIds,

        tags:
          clientForm.tags
            .split(",")
            .map(
              (value) =>
                value.trim(),
            )
            .filter(Boolean),

        notes:
          clientForm.notes.trim(),

        services:
          clientForm.services,
      };

      /*
       * Password is sent only if:
       * - Creating a client, OR
       * - Admin explicitly entered a new password.
       */
      if (
        clientForm.password.trim()
      ) {
        payload.password =
          clientForm.password;
      }

      setToast(
        editingClient
          ? "Updating client..."
          : "Creating client...",
      );

      let response:
        Response;

      if (
        editingClient
      ) {
        response =
          await fetch(
            `/api/admin/clients/${encodeURIComponent(
              editingClient.id,
            )}`,
            {
              method:
                "PATCH",

              credentials:
                "include",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  payload,
                ),
            },
          );
      } else {
        response =
          await fetch(
            "/api/admin/clients",
            {
              method:
                "POST",

              credentials:
                "include",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  client:
                    payload,
                }),
            },
          );
      }

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        return note(
          data?.message ??
            "Unable to save client.",
        );
      }

      setDrawer(
        null,
      );

      await load();

      note(
        editingClient
          ? "Client updated in MongoDB."
          : "Client created in MongoDB.",
      );

      /*
       * Plain password is only shown to the
       * Admin in the current credentials modal.
       * It is never stored in MongoDB.
       */
      if (
        data.credentials
      ) {
        setCredentials(
          data.credentials,
        );
      } else if (
        data.password ||
        clientForm.password
      ) {
        setCredentials({
          clientId:
            clientForm.clientId,

          username:
            clientForm.username,

          email:
            clientForm.email,

          password:
            data.password ??
            clientForm.password,

          name:
            clientForm.name,

          companyName:
            clientForm.companyName,

          status:
            clientForm.status,
        });
      }
    } catch (error) {
      console.error(
        "HCS save client error:",
        error,
      );

      note(
        "Unable to connect to MongoDB.",
      );
    }
  }

  /* =======================================================
     RESET PASSWORD
  ======================================================== */

  async function resetPassword(
    client: ExtendedClient,
  ) {
    try {
      const response =
        await fetch(
          `/api/admin/clients/${encodeURIComponent(
            client.id,
          )}`,
          {
            method:
              "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "resetPassword",
              }),
          },
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        return note(
          data?.message ??
            "Password reset failed.",
        );
      }

      await load();

      if (
        data.credentials
      ) {
        setCredentials(
          data.credentials,
        );
      }

      note(
        "Password reset and saved to MongoDB.",
      );
    } catch (
      error
    ) {
      console.error(
        "Reset password error:",
        error,
      );

      note(
        "Unable to reset password.",
      );
    }
  }

  /* =======================================================
     PORTAL TOGGLE
  ======================================================== */

  async function togglePortal(
    client: ExtendedClient,
  ) {
    const enabled =
      client.clientPortalEnabled ===
      false;

    try {
      const response =
        await fetch(
          `/api/admin/clients/${encodeURIComponent(
            client.id,
          )}`,
          {
            method:
              "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                clientPortalEnabled:
                  enabled,

                active:
                  enabled &&
                  client.status ===
                    "Active",
              }),
          },
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        return note(
          data?.message ??
            "Unable to update portal access.",
        );
      }

      await load();

      note(
        enabled
          ? "Portal enabled."
          : "Portal disabled.",
      );
    } catch {
      note(
        "Unable to update portal access.",
      );
    }
  }

  /* =======================================================
     STATUS
  ======================================================== */

  async function setStatus(
    client: ExtendedClient,
    status: ClientStatus,
  ) {
    try {
      const response =
        await fetch(
          `/api/admin/clients/${encodeURIComponent(
            client.id,
          )}`,
          {
            method:
              "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                status,

                active:
                  status ===
                    "Active" &&
                  client.clientPortalEnabled !==
                    false,
              }),
          },
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        return note(
          data?.message ??
            "Unable to update client status.",
        );
      }

      await load();

      note(
        `Client set to ${status}.`,
      );
    } catch {
      note(
        "Unable to update client status.",
      );
    }
  }

  /* =======================================================
     DELETE
  ======================================================== */

  async function removeClient(
    client: ExtendedClient,
  ) {
    if (
      !confirm(
        `Delete ${client.clientId}?`,
      )
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/admin/clients/${encodeURIComponent(
            client.id,
          )}`,
          {
            method:
              "DELETE",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },
          },
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        return note(
          data?.message ??
            "Unable to delete client.",
        );
      }

      setSelected(
        (current) =>
          current.filter(
            (id) =>
              id !==
              client.id,
          ),
      );

      await load();

      note(
        "Client deleted from MongoDB.",
      );
    } catch {
      note(
        "Unable to delete client.",
      );
    }
  }

  /* =======================================================
     BULK
  ======================================================== */

  async function bulk(
    action:
      | "enable"
      | "disable"
      | "suspend",
  ) {
    const selectedClients =
      clients.filter(
        (client) =>
          selected.includes(
            client.id,
          ),
      );

    if (
      selectedClients.length ===
      0
    ) {
      return;
    }

    try {
      await Promise.all(
        selectedClients.map(
          async (client) => {
            let payload:
              Record<
                string,
                unknown
              >;

            if (
              action ===
              "disable"
            ) {
              payload = {
                status:
                  "Disabled",

                active:
                  false,

                clientPortalEnabled:
                  false,
              };
            } else if (
              action ===
              "suspend"
            ) {
              payload = {
                status:
                  "Suspended",

                active:
                  false,
              };
            } else {
              payload = {
                status:
                  "Active",

                clientPortalEnabled:
                  client.clientPortalEnabled !==
                  false,

                active:
                  client.clientPortalEnabled !==
                    false,
              };
            }

            const response =
              await fetch(
                `/api/admin/clients/${encodeURIComponent(
                  client.id,
                )}`,
                {
                  method:
                    "PATCH",

                  credentials:
                    "include",

                  headers: {
                    "Content-Type":
                      "application/json",
                  },

                  body:
                    JSON.stringify(
                      payload,
                    ),
                },
              );

            if (
              !response.ok
            ) {
              throw new Error(
                client.clientId,
              );
            }
          },
        ),
      );

      setSelected(
        [],
      );

      await load();

      note(
        "Selected client accounts updated in MongoDB.",
      );
    } catch (
      error
    ) {
      console.error(
        "Bulk client update error:",
        error,
      );

      note(
        "Some client accounts could not be updated.",
      );
    }
  }

  /* =======================================================
     MODULE RECORDS
  ======================================================== */

  function editRecord(
    module: GenericModule,
    record?: AnyRecord,
  ) {
    setModal({ section: module, record });
  }

  async function saveRecord(
    module: GenericModule,
    record: AnyRecord,
  ) {
    const list = readRecords(MODULE_KEYS[module]);
    const id = idOf(record);
    const index = list.findIndex(
      (item, itemIndex) => idOf(item, itemIndex) === id,
    );

    const enriched: AnyRecord = {
      ...record,
      updatedAt: new Date().toISOString(),
    };

    const next =
      index >= 0
        ? list.map((item, itemIndex) =>
            itemIndex === index ? enriched : item,
          )
        : [...list, enriched];

    try {
      await writeRecords(module, next);
    } catch (error) {
      console.error('HCS module record save error:', error);
      return note(`Unable to save ${LABEL[module].toLowerCase()} to MongoDB.`);
    }

    setModal(null);
    await load();
    note(
      `${LABEL[module]} record ${index >= 0 ? 'updated' : 'created'} in MongoDB.`,
    );
  }

  async function deleteRecord(
    module: GenericModule,
    record: AnyRecord,
  ) {
    if (
      !confirm(
        `Delete this ${LABEL[module].toLowerCase()} record?`,
      )
    ) {
      return;
    }

    const id = idOf(record);
    const next = readRecords(MODULE_KEYS[module]).filter(
      (item, itemIndex) => idOf(item, itemIndex) !== id,
    );

    try {
      await writeRecords(module, next);
      await load();
      note('Record deleted from MongoDB.');
    } catch (error) {
      console.error('HCS module record delete error:', error);
      note('Unable to delete record from MongoDB.');
    }
  }

  /* =======================================================
     ADMIN SETTINGS
  ======================================================== */

  async function saveSettings() {
    if (!draftSettings) return;

    const account = draftSettings.account as
      | AdminAccountWithPassword
      | undefined;
    const password =
      account?.password ??
      account?.loginPassword ??
      '';

    if (password) {
      const error = validatePassword(password, draftSettings.security);
      if (error) return note(error);
    }

    try {
      const updatedSettings = {
        ...draftSettings,
        clients: clients as ClientAccount[],
      } satisfies GlobalAdminSettings;

      await saveGlobalAdminSettings(updatedSettings);

      const cleanSettings = clone({
        ...updatedSettings,
        account: {
          ...(updatedSettings.account ?? {}),
          password: undefined,
          loginPassword: undefined,
        },
      });

      setSettings(cleanSettings);
      setDraftSettings(clone(cleanSettings));
      note('Admin settings saved to MongoDB.');
    } catch (error) {
      console.error('HCS admin settings save error:', error);
      note('Unable to save admin settings to MongoDB.');
    }
  }

  /* =======================================================
     AUTH LOADING
  ======================================================== */

  if (
    !authorized ||
    !settings
  ) {
    return (
      <main className="auth-loading">
        <Image
          src="/images/logo.png"
          alt="HCS"
          width={165}
          height={58}
          priority
        />

        <span>
          Checking administrator
          session…
        </span>
      </main>
    );
  }

  /* =======================================================
     UI
  ======================================================== */

  return (
    <div className="hcs-admin-page">
      <aside
        className={`admin-sidebar ${
          sidebarOpen
            ? "open"
            : ""
        }`}
      >
        <div className="sidebar-brand">
          <Image
            src="/images/logo.png"
            alt="Hind Consultancy Services"
            width={165}
            height={58}
            priority
          />

          <button
            type="button"
            className="sidebar-close"
            onClick={() =>
              setSidebarOpen(
                false,
              )
            }
          >
            ×
          </button>
        </div>

        <div className="sidebar-label">
          HCS ADMIN PANEL
        </div>

        <nav className="sidebar-navigation">
          {NAV.map(
            (item) => (
              <button
                key={
                  item.key
                }
                type="button"
                className={`sidebar-navigation-item ${
                  section ===
                  item.key
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  nav(
                    item.key,
                  )
                }
              >
                <span>
                  {item.icon}
                </span>

                <span>
                  {item.label}
                </span>
              </button>
            ),
          )}
        </nav>

        <div className="sidebar-bottom">
          <span className="sync-dot" />
          MongoDB account store synchronized
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() =>
            setSidebarOpen(
              false,
            )
          }
          aria-label="Close sidebar"
        />
      ) : null}

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-sidebar-button"
              onClick={() =>
                setSidebarOpen(
                  true,
                )
              }
            >
              ☰
            </button>

            <div>
              <span className="eyebrow">
                HCS ADMINISTRATION
              </span>

              <h1>
                {
                  LABEL[
                    section
                  ]
                }
              </h1>
            </div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="topbar-icon-button"
              onClick={() =>
                nav(
                  "notifications",
                )
              }
            >
              ♢
            </button>

            <button
              type="button"
              className="profile-button"
              onClick={() =>
                setProfileOpen(
                  (value) =>
                    !value,
                )
              }
            >
              <span className="profile-avatar">
                {makeInitials(
                  settings
                    .account
                    ?.fullName ??
                    "HCS",
                )}
              </span>

              <span className="profile-copy">
                <strong>
                  {txt(
                    settings
                      .account
                      ?.fullName,
                    "HCS Administrator",
                  )}
                </strong>

                <small>
                  {txt(
                    settings
                      .account
                      ?.email,
                    "Administrator",
                  )}
                </small>
              </span>

              <span>
                ⌄
              </span>
            </button>

            {profileOpen ? (
              <div className="profile-popover">
                <strong>
                  {txt(
                    settings
                      .account
                      ?.fullName,
                    "HCS Administrator",
                  )}
                </strong>

                <span>
                  {txt(
                    settings
                      .account
                      ?.email,
                  )}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    nav(
                      "settings",
                    )
                  }
                >
                  Account & Security
                </button>

                <button
                  type="button"
                  onClick={() => void logout()}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <section className="admin-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                CONTROL CENTER
              </span>

              <h2>
                {
                  LABEL[
                    section
                  ]
                }
              </h2>

              <p>
                {section ===
                "dashboard"
                  ? "Live operational overview from saved HCS data."
                  : section ===
                      "clients"
                    ? "Manage client accounts, access, permissions and website scope."
                    : section ===
                        "settings"
                      ? "Admin identity and global security policy."
                      : `Manage ${LABEL[
                          section
                        ].toLowerCase()} inside this page.`}
              </p>
            </div>

            {section ===
            "clients" ? (
              <button
                type="button"
                className="primary-button"
                onClick={
                  openCreate
                }
              >
                ＋ Create Client
              </button>
            ) : section !==
                "dashboard" &&
              section !==
                "settings" ? (
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  editRecord(
                    section as GenericModule,
                  )
                }
              >
                ＋ Add{" "}
                {LABEL[
                  section
                ].replace(
                  /s$/,
                  "",
                )}
              </button>
            ) : null}
          </div>

          {/* =================================================
              DASHBOARD
          ================================================= */}

          {section ===
          "dashboard" ? (
            <>
              <div className="stats-grid">
                {[
                  [
                    "CLIENTS",
                    metrics.clients,
                    "Manage client accounts",
                    "clients",
                  ],
                  [
                    "ACTIVE CLIENTS",
                    metrics.active,
                    "Currently active",
                    "clients",
                  ],
                  [
                    "WEBSITES",
                    metrics.websites,
                    "Saved website records",
                    "websites",
                  ],
                  [
                    "KEYWORDS",
                    metrics.keywords,
                    "Saved keyword records",
                    "keywords",
                  ],
                  [
                    "RANKING",
                    metrics.ranking,
                    "Saved ranking rows",
                    "ranking",
                  ],
                  [
                    "REPORTS",
                    metrics.reports,
                    "Saved reports",
                    "reports",
                  ],
                  [
                    "TECHNICAL",
                    metrics.technical,
                    "Saved technical records",
                    "technical",
                  ],
                  [
                    "NOTIFICATIONS",
                    metrics.notifications,
                    "Saved notifications",
                    "notifications",
                  ],
                ].map(
                  ([
                    label,
                    value,
                    sub,
                    target,
                  ]) => (
                    <button
                      type="button"
                      className="metric-card"
                      key={
                        label
                      }
                      onClick={() =>
                        nav(
                          target as SectionKey,
                        )
                      }
                    >
                      <span>
                        {label}
                      </span>

                      <strong>
                        {value}
                      </strong>

                      <small>
                        {sub}
                      </small>
                    </button>
                  ),
                )}
              </div>

              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        CLIENT ACCESS
                      </span>

                      <h3>
                        Account health
                      </h3>
                    </div>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        nav(
                          "clients",
                        )
                      }
                    >
                      Manage Clients
                    </button>
                  </div>

                  <div className="health-list">
                    <div>
                      <span>
                        Active
                      </span>

                      <strong>
                        {
                          metrics.active
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Portal Enabled
                      </span>

                      <strong>
                        {
                          metrics.portal
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Suspended
                      </span>

                      <strong>
                        {
                          metrics.suspended
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Disabled
                      </span>

                      <strong>
                        {
                          metrics.disabled
                        }
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        QUICK ACTIONS
                      </span>

                      <h3>
                        Open module
                      </h3>
                    </div>
                  </div>

                  <div className="quick-actions">
                    {NAV.filter(
                      (item) =>
                        ![
                          "dashboard",
                          "settings",
                        ].includes(
                          item.key,
                        ),
                    ).map(
                      (item) => (
                        <button
                          type="button"
                          className="quick-action"
                          key={
                            item.key
                          }
                          onClick={() =>
                            nav(
                              item.key,
                            )
                          }
                        >
                          <span>
                            {item.icon}
                          </span>

                          <strong>
                            {item.label}
                          </strong>
                        </button>
                      ),
                    )}
                  </div>
                </section>
              </div>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      CLIENTS
                    </span>

                    <h3>
                      Latest accounts
                    </h3>
                  </div>
                </div>

                {clients.length ? (
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>
                            Client
                          </th>

                          <th>
                            Client ID
                          </th>

                          <th>
                            Company
                          </th>

                          <th>
                            Status
                          </th>

                          <th>
                            Portal
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {clients
                          .slice(
                            0,
                            8,
                          )
                          .map(
                            (
                              client,
                            ) => (
                              <tr
                                key={
                                  client.id
                                }
                              >
                                <td>
                                  {txt(
                                    client.name ??
                                      client.companyName,
                                  )}
                                </td>

                                <td>
                                  {
                                    client.clientId
                                  }
                                </td>

                                <td>
                                  {txt(
                                    client.companyName,
                                  )}
                                </td>

                                <td>
                                  {
                                    client.status
                                  }
                                </td>

                                <td>
                                  {client.clientPortalEnabled ===
                                  false
                                    ? "Disabled"
                                    : "Enabled"}
                                </td>
                              </tr>
                            ),
                          )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="No client accounts"
                    detail="Create a client from the Clients module."
                  />
                )}
              </section>
            </>
          ) : null}

          {/* =================================================
              CLIENTS
          ================================================= */}

          {section ===
          "clients" ? (
            <section className="clients-content">
              <div className="toolbar">
                <div className="search-field">
                  <span>
                    ⌕
                  </span>

                  <input
                    value={
                      search
                    }
                    onChange={(
                      event,
                    ) =>
                      setSearch(
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Search client, company, email, username..."
                  />
                </div>

                {selected.length >
                0 ? (
                  <div className="bulk-action-bar">
                    <span>
                      {
                        selected.length
                      }{" "}
                      selected
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        void bulk(
                          "enable",
                        )
                      }
                    >
                      Enable
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void bulk(
                          "disable",
                        )
                      }
                    >
                      Disable
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void bulk(
                          "suspend",
                        )
                      }
                    >
                      Suspend
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSelected(
                          [],
                        )
                      }
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
              </div>

              <section className="panel">
                {filteredClients.length ? (
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>
                            <input
                              type="checkbox"
                              checked={
                                filteredClients.length >
                                  0 &&
                                filteredClients.every(
                                  (
                                    client,
                                  ) =>
                                    selected.includes(
                                      client.id,
                                    ),
                                )
                              }
                              onChange={(
                                event,
                              ) =>
                                setSelected(
                                  event
                                    .target
                                    .checked
                                    ? filteredClients.map(
                                        (
                                          client,
                                        ) =>
                                          client.id,
                                      )
                                    : [],
                                )
                              }
                            />
                          </th>

                          <th>
                            Client
                          </th>

                          <th>
                            Client ID
                          </th>

                          <th>
                            Company
                          </th>

                          <th>
                            Email
                          </th>

                          <th>
                            Status
                          </th>

                          <th>
                            Portal
                          </th>

                          <th>
                            Websites
                          </th>

                          <th>
                            Plan
                          </th>

                          <th>
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredClients.map(
                          (
                            client,
                          ) => (
                            <tr
                              key={
                                client.id
                              }
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selected.includes(
                                    client.id,
                                  )}
                                  onChange={(
                                    event,
                                  ) =>
                                    setSelected(
                                      (
                                        current,
                                      ) =>
                                        event
                                          .target
                                          .checked
                                          ? [
                                              ...current,
                                              client.id,
                                            ]
                                          : current.filter(
                                              (
                                                id,
                                              ) =>
                                                id !==
                                                client.id,
                                            ),
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <div className="table-person">
                                  <span className="person-avatar">
                                    {makeInitials(
                                      client.name ??
                                        client.companyName ??
                                        "",
                                    )}
                                  </span>

                                  <span>
                                    <strong>
                                      {txt(
                                        client.name ??
                                          client.companyName,
                                      )}
                                    </strong>

                                    <small>
                                      {
                                        client.username
                                      }
                                    </small>
                                  </span>
                                </div>
                              </td>

                              <td>
                                {
                                  client.clientId
                                }
                              </td>

                              <td>
                                {txt(
                                  client.companyName,
                                )}
                              </td>

                              <td>
                                {txt(
                                  client.email,
                                )}
                              </td>

                              <td>
                                {
                                  client.status
                                }
                              </td>

                              <td>
                                {client.clientPortalEnabled ===
                                false
                                  ? "Disabled"
                                  : "Enabled"}
                              </td>

                              <td>
                                {
                                  client
                                    .assignedWebsiteIds
                                    ?.length ??
                                  0
                                }
                              </td>

                              <td>
                                {txt(
                                  client.plan,
                                )}
                              </td>

                              <td>
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEdit(
                                        client,
                                      )
                                    }
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void resetPassword(
                                        client,
                                      )
                                    }
                                  >
                                    Reset
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void togglePortal(
                                        client,
                                      )
                                    }
                                  >
                                    {client.clientPortalEnabled ===
                                    false
                                      ? "Enable"
                                      : "Disable"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void setStatus(
                                        client,
                                        client.status ===
                                          "Suspended"
                                          ? "Active"
                                          : "Suspended",
                                      )
                                    }
                                  >
                                    {client.status ===
                                    "Suspended"
                                      ? "Unsuspend"
                                      : "Suspend"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCredentials(
                                        {
                                          clientId:
                                            client.clientId,

                                          username:
                                            client.username,

                                          email:
                                            client.email,

                                          /*
                                           * Password cannot be recovered
                                           * from passwordHash.
                                           */
                                          password:
                                            "Password hidden. Use Reset to generate a new password.",

                                          name:
                                            client.name,

                                          companyName:
                                            client.companyName,

                                          status:
                                            client.status,
                                        },
                                      )
                                    }
                                  >
                                    Credentials
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void removeClient(
                                        client,
                                      )
                                    }
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title={
                      search
                        ? "No matching clients"
                        : "No clients yet"
                    }
                    detail={
                      search
                        ? "Try another search."
                        : "Create the first client account."
                    }
                  />
                )}
              </section>
            </section>
          ) : null}

          {/* =================================================
              MODULES
          ================================================= */}

          {section !==
            "dashboard" &&
          section !==
            "clients" &&
          section !==
            "settings" ? (
            <section className="module-content">
              <div className="toolbar">
                <div className="search-field">
                  <span>
                    ⌕
                  </span>

                  <input
                    value={
                      search
                    }
                    onChange={(
                      event,
                    ) =>
                      setSearch(
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder={`Search ${LABEL[
                      section
                    ].toLowerCase()}...`}
                  />
                </div>

                <span className="record-count">
                  {
                    filteredRecords.length
                  }{" "}
                  record
                  {filteredRecords.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              <section className="panel">
                {filteredRecords.length ? (
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>
                            Name
                          </th>

                          <th>
                            ID
                          </th>

                          <th>
                            Status
                          </th>

                          <th>
                            Website / Scope
                          </th>

                          <th>
                            Updated
                          </th>

                          <th>
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredRecords.map(
                          (
                            record,
                            index,
                          ) => (
                            <tr
                              key={`${idOf(
                                record,
                                index,
                              )}-${index}`}
                            >
                              <td>
                                <strong>
                                  {titleOf(
                                    record,
                                    section,
                                  )}
                                </strong>
                              </td>

                              <td>
                                {idOf(
                                  record,
                                  index,
                                )}
                              </td>

                              <td>
                                {txt(
                                  record.status ??
                                    record.state ??
                                    record.priority,
                                  "Saved",
                                )}
                              </td>

                              <td>
                                {txt(
                                  record.website ??
                                    record.domain ??
                                    record.url ??
                                    record.site ??
                                    record.websiteId ??
                                    record.clientId,
                                )}
                              </td>

                              <td>
                                {txt(
                                  record.updatedAt ??
                                    record.createdAt ??
                                    record.date,
                                )}
                              </td>

                              <td>
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      editRecord(
                                        section as GenericModule,
                                        record,
                                      )
                                    }
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      deleteRecord(
                                        section as GenericModule,
                                        record,
                                      )
                                    }
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title={`No ${LABEL[
                      section
                    ].toLowerCase()} records`}
                    detail="Only saved real records appear here; no demo data is generated."
                  />
                )}
              </section>
            </section>
          ) : null}

          {/* =================================================
              SETTINGS
          ================================================= */}

          {section ===
            "settings" &&
          draftSettings ? (
            <section className="settings-content">
              <div className="settings-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        ADMIN ACCOUNT
                      </span>

                      <h3>
                        Administrator identity
                      </h3>
                    </div>
                  </div>

                  <div className="form-grid">
                    <Field label="Admin ID">
                      <input
                        value={
                          draftSettings
                            .account
                            ?.adminId ??
                          ""
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    account:
                                      {
                                        ...current.account,
                                        adminId:
                                          event
                                            .target
                                            .value,
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>

                    <Field label="Username">
                      <input
                        value={
                          draftSettings
                            .account
                            ?.username ??
                          ""
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    account:
                                      {
                                        ...current.account,
                                        username:
                                          event
                                            .target
                                            .value,
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>

                    <Field label="Full Name">
                      <input
                        value={
                          draftSettings
                            .account
                            ?.fullName ??
                          ""
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    account:
                                      {
                                        ...current.account,
                                        fullName:
                                          event
                                            .target
                                            .value,
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>

                    <Field label="Email">
                      <input
                        value={
                          draftSettings
                            .account
                            ?.email ??
                          ""
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    account:
                                      {
                                        ...current.account,
                                        email:
                                          event
                                            .target
                                            .value,
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>

                    <Field label="Phone">
                      <input
                        value={
                          draftSettings
                            .account
                            ?.phone ??
                          ""
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    account:
                                      {
                                        ...current.account,
                                        phone:
                                          event
                                            .target
                                            .value,
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>

                    <Field label="Job Title">
                      <input
                        value={
                          draftSettings
                            .account
                            ?.jobTitle ??
                          ""
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    account:
                                      {
                                        ...current.account,
                                        jobTitle:
                                          event
                                            .target
                                            .value,
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        SECURITY
                      </span>

                      <h3>
                        Admin password
                      </h3>
                    </div>
                  </div>

                  <Field label="Password">
                    <input
                      type="password"
                      value={
                        (
                          draftSettings.account as
                            | AdminAccountWithPassword
                            | undefined
                        )?.password ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        setDraftSettings(
                          (
                            current,
                          ) =>
                            current
                              ? {
                                  ...current,

                                  account:
                                    {
                                      ...current.account,

                                      password:
                                        event
                                          .target
                                          .value,

                                      loginPassword:
                                        event
                                          .target
                                          .value,
                                    } as AdminAccountWithPassword,
                                }
                              : current,
                        )
                      }
                    />
                  </Field>

                  <p className="field-help">
                    Changing this password updates the unified Admin login.
                  </p>

                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={
                        draftSettings
                          .account
                          ?.active !==
                        false
                      }
                      onChange={(
                        event,
                      ) =>
                        setDraftSettings(
                          (
                            current,
                          ) =>
                            current
                              ? {
                                  ...current,

                                  account:
                                    {
                                      ...current.account,

                                      active:
                                        event
                                          .target
                                          .checked,
                                    },
                                }
                              : current,
                        )
                      }
                    />

                    <span>
                      Admin account active
                    </span>
                  </label>
                </section>

                <section className="panel settings-span">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        CLIENT PASSWORD POLICY
                      </span>

                      <h3>
                        Security rules used by generated/reset client passwords
                      </h3>
                    </div>
                  </div>

                  <div className="form-grid">
                    <Field label="Minimum Length">
                      <input
                        type="number"
                        min={6}
                        value={
                          draftSettings
                            .security
                            ?.minPasswordLength ??
                          8
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    security:
                                      {
                                        ...current.security,

                                        minPasswordLength:
                                          Math.max(
                                            6,
                                            Number(
                                              event
                                                .target
                                                .value,
                                            ) ||
                                              8,
                                          ),
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>

                    <Field label="Failed Attempts Limit">
                      <input
                        type="number"
                        min={1}
                        value={
                          draftSettings
                            .security
                            ?.failedAttemptsLimit ??
                          5
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    security:
                                      {
                                        ...current.security,

                                        failedAttemptsLimit:
                                          Math.max(
                                            1,
                                            Number(
                                              event
                                                .target
                                                .value,
                                            ) ||
                                              5,
                                          ),
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>
                  </div>

                  <div className="switch-grid">
                    {[
                      [
                        "requireUppercase",
                        "Require uppercase",
                      ],
                      [
                        "requireNumber",
                        "Require number",
                      ],
                      [
                        "requireSpecialCharacter",
                        "Require special character",
                      ],
                      [
                        "blockAfterFailedAttempts",
                        "Block after failed attempts",
                      ],
                      [
                        "loginAlerts",
                        "Login alerts",
                      ],
                      [
                        "suspiciousLoginAlerts",
                        "Suspicious login alerts",
                      ],
                      [
                        "sessionAlerts",
                        "Session alerts",
                      ],
                      [
                        "passwordExpiry",
                        "Password expiry",
                      ],
                    ].map(
                      ([
                        key,
                        label,
                      ]) => (
                        <label
                          className="switch-row"
                          key={
                            key
                          }
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(
                              (
                                draftSettings
                                  .security as AnyRecord
                              )?.[
                                key
                              ],
                            )}
                            onChange={(
                              event,
                            ) =>
                              setDraftSettings(
                                (
                                  current,
                                ) =>
                                  current
                                    ? {
                                        ...current,

                                        security:
                                          {
                                            ...current.security,

                                            [key]:
                                              event
                                                .target
                                                .checked,
                                          },
                                      }
                                    : current,
                              )
                            }
                          />

                          <span>
                            {label}
                          </span>
                        </label>
                      ),
                    )}
                  </div>
                </section>

                <section className="panel settings-span">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        GENERAL
                      </span>

                      <h3>
                        Company information
                      </h3>
                    </div>
                  </div>

                  <div className="form-grid">
                    <Field label="Company Name">
                      <input
                        value={
                          draftSettings
                            .general
                            ?.companyName ??
                          ""
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    general:
                                      {
                                        ...current.general,

                                        companyName:
                                          event
                                            .target
                                            .value,
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>

                    <Field label="Company Email">
                      <input
                        value={
                          draftSettings
                            .general
                            ?.companyEmail ??
                          ""
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    general:
                                      {
                                        ...current.general,

                                        companyEmail:
                                          event
                                            .target
                                            .value,
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>

                    <Field label="Support Email">
                      <input
                        value={
                          draftSettings
                            .general
                            ?.supportEmail ??
                          ""
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    general:
                                      {
                                        ...current.general,

                                        supportEmail:
                                          event
                                            .target
                                            .value,
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>

                    <Field label="Phone">
                      <input
                        value={
                          draftSettings
                            .general
                            ?.phone ??
                          ""
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    general:
                                      {
                                        ...current.general,

                                        phone:
                                          event
                                            .target
                                            .value,
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>

                    <Field label="Website">
                      <input
                        value={
                          draftSettings
                            .general
                            ?.website ??
                          ""
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    general:
                                      {
                                        ...current.general,

                                        website:
                                          event
                                            .target
                                            .value,
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>

                    <Field label="Timezone">
                      <input
                        value={
                          draftSettings
                            .general
                            ?.timezone ??
                          ""
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraftSettings(
                            (
                              current,
                            ) =>
                              current
                                ? {
                                    ...current,

                                    general:
                                      {
                                        ...current.general,

                                        timezone:
                                          event
                                            .target
                                            .value,
                                      },
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>
                  </div>
                </section>
              </div>

              <div className="sticky-save-bar">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setDraftSettings(
                      clone(
                        settings,
                      ),
                    )
                  }
                >
                  Discard
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    saveSettings
                  }
                >
                  Save Settings
                </button>
              </div>
            </section>
          ) : null}
        </section>
      </main>

      {drawer ? (
        <ClientDrawer
          form={
            clientForm
          }
          setForm={
            setClientForm
          }
          clients={
            clients
          }
          websites={
            websites
          }
          security={
            settings.security
          }
          mode={
            drawer
          }
          showPassword={
            showPassword
          }
          setShowPassword={
            setShowPassword
          }
          onClose={() =>
            setDrawer(
              null,
            )
          }
          onSubmit={
            submitClient
          }
        />
      ) : null}

      {modal ? (
        <RecordModal
          section={modal.section}
          initial={modal.record}
          clients={clients}
          websites={websites}
          onClose={() => setModal(null)}
          onSave={saveRecord}
        />
      ) : null}

      {credentials ? (
        <CredentialsModal
          value={
            credentials
          }
          onClose={() =>
            setCredentials(
              null,
            )
          }
        />
      ) : null}

      {toast ? (
        <div className="toast">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================
   CLIENT DRAWER
========================================================= */

function ClientDrawer({
  form,
  setForm,
  clients,
  websites,
  security,
  mode,
  showPassword,
  setShowPassword,
  onClose,
  onSubmit,
}: any) {
  const set = (
    key: keyof ClientForm,
    value: any,
  ) =>
    setForm(
      (
        previous: ClientForm,
      ) => ({
        ...previous,
        [key]:
          value,
      }),
    );

  const toggle = (
    key: PermissionKey,
  ) =>
    set(
      "permissions",
      {
        ...form.permissions,
        [key]:
          !Boolean(
            form.permissions[
              key
            ],
          ),
      },
    );

  const regenerate =
    () =>
      set(
        "password",
        passwordFor(
          security,
        ),
      );

  const allSites =
    websites.map(
      (
        record: AnyRecord,
        index: number,
      ) =>
        idOf(
          record,
          index,
        ),
    );

  return (
    <div className="modal-layer">
      <button
        type="button"
        className="modal-backdrop"
        onClick={
          onClose
        }
        aria-label="Close"
      />

      <section className="drawer-modal">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">
              {mode ===
              "create"
                ? "NEW CLIENT"
                : "EDIT CLIENT"}
            </span>

            <h2>
              {mode ===
              "create"
                ? "Create Client"
                : form.clientId}
            </h2>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={
              onClose
            }
          >
            ×
          </button>
        </div>

        <form
          className="drawer-body"
          onSubmit={
            onSubmit
          }
        >
          {/* IDENTITY */}

          <section className="form-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  IDENTITY
                </span>

                <h3>
                  Client account
                </h3>
              </div>
            </div>

            <div className="form-grid">
              <Field label="Client ID">
                <input
                  value={
                    form.clientId
                  }
                  readOnly
                />
              </Field>

              <Field label="Name">
                <input
                  required
                  value={
                    form.name
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "name",
                      event
                        .target
                        .value,
                    )
                  }
                />
              </Field>

              <Field label="Company">
                <input
                  required
                  value={
                    form.companyName
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "companyName",
                      event
                        .target
                        .value,
                    )
                  }
                />
              </Field>

              <Field label="Email">
                <input
                  required
                  type="email"
                  value={
                    form.email
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "email",
                      event
                        .target
                        .value,
                    )
                  }
                />
              </Field>

              <Field label="Username">
                <input
                  required
                  value={
                    form.username
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "username",
                      event
                        .target
                        .value,
                    )
                  }
                />
              </Field>

              <Field label="Phone">
                <input
                  value={
                    form.phone
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "phone",
                      event
                        .target
                        .value,
                    )
                  }
                />
              </Field>

              <Field label="Website">
                <input
                  value={
                    form.website
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "website",
                      event
                        .target
                        .value,
                    )
                  }
                />
              </Field>

              <Field label="Plan">
                <input
                  value={
                    form.plan
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "plan",
                      event
                        .target
                        .value,
                    )
                  }
                />
              </Field>

              <Field label="Manager">
                <input
                  value={
                    form.assignedManager
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "assignedManager",
                      event
                        .target
                        .value,
                    )
                  }
                />
              </Field>

              <Field label="Status">
                <select
                  value={
                    form.status
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "status",
                      event
                        .target
                        .value,
                    )
                  }
                >
                  <option>
                    Active
                  </option>

                  <option>
                    Suspended
                  </option>

                  <option>
                    Disabled
                  </option>
                </select>
              </Field>
            </div>
          </section>

          {/* SECURITY */}

          <section className="form-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  SECURITY
                </span>

                <h3>
                  Portal credentials
                </h3>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={
                  regenerate
                }
              >
                Regenerate
              </button>
            </div>

            <div className="password-field">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={
                  form.password
                }
                onChange={(
                  event,
                ) =>
                  set(
                    "password",
                    event
                      .target
                      .value,
                  )
                }
                placeholder={
                  mode ===
                  "edit"
                    ? "Leave blank to keep current password"
                    : "Generated password"
                }
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (
                      value: boolean,
                    ) =>
                      !value,
                  )
                }
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>

            <p className="field-help">
              Password is securely hashed before it is stored in MongoDB.
            </p>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={
                  form.clientPortalEnabled
                }
                onChange={(
                  event,
                ) =>
                  set(
                    "clientPortalEnabled",
                    event
                      .target
                      .checked,
                  )
                }
              />

              <span>
                Portal enabled
              </span>
            </label>
          </section>

          {/* PERMISSIONS */}

          <section className="form-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  PERMISSIONS
                </span>

                <h3>
                  Client module access
                </h3>
              </div>

              <div className="inline-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    set(
                      "permissions",
                      clone(
                        ALL_PERMISSIONS,
                      ),
                    )
                  }
                >
                  Grant All
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    set(
                      "permissions",
                      Object.fromEntries(
                        PERMISSIONS.map(
                          (
                            permission,
                          ) => [
                            permission.key,
                            false,
                          ],
                        ),
                      ),
                    )
                  }
                >
                  Remove All
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    set(
                      "permissions",
                      clone(
                        DEFAULT_PERMISSIONS,
                      ),
                    )
                  }
                >
                  Default
                </button>
              </div>
            </div>

            <div className="permission-grid">
              {PERMISSIONS.map(
                (
                  permission,
                ) => (
                  <button
                    type="button"
                    key={
                      permission.key
                    }
                    className={`permission-card ${
                      form.permissions[
                        permission.key
                      ]
                        ? "enabled"
                        : ""
                    }`}
                    onClick={() =>
                      toggle(
                        permission.key,
                      )
                    }
                  >
                    <span className="permission-check">
                      {form.permissions[
                        permission.key
                      ]
                        ? "✓"
                        : ""}
                    </span>

                    <span>
                      <strong>
                        {
                          permission.label
                        }
                      </strong>

                      <small>
                        {permission.key ===
                        "keywords"
                          ? "SEO and keyword data"
                          : "Client portal module"}
                      </small>
                    </span>
                  </button>
                ),
              )}
            </div>
          </section>

          {/* WEBSITE SCOPE */}

          <section className="form-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  WEBSITE SCOPE
                </span>

                <h3>
                  Assign existing websites
                </h3>
              </div>

              <span className="record-count">
                {
                  form
                    .assignedWebsiteIds
                    .length
                }{" "}
                selected
              </span>
            </div>

            {websites.length ? (
              <>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      set(
                        "assignedWebsiteIds",
                        allSites,
                      )
                    }
                  >
                    Select All
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      set(
                        "assignedWebsiteIds",
                        [],
                      )
                    }
                  >
                    Clear All
                  </button>
                </div>

                <div className="assignment-list">
                  {websites.map(
                    (
                      website: AnyRecord,
                      index: number,
                    ) => {
                      const id =
                        idOf(
                          website,
                          index,
                        );

                      const checked =
                        form.assignedWebsiteIds.includes(
                          id,
                        );

                      return (
                        <label
                          className="assignment-row"
                          key={
                            id
                          }
                        >
                          <input
                            type="checkbox"
                            checked={
                              checked
                            }
                            onChange={(
                              event,
                            ) =>
                              set(
                                "assignedWebsiteIds",
                                event
                                  .target
                                  .checked
                                  ? [
                                      ...form.assignedWebsiteIds,
                                      id,
                                    ]
                                  : form.assignedWebsiteIds.filter(
                                      (
                                        value: string,
                                      ) =>
                                        value !==
                                        id,
                                    ),
                              )
                            }
                          />

                          <span>
                            <strong>
                              {
                                titleOf(
                                  website,
                                  "websites",
                                )
                              }
                            </strong>

                            <small>
                              {txt(
                                website.domain ??
                                  website.url ??
                                  website.website,
                              )}
                            </small>
                          </span>
                        </label>
                      );
                    },
                  )}
                </div>
              </>
            ) : (
              <Empty
                title="No website records available"
                detail="Create real website records first. No placeholder website is added."
              />
            )}
          </section>

          {/* SERVICES */}

          <section className="form-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">SERVICES</span>

                <h3>
                  Service scope
                </h3>
              </div>

              <span className="record-count">
                {form.services.length} selected
              </span>
            </div>

            <p className="field-help">
              Choose the services this client can see or manage in the portal.
            </p>

            <div className="permission-grid">
              {CLIENT_SERVICES.map((service) => {
                const enabled = form.services.includes(service);
                return (
                  <button
                    type="button"
                    key={service}
                    className={`permission-card ${enabled ? 'enabled' : ''}`}
                    onClick={() =>
                      set(
                        'services',
                        enabled
                          ? form.services.filter((item: string) => item !== service)
                          : [...form.services, service],
                      )
                    }
                  >
                    <span className="permission-check">
                      {enabled ? '✓' : ''}
                    </span>
                    <span>
                      <strong>{service}</strong>
                      <small>Client service assignment</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* NOTES */}

          <section className="form-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  NOTES
                </span>

                <h3>
                  Internal information
                </h3>
              </div>
            </div>

            <div className="form-grid">
              <Field label="Tags">
                <input
                  value={
                    form.tags
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "tags",
                      event
                        .target
                        .value,
                    )
                  }
                />
              </Field>

              <Field label="Notes">
                <textarea
                  rows={5}
                  value={
                    form.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "notes",
                      event
                        .target
                        .value,
                    )
                  }
                />
              </Field>
            </div>
          </section>

          <div className="drawer-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={
                onClose
              }
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
            >
              {mode ===
              "create"
                ? "Create Client"
                : "Save Client Access"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* =========================================================
   RECORD MODAL
========================================================= */

function RecordModal({
  section,
  initial,
  clients,
  websites,
  onClose,
  onSave,
}: {
  section: GenericModule;
  initial?: AnyRecord;
  clients: ExtendedClient[];
  websites: AnyRecord[];
  onClose: () => void;
  onSave: (section: GenericModule, record: AnyRecord) => void | Promise<void>;
}) {
  const fields = MODULE_FORM_FIELDS[section] ?? [];

  const base = useMemo(
    () => ({
      ...defaultModuleRecord(section),
      ...(initial ?? {}),
    }),
    [section, initial],
  );

  const [form, setForm] = useState<AnyRecord>(base);
  const [customFields, setCustomFields] = useState<
    Array<{ key: string; value: string }>
  >(() => {
    const known = new Set([
      ...fields.map((field) => field.key),
      'id',
      'createdAt',
      'updatedAt',
      'generatedAt',
      'generatedBy',
    ]);

    return Object.entries(initial ?? {})
      .filter(([key]) => !known.has(key))
      .map(([key, value]) => ({
        key,
        value:
          Array.isArray(value)
            ? value.join(', ')
            : typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : String(value ?? ''),
      }));
  });

  const [error, setError] = useState('');

  const setField = (key: string, value: unknown) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setClient = (key: string, value: string) =>
    setField(key, value);

  const addCustomField = () =>
    setCustomFields((current) => [...current, { key: '', value: '' }]);

  const updateCustomField = (
    index: number,
    key: 'key' | 'value',
    value: string,
  ) =>
    setCustomFields((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );

  const removeCustomField = (index: number) =>
    setCustomFields((current) =>
      current.filter((_, rowIndex) => rowIndex !== index),
    );

  const buildRecord = () => {
    const result: AnyRecord = {
      ...form,
      updatedAt: new Date().toISOString(),
    };

    for (const field of fields) {
      if (
        field.type === 'number' &&
        result[field.key] !== '' &&
        result[field.key] !== undefined
      ) {
        const numberValue = Number(result[field.key]);
        result[field.key] = Number.isFinite(numberValue)
          ? numberValue
          : '';
      }

      if (
        typeof result[field.key] === 'string' &&
        (field.key === 'tags' || field.key === 'services')
      ) {
        result[field.key] = result[field.key]
          .split(',')
          .map((value: string) => value.trim())
          .filter(Boolean);
      }
    }

    for (const row of customFields) {
      const key = row.key.trim();
      if (!key) continue;
      result[key] = row.value.trim();
    }

    return result;
  };

  function save() {
    const result = buildRecord();

    for (const field of fields) {
      if (
        field.required &&
        !String(result[field.key] ?? '').trim()
      ) {
        setError(`${field.label} is required.`);
        return;
      }
    }

    setError('');
    void onSave(section, result);
  }

  return (
    <div className="modal-layer">
      <button
        type="button"
        className="modal-backdrop"
        onClick={onClose}
        aria-label="Close"
      />

      <section className="drawer-modal">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">
              {initial ? 'EDIT RECORD' : 'NEW RECORD'}
            </span>
            <h2>
              {initial
                ? titleOf(initial, section)
                : `Add ${LABEL[section].replace(/s$/, '')}`}
            </h2>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form
          className="drawer-body"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <section className="form-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">STRUCTURED ENTRY</span>
                <h3>{LABEL[section]} details</h3>
              </div>
              <span className="record-count">{fields.length} fields</span>
            </div>

            <div className="form-grid">
              {fields.map((field) => {
                const value =
                  form[field.key] ??
                  (field.type === 'checkbox' ? false : '');

                if (field.type === 'checkbox') {
                  return (
                    <label
                      key={field.key}
                      className={`switch-row ${field.wide ? 'field-wide-switch' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(event) =>
                          setField(field.key, event.target.checked)
                        }
                      />
                      <span>{field.label}</span>
                    </label>
                  );
                }

                if (field.key === 'clientId') {
                  return (
                    <Field key={field.key} label={field.label}>
                      <select
                        value={String(value ?? '')}
                        onChange={(event) =>
                          setClient(field.key, event.target.value)
                        }
                      >
                        <option value="">Unassigned</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.clientId}>
                            {client.clientId} — {txt(client.name ?? client.companyName)}
                          </option>
                        ))}
                      </select>
                      <small className="field-help-inline">
                        Select the HCS client that owns this record.
                      </small>
                    </Field>
                  );
                }

                if (field.key === 'websiteId') {
                  return (
                    <Field key={field.key} label={field.label}>
                      <select
                        value={String(value ?? '')}
                        onChange={(event) =>
                          setField(field.key, event.target.value)
                        }
                      >
                        <option value="">Unassigned</option>
                        {websites.map((website, index) => {
                          const id = idOf(website, index);
                          return (
                            <option key={id} value={id}>
                              {id} — {titleOf(website, 'websites')}
                            </option>
                          );
                        })}
                      </select>
                    </Field>
                  );
                }

                return (
                  <Field key={field.key} label={field.label}>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={String(value ?? '')}
                        placeholder={field.placeholder}
                        required={field.required}
                        rows={field.wide ? 6 : 4}
                        onChange={(event) =>
                          setField(field.key, event.target.value)
                        }
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={String(value ?? '')}
                        required={field.required}
                        onChange={(event) =>
                          setField(field.key, event.target.value)
                        }
                      >
                        {(field.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type ?? 'text'}
                        value={String(value ?? '')}
                        placeholder={field.placeholder}
                        required={field.required}
                        min={field.type === 'number' ? 0 : undefined}
                        onChange={(event) =>
                          setField(field.key, event.target.value)
                        }
                      />
                    )}
                    {field.help ? (
                      <small className="field-help-inline">{field.help}</small>
                    ) : null}
                  </Field>
                );
              })}
            </div>
          </section>

          <section className="form-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">CUSTOM DATA</span>
                <h3>Additional fields</h3>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={addCustomField}
              >
                ＋ Add Field
              </button>
            </div>

            <p className="field-help">
              Existing fields that are not part of the standard module form appear here, so old records are not lost.
            </p>

            {customFields.length ? (
              <div className="form-grid custom-field-grid">
                {customFields.map((row, index) => (
                  <div
                    key={`custom-${index}`}
                    className="custom-field-row"
                  >
                    <input
                      value={row.key}
                      placeholder="Field name"
                      onChange={(event) =>
                        updateCustomField(index, 'key', event.target.value)
                      }
                    />
                    <input
                      value={row.value}
                      placeholder="Value"
                      onChange={(event) =>
                        updateCustomField(index, 'value', event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => removeCustomField(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No custom fields"
                detail="Use Add Field when you need information outside the standard module form."
              />
            )}
          </section>

          {error ? <div className="form-error">{error}</div> : null}

          <div className="drawer-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="primary-button">
              {initial
                ? 'Update Record'
                : `Add ${LABEL[section].replace(/s$/, '')}`}
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

function CredentialsModal({
  value,
  onClose,
}: {
  value: AnyRecord;
  onClose: () => void;
}) {
  const copy =
    (text: string) => {
      navigator.clipboard?.writeText(
        text,
      );
    };

  const downloadTxt =
    () => {
      const body =
        `HIND CONSULTANCY SERVICES
CLIENT PORTAL CREDENTIALS

Client ID: ${value.clientId}
Username: ${value.username}
Email: ${value.email}
Password: ${value.password}
Status: ${value.status}`;

      const url =
        URL.createObjectURL(
          new Blob(
            [body],
            {
              type:
                "text/plain",
            },
          ),
        );

      const anchor =
        document.createElement(
          "a",
        );

      anchor.href =
        url;

      anchor.download =
        `${value.clientId}-credentials.txt`;

      anchor.click();

      URL.revokeObjectURL(
        url,
      );
    };

  const downloadExe =
    async () => {
      try {
        const response =
          await fetch(
            "/api/client-credentials-exe",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  value,
                ),
            },
          );

        if (
          !response.ok
        ) {
          return;
        }

        const url =
          URL.createObjectURL(
            await response.blob(),
          );

        const anchor =
          document.createElement(
            "a",
          );

        anchor.href =
          url;

        anchor.download =
          `${value.clientId}-credentials.exe`;

        anchor.click();

        URL.revokeObjectURL(
          url,
        );
      } catch {
        // Ignore download failure.
      }
    };

  return (
    <div className="modal-layer">
      <button
        type="button"
        className="modal-backdrop"
        onClick={
          onClose
        }
        aria-label="Close"
      />

      <section className="credentials-modal">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">
              CLIENT CREDENTIALS
            </span>

            <h2>
              {
                value.clientId
              }
            </h2>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={
              onClose
            }
          >
            ×
          </button>
        </div>

        <div className="credentials-body">
          {[
            [
              "Client ID",
              value.clientId,
            ],
            [
              "Username",
              value.username,
            ],
            [
              "Email",
              value.email,
            ],
            [
              "Password",
              value.password,
            ],
            [
              "Status",
              value.status,
            ],
          ].map(
            ([
              label,
              rowValue,
            ]) => (
              <div
                className="credential-row"
                key={
                  label
                }
              >
                <span>
                  {
                    label
                  }
                </span>

                <strong>
                  {
                    rowValue
                  }
                </strong>
              </div>
            ),
          )}

          <div className="credential-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                copy(
                  String(
                    value.clientId,
                  ),
                )
              }
            >
              Copy Client ID
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                copy(
                  String(
                    value.password,
                  ),
                )
              }
            >
              Copy Password
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                copy(
                  `Client ID: ${value.clientId}
Username: ${value.username}
Email: ${value.email}
Password: ${value.password}`,
                )
              }
            >
              Copy Credentials
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={
                downloadTxt
              }
            >
              Download TXT
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={
                downloadExe
              }
            >
              Download EXE
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
