"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getGlobalAdminSettings,
  saveClientAccount,
  type ClientAccount,
} from "../admin/admin-settings";

import "./style.css";

/* =========================================================
   HCS CLIENT PORTAL
   ---------------------------------------------------------
   SOURCE OF TRUTH:
   app/admin/admin-settings.ts

   AUTH FLOW:
   / -> unified login -> hcs-auth-session -> /client

   CLIENT DATA:
   - Same global client account created by Admin
   - Same Client ID
   - Same password
   - Same status
   - Same portal access
   - Same permissions
   - Same assigned websites
   - Same assigned services
   - Live localStorage synchronization

   IMPORTANT:
   No dummy client records.
   No hardcoded website records.
   No hardcoded SEO records.
   ========================================================= */

/* =========================================================
   TYPES
========================================================= */

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

type Section =
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
  | "notifications"
  | "profile";

type AnyRecord = Record<string, unknown>;

type ExtendedClientAccount = ClientAccount & {
  services?: unknown[];
  assignedServices?: unknown[];
  serviceAccess?: unknown[];
  selectedServices?: unknown[];
  portalData?: AnyRecord;
};

type AuthSession = {
  authenticated?: boolean;
  role?: string;
  id?: string;
  clientId?: string;
  accountId?: string;
  username?: string;
  email?: string;
  name?: string;
  companyName?: string;
  loggedInAt?: string;
};

type WebsiteRecord = {
  id: string;
  name: string;
  domain: string;
  status: string;
};

type KeywordRecord = {
  id: string;
  keyword: string;
  currentRank: number | null;
  previousRank: number | null;
  targetUrl: string;
  volume: number | null;
  status: string;
  websiteId: string;
};

type RankingRecord = {
  id: string;
  keyword: string;
  position: number | null;
  previousPosition: number | null;
  url: string;
  checkedAt: string;
  websiteId: string;
};

type PageRecord = {
  id: string;
  title: string;
  url: string;
  seoStatus: string;
  indexStatus: string;
  issues: number;
  updatedAt: string;
  websiteId: string;
};

type BlogRecord = {
  id: string;
  title: string;
  status: string;
  author: string;
  publishedAt: string;
  url: string;
  updatedAt: string;
  websiteId: string;
};

type BacklinkRecord = {
  id: string;
  source: string;
  target: string;
  anchor: string;
  status: string;
  date: string;
  websiteId: string;
};

type TechnicalRecord = {
  id: string;
  issue: string;
  severity: string;
  status: string;
  url: string;
  detectedAt: string;
  lastChecked: string;
  websiteId: string;
};

type ReportRecord = {
  id: string;
  title: string;
  period: string;
  status: string;
  createdAt: string;
  url: string;
  websiteId: string;
};

type NotificationRecord = {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  read: boolean;
  websiteId: string;
};

type CompetitorRecord = {
  id: string;
  name: string;
  domain: string;
  status: string;
  websiteId: string;
};

type ServiceRecord = {
  id: string;
  name: string;
  description: string;
  status: string;
  startedAt: string;
};

type PortalData = {
  websites: WebsiteRecord[];
  keywords: KeywordRecord[];
  rankings: RankingRecord[];
  pages: PageRecord[];
  blogs: BlogRecord[];
  backlinks: BacklinkRecord[];
  technical: TechnicalRecord[];
  reports: ReportRecord[];
  notifications: NotificationRecord[];
  competitors: CompetitorRecord[];
};

/* =========================================================
   CONSTANTS
========================================================= */

const AUTH_SESSION_KEY = "hcs-auth-session";

const ADMIN_SETTINGS_EVENT = "hcs-admin-settings-updated";

const PORTAL_SYNC_EVENT = "hcs-admin-portal-data-updated";

const STORAGE_KEYS = {
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

  rankings: [
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

  notifications: [
    "hcs-admin-notifications-v5",
    "hcs-admin-notifications-v4",
  ],

  competitors: [
    "hcs-admin-competitors-v6",
    "hcs-admin-competitors-v5",
    "hcs-admin-competitors-v4",
  ],
};

/* =========================================================
   SIDEBAR
========================================================= */

const NAV_ITEMS: Array<{
  id: Section;
  label: string;
  icon: string;
  permission?: PermissionKey;
}> = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "⌂",
    permission: "dashboard",
  },
  {
    id: "websites",
    label: "My Websites",
    icon: "◉",
    permission: "websites",
  },
  {
    id: "keywords",
    label: "SEO & Keywords",
    icon: "#",
    permission: "keywords",
  },
  {
    id: "ranking",
    label: "Rankings",
    icon: "↗",
    permission: "ranking",
  },
  {
    id: "pages",
    label: "Pages",
    icon: "▤",
    permission: "pages",
  },
  {
    id: "blogs",
    label: "Blogs",
    icon: "✎",
    permission: "blogs",
  },
  {
    id: "backlinks",
    label: "Backlinks",
    icon: "↔",
    permission: "backlinks",
  },
  {
    id: "technical",
    label: "Technical SEO",
    icon: "⚙",
    permission: "technical",
  },
  {
    id: "reports",
    label: "Reports",
    icon: "▥",
    permission: "reports",
  },
  {
    id: "competitors",
    label: "Competitors",
    icon: "◎",
    permission: "competitors",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: "♢",
    permission: "notifications",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function stringValue(
  value: unknown,
  fallback = "",
): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();

  return text || fallback;
}

function numberValue(
  value: unknown,
  fallback = 0,
): number {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function booleanValue(
  value: unknown,
  fallback = false,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function recordArray(value: unknown): AnyRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is AnyRecord =>
      Boolean(item) &&
      typeof item === "object" &&
      !Array.isArray(item),
  );
}

function readStoredRecords(
  keys: string[],
): AnyRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);

      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        return recordArray(parsed);
      }

      if (
        parsed &&
        typeof parsed === "object"
      ) {
        const candidate =
          parsed.records ??
          parsed.data ??
          parsed.items ??
          parsed.websites ??
          parsed.keywords ??
          parsed.rankings ??
          parsed.pages ??
          parsed.blogs ??
          parsed.backlinks ??
          parsed.technical ??
          parsed.reports ??
          parsed.notifications ??
          parsed.competitors;

        const rows = recordArray(candidate);

        if (rows.length) {
          return rows;
        }
      }
    } catch {
      // Ignore unreadable local storage entries.
    }
  }

  return [];
}

function valueTokens(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function normalizeToken(
  value: unknown,
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function hostToken(
  value: unknown,
): string {
  const source = String(value ?? "").trim();

  if (!source) {
    return "";
  }

  try {
    const normalized =
      source.startsWith("http://") ||
      source.startsWith("https://")
        ? source
        : `https://${source}`;

    return new URL(normalized)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return source
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  }
}

function tokensFromFields(
  record: AnyRecord,
  fields: string[],
): string[] {
  const tokens: string[] = [];

  for (const field of fields) {
    const value = record[field];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      tokens.push(normalizeToken(value));
    }
  }

  return tokens.filter(Boolean);
}

function formatDate(
  value: string | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(
  value: string | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(
  name: string,
  company: string,
): string {
  const source =
    name.trim() ||
    company.trim() ||
    "Client";

  const parts = source
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    `${parts[0][0]}${parts[1][0]}`
  ).toUpperCase();
}

function parseSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(
        AUTH_SESSION_KEY,
      );

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(
      raw,
    ) as AuthSession;

    if (
      !parsed ||
      typeof parsed !== "object"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function findCurrentClient(
  session: AuthSession,
): ClientAccount | null {
  const settings =
    getGlobalAdminSettings();

  const clients =
    Array.isArray(settings.clients)
      ? settings.clients
      : [];

  const identifiers = [
    session.clientId,
    session.accountId,
    session.username,
    session.email,
    session.id,
  ]
    .filter(Boolean)
    .map(normalizeToken);

  if (!identifiers.length) {
    return null;
  }

  return (
    clients.find((client) => {
      const clientIdentifiers = [
        client.clientId,
        client.id,
        client.username,
        client.email,
      ]
        .filter(Boolean)
        .map(normalizeToken);

      return clientIdentifiers.some(
        (value) =>
          identifiers.includes(value),
      );
    }) ?? null
  );
}

/* =========================================================
   PERMISSION NORMALIZATION
========================================================= */

function permissionEnabled(
  client: ExtendedClientAccount | null,
  permission: PermissionKey,
): boolean {
  if (!client) {
    return false;
  }

  if (permission === "dashboard") {
    return (
      client.permissions?.dashboard !== false
    );
  }

  const permissions =
    client.permissions ?? {};

  const aliases: Record<
    PermissionKey,
    string[]
  > = {
    dashboard: ["dashboard"],
    websites: ["websites", "website"],
    keywords: [
      "keywords",
      "seo",
    ],
    ranking: [
      "ranking",
      "rankings",
    ],
    pages: ["pages"],
    blogs: ["blogs"],
    backlinks: ["backlinks"],
    technical: [
      "technical",
      "technicalSeo",
      "technicalSEO",
    ],
    reports: ["reports"],
    competitors: [
      "competitors",
      "competitor",
    ],
    notifications: [
      "notifications",
      "notification",
    ],
  };

  const keys = aliases[permission];

  return keys.some(
    (key) => permissions[key] === true,
  );
}

/* =========================================================
   WEBSITE ASSIGNMENT FILTER
========================================================= */

function recordBelongsToCurrentClient(
  record: AnyRecord,
  client: ExtendedClientAccount,
  assignedWebsiteIds: Set<string>,
  websiteTokens: Set<string>,
  websiteHosts: Set<string>,
): boolean {
  const recordClientTokens = [
    record.clientId,
    record.clientID,
    record.client_id,
    record.client,
    record.clientName,
    record.clientUsername,
    record.customerId,
    record.accountId,
  ]
    .map(normalizeToken)
    .filter(Boolean);

  const clientTokens = [
    client.clientId,
    client.id,
    client.username,
    client.email,
    client.companyName,
    client.name,
  ]
    .map(normalizeToken)
    .filter(Boolean);

  if (
    recordClientTokens.some(
      (token) =>
        clientTokens.includes(token),
    )
  ) {
    return true;
  }

  const websiteValues = [
    record.websiteId,
    record.websiteID,
    record.siteId,
    record.siteID,
    record.website,
    record.site,
    record.domain,
    record.url,
    record.targetUrl,
    record.websiteName,
    record.siteName,
  ];

  const recordWebsiteTokens =
    websiteValues
      .map(normalizeToken)
      .filter(Boolean);

  if (
    recordWebsiteTokens.some(
      (token) =>
        assignedWebsiteIds.has(token) ||
        websiteTokens.has(token),
    )
  ) {
    return true;
  }

  const recordHosts = [
    record.domain,
    record.url,
    record.website,
  ]
    .map(hostToken)
    .filter(Boolean);

  if (
    recordHosts.some((host) =>
      websiteHosts.has(host),
    )
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   LIVE PORTAL DATA
========================================================= */

function buildPortalData(
  client: ExtendedClientAccount,
): PortalData {
  const emptyData: PortalData = {
    websites: [],
    keywords: [],
    rankings: [],
    pages: [],
    blogs: [],
    backlinks: [],
    technical: [],
    reports: [],
    notifications: [],
    competitors: [],
  };

  if (typeof window === "undefined") {
    return emptyData;
  }

  const explicit =
    client.portalData &&
    typeof client.portalData === "object"
      ? client.portalData
      : {};

  /*
    Websites are primarily controlled by
    assignedWebsiteIds from Admin.
  */
  const websiteRows =
    readStoredRecords(
      STORAGE_KEYS.websites,
    );

  const assignedIds = new Set(
    valueTokens(
      client.assignedWebsiteIds,
    ).map(normalizeToken),
  );

  const assignedWebsites =
    websiteRows.filter((record) => {
      const recordId = normalizeToken(
        record.id ??
          record._id ??
          record.websiteId,
      );

      if (
        recordId &&
        assignedIds.has(recordId)
      ) {
        return true;
      }

      return recordBelongsToCurrentClient(
        record,
        client,
        assignedIds,
        new Set(),
        new Set(),
      );
    });

  /*
    Build website tokens from assigned sites.
  */
  const websiteTokens =
    new Set<string>();

  const websiteHosts =
    new Set<string>();

  for (
    const website of assignedWebsites
  ) {
    tokensFromFields(
      website,
      [
        "id",
        "_id",
        "name",
        "domain",
        "url",
        "website",
        "websiteName",
        "site",
        "siteName",
      ],
    ).forEach((token) =>
      websiteTokens.add(token),
    );

    [
      website.domain,
      website.url,
      website.website,
    ]
      .map(hostToken)
      .filter(Boolean)
      .forEach((host) =>
        websiteHosts.add(host),
      );
  }

  /*
    Client website field can also act as a
    direct website relationship.
  */
  if (client.website) {
    const clientWebsiteToken =
      normalizeToken(client.website);

    if (clientWebsiteToken) {
      websiteTokens.add(
        clientWebsiteToken,
      );
    }

    const clientHost =
      hostToken(client.website);

    if (clientHost) {
      websiteHosts.add(clientHost);
    }
  }

  const resolveModule = (
    moduleKey:
      | "keywords"
      | "rankings"
      | "pages"
      | "blogs"
      | "backlinks"
      | "technical"
      | "reports"
      | "notifications"
      | "competitors",
  ): AnyRecord[] => {
    const portalValue =
      explicit[moduleKey];

    const portalRows =
      recordArray(portalValue);

    const storedRows =
      readStoredRecords(
        STORAGE_KEYS[moduleKey],
      );

    const filtered =
      storedRows.filter((record) =>
        recordBelongsToCurrentClient(
          record,
          client,
          assignedIds,
          websiteTokens,
          websiteHosts,
        ),
      );

    /*
      Explicit portal data is already
      inside the current client record,
      therefore it is safe to include.
    */
    return [
      ...portalRows,
      ...filtered,
    ];
  };

  return {
    websites: assignedWebsites.map(
      normalizeWebsite,
    ),

    keywords: resolveModule(
      "keywords",
    ).map(normalizeKeyword),

    rankings: resolveModule(
      "rankings",
    ).map(normalizeRanking),

    pages: resolveModule(
      "pages",
    ).map(normalizePage),

    blogs: resolveModule(
      "blogs",
    ).map(normalizeBlog),

    backlinks: resolveModule(
      "backlinks",
    ).map(normalizeBacklink),

    technical: resolveModule(
      "technical",
    ).map(normalizeTechnical),

    reports: resolveModule(
      "reports",
    ).map(normalizeReport),

    notifications: resolveModule(
      "notifications",
    ).map(normalizeNotification),

    competitors: resolveModule(
      "competitors",
    ).map(normalizeCompetitor),
  };
}

/* =========================================================
   NORMALIZERS
========================================================= */

function normalizeWebsite(
  record: AnyRecord,
  index = 0,
): WebsiteRecord {
  return {
    id: stringValue(
      record.id ??
        record._id ??
        record.websiteId,
      `website-${index}`,
    ),

    name: stringValue(
      record.name ??
        record.title ??
        record.websiteName ??
        record.siteName,
      "",
    ),

    domain: stringValue(
      record.domain ??
        record.url ??
        record.website,
      "",
    ),

    status: stringValue(
      record.status,
      "Active",
    ),
  };
}

function normalizeKeyword(
  record: AnyRecord,
  index = 0,
): KeywordRecord {
  const currentRaw =
    record.currentRank ??
    record.rank ??
    record.position;

  const previousRaw =
    record.previousRank ??
    record.previousPosition;

  return {
    id: stringValue(
      record.id ??
        record._id,
      `keyword-${index}`,
    ),

    keyword: stringValue(
      record.keyword ??
        record.name ??
        record.title,
      "",
    ),

    currentRank:
      currentRaw === null ||
      currentRaw === undefined ||
      currentRaw === ""
        ? null
        : numberValue(
            currentRaw,
            0,
          ),

    previousRank:
      previousRaw === null ||
      previousRaw === undefined ||
      previousRaw === ""
        ? null
        : numberValue(
            previousRaw,
            0,
          ),

    targetUrl: stringValue(
      record.targetUrl ??
        record.url,
      "",
    ),

    volume:
      record.volume === null ||
      record.volume === undefined
        ? null
        : numberValue(
            record.volume,
            0,
          ),

    status: stringValue(
      record.status,
      "Tracked",
    ),

    websiteId: stringValue(
      record.websiteId ??
        record.siteId,
      "",
    ),
  };
}

function normalizeRanking(
  record: AnyRecord,
  index = 0,
): RankingRecord {
  return {
    id: stringValue(
      record.id ??
        record._id,
      `ranking-${index}`,
    ),

    keyword: stringValue(
      record.keyword ??
        record.name ??
        record.title,
      "",
    ),

    position:
      record.position === null ||
      record.position === undefined
        ? record.currentRank ===
            null ||
          record.currentRank === undefined
          ? null
          : numberValue(
              record.currentRank,
              0,
            )
        : numberValue(
            record.position,
            0,
          ),

    previousPosition:
      record.previousPosition ===
        null ||
      record.previousPosition ===
        undefined
        ? record.previousRank ===
            null ||
          record.previousRank === undefined
          ? null
          : numberValue(
              record.previousRank,
              0,
            )
        : numberValue(
            record.previousPosition,
            0,
          ),

    url: stringValue(
      record.url ??
        record.targetUrl,
      "",
    ),

    checkedAt: stringValue(
      record.checkedAt ??
        record.updatedAt ??
        record.lastChecked,
      "",
    ),

    websiteId: stringValue(
      record.websiteId ??
        record.siteId,
      "",
    ),
  };
}

function normalizePage(
  record: AnyRecord,
  index = 0,
): PageRecord {
  return {
    id: stringValue(
      record.id ??
        record._id,
      `page-${index}`,
    ),

    title: stringValue(
      record.title ??
        record.name,
      "",
    ),

    url: stringValue(
      record.url,
      "",
    ),

    seoStatus: stringValue(
      record.seoStatus ??
        record.status,
      "Not available",
    ),

    indexStatus: stringValue(
      record.indexStatus,
      "Not available",
    ),

    issues: numberValue(
      record.issues ??
        record.issueCount,
      0,
    ),

    updatedAt: stringValue(
      record.updatedAt ??
        record.lastUpdated,
      "",
    ),

    websiteId: stringValue(
      record.websiteId ??
        record.siteId,
      "",
    ),
  };
}

function normalizeBlog(
  record: AnyRecord,
  index = 0,
): BlogRecord {
  return {
    id: stringValue(
      record.id ??
        record._id,
      `blog-${index}`,
    ),

    title: stringValue(
      record.title ??
        record.name,
      "",
    ),

    status: stringValue(
      record.status,
      "Draft",
    ),

    author: stringValue(
      record.author,
      "",
    ),

    publishedAt: stringValue(
      record.publishedAt ??
        record.date,
      "",
    ),

    url: stringValue(
      record.url,
      "",
    ),

    updatedAt: stringValue(
      record.updatedAt,
      "",
    ),

    websiteId: stringValue(
      record.websiteId ??
        record.siteId,
      "",
    ),
  };
}

function normalizeBacklink(
  record: AnyRecord,
  index = 0,
): BacklinkRecord {
  return {
    id: stringValue(
      record.id ??
        record._id,
      `backlink-${index}`,
    ),

    source: stringValue(
      record.source ??
        record.sourceUrl,
      "",
    ),

    target: stringValue(
      record.target ??
        record.targetUrl,
      "",
    ),

    anchor: stringValue(
      record.anchor ??
        record.anchorText,
      "",
    ),

    status: stringValue(
      record.status,
      "Unknown",
    ),

    date: stringValue(
      record.date ??
        record.createdAt,
      "",
    ),

    websiteId: stringValue(
      record.websiteId ??
        record.siteId,
      "",
    ),
  };
}

function normalizeTechnical(
  record: AnyRecord,
  index = 0,
): TechnicalRecord {
  return {
    id: stringValue(
      record.id ??
        record._id,
      `technical-${index}`,
    ),

    issue: stringValue(
      record.issue ??
        record.title ??
        record.name,
      "",
    ),

    severity: stringValue(
      record.severity,
      "Normal",
    ),

    status: stringValue(
      record.status,
      "Open",
    ),

    url: stringValue(
      record.url,
      "",
    ),

    detectedAt: stringValue(
      record.detectedAt ??
        record.createdAt,
      "",
    ),

    lastChecked: stringValue(
      record.lastChecked ??
        record.updatedAt,
      "",
    ),

    websiteId: stringValue(
      record.websiteId ??
        record.siteId,
      "",
    ),
  };
}

function normalizeReport(
  record: AnyRecord,
  index = 0,
): ReportRecord {
  return {
    id: stringValue(
      record.id ??
        record._id,
      `report-${index}`,
    ),

    title: stringValue(
      record.title ??
        record.name,
      "",
    ),

    period: stringValue(
      record.period ??
        record.reportingPeriod,
      "",
    ),

    status: stringValue(
      record.status,
      "Available",
    ),

    createdAt: stringValue(
      record.createdAt ??
        record.generatedAt,
      "",
    ),

    url: stringValue(
      record.url ??
        record.href,
      "",
    ),

    websiteId: stringValue(
      record.websiteId ??
        record.siteId,
      "",
    ),
  };
}

function normalizeNotification(
  record: AnyRecord,
  index = 0,
): NotificationRecord {
  return {
    id: stringValue(
      record.id ??
        record._id,
      `notification-${index}`,
    ),

    title: stringValue(
      record.title ??
        record.name,
      "",
    ),

    message: stringValue(
      record.message ??
        record.description,
      "",
    ),

    type: stringValue(
      record.type,
      "Info",
    ),

    createdAt: stringValue(
      record.createdAt ??
        record.date ??
        record.time,
      "",
    ),

    read: booleanValue(
      record.read,
      false,
    ),

    websiteId: stringValue(
      record.websiteId ??
        record.siteId,
      "",
    ),
  };
}

function normalizeCompetitor(
  record: AnyRecord,
  index = 0,
): CompetitorRecord {
  return {
    id: stringValue(
      record.id ??
        record._id,
      `competitor-${index}`,
    ),

    name: stringValue(
      record.name ??
        record.title,
      "",
    ),

    domain: stringValue(
      record.domain ??
        record.url,
      "",
    ),

    status: stringValue(
      record.status,
      "Tracked",
    ),

    websiteId: stringValue(
      record.websiteId ??
        record.siteId,
      "",
    ),
  };
}

/* =========================================================
   SERVICE PARSER
========================================================= */

function getClientServices(
  client: ExtendedClientAccount | null,
): ServiceRecord[] {
  if (!client) {
    return [];
  }

  const raw = client as
    ExtendedClientAccount &
      Record<string, unknown>;

  const source =
    raw.services ??
    raw.assignedServices ??
    raw.serviceAccess ??
    raw.selectedServices;

  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((item, index) => {
      if (typeof item === "string") {
        const name = item.trim();

        if (!name) {
          return null;
        }

        return {
          id: `service-${index + 1}`,
          name,
          description: "",
          status: "Active",
          startedAt: "",
        };
      }

      if (
        !item ||
        typeof item !== "object"
      ) {
        return null;
      }

      const record =
        item as AnyRecord;

      const name = stringValue(
        record.name ??
          record.title ??
          record.serviceName,
      );

      if (!name) {
        return null;
      }

      return {
        id: stringValue(
          record.id ??
            record.serviceId,
          `service-${index + 1}`,
        ),

        name,

        description: stringValue(
          record.description,
        ),

        status: stringValue(
          record.status,
          "Active",
        ),

        startedAt: stringValue(
          record.startedAt ??
            record.startDate,
        ),
      };
    })
    .filter(
      (item): item is ServiceRecord =>
        Boolean(item),
    );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function ClientPage() {
  const router = useRouter();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    client,
    setClient,
  ] = useState<ExtendedClientAccount | null>(
    null,
  );

  const [
    portalData,
    setPortalData,
  ] = useState<PortalData>({
    websites: [],
    keywords: [],
    rankings: [],
    pages: [],
    blogs: [],
    backlinks: [],
    technical: [],
    reports: [],
    notifications: [],
    competitors: [],
  });

  const [
    section,
    setSection,
  ] = useState<Section>(
    "dashboard",
  );

  const [
    selectedWebsiteId,
    setSelectedWebsiteId,
  ] = useState("all");

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false);

  const [
    notificationOpen,
    setNotificationOpen,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    toast,
    setToast,
  ] = useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState("");

  const [
    passwordModalOpen,
    setPasswordModalOpen,
  ] = useState(false);

  const [
    passwordState,
    setPasswordState,
  ] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const [
    passwordError,
    setPasswordError,
  ] = useState("");

  const [
    savingPassword,
    setSavingPassword,
  ] = useState(false);

  /* =======================================================
     TOAST
  ======================================================== */

  const showToast = useCallback(
    (message: string) => {
      setToast(message);

      window.setTimeout(() => {
        setToast("");
      }, 2800);
    },
    [],
  );

  /* =======================================================
     LOGOUT
  ======================================================== */

  const logout = useCallback(() => {
    try {
      window.localStorage.removeItem(
        AUTH_SESSION_KEY,
      );
    } catch {
      // Ignore logout storage failure.
    }

    setClient(null);
    setPortalData({
      websites: [],
      keywords: [],
      rankings: [],
      pages: [],
      blogs: [],
      backlinks: [],
      technical: [],
      reports: [],
      notifications: [],
      competitors: [],
    });

    router.replace("/");
  }, [router]);

  /* =======================================================
     AUTH + DATA SYNC
  ======================================================== */

  const syncClient = useCallback(
    (showMessage = false) => {
      const session =
        parseSession();

      if (
        !session ||
        session.authenticated !== true ||
        session.role !== "client"
      ) {
        router.replace("/");
        return;
      }

      const currentClient =
        findCurrentClient(
          session,
        ) as ExtendedClientAccount | null;

      if (
        !currentClient ||
        currentClient.role !== "client" ||
        currentClient.status !== "Active" ||
        currentClient.active === false ||
        currentClient.clientPortalEnabled ===
          false
      ) {
        try {
          window.localStorage.removeItem(
            AUTH_SESSION_KEY,
          );
        } catch {
          // Ignore.
        }

        setClient(null);
        router.replace("/");
        return;
      }

      setClient(currentClient);

      setPortalData(
        buildPortalData(
          currentClient,
        ),
      );

      setLastUpdated(
        new Date().toISOString(),
      );

      if (showMessage) {
        showToast(
          "Latest HCS data loaded.",
        );
      }
    },
    [router, showToast],
  );

  useEffect(() => {
    syncClient(false);
    setLoading(false);
  }, [syncClient]);

  useEffect(() => {
    const handleAdminUpdate = () => {
      syncClient(true);
    };

    const handlePortalUpdate = () => {
      syncClient(true);
    };

    const handleStorage = (
      event: StorageEvent,
    ) => {
      if (
        !event.key ||
        event.key ===
          AUTH_SESSION_KEY ||
        event.key ===
          "hcs-admin-settings-v6"
      ) {
        syncClient(false);
        return;
      }

      const allKeys =
        Object.values(
          STORAGE_KEYS,
        ).flat();

      if (
        allKeys.includes(
          event.key,
        )
      ) {
        syncClient(false);
      }
    };

    window.addEventListener(
      ADMIN_SETTINGS_EVENT,
      handleAdminUpdate as EventListener,
    );

    window.addEventListener(
      PORTAL_SYNC_EVENT,
      handlePortalUpdate as EventListener,
    );

    window.addEventListener(
      "storage",
      handleStorage,
    );

    const interval =
      window.setInterval(() => {
        syncClient(false);
      }, 5000);

    return () => {
      window.removeEventListener(
        ADMIN_SETTINGS_EVENT,
        handleAdminUpdate as EventListener,
      );

      window.removeEventListener(
        PORTAL_SYNC_EVENT,
        handlePortalUpdate as EventListener,
      );

      window.removeEventListener(
        "storage",
        handleStorage,
      );

      window.clearInterval(
        interval,
      );
    };
  }, [syncClient]);

  /* =======================================================
     PERMISSIONS
  ======================================================== */

  const allowedSections =
    useMemo(() => {
      return NAV_ITEMS.filter(
        (item) =>
          !item.permission ||
          permissionEnabled(
            client,
            item.permission,
          ),
      );
    }, [client]);

  useEffect(() => {
    if (!client) {
      return;
    }

    if (
      section !== "profile" &&
      !permissionEnabled(
        client,
        section as PermissionKey,
      )
    ) {
      setSection(
        permissionEnabled(
          client,
          "dashboard",
        )
          ? "dashboard"
          : "profile",
      );
    }
  }, [client, section]);

  /* =======================================================
     WEBSITE FILTER
  ======================================================== */

  const websites =
    portalData.websites;

  const filteredWebsites =
    useMemo(() => {
      if (
        selectedWebsiteId ===
        "all"
      ) {
        return websites;
      }

      return websites.filter(
        (website) =>
          website.id ===
          selectedWebsiteId,
      );
    }, [
      websites,
      selectedWebsiteId,
    ]);

  const filterRowsByWebsite =
    useCallback(
      <T extends { websiteId: string }>(
        rows: T[],
      ) => {
        if (
          selectedWebsiteId ===
          "all"
        ) {
          return rows;
        }

        return rows.filter(
          (row) =>
            !row.websiteId ||
            row.websiteId ===
              selectedWebsiteId,
        );
      },
      [selectedWebsiteId],
    );

  const keywords =
    filterRowsByWebsite(
      portalData.keywords,
    );

  const rankings =
    filterRowsByWebsite(
      portalData.rankings,
    );

  const pages =
    filterRowsByWebsite(
      portalData.pages,
    );

  const blogs =
    filterRowsByWebsite(
      portalData.blogs,
    );

  const backlinks =
    filterRowsByWebsite(
      portalData.backlinks,
    );

  const technical =
    filterRowsByWebsite(
      portalData.technical,
    );

  const reports =
    filterRowsByWebsite(
      portalData.reports,
    );

  const notifications =
    filterRowsByWebsite(
      portalData.notifications,
    );

  const competitors =
    filterRowsByWebsite(
      portalData.competitors,
    );

  const services =
    useMemo(
      () =>
        getClientServices(
          client,
        ),
      [client],
    );

  /* =======================================================
     DASHBOARD METRICS
  ======================================================== */

  const unreadNotifications =
    notifications.filter(
      (item) => !item.read,
    ).length;

  const openTechnicalIssues =
    technical.filter(
      (item) =>
        ![
          "resolved",
          "closed",
        ].includes(
          item.status.toLowerCase(),
        ),
    ).length;

  const displayName =
    client?.name ||
    client?.companyName ||
    "Client";

  const displayCompany =
    client?.companyName ||
    "Client Portal";

  const displayInitials =
    initials(
      displayName,
      displayCompany,
    );

  /* =======================================================
     NAVIGATION
  ======================================================== */

  const navigate = (
    nextSection: Section,
  ) => {
    if (
      nextSection !==
      "profile"
    ) {
      const nav =
        NAV_ITEMS.find(
          (item) =>
            item.id ===
            nextSection,
        );

      if (
        nav?.permission &&
        !permissionEnabled(
          client,
          nav.permission,
        )
      ) {
        showToast(
          "This module is not enabled for your account.",
        );
        return;
      }
    }

    setSection(nextSection);
    setSidebarOpen(false);
    setProfileOpen(false);
    setNotificationOpen(false);
    setSearch("");
  };

  /* =======================================================
     PASSWORD CHANGE
  ======================================================== */

  const changePassword =
    () => {
      if (!client) {
        return;
      }

      setPasswordError("");

      if (
        !passwordState.current
      ) {
        setPasswordError(
          "Current password is required.",
        );
        return;
      }

      if (
        passwordState.current !==
        client.password
      ) {
        setPasswordError(
          "Current password is incorrect.",
        );
        return;
      }

      const security =
        getGlobalAdminSettings()
          .security ?? {};

      const minimum = Math.max(
        8,
        numberValue(
          security.minPasswordLength,
          8,
        ),
      );

      const requireUppercase =
        security.requireUppercase !==
        false;

      const requireNumber =
        security.requireNumber !==
        false;

      const requireSpecial =
        security.requireSpecialCharacter !==
        false;

      if (
        passwordState.next.length <
        minimum
      ) {
        setPasswordError(
          `New password must contain at least ${minimum} characters.`,
        );
        return;
      }

      if (
        passwordState.next.length >
        128
      ) {
        setPasswordError(
          "New password cannot exceed 128 characters.",
        );
        return;
      }

      if (
        passwordState.next ===
        client.password
      ) {
        setPasswordError(
          "New password must be different from the current password.",
        );
        return;
      }

      if (
        requireUppercase &&
        !/[A-Z]/.test(
          passwordState.next,
        )
      ) {
        setPasswordError(
          "New password must contain an uppercase letter.",
        );
        return;
      }

      if (
        requireNumber &&
        !/[0-9]/.test(
          passwordState.next,
        )
      ) {
        setPasswordError(
          "New password must contain a number.",
        );
        return;
      }

      if (
        requireSpecial &&
        !/[^A-Za-z0-9]/.test(
          passwordState.next,
        )
      ) {
        setPasswordError(
          "New password must contain a special character.",
        );
        return;
      }

      if (
        passwordState.next !==
        passwordState.confirm
      ) {
        setPasswordError(
          "New password and confirmation do not match.",
        );
        return;
      }

      setSavingPassword(true);

      try {
        const updatedClient = {
          ...client,
          password:
            passwordState.next,
          updatedAt:
            new Date().toISOString(),
        } as ClientAccount;

        saveClientAccount(
          updatedClient,
        );

        setClient(
          updatedClient as ExtendedClientAccount,
        );

        setPasswordState({
          current: "",
          next: "",
          confirm: "",
        });

        setPasswordModalOpen(
          false,
        );

        showToast(
          "Password updated successfully.",
        );
      } catch {
        setPasswordError(
          "Password could not be saved.",
        );
      } finally {
        setSavingPassword(false);
      }
    };

  /* =======================================================
     SEARCH
  ======================================================== */

  const normalizedSearch =
    search
      .trim()
      .toLowerCase();

  const filteredKeywords =
    normalizedSearch
      ? keywords.filter(
          (item) =>
            item.keyword
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            item.targetUrl
              .toLowerCase()
              .includes(
                normalizedSearch,
              ),
        )
      : keywords;

  const filteredWebsitesSearch =
    normalizedSearch
      ? filteredWebsites.filter(
          (item) =>
            item.name
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            item.domain
              .toLowerCase()
              .includes(
                normalizedSearch,
              ),
        )
      : filteredWebsites;

  const filteredPages =
    normalizedSearch
      ? pages.filter(
          (item) =>
            item.title
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            item.url
              .toLowerCase()
              .includes(
                normalizedSearch,
              ),
        )
      : pages;

  const filteredBlogs =
    normalizedSearch
      ? blogs.filter(
          (item) =>
            item.title
              .toLowerCase()
              .includes(
                normalizedSearch,
              ),
        )
      : blogs;

  const filteredBacklinks =
    normalizedSearch
      ? backlinks.filter(
          (item) =>
            item.source
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            item.target
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            item.anchor
              .toLowerCase()
              .includes(
                normalizedSearch,
              ),
        )
      : backlinks;

  const filteredTechnical =
    normalizedSearch
      ? technical.filter(
          (item) =>
            item.issue
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            item.url
              .toLowerCase()
              .includes(
                normalizedSearch,
              ),
        )
      : technical;

  /* =======================================================
     UI HELPERS
  ======================================================== */

  function statusClass(
    value: string,
  ) {
    return value
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function renderEmpty(
    title: string,
    message: string,
  ) {
    return (
      <div className="client-empty-state">
        <div className="client-empty-icon">
          ○
        </div>

        <h3>{title}</h3>

        <p>{message}</p>
      </div>
    );
  }

  /* =======================================================
     DASHBOARD
  ======================================================== */

  function renderDashboard() {
    const latestReports =
      [...reports]
        .sort(
          (a, b) =>
            Date.parse(
              b.createdAt || "",
            ) -
            Date.parse(
              a.createdAt || "",
            ),
        )
        .slice(0, 5);

    const latestNotifications =
      [...notifications]
        .sort(
          (a, b) =>
            Date.parse(
              b.createdAt || "",
            ) -
            Date.parse(
              a.createdAt || "",
            ),
        )
        .slice(0, 5);

    return (
      <div className="client-section">
        <div className="client-welcome">
          <div>
            <span className="client-eyebrow">
              CLIENT PORTAL
            </span>

            <h1>
              Welcome, {displayName}
            </h1>

            <p>
              {displayCompany}. This
              dashboard shows the data,
              websites and services
              currently assigned to your
              HCS account.
            </p>
          </div>

          <div className="client-live-badge">
            <span />
            ACTIVE
          </div>
        </div>

        {/* WEBSITE SELECTOR */}
        {permissionEnabled(
          client,
          "websites",
        ) &&
        websites.length > 0 ? (
          <div className="client-context-bar">
            <div>
              <span>
                CURRENT WEBSITE
              </span>

              <strong>
                {selectedWebsiteId ===
                "all"
                  ? "All assigned websites"
                  : websites.find(
                      (website) =>
                        website.id ===
                        selectedWebsiteId,
                    )?.name ||
                    "Assigned website"}
              </strong>
            </div>

            <select
              value={
                selectedWebsiteId
              }
              onChange={(event) =>
                setSelectedWebsiteId(
                  event.target.value,
                )
              }
            >
              <option value="all">
                All assigned websites
              </option>

              {websites.map(
                (website) => (
                  <option
                    key={website.id}
                    value={website.id}
                  >
                    {website.name ||
                      website.domain}
                  </option>
                ),
              )}
            </select>
          </div>
        ) : null}

        {/* METRICS */}
        <div className="client-stats-grid">
          <MetricCard
            label="Websites"
            value={
              websites.length
            }
            detail="Assigned websites"
            icon="◉"
          />

          <MetricCard
            label="Keywords"
            value={
              keywords.length
            }
            detail="Available keyword records"
            icon="#"
          />

          <MetricCard
            label="Ranking Records"
            value={
              rankings.length
            }
            detail="Available ranking data"
            icon="↗"
          />

          <MetricCard
            label="Open Issues"
            value={
              openTechnicalIssues
            }
            detail="Technical issues"
            icon="!"
          />
        </div>

        {/* SERVICES */}
        {services.length > 0 ? (
          <div className="client-content-card">
            <div className="client-card-header">
              <div>
                <span>
                  ASSIGNED SERVICES
                </span>

                <h2>
                  Your HCS Services
                </h2>
              </div>

              <span className="client-count-badge">
                {services.length}
              </span>
            </div>

            <div className="client-service-grid">
              {services.map(
                (service) => (
                  <div
                    key={service.id}
                    className="client-service-card"
                  >
                    <div className="client-service-mark">
                      ✓
                    </div>

                    <div>
                      <h3>
                        {service.name}
                      </h3>

                      {service.description ? (
                        <p>
                          {
                            service.description
                          }
                        </p>
                      ) : null}

                      <span
                        className={`client-status-badge ${statusClass(
                          service.status,
                        )}`}
                      >
                        {service.status}
                      </span>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        ) : null}

        {/* LOWER GRID */}
        <div className="client-dashboard-grid">
          <div className="client-content-card">
            <div className="client-card-header">
              <div>
                <span>
                  REPORTS
                </span>

                <h2>
                  Latest Reports
                </h2>
              </div>

              {permissionEnabled(
                client,
                "reports",
              ) ? (
                <button
                  type="button"
                  className="client-text-button"
                  onClick={() =>
                    navigate(
                      "reports",
                    )
                  }
                >
                  View all →
                </button>
              ) : null}
            </div>

            {latestReports.length ? (
              <div className="client-list">
                {latestReports.map(
                  (report) => (
                    <div
                      key={report.id}
                      className="client-list-row"
                    >
                      <div>
                        <strong>
                          {report.title}
                        </strong>

                        <span>
                          {report.period ||
                            formatDateOnly(
                              report.createdAt,
                            )}
                        </span>
                      </div>

                      <span
                        className={`client-status-badge ${statusClass(
                          report.status,
                        )}`}
                      >
                        {report.status}
                      </span>
                    </div>
                  ),
                )}
              </div>
            ) : (
              renderEmpty(
                "No reports available",
                "No report has been assigned or generated for this account.",
              )
            )}
          </div>

          <div className="client-content-card">
            <div className="client-card-header">
              <div>
                <span>
                  NOTIFICATIONS
                </span>

                <h2>
                  Latest Updates
                </h2>
              </div>

              {unreadNotifications >
              0 ? (
                <span className="client-count-badge">
                  {unreadNotifications}
                </span>
              ) : null}
            </div>

            {latestNotifications.length ? (
              <div className="client-list">
                {latestNotifications.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="client-list-row client-notification-row"
                    >
                      <div>
                        <strong>
                          {item.title}
                        </strong>

                        <span>
                          {item.message}
                        </span>

                        <small>
                          {formatDate(
                            item.createdAt,
                          )}
                        </small>
                      </div>

                      {!item.read ? (
                        <span className="client-unread-dot" />
                      ) : null}
                    </div>
                  ),
                )}
              </div>
            ) : (
              renderEmpty(
                "No notifications",
                "There are currently no client-facing notifications.",
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     WEBSITES
  ======================================================== */

  function renderWebsites() {
    if (
      !permissionEnabled(
        client,
        "websites",
      )
    ) {
      return renderEmpty(
        "Access unavailable",
        "Website access has not been enabled for this account.",
      );
    }

    return (
      <div className="client-section">
        <SectionHeader
          eyebrow="WEBSITES"
          title="My Websites"
          description="Websites currently assigned to your HCS client account."
        />

        <div className="client-toolbar">
          <div className="client-search">
            <span>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search websites..."
            />
          </div>

          <span className="client-toolbar-count">
            {filteredWebsitesSearch.length} assigned
          </span>
        </div>

        {filteredWebsitesSearch.length ? (
          <div className="client-website-grid">
            {filteredWebsitesSearch.map(
              (website) => (
                <button
                  key={website.id}
                  type="button"
                  className={`client-website-card ${
                    selectedWebsiteId ===
                    website.id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedWebsiteId(
                      website.id,
                    );
                    navigate(
                      "dashboard",
                    );
                  }}
                >
                  <div className="client-website-card-top">
                    <span className="client-website-icon">
                      ◉
                    </span>

                    <span
                      className={`client-status-badge ${statusClass(
                        website.status,
                      )}`}
                    >
                      {website.status}
                    </span>
                  </div>

                  <h3>
                    {website.name ||
                      website.domain ||
                      "Assigned website"}
                  </h3>

                  <p>
                    {website.domain ||
                      "Domain not available"}
                  </p>

                  <span className="client-card-arrow">
                    Open website context →
                  </span>
                </button>
              ),
            )}
          </div>
        ) : (
          renderEmpty(
            "No websites assigned",
            "HCS Admin has not assigned a website to this client account.",
          )
        )}
      </div>
    );
  }

  /* =======================================================
     KEYWORDS
  ======================================================== */

  function renderKeywords() {
    if (
      !permissionEnabled(
        client,
        "keywords",
      )
    ) {
      return renderEmpty(
        "SEO access unavailable",
        "SEO and keyword access has not been enabled for this account.",
      );
    }

    return (
      <div className="client-section">
        <SectionHeader
          eyebrow="SEO"
          title="SEO & Keywords"
          description="Keyword records available for your assigned websites."
        />

        <div className="client-toolbar">
          <div className="client-search">
            <span>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search keywords or URLs..."
            />
          </div>

          <span className="client-toolbar-count">
            {filteredKeywords.length} records
          </span>
        </div>

        {filteredKeywords.length ? (
          <div className="client-table-wrap">
            <table className="client-table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Current</th>
                  <th>Previous</th>
                  <th>Target URL</th>
                  <th>Volume</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredKeywords.map(
                  (item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>
                          {item.keyword ||
                            "Unnamed keyword"}
                        </strong>
                      </td>

                      <td>
                        {item.currentRank ??
                          "—"}
                      </td>

                      <td>
                        {item.previousRank ??
                          "—"}
                      </td>

                      <td>
                        <span className="client-cell-secondary">
                          {item.targetUrl ||
                            "—"}
                        </span>
                      </td>

                      <td>
                        {item.volume ??
                          "—"}
                      </td>

                      <td>
                        <span
                          className={`client-status-badge ${statusClass(
                            item.status,
                          )}`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          renderEmpty(
            "No keyword data available",
            "There are no keyword records assigned to the selected website or client account.",
          )
        )}
      </div>
    );
  }

  /* =======================================================
     RANKINGS
  ======================================================== */

  function renderRankings() {
    if (
      !permissionEnabled(
        client,
        "ranking",
      )
    ) {
      return renderEmpty(
        "Ranking access unavailable",
        "Ranking access has not been enabled for this account.",
      );
    }

    return (
      <div className="client-section">
        <SectionHeader
          eyebrow="RANK TRACKING"
          title="Rankings"
          description="Current ranking records available to your account."
        />

        <div className="client-toolbar">
          <div className="client-search">
            <span>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search ranking records..."
            />
          </div>

          <span className="client-toolbar-count">
            {rankings.length} records
          </span>
        </div>

        {rankings.length ? (
          <div className="client-table-wrap">
            <table className="client-table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Current</th>
                  <th>Previous</th>
                  <th>Target URL</th>
                  <th>Checked</th>
                </tr>
              </thead>

              <tbody>
                {rankings
                  .filter((item) =>
                    normalizedSearch
                      ? item.keyword
                          .toLowerCase()
                          .includes(
                            normalizedSearch,
                          ) ||
                        item.url
                          .toLowerCase()
                          .includes(
                            normalizedSearch,
                          )
                      : true,
                  )
                  .map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>
                          {item.keyword ||
                            "Unnamed keyword"}
                        </strong>
                      </td>

                      <td>
                        {item.position ??
                          "—"}
                      </td>

                      <td>
                        {item.previousPosition ??
                          "—"}
                      </td>

                      <td>
                        <span className="client-cell-secondary">
                          {item.url ||
                            "—"}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          item.checkedAt,
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          renderEmpty(
            "No ranking data available",
            "No ranking records are currently available for your account.",
          )
        )}
      </div>
    );
  }

  /* =======================================================
     PAGES
  ======================================================== */

  function renderPages() {
    if (
      !permissionEnabled(
        client,
        "pages",
      )
    ) {
      return renderEmpty(
        "Page access unavailable",
        "Page access has not been enabled for this account.",
      );
    }

    return (
      <div className="client-section">
        <SectionHeader
          eyebrow="SEO PAGES"
          title="Pages"
          description="Assigned website pages and their available SEO information."
        />

        <div className="client-toolbar">
          <div className="client-search">
            <span>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search pages..."
            />
          </div>

          <span className="client-toolbar-count">
            {filteredPages.length} pages
          </span>
        </div>

        {filteredPages.length ? (
          <div className="client-table-wrap">
            <table className="client-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>URL</th>
                  <th>SEO</th>
                  <th>Index</th>
                  <th>Issues</th>
                  <th>Updated</th>
                </tr>
              </thead>

              <tbody>
                {filteredPages.map(
                  (item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>
                          {item.title ||
                            "Untitled page"}
                        </strong>
                      </td>

                      <td>
                        <span className="client-cell-secondary">
                          {item.url ||
                            "—"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`client-status-badge ${statusClass(
                            item.seoStatus,
                          )}`}
                        >
                          {item.seoStatus}
                        </span>
                      </td>

                      <td>
                        {item.indexStatus ||
                          "—"}
                      </td>

                      <td>
                        {item.issues}
                      </td>

                      <td>
                        {formatDate(
                          item.updatedAt,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          renderEmpty(
            "No page data available",
            "There are no website pages currently available to this account.",
          )
        )}
      </div>
    );
  }

  /* =======================================================
     BLOGS
  ======================================================== */

  function renderBlogs() {
    if (
      !permissionEnabled(
        client,
        "blogs",
      )
    ) {
      return renderEmpty(
        "Blog access unavailable",
        "Blog access has not been enabled for this account.",
      );
    }

    return (
      <div className="client-section">
        <SectionHeader
          eyebrow="CONTENT"
          title="Blogs"
          description="Blog content and publication information available to your client account."
        />

        <div className="client-toolbar">
          <div className="client-search">
            <span>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search blogs..."
            />
          </div>

          <span className="client-toolbar-count">
            {filteredBlogs.length} records
          </span>
        </div>

        {filteredBlogs.length ? (
          <div className="client-article-grid">
            {filteredBlogs.map(
              (blog) => (
                <article
                  key={blog.id}
                  className="client-article-card"
                >
                  <div className="client-article-top">
                    <span>
                      BLOG
                    </span>

                    <span
                      className={`client-status-badge ${statusClass(
                        blog.status,
                      )}`}
                    >
                      {blog.status}
                    </span>
                  </div>

                  <h3>
                    {blog.title ||
                      "Untitled blog"}
                  </h3>

                  <p>
                    {blog.author
                      ? `Author: ${blog.author}`
                      : "Author information not available."}
                  </p>

                  <div className="client-article-meta">
                    <span>
                      {formatDateOnly(
                        blog.publishedAt,
                      )}
                    </span>

                    <span>
                      {formatDate(
                        blog.updatedAt,
                      )}
                    </span>
                  </div>

                  {blog.url ? (
                    <a
                      href={blog.url}
                      target="_blank"
                      rel="noreferrer"
                      className="client-outline-button"
                    >
                      Open Article →
                    </a>
                  ) : null}
                </article>
              ),
            )}
          </div>
        ) : (
          renderEmpty(
            "No blog data available",
            "There are no blog records currently assigned to this account.",
          )
        )}
      </div>
    );
  }

  /* =======================================================
     BACKLINKS
  ======================================================== */

  function renderBacklinks() {
    if (
      !permissionEnabled(
        client,
        "backlinks",
      )
    ) {
      return renderEmpty(
        "Backlink access unavailable",
        "Backlink access has not been enabled for this account.",
      );
    }

    return (
      <div className="client-section">
        <SectionHeader
          eyebrow="OFF-PAGE SEO"
          title="Backlinks"
          description="Backlink records available for your assigned websites."
        />

        <div className="client-toolbar">
          <div className="client-search">
            <span>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search backlinks..."
            />
          </div>

          <span className="client-toolbar-count">
            {filteredBacklinks.length} records
          </span>
        </div>

        {filteredBacklinks.length ? (
          <div className="client-table-wrap">
            <table className="client-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Target</th>
                  <th>Anchor</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {filteredBacklinks.map(
                  (item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="client-cell-secondary">
                          {item.source ||
                            "—"}
                        </span>
                      </td>

                      <td>
                        <span className="client-cell-secondary">
                          {item.target ||
                            "—"}
                        </span>
                      </td>

                      <td>
                        {item.anchor ||
                          "—"}
                      </td>

                      <td>
                        <span
                          className={`client-status-badge ${statusClass(
                            item.status,
                          )}`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td>
                        {formatDateOnly(
                          item.date,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          renderEmpty(
            "No backlink data available",
            "There are currently no backlink records available for this account.",
          )
        )}
      </div>
    );
  }

  /* =======================================================
     TECHNICAL
  ======================================================== */

  function renderTechnical() {
    if (
      !permissionEnabled(
        client,
        "technical",
      )
    ) {
      return renderEmpty(
        "Technical SEO unavailable",
        "Technical SEO access has not been enabled for this account.",
      );
    }

    return (
      <div className="client-section">
        <SectionHeader
          eyebrow="TECHNICAL SEO"
          title="Technical Issues"
          description="Technical SEO issues and their current status."
        />

        <div className="client-toolbar">
          <div className="client-search">
            <span>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search technical issues..."
            />
          </div>

          <span className="client-toolbar-count">
            {filteredTechnical.length} issues
          </span>
        </div>

        {filteredTechnical.length ? (
          <div className="client-issue-grid">
            {filteredTechnical.map(
              (item) => (
                <article
                  key={item.id}
                  className="client-issue-card"
                >
                  <div className="client-issue-top">
                    <span
                      className={`client-status-badge ${statusClass(
                        item.severity,
                      )}`}
                    >
                      {item.severity}
                    </span>

                    <span
                      className={`client-status-badge ${statusClass(
                        item.status,
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <h3>
                    {item.issue ||
                      "Technical issue"}
                  </h3>

                  <p>
                    {item.url ||
                      "Affected URL not available"}
                  </p>

                  <div className="client-issue-meta">
                    <span>
                      Detected:{" "}
                      {formatDate(
                        item.detectedAt,
                      )}
                    </span>

                    <span>
                      Checked:{" "}
                      {formatDate(
                        item.lastChecked,
                      )}
                    </span>
                  </div>
                </article>
              ),
            )}
          </div>
        ) : (
          renderEmpty(
            "No technical issues available",
            "There are currently no technical SEO records available for this account.",
          )
        )}
      </div>
    );
  }

  /* =======================================================
     REPORTS
  ======================================================== */

  function renderReports() {
    if (
      !permissionEnabled(
        client,
        "reports",
      )
    ) {
      return renderEmpty(
        "Report access unavailable",
        "Report access has not been enabled for this account.",
      );
    }

    return (
      <div className="client-section">
        <SectionHeader
          eyebrow="REPORTING"
          title="Reports"
          description="Reports made available to your client account."
        />

        {reports.length ? (
          <div className="client-report-grid">
            {reports.map(
              (report) => (
                <article
                  key={report.id}
                  className="client-report-card"
                >
                  <div className="client-report-icon">
                    ▥
                  </div>

                  <div className="client-report-content">
                    <span>
                      {report.period ||
                        "Reporting period unavailable"}
                    </span>

                    <h3>
                      {report.title ||
                        "Untitled report"}
                    </h3>

                    <p>
                      {formatDate(
                        report.createdAt,
                      )}
                    </p>
                  </div>

                  <div className="client-report-actions">
                    <span
                      className={`client-status-badge ${statusClass(
                        report.status,
                      )}`}
                    >
                      {report.status}
                    </span>

                    {report.url ? (
                      <a
                        href={report.url}
                        target="_blank"
                        rel="noreferrer"
                        className="client-outline-button"
                      >
                        View Report →
                      </a>
                    ) : null}
                  </div>
                </article>
              ),
            )}
          </div>
        ) : (
          renderEmpty(
            "No reports available",
            "HCS Admin has not assigned or generated a report for this account.",
          )
        )}
      </div>
    );
  }

  /* =======================================================
     COMPETITORS
  ======================================================== */

  function renderCompetitors() {
    if (
      !permissionEnabled(
        client,
        "competitors",
      )
    ) {
      return renderEmpty(
        "Competitor access unavailable",
        "Competitor access has not been enabled for this account.",
      );
    }

    return (
      <div className="client-section">
        <SectionHeader
          eyebrow="COMPETITIVE VIEW"
          title="Competitors"
          description="Competitor records currently available for your assigned websites."
        />

        {competitors.length ? (
          <div className="client-website-grid">
            {competitors.map(
              (competitor) => (
                <article
                  key={competitor.id}
                  className="client-website-card static"
                >
                  <div className="client-website-card-top">
                    <span className="client-website-icon">
                      ◎
                    </span>

                    <span
                      className={`client-status-badge ${statusClass(
                        competitor.status,
                      )}`}
                    >
                      {competitor.status}
                    </span>
                  </div>

                  <h3>
                    {competitor.name ||
                      "Unnamed competitor"}
                  </h3>

                  <p>
                    {competitor.domain ||
                      "Domain not available"}
                  </p>
                </article>
              ),
            )}
          </div>
        ) : (
          renderEmpty(
            "No competitor data available",
            "No competitor records are currently available for this account.",
          )
        )}
      </div>
    );
  }

  /* =======================================================
     NOTIFICATIONS
  ======================================================== */

  function renderNotifications() {
    if (
      !permissionEnabled(
        client,
        "notifications",
      )
    ) {
      return renderEmpty(
        "Notification access unavailable",
        "Notifications have not been enabled for this account.",
      );
    }

    return (
      <div className="client-section">
        <SectionHeader
          eyebrow="UPDATES"
          title="Notifications"
          description="Client-facing updates and alerts from HCS."
        />

        {notifications.length ? (
          <div className="client-notification-list">
            {notifications.map(
              (item) => (
                <article
                  key={item.id}
                  className={`client-notification-card ${
                    item.read
                      ? ""
                      : "unread"
                  }`}
                >
                  <div className="client-notification-icon">
                    {item.type ===
                    "Alert"
                      ? "!"
                      : item.type ===
                        "Warning"
                        ? "!"
                        : item.type ===
                          "Success"
                          ? "✓"
                          : "i"}
                  </div>

                  <div className="client-notification-content">
                    <div className="client-notification-head">
                      <h3>
                        {item.title ||
                          "Notification"}
                      </h3>

                      {!item.read ? (
                        <span className="client-unread-label">
                          NEW
                        </span>
                      ) : null}
                    </div>

                    <p>
                      {item.message ||
                        "No additional details available."}
                    </p>

                    <span>
                      {formatDate(
                        item.createdAt,
                      )}
                    </span>
                  </div>
                </article>
              ),
            )}
          </div>
        ) : (
          renderEmpty(
            "No notifications",
            "There are currently no client-facing notifications.",
          )
        )}
      </div>
    );
  }

  /* =======================================================
     PROFILE
  ======================================================== */

  function renderProfile() {
    if (!client) {
      return null;
    }

    return (
      <div className="client-section">
        <SectionHeader
          eyebrow="ACCOUNT"
          title="Profile & Access"
          description="Your current client account information and security controls."
        />

        <div className="client-profile-grid">
          <div className="client-content-card">
            <div className="client-profile-header">
              <div className="client-avatar large">
                {displayInitials}
              </div>

              <div>
                <span>
                  CLIENT ACCOUNT
                </span>

                <h2>
                  {displayName}
                </h2>

                <p>
                  {displayCompany}
                </p>
              </div>
            </div>

            <div className="client-detail-grid">
              <DetailItem
                label="Client ID"
                value={client.clientId}
              />

              <DetailItem
                label="Username"
                value={client.username}
              />

              <DetailItem
                label="Email"
                value={client.email}
              />

              <DetailItem
                label="Phone"
                value={
                  client.phone ||
                  "Not available"
                }
              />

              <DetailItem
                label="Plan"
                value={
                  client.plan ||
                  "Not specified"
                }
              />

              <DetailItem
                label="Account Status"
                value={client.status}
              />

              <DetailItem
                label="Created"
                value={formatDate(
                  client.createdAt,
                )}
              />

              <DetailItem
                label="Last Login"
                value={formatDate(
                  client.lastLogin,
                )}
              />
            </div>
          </div>

          <div className="client-content-card">
            <div className="client-card-header">
              <div>
                <span>
                  SECURITY
                </span>

                <h2>
                  Password
                </h2>
              </div>
            </div>

            <p className="client-muted-text">
              Change your client portal password
              according to the current HCS security
              policy.
            </p>

            <button
              type="button"
              className="client-primary-button"
              onClick={() => {
                setPasswordError("");
                setPasswordState({
                  current: "",
                  next: "",
                  confirm: "",
                });
                setPasswordModalOpen(
                  true,
                );
              }}
            >
              Change Password →
            </button>
          </div>

          <div className="client-content-card">
            <div className="client-card-header">
              <div>
                <span>
                  ACCESS
                </span>

                <h2>
                  Enabled Modules
                </h2>
              </div>
            </div>

            <div className="client-access-grid">
              {NAV_ITEMS.filter(
                (item) =>
                  item.permission,
              ).map((item) => {
                const enabled =
                  item.permission
                    ? permissionEnabled(
                        client,
                        item.permission,
                      )
                    : false;

                return (
                  <div
                    key={item.id}
                    className={`client-access-item ${
                      enabled
                        ? "enabled"
                        : "disabled"
                    }`}
                  >
                    <span>
                      {item.icon}
                    </span>

                    <strong>
                      {item.label}
                    </strong>

                    <small>
                      {enabled
                        ? "Enabled"
                        : "Not enabled"}
                    </small>
                  </div>
                );
              })}
            </div>
          </div>

          {services.length > 0 ? (
            <div className="client-content-card">
              <div className="client-card-header">
                <div>
                  <span>
                    SERVICES
                  </span>

                  <h2>
                    Assigned Services
                  </h2>
                </div>
              </div>

              <div className="client-list">
                {services.map(
                  (service) => (
                    <div
                      key={service.id}
                      className="client-list-row"
                    >
                      <div>
                        <strong>
                          {service.name}
                        </strong>

                        <span>
                          {service.description ||
                            "Service assigned by HCS Admin"}
                        </span>
                      </div>

                      <span
                        className={`client-status-badge ${statusClass(
                          service.status,
                        )}`}
                      >
                        {service.status}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  /* =======================================================
     SECTION SWITCH
  ======================================================== */

  function renderCurrentSection() {
    switch (section) {
      case "websites":
        return renderWebsites();

      case "keywords":
        return renderKeywords();

      case "ranking":
        return renderRankings();

      case "pages":
        return renderPages();

      case "blogs":
        return renderBlogs();

      case "backlinks":
        return renderBacklinks();

      case "technical":
        return renderTechnical();

      case "reports":
        return renderReports();

      case "competitors":
        return renderCompetitors();

      case "notifications":
        return renderNotifications();

      case "profile":
        return renderProfile();

      case "dashboard":
      default:
        return renderDashboard();
    }
  }

  /* =======================================================
     LOADING
  ======================================================== */

  if (loading) {
    return (
      <div className="client-loading-screen">
        <div className="client-loading-card">
          <Image
            src="/images/logo.png"
            alt="Hind Consultancy Services"
            width={190}
            height={58}
            priority
          />

          <div className="client-loading-spinner" />

          <p>
            Verifying secure client
            session…
          </p>
        </div>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  /* =======================================================
     MAIN UI
  ======================================================== */

  return (
    <div className="client-portal">
      {/* ================================================
          MOBILE OVERLAY
      ================================================= */}
      {sidebarOpen ? (
        <button
          type="button"
          className="client-sidebar-overlay"
          aria-label="Close navigation"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      ) : null}

      {/* ================================================
          SIDEBAR
      ================================================= */}
      <aside
        className={`client-sidebar ${
          sidebarOpen
            ? "open"
            : ""
        }`}
      >
        <div className="client-sidebar-brand">
          <Image
            src="/images/logo.png"
            alt="Hind Consultancy Services"
            width={175}
            height={54}
            priority
          />

          <span>
            CLIENT PORTAL
          </span>
        </div>

        <div className="client-sidebar-client">
          <div className="client-avatar">
            {displayInitials}
          </div>

          <div>
            <strong>
              {displayName}
            </strong>

            <span>
              {client.clientId}
            </span>
          </div>
        </div>

        <nav className="client-sidebar-nav">
          <div className="client-nav-label">
            PORTAL
          </div>

          {allowedSections.map(
            (item) => (
              <button
                key={item.id}
                type="button"
                className={`client-nav-item ${
                  section ===
                  item.id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  navigate(item.id)
                }
              >
                <span className="client-nav-icon">
                  {item.icon}
                </span>

                <span>
                  {item.label}
                </span>
              </button>
            ),
          )}

          <div className="client-nav-label account">
            ACCOUNT
          </div>

          <button
            type="button"
            className={`client-nav-item ${
              section === "profile"
                ? "active"
                : ""
            }`}
            onClick={() =>
              navigate("profile")
            }
          >
            <span className="client-nav-icon">
              ◌
            </span>

            <span>
              Profile & Security
            </span>
          </button>
        </nav>

        <div className="client-sidebar-footer">
          <button
            type="button"
            className="client-logout-button"
            onClick={logout}
          >
            <span>↪</span>
            Sign out
          </button>

          <small>
            HCS Client Portal
          </small>
        </div>
      </aside>

      {/* ================================================
          MAIN
      ================================================= */}
      <main className="client-main">
        {/* HEADER */}
        <header className="client-topbar">
          <div className="client-topbar-left">
            <button
              type="button"
              className="client-mobile-menu"
              aria-label="Open navigation"
              onClick={() =>
                setSidebarOpen(true)
              }
            >
              ☰
            </button>

            <div>
              <div className="client-breadcrumb">
                HCS PORTAL
                <span>/</span>
                {
                  NAV_ITEMS.find(
                    (item) =>
                      item.id ===
                      section,
                  )?.label
                }
              </div>

              <h1>
                {section ===
                "profile"
                  ? "Profile & Security"
                  : NAV_ITEMS.find(
                      (item) =>
                        item.id ===
                        section,
                    )?.label ||
                    "Dashboard"}
              </h1>
            </div>
          </div>

          <div className="client-topbar-actions">
            <button
              type="button"
              className="client-refresh-button"
              onClick={() =>
                syncClient(true)
              }
            >
              ↻
              <span>
                Refresh
              </span>
            </button>

            <button
              type="button"
              className="client-notification-button"
              onClick={() => {
                setNotificationOpen(
                  (current) =>
                    !current,
                );
                setProfileOpen(false);
              }}
            >
              ♢

              {unreadNotifications >
              0 ? (
                <b>
                  {unreadNotifications}
                </b>
              ) : null}
            </button>

            <button
              type="button"
              className="client-profile-button"
              onClick={() => {
                setProfileOpen(
                  (current) =>
                    !current,
                );
                setNotificationOpen(
                  false,
                );
              }}
            >
              <span className="client-avatar small">
                {displayInitials}
              </span>

              <span>
                <strong>
                  {displayName}
                </strong>

                <small>
                  {client.clientId}
                </small>
              </span>

              <em>
                ▾
              </em>
            </button>
          </div>

          {/* PROFILE DROPDOWN */}
          {profileOpen ? (
            <div className="client-dropdown client-profile-dropdown">
              <div className="client-dropdown-header">
                <strong>
                  {displayName}
                </strong>

                <span>
                  {client.email}
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "profile",
                  )
                }
              >
                ◌ Profile & Security
              </button>

              <button
                type="button"
                onClick={() =>
                  setPasswordModalOpen(
                    true,
                  )
                }
              >
                ••• Change Password
              </button>

              <button
                type="button"
                className="danger"
                onClick={logout}
              >
                ↪ Sign out
              </button>
            </div>
          ) : null}

          {/* NOTIFICATION DROPDOWN */}
          {notificationOpen ? (
            <div className="client-dropdown client-notification-dropdown">
              <div className="client-dropdown-header">
                <strong>
                  Notifications
                </strong>

                <span>
                  {unreadNotifications} unread
                </span>
              </div>

              {notifications.length ? (
                notifications
                  .slice(0, 6)
                  .map(
                    (item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={`client-notification-dropdown-item ${
                          item.read
                            ? ""
                            : "unread"
                        }`}
                        onClick={() =>
                          navigate(
                            "notifications",
                          )
                        }
                      >
                        <strong>
                          {item.title}
                        </strong>

                        <span>
                          {item.message}
                        </span>
                      </button>
                    ),
                  )
              ) : (
                <div className="client-dropdown-empty">
                  No notifications available.
                </div>
              )}
            </div>
          ) : null}
        </header>

        {/* CONTENT */}
        <div className="client-content">
          {renderCurrentSection()}
        </div>

        {/* FOOTER */}
        <footer className="client-footer">
          <span>
            ©{" "}
            {new Date().getFullYear()}{" "}
            Hind Consultancy Services
          </span>

          <span>
            Last synced:{" "}
            {lastUpdated
              ? formatDate(
                  lastUpdated,
                )
              : "—"}
          </span>
        </footer>
      </main>

      {/* =================================================
          PASSWORD MODAL
      ================================================== */}
      {passwordModalOpen ? (
        <div className="client-modal-overlay">
          <div
            className="client-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="client-modal-header">
              <div>
                <span>
                  ACCOUNT SECURITY
                </span>

                <h2>
                  Change Password
                </h2>
              </div>

              <button
                type="button"
                className="client-modal-close"
                onClick={() =>
                  setPasswordModalOpen(
                    false,
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="client-modal-body">
              <label className="client-form-field">
                <span>
                  Current Password
                </span>

                <input
                  type="password"
                  value={
                    passwordState.current
                  }
                  onChange={(event) =>
                    setPasswordState(
                      (current) => ({
                        ...current,
                        current:
                          event.target
                            .value,
                      }),
                    )
                  }
                  autoComplete="current-password"
                />
              </label>

              <label className="client-form-field">
                <span>
                  New Password
                </span>

                <input
                  type="password"
                  value={
                    passwordState.next
                  }
                  onChange={(event) =>
                    setPasswordState(
                      (current) => ({
                        ...current,
                        next:
                          event.target
                            .value,
                      }),
                    )
                  }
                  autoComplete="new-password"
                />
              </label>

              <label className="client-form-field">
                <span>
                  Confirm New Password
                </span>

                <input
                  type="password"
                  value={
                    passwordState.confirm
                  }
                  onChange={(event) =>
                    setPasswordState(
                      (current) => ({
                        ...current,
                        confirm:
                          event.target
                            .value,
                      }),
                    )
                  }
                  autoComplete="new-password"
                />
              </label>

              {passwordError ? (
                <div className="client-form-error">
                  {passwordError}
                </div>
              ) : null}

              <div className="client-password-help">
                Password requirements are
                inherited from HCS Admin Security
                Settings.
              </div>
            </div>

            <div className="client-modal-footer">
              <button
                type="button"
                className="client-secondary-button"
                onClick={() =>
                  setPasswordModalOpen(
                    false,
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="client-primary-button"
                onClick={
                  changePassword
                }
                disabled={
                  savingPassword
                }
              >
                {savingPassword
                  ? "Saving..."
                  : "Save Password"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* =================================================
          TOAST
      ================================================== */}
      {toast ? (
        <div className="client-toast">
          <span>
            ✓
          </span>

          {toast}
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: string;
}) {
  return (
    <div className="client-metric-card">
      <div className="client-metric-top">
        <span>
          {label}
        </span>

        <strong>
          {icon}
        </strong>
      </div>

      <div className="client-metric-value">
        {value}
      </div>

      <p>
        {detail}
      </p>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="client-section-header">
      <div>
        <span>
          {eyebrow}
        </span>

        <h1>
          {title}
        </h1>

        <p>
          {description}
        </p>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="client-detail-item">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

/* =========================================================
   REPAIR NOTES
   ---------------------------------------------------------
   Existing client/admin data flow, localStorage keys, permissions,
   assigned website filtering, sections, and component structure
   are intentionally preserved.
========================================================= */
