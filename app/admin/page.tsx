"use client";

import Image from "next/image";
import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getGlobalAdminSettings,
  saveGlobalAdminSettings,
  type ClientAccount,
  type GlobalAdminSettings,
} from "./admin-settings";

/* =========================================================
   HCS ADMIN PANEL v3
   ---------------------------------------------------------
   IMPORTANT DATA ARCHITECTURE

   1. Admin authentication:
      /api/auth/me

   2. Client accounts:
      /api/admin/clients

   3. Client passwords:
      NEVER stored in localStorage.
      Only temporary form value / credentials response.

   4. Module records:
      Existing localStorage system is retained for now.
      These can be migrated to MongoDB separately.

   5. admin-settings.ts:
      Settings/UI source only.
      It is NOT the permanent client database.
========================================================= */

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

type GenericModule = Exclude<
  SectionKey,
  "dashboard" | "clients" | "settings"
>;

type ClientStatus =
  | "Active"
  | "Suspended"
  | "Disabled";

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
  Record<PermissionKey, boolean>;

type AnyRecord =
  Record<string, any>;

type Theme =
  | "light"
  | "dark";

type ExtendedClient =
  ClientAccount & {
    assignedServices?: string[];
    selectedServices?: string[];
  };

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
  services: string;
};

type AgencySettings = {
  legalBusinessName: string;
  tagline: string;
  registrationType: string;
  gstin: string;
  pan: string;
  cin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  businessHours: string;
  currency: string;
  defaultClientPlan: string;
  primaryService: string;
  whatsappNumber: string;
  supportPhone: string;
  salesPhone: string;
  supportEmail: string;
  salesEmail: string;
  billingEmail: string;
  logoPath: string;
  faviconPath: string;
  brandWebsite: string;
  linkedin: string;
  instagram: string;
  facebook: string;
  x: string;
  youtube: string;
  businessDescription: string;
  defaultReportName: string;
  defaultReportPeriod: string;
  timezone: string;
  leadSource: string;
  defaultManager: string;
};

/* ---------- storage keys ---------- */

const SESSION_KEY =
  "hcs-session-admin";

const LEGACY_SESSION_KEY =
  "hcs-auth-session";

const ACTIVITY_KEY =
  "hcs-admin-activity";

const THEME_KEY =
  "hcs-theme";

const AGENCY_SETTINGS_KEY =
  "hcs-agency-settings-v1";

const AGENCY_SETTINGS_EVENT =
  "hcs-agency-settings-updated";

const PORTAL_DATA_EVENT =
  "hcs-admin-portal-data-updated";

const CLIENT_PANEL_URL =
  "/client";

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
    icon: "✱",
  },
];

const LABEL =
  Object.fromEntries(
    NAV.map((item) => [
      item.key,
      item.label,
    ]),
  ) as Record<
    SectionKey,
    string
  >;

const PERMISSIONS: Array<{
  key: PermissionKey;
  label: string;
  description: string;
}> = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Client overview",
  },
  {
    key: "websites",
    label: "Websites",
    description: "Assigned websites",
  },
  {
    key: "keywords",
    label: "Keywords / SEO",
    description: "Keyword and SEO data",
  },
  {
    key: "ranking",
    label: "Rankings",
    description: "Keyword positions",
  },
  {
    key: "pages",
    label: "Pages",
    description: "Page performance",
  },
  {
    key: "blogs",
    label: "Blogs",
    description: "Blog/content data",
  },
  {
    key: "backlinks",
    label: "Backlinks",
    description: "Backlink records",
  },
  {
    key: "technical",
    label: "Technical SEO",
    description: "Technical audits",
  },
  {
    key: "reports",
    label: "Reports",
    description: "Client reports",
  },
  {
    key: "competitors",
    label: "Competitors",
    description: "Competitor records",
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Client notifications",
  },
];

const allPerms = (
  value: boolean,
): PermissionMap =>
  Object.fromEntries(
    PERMISSIONS.map(
      (permission) => [
        permission.key,
        value,
      ],
    ),
  ) as PermissionMap;

const DEFAULT_PERMISSIONS: PermissionMap = {
  ...allPerms(true),
  technical: false,
  competitors: false,
};

const DEFAULT_AGENCY_SETTINGS: AgencySettings =
  {
    legalBusinessName:
      "Hind Consultancy Services",
    tagline:
      "Smart Technology. Better Business.",
    registrationType:
      "Proprietorship / Agency",
    gstin: "",
    pan: "",
    cin: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    businessHours:
      "Monday - Saturday, 10:00 AM - 7:00 PM",
    currency: "INR",
    defaultClientPlan:
      "Monthly SEO",
    primaryService:
      "SEO & Digital Marketing",
    whatsappNumber: "",
    supportPhone: "",
    salesPhone: "",
    supportEmail:
      "support@hindconsultancyservices.com",
    salesEmail:
      "admin@hindconsultancyservices.com",
    billingEmail:
      "admin@hindconsultancyservices.com",
    logoPath:
      "/images/logo.png",
    faviconPath:
      "/images/logo.png",
    brandWebsite:
      "https://hindconsultancyservices.com",
    linkedin: "",
    instagram: "",
    facebook: "",
    x: "",
    youtube: "",
    businessDescription:
      "Hind Consultancy Services provides web development, SEO, digital marketing, business consultancy, documentation support and IT solutions.",
    defaultReportName:
      "HCS SEO Performance Report",
    defaultReportPeriod:
      "Monthly",
    timezone:
      "Asia/Kolkata",
    leadSource:
      "Website",
    defaultManager: "",
  };

/* ---------- settings field maps ---------- */

type AF = Array<
  [
    keyof AgencySettings,
    string,
    string?
  ]
>;

const AG_IDENTITY: AF = [
  [
    "legalBusinessName",
    "Legal Business Name",
  ],
  ["tagline", "Tagline"],
  [
    "registrationType",
    "Registration Type",
  ],
  ["gstin", "GSTIN"],
  ["pan", "PAN"],
  ["cin", "CIN / Registration Number"],
  [
    "primaryService",
    "Primary Service",
  ],
  [
    "defaultClientPlan",
    "Default Client Plan",
  ],
  [
    "businessHours",
    "Business Hours",
  ],
  ["currency", "Currency"],
  ["timezone", "Timezone"],
  ["country", "Country"],
  ["city", "City"],
  ["state", "State"],
  ["pincode", "Pincode"],
];

const AG_CONTACT: AF = [
  [
    "whatsappNumber",
    "WhatsApp Number",
  ],
  [
    "supportPhone",
    "Support Phone",
  ],
  ["salesPhone", "Sales Phone"],
  [
    "supportEmail",
    "Support Email",
    "email",
  ],
  [
    "salesEmail",
    "Sales Email",
    "email",
  ],
  [
    "billingEmail",
    "Billing Email",
    "email",
  ],
  [
    "brandWebsite",
    "Business Website",
    "url",
  ],
];

const AG_SOCIAL: AF = [
  ["linkedin", "LinkedIn"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["x", "X / Twitter"],
  ["youtube", "YouTube"],
];

const AG_BRAND: AF = [
  ["logoPath", "Logo Path"],
  ["faviconPath", "Favicon Path"],
];

const AG_OPS: AF = [
  [
    "defaultManager",
    "Default Manager",
  ],
  [
    "leadSource",
    "Lead Source",
  ],
  [
    "defaultReportName",
    "Default Report Name",
  ],
];

const ACCOUNT_FIELDS: Array<
  [string, string, string?]
> = [
  ["adminId", "Admin ID"],
  ["username", "Username"],
  ["fullName", "Full Name"],
  ["email", "Email", "email"],
  ["phone", "Phone"],
  ["jobTitle", "Job Title"],
];

const SECURITY_NUMBERS: Array<
  [string, string, number, number]
> = [
  [
    "minPasswordLength",
    "Minimum Password Length",
    6,
    8,
  ],
  [
    "failedAttemptsLimit",
    "Failed Attempts Limit",
    1,
    5,
  ],
  [
    "sessionTimeoutMinutes",
    "Session Timeout (minutes)",
    5,
    60,
  ],
  [
    "passwordExpiryDays",
    "Password Expiry Days",
    0,
    0,
  ],
];

const SECURITY_TOGGLES: Array<
  [string, string]
> = [
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
];

const SETTINGS_TABS = [
  {
    key: "account",
    label: "Account",
  },
  {
    key: "security",
    label: "Security",
  },
  {
    key: "agency",
    label: "Agency",
  },
  {
    key: "contact",
    label: "Contact & Social",
  },
  {
    key: "branding",
    label: "Branding",
  },
  {
    key: "operations",
    label: "Operations",
  },
  {
    key: "appearance",
    label: "Appearance",
  },
] as const;

type SettingsTab =
  (typeof SETTINGS_TABS)[number]["key"];

/* ---------- module form config ---------- */

type FieldDef = {
  k: string;
  l: string;
  t?:
    | "text"
    | "number"
    | "date"
    | "datetime-local"
    | "url"
    | "select"
    | "textarea"
    | "client"
    | "website";
  o?: string[];
  req?: boolean;
  def?: string;
  min?: number;
  max?: number;
  step?: string;
};

const CLIENT_REQ: FieldDef = {
  k: "clientId",
  l: "Client",
  t: "client",
  req: true,
};

const CLIENT_OPT: FieldDef = {
  k: "clientId",
  l: "Client",
  t: "client",
};

const SITE: FieldDef = {
  k: "websiteId",
  l: "Website",
  t: "website",
};

const SITE_REQ: FieldDef = {
  ...SITE,
  req: true,
};

const notes = (
  label = "Notes",
): FieldDef => ({
  k: "notes",
  l: label,
  t: "textarea",
});

const MODULE_FORMS: Record<
  GenericModule,
  {
    sub: string;
    fields: FieldDef[];
  }
> = {
  websites: {
    sub: "Website profile",
    fields: [
      {
        k: "name",
        l: "Website Name",
        req: true,
      },
      {
        k: "domain",
        l: "Domain",
        req: true,
      },
      {
        k: "url",
        l: "Website URL",
        t: "url",
      },
      CLIENT_OPT,
      {
        k: "manager",
        l: "Manager",
        def: "$manager",
      },
      {
        k: "status",
        l: "Status",
        t: "select",
        o: [
          "Active",
          "Paused",
          "Completed",
          "Inactive",
        ],
        def: "Active",
      },
      {
        k: "service",
        l: "Primary Service",
      },
      {
        k: "startDate",
        l: "Start Date",
        t: "date",
      },
      {
        k: "targetCountry",
        l: "Target Country",
        def: "India",
      },
      notes(),
    ],
  },

  keywords: {
    sub: "SEO keyword record",
    fields: [
      CLIENT_REQ,
      SITE,
      {
        k: "keyword",
        l: "Keyword",
        req: true,
      },
      {
        k: "intent",
        l: "Search Intent",
        t: "select",
        o: [
          "Informational",
          "Commercial",
          "Transactional",
          "Navigational",
        ],
      },
      {
        k: "searchVolume",
        l: "Search Volume",
        t: "number",
        min: 0,
      },
      {
        k: "difficulty",
        l: "Difficulty",
        t: "number",
        min: 0,
        max: 100,
      },
      {
        k: "targetUrl",
        l: "Target URL",
      },
      {
        k: "status",
        l: "Status",
        t: "select",
        o: [
          "Active",
          "Tracking",
          "Paused",
        ],
        def: "Active",
      },
      notes("Keyword Notes"),
    ],
  },

  ranking: {
    sub: "Keyword ranking snapshot",
    fields: [
      CLIENT_REQ,
      SITE,
      {
        k: "keyword",
        l: "Keyword",
        req: true,
      },
      {
        k: "searchEngine",
        l: "Search Engine",
        t: "select",
        o: [
          "Google",
          "Bing",
          "Yahoo",
        ],
        def: "Google",
      },
      {
        k: "device",
        l: "Device",
        t: "select",
        o: [
          "Desktop",
          "Mobile",
          "Tablet",
        ],
        def: "Desktop",
      },
      {
        k: "currentPosition",
        l: "Current Position",
        t: "number",
        min: 0,
      },
      {
        k: "previousPosition",
        l: "Previous Position",
        t: "number",
        min: 0,
      },
      {
        k: "date",
        l: "Tracking Date",
        t: "date",
        def: "$today",
      },
      {
        k: "targetUrl",
        l: "Target URL",
      },
      {
        k: "serpFeature",
        l: "SERP Feature",
      },
      notes("Ranking Notes"),
    ],
  },

  pages: {
    sub: "Website page performance",
    fields: [
      CLIENT_REQ,
      SITE_REQ,
      {
        k: "title",
        l: "Page Title",
        req: true,
      },
      {
        k: "url",
        l: "Page URL",
        req: true,
      },
      {
        k: "clicks",
        l: "Clicks",
        t: "number",
        min: 0,
      },
      {
        k: "impressions",
        l: "Impressions",
        t: "number",
        min: 0,
      },
      {
        k: "averagePosition",
        l: "Average Position",
        t: "number",
        min: 0,
        step: "0.1",
      },
      {
        k: "status",
        l: "Status",
        t: "select",
        o: [
          "Active",
          "Needs Update",
          "Optimized",
        ],
        def: "Active",
      },
      {
        k: "keyword",
        l: "Primary Keyword",
      },
      {
        k: "lastAudited",
        l: "Last Audited",
        t: "date",
      },
      notes("Page Notes"),
    ],
  },

  blogs: {
    sub: "Blog / content record",
    fields: [
      CLIENT_REQ,
      SITE,
      {
        k: "title",
        l: "Blog Title",
        req: true,
      },
      {
        k: "author",
        l: "Author",
      },
      {
        k: "keyword",
        l: "Target Keyword",
      },
      {
        k: "publishDate",
        l: "Publish Date",
        t: "date",
      },
      {
        k: "url",
        l: "Content URL",
      },
      {
        k: "status",
        l: "Status",
        t: "select",
        o: [
          "Draft",
          "Planned",
          "Published",
          "Updated",
        ],
        def: "Draft",
      },
      {
        k: "category",
        l: "Category",
      },
      {
        k: "wordCount",
        l: "Word Count",
        t: "number",
        min: 0,
      },
      notes("Content Notes"),
    ],
  },

  backlinks: {
    sub: "Off-page SEO record",
    fields: [
      CLIENT_REQ,
      {
        ...SITE_REQ,
        l: "Target Website",
      },
      {
        k: "sourceUrl",
        l: "Source URL",
        t: "url",
        req: true,
      },
      {
        k: "targetUrl",
        l: "Target URL",
        t: "url",
        req: true,
      },
      {
        k: "anchorText",
        l: "Anchor Text",
      },
      {
        k: "linkType",
        l: "Link Type",
        t: "select",
        o: [
          "DoFollow",
          "NoFollow",
          "Sponsored",
          "UGC",
        ],
      },
      {
        k: "status",
        l: "Status",
        t: "select",
        o: [
          "Active",
          "Pending",
          "Removed",
          "Lost",
        ],
        def: "Active",
      },
      {
        k: "date",
        l: "Published Date",
        t: "date",
        def: "$today",
      },
      {
        k: "domainAuthority",
        l: "Domain Authority",
        t: "number",
        min: 0,
        max: 100,
      },
      {
        k: "domainRating",
        l: "Domain Rating",
        t: "number",
        min: 0,
        max: 100,
      },
      {
        k: "traffic",
        l: "Traffic Estimate",
        t: "number",
        min: 0,
      },
      notes("Backlink Notes"),
    ],
  },

  technical: {
    sub: "Technical audit issue",
    fields: [
      CLIENT_REQ,
      SITE_REQ,
      {
        k: "title",
        l: "Issue Title",
        req: true,
      },
      {
        k: "category",
        l: "Category",
        t: "select",
        o: [
          "Crawlability",
          "Indexing",
          "Core Web Vitals",
          "Meta / On-page",
          "Structured Data",
          "Mobile SEO",
          "Security",
          "Internal Links",
        ],
      },
      {
        k: "severity",
        l: "Severity",
        t: "select",
        o: [
          "Critical",
          "High",
          "Medium",
          "Low",
        ],
        def: "Medium",
      },
      {
        k: "url",
        l: "Affected URL",
      },
      {
        k: "status",
        l: "Status",
        t: "select",
        o: [
          "Open",
          "In Progress",
          "Resolved",
          "Ignored",
        ],
        def: "Open",
      },
      {
        k: "dueDate",
        l: "Due Date",
        t: "date",
      },
      {
        k: "assignedTo",
        l: "Assigned To",
        def: "$manager",
      },
      {
        k: "recommendation",
        l: "Recommendation",
      },
      notes("Audit Notes"),
    ],
  },

  reports: {
    sub: "SEO / client report",
    fields: [
      CLIENT_REQ,
      SITE,
      {
        k: "name",
        l: "Report Name",
        req: true,
        def: "$reportName",
      },
      {
        k: "type",
        l: "Report Type",
        t: "select",
        o: [
          "SEO",
          "Technical SEO",
          "Backlink",
          "Monthly Performance",
          "Competitor",
        ],
        def: "SEO",
      },
      {
        k: "period",
        l: "Period",
        t: "select",
        o: [
          "Weekly",
          "Monthly",
          "Quarterly",
          "Yearly",
        ],
        def: "$reportPeriod",
      },
      {
        k: "date",
        l: "Report Date",
        t: "date",
        def: "$today",
      },
      {
        k: "status",
        l: "Status",
        t: "select",
        o: [
          "Draft",
          "Ready",
          "Delivered",
          "Archived",
        ],
        def: "Draft",
      },
      {
        k: "url",
        l: "Report URL",
      },
      {
        k: "summary",
        l: "Report Summary",
        t: "textarea",
      },
    ],
  },

  competitors: {
    sub: "Competitor profile",
    fields: [
      CLIENT_REQ,
      SITE,
      {
        k: "name",
        l: "Competitor Name",
        req: true,
      },
      {
        k: "domain",
        l: "Domain",
        req: true,
      },
      {
        k: "industry",
        l: "Industry",
      },
      {
        k: "type",
        l: "Competitor Type",
        t: "select",
        o: [
          "Direct",
          "Indirect",
          "Local",
          "National",
        ],
        def: "Direct",
      },
      {
        k: "traffic",
        l: "Estimated Traffic",
        t: "number",
        min: 0,
      },
      {
        k: "status",
        l: "Status",
        t: "select",
        o: [
          "Monitoring",
          "Active",
          "Archived",
        ],
        def: "Monitoring",
      },
      {
        k: "topKeyword",
        l: "Top Keyword",
      },
      {
        k: "domainAuthority",
        l: "Estimated Domain Authority",
        t: "number",
        min: 0,
        max: 100,
      },
      notes("Competitor Notes"),
    ],
  },

  notifications: {
    sub: "Client notification",
    fields: [
      CLIENT_OPT,
      {
        k: "title",
        l: "Title",
        req: true,
      },
      {
        k: "type",
        l: "Type",
        t: "select",
        o: [
          "General",
          "SEO Update",
          "Report",
          "Website",
          "Payment",
          "Maintenance",
          "Important",
        ],
        def: "General",
      },
      {
        k: "status",
        l: "Status",
        t: "select",
        o: [
          "Unread",
          "Read",
          "Archived",
        ],
        def: "Unread",
      },
      {
        k: "date",
        l: "Date",
        t: "datetime-local",
        def: "$now",
      },
      {
        k: "url",
        l: "Action URL",
      },
      {
        k: "message",
        l: "Message",
        t: "textarea",
        req: true,
      },
    ],
  },
};

const MODULES =
  Object.keys(
    MODULE_FORMS,
  ) as GenericModule[];

const isModule = (
  value: SectionKey,
): value is GenericModule =>
  value in MODULE_FORMS;

const TITLE_KEYS: Record<
  GenericModule,
  [string[], string]
> = {
  websites: [
    ["name", "domain", "url"],
    "Website",
  ],
  keywords: [
    ["keyword", "query", "name"],
    "Keyword",
  ],
  ranking: [
    ["keyword", "query", "name"],
    "Keyword",
  ],
  pages: [
    ["title", "name", "url"],
    "Page",
  ],
  blogs: [
    ["title", "name"],
    "Blog",
  ],
  backlinks: [
    [
      "targetUrl",
      "sourceUrl",
      "anchorText",
      "name",
    ],
    "Backlink",
  ],
  technical: [
    ["title", "issue", "name"],
    "Technical issue",
  ],
  reports: [
    ["name", "title"],
    "Report",
  ],
  competitors: [
    ["name", "domain"],
    "Competitor",
  ],
  notifications: [
    ["title", "subject", "name"],
    "Notification",
  ],
};

const ID_KEYS = [
  "id",
  "_id",
  "clientId",
  "websiteId",
  "keywordId",
  "pageId",
  "blogId",
  "backlinkId",
  "reportId",
  "notificationId",
];

/* =========================================================
   HELPERS
========================================================= */

const clone = <T,>(
  value: T,
): T =>
  JSON.parse(
    JSON.stringify(value),
  ) as T;

const isRec = (
  value: unknown,
): value is AnyRecord =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value);

function parseJSON(
  raw: string | null,
): any {
  try {
    return raw
      ? JSON.parse(raw)
      : null;
  } catch {
    return null;
  }
}

function txt(
  value: unknown,
  fallback = "—",
) {
  const result =
    String(value ?? "").trim();

  return result || fallback;
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
          (part) =>
            part[0]?.toUpperCase() ??
            "",
        )
        .join("")
    : "HC";
}

function idOf(
  record: AnyRecord,
  index = 0,
) {
  const found =
    ID_KEYS
      .map(
        (key) => record[key],
      )
      .find(
        (value) =>
          String(
            value ?? "",
          ).trim(),
      );

  return txt(
    found,
    String(index + 1),
  );
}

function titleOf(
  record: AnyRecord,
  section: GenericModule,
) {
  const [
    keys,
    fallback,
  ] = TITLE_KEYS[section];

  return txt(
    keys
      .map(
        (key) =>
          record[key],
      )
      .find(
        (value) =>
          String(
            value ?? "",
          ).trim(),
      ),
    fallback,
  );
}

function fmtDate(
  value: unknown,
) {
  const raw =
    String(value ?? "").trim();

  if (!raw) return "—";

  const date =
    new Date(raw);

  return Number.isNaN(
    date.getTime(),
  )
    ? raw
    : date.toLocaleDateString(
        undefined,
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        },
      );
}

const localNow = () =>
  new Date(
    Date.now() -
      new Date().getTimezoneOffset() *
        60000,
  ).toISOString();

function triggerDownload(
  blob: Blob,
  filename: string,
) {
  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      "a",
    );

  anchor.href = url;
  anchor.download =
    filename;

  anchor.click();

  URL.revokeObjectURL(url);
}

function downloadCSV(
  name: string,
  rows: AnyRecord[],
) {
  if (!rows.length) {
    return;
  }

  const columns =
    Array.from(
      new Set(
        rows.flatMap((row) =>
          Object.keys(row),
        ),
      ),
    );

  const escapeCell = (
    value: unknown,
  ) => {
    let result =
      value == null
        ? ""
        : typeof value ===
            "object"
          ? JSON.stringify(value)
          : String(value);

    if (
      /^[=+\-@]/.test(
        result,
      )
    ) {
      result = `'${result}`;
    }

    return `"${result.replace(
      /"/g,
      '""',
    )}"`;
  };

  const body = [
    columns.join(","),
    ...rows.map((row) =>
      columns
        .map((column) =>
          escapeCell(
            row[column],
          ),
        )
        .join(","),
    ),
  ].join("\n");

  triggerDownload(
    new Blob(
      ["\ufeff" + body],
      {
        type:
          "text/csv;charset=utf-8",
      },
    ),
    name,
  );
}

/* ---------- legacy UI session helpers ---------- */

function readAdminSession(): AnyRecord | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  const own =
    parseJSON(
      localStorage.getItem(
        SESSION_KEY,
      ),
    );

  if (
    own?.role ===
    "admin"
  ) {
    return own;
  }

  const legacy =
    parseJSON(
      localStorage.getItem(
        LEGACY_SESSION_KEY,
      ),
    );

  if (
    legacy?.role ===
    "admin"
  ) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify(
        legacy,
      ),
    );

    localStorage.removeItem(
      LEGACY_SESSION_KEY,
    );

    return legacy;
  }

  return null;
}

function writeAdminSession(
  data: AnyRecord,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      ...data,
      role: "admin",
    }),
  );
}

function clearAdminSession() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  localStorage.removeItem(
    SESSION_KEY,
  );

  const legacy =
    parseJSON(
      localStorage.getItem(
        LEGACY_SESSION_KEY,
      ),
    );

  if (
    legacy?.role ===
    "admin"
  ) {
    localStorage.removeItem(
      LEGACY_SESSION_KEY,
    );
  }
}

/* ---------- theme ---------- */

function useTheme() {
  const [
    theme,
    setThemeState,
  ] =
    useState<Theme>("light");

  const apply =
    useCallback(
      (
        next: Theme,
        persist = true,
      ) => {
        const root =
          document.documentElement;

        root.classList.add(
          "theme-anim",
        );

        root.dataset.theme =
          next;

        window.setTimeout(
          () =>
            root.classList.remove(
              "theme-anim",
            ),
          350,
        );

        setThemeState(next);

        if (persist) {
          try {
            localStorage.setItem(
              THEME_KEY,
              next,
            );
          } catch {
            // ignore
          }
        }
      },
      [],
    );

  useEffect(() => {
    let saved: string | null =
      null;

    try {
      saved =
        localStorage.getItem(
          THEME_KEY,
        );
    } catch {
      // ignore
    }

    const system: Theme =
      window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches
        ? "dark"
        : "light";

    apply(
      saved === "dark" ||
        saved === "light"
        ? saved
        : system,
      false,
    );

    const onStorage =
      (
        event: StorageEvent,
      ) => {
        if (
          event.key ===
            THEME_KEY &&
          (
            event.newValue ===
              "dark" ||
            event.newValue ===
              "light"
          )
        ) {
          apply(
            event.newValue,
            false,
          );
        }
      };

    window.addEventListener(
      "storage",
      onStorage,
    );

    return () =>
      window.removeEventListener(
        "storage",
        onStorage,
      );
  }, [apply]);

  const toggle =
    useCallback(
      () =>
        apply(
          theme === "dark"
            ? "light"
            : "dark",
        ),
      [apply, theme],
    );

  return {
    theme,
    setTheme: apply,
    toggle,
  };
}

/* ---------- agency + module storage ---------- */

function readAgencySettings(): AgencySettings {
  if (
    typeof window ===
    "undefined"
  ) {
    return clone(
      DEFAULT_AGENCY_SETTINGS,
    );
  }

  const parsed =
    parseJSON(
      window.localStorage.getItem(
        AGENCY_SETTINGS_KEY,
      ),
    );

  return {
    ...clone(
      DEFAULT_AGENCY_SETTINGS,
    ),
    ...(isRec(parsed)
      ? parsed
      : {}),
  };
}

function saveAgencySettings(
  value: AgencySettings,
) {
  window.localStorage.setItem(
    AGENCY_SETTINGS_KEY,
    JSON.stringify(value),
  );

  window.dispatchEvent(
    new CustomEvent(
      AGENCY_SETTINGS_EVENT,
    ),
  );
}

function readRecords(
  keys: string[],
): AnyRecord[] {
  if (
    typeof window ===
    "undefined"
  ) {
    return [];
  }

  for (const key of keys) {
    const parsed =
      parseJSON(
        window.localStorage.getItem(
          key,
        ),
      );

    const list =
      Array.isArray(parsed)
        ? parsed
        : Array.isArray(
              parsed?.items,
            )
          ? parsed.items
          : Array.isArray(
                parsed?.data,
              )
            ? parsed.data
            : null;

    if (list) {
      return list.filter(isRec);
    }
  }

  return [];
}

function writeRecords(
  section: GenericModule,
  records: AnyRecord[],
) {
  window.localStorage.setItem(
    MODULE_KEYS[section][0],
    JSON.stringify(records),
  );

  window.dispatchEvent(
    new CustomEvent(
      PORTAL_DATA_EVENT,
      {
        detail: {
          section,
          records,
        },
      },
    ),
  );
}

/* ---------- clients / passwords ---------- */

function nextClientId(
  clients: ExtendedClient[],
) {
  const numbers =
    clients.map(
      (client) =>
        Number(
          String(
            client.clientId ??
              "",
          ).match(
            /^HCS-CL-(\d+)$/i,
          )?.[1] ??
            0,
        ),
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

function rnd(
  n: number,
) {
  const buffer =
    new Uint32Array(1);

  crypto.getRandomValues(
    buffer,
  );

  return buffer[0] % n;
}

function generatePassword(
  security: AnyRecord,
) {
  const pick =
    (value: string) =>
      value[rnd(value.length)];

  const upper =
    "ABCDEFGHJKLMNPQRSTUVWXYZ";

  const lower =
    "abcdefghijkmnopqrstuvwxyz";

  const numbers =
    "23456789";

  const special =
    "@#$%&*!?";

  const useUpper =
    security?.requireUppercase !==
    false;

  const useNumber =
    security?.requireNumber !==
    false;

  const useSpecial =
    security?.requireSpecialCharacter !==
    false;

  const pool =
    lower +
    (useUpper ? upper : "") +
    (useNumber ? numbers : "") +
    (useSpecial
      ? special
      : "");

  const characters = [
    pick(lower),
    ...(useUpper
      ? [pick(upper)]
      : []),
    ...(useNumber
      ? [pick(numbers)]
      : []),
    ...(useSpecial
      ? [pick(special)]
      : []),
  ];

  const minimum =
    Math.max(
      Number(
        security?.minPasswordLength ??
          8,
      ),
      12,
    );

  while (
    characters.length <
    minimum
  ) {
    characters.push(
      pick(pool),
    );
  }

  for (
    let index =
      characters.length - 1;
    index > 0;
    index--
  ) {
    const randomIndex =
      rnd(index + 1);

    [
      characters[index],
      characters[randomIndex],
    ] = [
      characters[randomIndex],
      characters[index],
    ];
  }

  return characters.join("");
}

function validatePassword(
  password: string,
  security: AnyRecord,
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
  const source =
    isRec(value)
      ? value
      : {};

  const result = {
    ...DEFAULT_PERMISSIONS,
  };

  (
    Object.keys(
      result,
    ) as PermissionKey[]
  ).forEach(
    (key) => {
      if (
        source[key] !==
        undefined
      ) {
        result[key] =
          Boolean(
            source[key],
          );
      }
    },
  );

  return result;
}

const emptyClientForm =
  (): ClientForm => ({
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
    clientPortalEnabled:
      true,
    assignedWebsiteIds: [],
    permissions:
      clone(
        DEFAULT_PERMISSIONS,
      ),
    tags: "",
    notes: "",
    services: "",
  });

const splitList = (
  value: string,
) =>
  value
    .split(",")
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean);

function buildDefaults(
  section: GenericModule,
  agency: AgencySettings,
): AnyRecord {
  const now =
    localNow();

  const tokens: Record<
    string,
    string
  > = {
    $manager:
      agency.defaultManager,

    $reportName:
      agency.defaultReportName,

    $reportPeriod:
      agency.defaultReportPeriod,

    $today:
      now.slice(0, 10),

    $now:
      now.slice(0, 16),
  };

  const record: AnyRecord = {
    id:
      crypto.randomUUID(),
    createdAt:
      new Date().toISOString(),
  };

  MODULE_FORMS[
    section
  ].fields.forEach(
    (field) => {
      if (
        field.def !==
        undefined
      ) {
        record[field.k] =
          field.def in tokens
            ? tokens[field.def]
            : field.def;
      }
    },
  );

  return record;
}

/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

function EmptyState({
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
  required = false,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <label
      className={`field ${
        wide ? "wide" : ""
      }`}
    >
      <span>
        {label}
        {required
          ? " *"
          : ""}
      </span>
      {children}
    </label>
  );
}

function Panel({
  eyebrow,
  title,
  span,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  span?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={`panel ${
        span
          ? "settings-span"
          : ""
      }`}
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            {eyebrow}
          </span>
          <h3>{title}</h3>
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

function StatusBadge({
  value,
}: {
  value: string;
}) {
  const normalized =
    value.toLowerCase();

  const tone =
    [
      "active",
      "enabled",
      "published",
      "ready",
      "delivered",
      "resolved",
      "optimized",
    ].includes(
      normalized,
    )
      ? "active"
      : [
            "suspended",
            "disabled",
            "lost",
            "removed",
            "critical",
            "open",
          ].includes(
            normalized,
          )
        ? "danger"
        : "pending";

  return (
    <span
      className={`status-badge ${tone}`}
    >
      {value}
    </span>
  );
}

/* =========================================================
   ADMIN PAGE
========================================================= */

export default function AdminPage() {
  const {
    theme,
    setTheme,
    toggle: toggleTheme,
  } = useTheme();

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
  ] =
    useState(false);

  const [
    authorized,
    setAuthorized,
  ] =
    useState(false);

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
    agencySettings,
    setAgencySettings,
  ] =
    useState<AgencySettings>(
      clone(
        DEFAULT_AGENCY_SETTINGS,
      ),
    );

  const [
    draftAgency,
    setDraftAgency,
  ] =
    useState<AgencySettings>(
      clone(
        DEFAULT_AGENCY_SETTINGS,
      ),
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
    clients,
    setClients,
  ] =
    useState<
      ExtendedClient[]
    >([]);

  const [
    clientLoading,
    setClientLoading,
  ] =
    useState(true);

  const [
    clientActionLoading,
    setClientActionLoading,
  ] =
    useState(false);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("All");

  const [
    toast,
    setToast,
  ] =
    useState("");

  const [
    profileOpen,
    setProfileOpen,
  ] =
    useState(false);

  const [
    settingsTab,
    setSettingsTab,
  ] =
    useState<SettingsTab>(
      "account",
    );

  const [
    showAdminPw,
    setShowAdminPw,
  ] =
    useState(false);

  const [
    clientModal,
    setClientModal,
  ] =
    useState<
      "create" | "edit" | null
    >(null);

  const [
    editingClient,
    setEditingClient,
  ] =
    useState<
      ExtendedClient | null
    >(null);

  const [
    credentials,
    setCredentials,
  ] =
    useState<AnyRecord | null>(
      null,
    );

  const [
    selectedClients,
    setSelectedClients,
  ] =
    useState<string[]>([]);

  const [
    recordModal,
    setRecordModal,
  ] =
    useState<{
      section: GenericModule;
      record?: AnyRecord;
    } | null>(null);

  const [
    clientForm,
    setClientForm,
  ] =
    useState<ClientForm>(
      emptyClientForm(),
    );

  const sectionRef =
    useRef(section);

  sectionRef.current =
    section;

  const security =
    useMemo(
      () =>
        (settings?.security ??
          {}) as AnyRecord,
      [settings],
    );

  const sessionMinutes =
    Number(
      security.sessionTimeoutMinutes ??
        60,
    ) || 60;

  /* ---------- load settings + local module data ---------- */

  const loadEverything =
    useCallback(() => {
      const current =
        getGlobalAdminSettings();

      /*
       * Client accounts are no longer read from
       * admin-settings.ts.
       *
       * They are loaded from MongoDB separately.
       */
      const cleanSettings = {
        ...current,
        clients: [],
      };

      const agency =
        readAgencySettings();

      setSettings(
        cleanSettings,
      );

      setDraftSettings(
        clone(
          cleanSettings,
        ),
      );

      setAgencySettings(
        agency,
      );

      setDraftAgency(
        clone(agency),
      );

      const next: Record<
        string,
        AnyRecord[]
      > = {};

      MODULES.forEach(
        (module) => {
          next[module] =
            readRecords(
              MODULE_KEYS[
                module
              ],
            );
        },
      );

      setRecords(next);
    }, []);

  /* ---------- load clients from MongoDB ---------- */

  const loadClients =
    useCallback(
      async () => {
        setClientLoading(
          true,
        );

        try {
          const response =
            await fetch(
              "/api/admin/clients",
              {
                method: "GET",
                credentials:
                  "include",
                cache:
                  "no-store",
              },
            );

          const data =
            (await response.json()) as {
              success?: boolean;
              message?: string;
              clients?: ExtendedClient[];
            };

          if (
            !response.ok ||
            !data.success
          ) {
            console.error(
              "HCS client load error:",
              data.message,
            );

            setClients([]);
            return;
          }

          setClients(
            Array.isArray(
              data.clients,
            )
              ? data.clients
              : [],
          );
        } catch (error) {
          console.error(
            "HCS client load error:",
            error,
          );

          setClients([]);
        } finally {
          setClientLoading(
            false,
          );
        }
      },
      [],
    );

  /* ---------- server authentication ---------- */

  useEffect(() => {
    let cancelled =
      false;

    async function verifyAdminSession() {
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

        if (
          !response.ok
        ) {
          if (
            !cancelled
          ) {
            clearAdminSession();
            window.location.replace(
              "/",
            );
          }

          return;
        }

        const data =
          (await response.json()) as {
            success?: boolean;
            role?: string;
            user?: AnyRecord;
          };

        if (
          !data.success ||
          data.role !==
            "admin"
        ) {
          if (
            !cancelled
          ) {
            clearAdminSession();
            window.location.replace(
              "/",
            );
          }

          return;
        }

        if (
          cancelled
        ) {
          return;
        }

        /*
         * This is only a UI compatibility/session snapshot.
         * The real authorization remains the HTTP-only
         * server session.
         */
        if (
          data.user
        ) {
          writeAdminSession({
            authenticated:
              true,
            role: "admin",
            id:
              data.user.id,
            adminId:
              data.user.adminId,
            accountId:
              data.user.accountId,
            username:
              data.user.username,
            name:
              data.user.name ??
              data.user.fullName,
            email:
              data.user.email,
          });
        }

        setAuthorized(
          true,
        );

        loadEverything();

        void loadClients();
      } catch (error) {
        console.error(
          "HCS admin session error:",
          error,
        );

        if (
          !cancelled
        ) {
          clearAdminSession();
          window.location.replace(
            "/",
          );
        }
      }
    }

    verifyAdminSession();

    return () => {
      cancelled = true;
    };
  }, [
    loadEverything,
    loadClients,
  ]);

  /* ---------- live sync ---------- */

  useEffect(() => {
    const sync =
      () => {
        loadEverything();
        void loadClients();
      };

    const onStorage =
      (
        event: StorageEvent,
      ) => {
        if (
          event.key ===
            THEME_KEY ||
          event.key ===
            ACTIVITY_KEY
        ) {
          return;
        }

        if (
          event.key?.startsWith(
            "hcs-session-",
          ) ||
          event.key ===
            LEGACY_SESSION_KEY
        ) {
          return;
        }

        sync();
      };

    const events = [
      "hcs-admin-settings-updated",
      PORTAL_DATA_EVENT,
      AGENCY_SETTINGS_EVENT,
    ];

    events.forEach(
      (name) =>
        window.addEventListener(
          name,
          sync,
        ),
    );

    window.addEventListener(
      "storage",
      onStorage,
    );

    return () => {
      events.forEach(
        (name) =>
          window.removeEventListener(
            name,
            sync,
          ),
      );

      window.removeEventListener(
        "storage",
        onStorage,
      );
    };
  }, [
    loadEverything,
    loadClients,
  ]);

  /* ---------- shortcuts ---------- */

  useEffect(() => {
    const onKey =
      (event: KeyboardEvent) => {
        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key.toLowerCase() ===
            "k"
        ) {
          event.preventDefault();

          document
            .querySelector<HTMLInputElement>(
              ".search-field input",
            )
            ?.focus();
        }

        if (
          event.key ===
          "Escape"
        ) {
          setClientModal(
            null,
          );

          setRecordModal(
            null,
          );

          setCredentials(
            null,
          );

          setProfileOpen(
            false,
          );

          setSidebarOpen(
            false,
          );
        }
      };

    window.addEventListener(
      "keydown",
      onKey,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKey,
      );
  }, []);

  /* ---------- idle session timeout ---------- */

  useEffect(() => {
    if (!authorized) {
      return;
    }

    const limit =
      sessionMinutes *
      60_000;

    let timer = 0;

    let lastWrite = 0;

    const check =
      () => {
        const last =
          Number(
            localStorage.getItem(
              ACTIVITY_KEY,
            ),
          ) || 0;

        const idle =
          Date.now() -
          last;

        if (
          idle >= limit
        ) {
          clearAdminSession();

          void fetch(
            "/api/auth/logout",
            {
              method: "POST",
              credentials:
                "include",
            },
          ).finally(
            () =>
              window.location.replace(
                "/",
              ),
          );

          return;
        }

        timer =
          window.setTimeout(
            check,
            limit -
              idle,
          );
      };

    const touch =
      () => {
        const now =
          Date.now();

        if (
          now -
            lastWrite >
          15_000
        ) {
          lastWrite =
            now;

          try {
            localStorage.setItem(
              ACTIVITY_KEY,
              String(now),
            );
          } catch {
            // ignore
          }
        }
      };

    const events = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ];

    events.forEach(
      (name) =>
        window.addEventListener(
          name,
          touch,
          {
            passive: true,
          },
        ),
    );

    touch();

    timer =
      window.setTimeout(
        check,
        limit,
      );

    return () => {
      window.clearTimeout(
        timer,
      );

      events.forEach(
        (name) =>
          window.removeEventListener(
            name,
            touch,
          ),
      );
    };
  }, [
    authorized,
    sessionMinutes,
  ]);

  /* ---------- toast ---------- */

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer =
      window.setTimeout(
        () => setToast(""),
        2600,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [toast]);

  /* ---------- memos ---------- */

  const websites =
    useMemo(
      () =>
        records.websites ??
        [],
      [records],
    );

  const currentRecords =
    useMemo(
      () =>
        isModule(section)
          ? records[
              section
            ] ?? []
          : [],
      [
        section,
        records,
      ],
    );

  const term =
    search
      .trim()
      .toLowerCase();

  const filteredClients =
    useMemo(
      () =>
        clients.filter(
          (client) => {
            if (
              statusFilter !==
                "All" &&
              client.status !==
                statusFilter
            ) {
              return false;
            }

            if (!term) {
              return true;
            }

            return [
              client.name,
              client.companyName,
              client.email,
              client.username,
              client.clientId,
              client.plan,
              client.status,
            ].some(
              (value) =>
                String(
                  value ?? "",
                )
                  .toLowerCase()
                  .includes(
                    term,
                  ),
            );
          },
        ),
      [
        clients,
        term,
        statusFilter,
      ],
    );

  const filteredRecords =
    useMemo(
      () =>
        currentRecords.filter(
          (record) =>
            !term ||
            JSON.stringify(
              record,
            )
              .toLowerCase()
              .includes(
                term,
              ),
        ),
      [
        currentRecords,
        term,
      ],
    );

  const latestClients =
    useMemo(
      () =>
        [...clients]
          .sort(
            (
              first,
              second,
            ) =>
              String(
                second.createdAt ??
                  "",
              ).localeCompare(
                String(
                  first.createdAt ??
                    "",
                ),
              ),
          )
          .slice(0, 8),
      [clients],
    );

  const clientByCode =
    useMemo(
      () =>
        new Map(
          clients.map(
            (client) => [
              String(
                client.clientId,
              ),
              client,
            ],
          ),
        ),
      [clients],
    );

  const websiteName =
    useMemo(
      () =>
        new Map(
          websites.map(
            (
              website,
              index,
            ) => [
              idOf(
                website,
                index,
              ),
              titleOf(
                website,
                "websites",
              ),
            ],
          ),
        ),
      [websites],
    );

  const counts =
    useMemo(() => {
      const result: Record<
        string,
        number
      > = {
        clients:
          clients.length,
      };

      MODULES.forEach(
        (module) => {
          result[
            module
          ] =
            (
              records[
                module
              ] ?? []
            ).length;
        },
      );

      return result;
    }, [
      clients,
      records,
    ]);

  const health =
    useMemo(
      () => ({
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
      }),
      [clients],
    );

  const dirty =
    useMemo(
      () =>
        !!settings &&
        !!draftSettings &&
        (
          JSON.stringify(
            draftSettings,
          ) !==
            JSON.stringify(
              settings,
            ) ||
          JSON.stringify(
            draftAgency,
          ) !==
            JSON.stringify(
              agencySettings,
            )
        ),
      [
        settings,
        draftSettings,
        draftAgency,
        agencySettings,
      ],
    );

  /* ---------- navigation ---------- */

  const notify = (
    message: string,
  ) =>
    setToast(
      message,
    );

  function navigate(
    next: SectionKey,
  ) {
    if (
      next ===
        section &&
      next ===
        "settings"
    ) {
      setSidebarOpen(
        false,
      );

      setProfileOpen(
        false,
      );

      return;
    }

    if (
      section ===
        "settings" &&
      next !==
        "settings" &&
      dirty &&
      !window.confirm(
        "You have unsaved settings. Leave without saving?",
      )
    ) {
      return;
    }

    setSection(next);

    setSidebarOpen(
      false,
    );

    setProfileOpen(
      false,
    );

    setSearch("");

    setStatusFilter(
      "All",
    );

    setSelectedClients(
      [],
    );

    loadEverything();

    if (
      next ===
      "clients"
    ) {
      void loadClients();
    }
  }

  async function logout() {
    try {
      await fetch(
        "/api/auth/logout",
        {
          method: "POST",
          credentials:
            "include",
        },
      );
    } catch {
      // Always clear local compatibility data below.
    }

    clearAdminSession();

    window.location.replace(
      "/",
    );
  }

  /* =======================================================
     CLIENTS
  ======================================================= */

  function openCreateClient() {
    setEditingClient(
      null,
    );

    setClientForm({
      ...emptyClientForm(),
      clientId:
        nextClientId(
          clients,
        ),
      password:
        generatePassword(
          security,
        ),
      plan:
        agencySettings.defaultClientPlan,
      assignedManager:
        agencySettings.defaultManager,
    });

    setClientModal(
      "create",
    );
  }

  function openEditClient(
    client: ExtendedClient,
  ) {
    setEditingClient(
      client,
    );

    setClientForm({
      clientId:
        client.clientId,

      username:
        client.username,

      email:
        client.email,

      /*
       * Existing password is intentionally not loaded.
       * It is hashed in MongoDB and cannot be recovered.
       */
      password: "",

      name:
        client.name,

      companyName:
        client.companyName,

      phone:
        client.phone ?? "",

      website:
        client.website ?? "",

      plan:
        client.plan ?? "",

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
        client.tags?.join(
          ", ",
        ) ?? "",

      notes:
        client.notes ?? "",

      services:
        (
          client.services ??
          client.assignedServices ??
          client.selectedServices ??
          []
        ).join(", "),
    });

    setClientModal(
      "edit",
    );
  }

  const credentialsOf = (
    client: ExtendedClient,
    password = "",
  ) => ({
    clientId:
      client.clientId,

    username:
      client.username,

    email:
      client.email,

    password,

    name:
      client.name,

    companyName:
      client.companyName,

    status:
      client.status,
  });

  async function submitClient(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (clientActionLoading) {
      return;
    }

    const form =
      clientForm;

    if (
      !form.name.trim() ||
      !form.companyName.trim() ||
      !form.email.trim() ||
      !form.username.trim()
    ) {
      return notify(
        "Name, company, email and username are required.",
      );
    }

    /*
     * Password is required for NEW clients.
     * For EDIT, leaving password empty preserves
     * the existing hashed password.
     */
    if (
      !editingClient ||
      form.password.trim()
    ) {
      const passwordError =
        validatePassword(
          form.password,
          security,
        );

      if (passwordError) {
        return notify(
          passwordError,
        );
      }
    }

    setClientActionLoading(
      true,
    );

    try {
      const payload: AnyRecord =
        {
          clientId:
            editingClient?.clientId ??
            form.clientId,

          username:
            form.username.trim(),

          email:
            form.email.trim(),

          name:
            form.name.trim(),

          companyName:
            form.companyName.trim(),

          phone:
            form.phone.trim(),

          website:
            form.website.trim(),

          plan:
            form.plan.trim(),

          assignedManager:
            form.assignedManager.trim(),

          status:
            form.status,

          clientPortalEnabled:
            form.clientPortalEnabled,

          assignedWebsiteIds:
            [
              ...form.assignedWebsiteIds,
            ],

          permissions:
            clone(
              form.permissions,
            ),

          tags:
            splitList(
              form.tags,
            ),

          notes:
            form.notes.trim(),

          services:
            splitList(
              form.services,
            ),
        };

      /*
       * Password is sent only when:
       * 1. Creating a client
       * 2. Explicitly changing password during edit
       */
      if (
        !editingClient ||
        form.password.trim()
      ) {
        payload.password =
          form.password;
      }

      const endpoint =
        editingClient
          ? `/api/admin/clients/${encodeURIComponent(
              editingClient.id,
            )}`
          : "/api/admin/clients";

      const response =
        await fetch(
          endpoint,
          {
            method:
              editingClient
                ? "PATCH"
                : "POST",

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

      const data =
        (await response.json()) as {
          success?: boolean;
          message?: string;
          client?: ExtendedClient;
          credentials?: AnyRecord;
        };

      if (
        !response.ok ||
        !data.success ||
        !data.client
      ) {
        return notify(
          data.message ??
            "Client could not be saved.",
        );
      }

      setClientModal(
        null,
      );

      setEditingClient(
        null,
      );

      await loadClients();

      /*
       * API should return plaintext credentials only
       * immediately after create/reset.
       * It should NEVER store plaintext in MongoDB.
       */
      if (
        data.credentials
      ) {
        setCredentials(
          data.credentials,
        );
      }

      notify(
        editingClient
          ? "Client updated successfully."
          : "Client created successfully.",
      );
    } catch (error) {
      console.error(
        "HCS client save error:",
        error,
      );

      notify(
        "Unable to save client.",
      );
    } finally {
      setClientActionLoading(
        false,
      );
    }
  }

  async function resetClientPassword(
    client: ExtendedClient,
  ) {
    if (clientActionLoading) {
      return;
    }

    if (
      !window.confirm(
        `Generate a new password for ${client.clientId}?`,
      )
    ) {
      return;
    }

    setClientActionLoading(
      true,
    );

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
        (await response.json()) as {
          success?: boolean;
          message?: string;
          credentials?: AnyRecord;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        return notify(
          data.message ??
            "Password reset failed.",
        );
      }

      if (
        data.credentials
      ) {
        setCredentials(
          data.credentials,
        );
      }

      await loadClients();

      notify(
        "Client password reset successfully.",
      );
    } catch (error) {
      console.error(
        "HCS client password reset error:",
        error,
      );

      notify(
        "Unable to reset client password.",
      );
    } finally {
      setClientActionLoading(
        false,
      );
    }
  }

  async function toggleClientPortal(
    client: ExtendedClient,
  ) {
    if (clientActionLoading) {
      return;
    }

    const enabled =
      client.clientPortalEnabled ===
      false;

    setClientActionLoading(
      true,
    );

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
        (await response.json()) as {
          success?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        return notify(
          data.message ??
            "Client portal update failed.",
        );
      }

      await loadClients();

      notify(
        enabled
          ? "Client portal enabled."
          : "Client portal disabled.",
      );
    } catch {
      notify(
        "Unable to update client portal.",
      );
    } finally {
      setClientActionLoading(
        false,
      );
    }
  }

  async function changeClientStatus(
    client: ExtendedClient,
    status: ClientStatus,
  ) {
    if (clientActionLoading) {
      return;
    }

    setClientActionLoading(
      true,
    );

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
                  "Active",

                clientPortalEnabled:
                  status ===
                  "Active"
                    ? client.clientPortalEnabled !==
                      false
                    : client.clientPortalEnabled,
              }),
          },
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        return notify(
          data.message ??
            "Status update failed.",
        );
      }

      await loadClients();

      notify(
        `Client status changed to ${status}.`,
      );
    } catch {
      notify(
        "Unable to update client status.",
      );
    } finally {
      setClientActionLoading(
        false,
      );
    }
  }

  async function deleteClient(
    client: ExtendedClient,
  ) {
    if (clientActionLoading) {
      return;
    }

    if (
      !window.confirm(
        `Delete ${client.clientId}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setClientActionLoading(
      true,
    );

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
          },
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        return notify(
          data.message ??
            "Client deletion failed.",
        );
      }

      setSelectedClients(
        (current) =>
          current.filter(
            (id) =>
              id !==
              client.id,
          ),
      );

      await loadClients();

      notify(
        "Client deleted successfully.",
      );
    } catch {
      notify(
        "Unable to delete client.",
      );
    } finally {
      setClientActionLoading(
        false,
      );
    }
  }

  async function applyBulkAction(
    action:
      | "enable"
      | "disable"
      | "suspend",
  ) {
    if (
      !selectedClients.length ||
      clientActionLoading
    ) {
      return;
    }

    setClientActionLoading(
      true,
    );

    try {
      const results =
        await Promise.all(
          selectedClients.map(
            async (id) => {
              let payload: AnyRecord;

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
                  active:
                    true,
                  clientPortalEnabled:
                    true,
                };
              }

              return fetch(
                `/api/admin/clients/${encodeURIComponent(
                  id,
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
            },
          ),
        );

      const failed =
        results.some(
          (result) =>
            !result.ok,
        );

      if (failed) {
        notify(
          "Some client accounts could not be updated.",
        );
      } else {
        notify(
          "Selected client accounts updated.",
        );
      }

      setSelectedClients(
        [],
      );

      await loadClients();
    } catch {
      notify(
        "Bulk client update failed.",
      );
    } finally {
      setClientActionLoading(
        false,
      );
    }
  }

  /* =======================================================
     MODULE RECORDS
  ======================================================= */

  function openRecordEditor(
    module: GenericModule,
    record?: AnyRecord,
  ) {
    setRecordModal({
      section: module,
      record,
    });
  }

  function saveModuleRecord(
    module: GenericModule,
    record: AnyRecord,
  ) {
    const current =
      readRecords(
        MODULE_KEYS[module],
      );

    const recordId =
      idOf(record);

    const index =
      current.findIndex(
        (item, itemIndex) =>
          idOf(
            item,
            itemIndex,
          ) === recordId,
      );

    const next =
      index >= 0
        ? current.map(
            (
              item,
              itemIndex,
            ) =>
              itemIndex ===
              index
                ? record
                : item,
          )
        : [
            ...current,
            record,
          ];

    writeRecords(
      module,
      next,
    );

    setRecordModal(
      null,
    );

    loadEverything();

    notify(
      `${LABEL[module]} record saved successfully.`,
    );
  }

  function deleteModuleRecord(
    module: GenericModule,
    record: AnyRecord,
  ) {
    if (
      !window.confirm(
        `Delete this ${LABEL[
          module
        ].toLowerCase()} record?`,
      )
    ) {
      return;
    }

    const recordId =
      idOf(record);

    writeRecords(
      module,
      readRecords(
        MODULE_KEYS[
          module
        ],
      ).filter(
        (
          item,
          itemIndex,
        ) =>
          idOf(
            item,
            itemIndex,
          ) !== recordId,
      ),
    );

    loadEverything();

    notify(
      "Record deleted successfully.",
    );
  }

  /* =======================================================
     SETTINGS
  ======================================================= */

  const patchAccount =
    (
      patch: AnyRecord,
    ) =>
      setDraftSettings(
        (current) =>
          current
            ? ({
                ...current,
                account: {
                  ...current.account!,
                  ...patch,
                },
                clients: [],
              } as GlobalAdminSettings)
            : current,
      );

  const patchSecurity =
    (
      patch: AnyRecord,
    ) =>
      setDraftSettings(
        (current) =>
          current
            ? ({
                ...current,
                security: {
                  ...current.security,
                  ...patch,
                },
                clients: [],
              } as GlobalAdminSettings)
            : current,
      );

  const patchAgency =
    <K extends keyof AgencySettings>(
      key: K,
      value: AgencySettings[K],
    ) =>
      setDraftAgency(
        (current) => ({
          ...current,
          [key]: value,
        }),
      );

  function saveAdminSettings() {
    if (
      !draftSettings
    ) {
      return;
    }

    /*
     * Admin password is intentionally NOT edited here.
     * Authentication uses MongoDB passwordHash.
     */
    const finalSecurity: AnyRecord =
      {
        ...draftSettings.security,
      };

    SECURITY_NUMBERS.forEach(
      ([
        key,
        ,
        minimum,
        fallback,
      ]) => {
        finalSecurity[key] =
          Math.max(
            minimum,
            Number(
              finalSecurity[key],
            ) ||
              fallback,
          );
      },
    );

    const finalSettings: GlobalAdminSettings =
      {
        ...draftSettings,
        security:
          finalSecurity,
        clients: [],
      };

    saveGlobalAdminSettings(
      finalSettings,
    );

    saveAgencySettings(
      draftAgency,
    );

    /*
     * This local snapshot is only a UI compatibility
     * cache. It is NOT the authentication source.
     */
    const currentSession =
      readAdminSession();

    if (
      currentSession
    ) {
      writeAdminSession({
        ...currentSession,

        adminId:
          finalSettings
            .account
            ?.adminId ??
          currentSession.adminId,

        username:
          finalSettings
            .account
            ?.username ??
          currentSession.username,

        email:
          finalSettings
            .account
            ?.email ??
          currentSession.email,
      });
    }

    setSettings(
      clone(
        finalSettings,
      ),
    );

    setDraftSettings(
      clone(
        finalSettings,
      ),
    );

    setAgencySettings(
      clone(
        draftAgency,
      ),
    );

    notify(
      "Settings saved successfully.",
    );
  }

  function discardSettings() {
    if (settings) {
      setDraftSettings(
        clone(settings),
      );
    }

    setDraftAgency(
      clone(
        agencySettings,
      ),
    );
  }

  /* ---------- credentials download ---------- */

  function downloadCredentialsText(
    value: AnyRecord,
  ) {
    const body = [
      "HIND CONSULTANCY SERVICES",
      "CLIENT PORTAL CREDENTIALS",
      "",
      `Client ID: ${value.clientId}`,
      `Username: ${value.username}`,
      `Email: ${value.email}`,
      `Password: ${value.password}`,
      `Status: ${value.status}`,
    ].join("\n");

    triggerDownload(
      new Blob(
        [body],
        {
          type:
            "text/plain;charset=utf-8",
        },
      ),
      `${value.clientId}-credentials.txt`,
    );
  }

  async function downloadCredentialsExe(
    value: AnyRecord,
  ) {
    try {
      const response =
        await fetch(
          "/api/client-credentials-exe",
          {
            method: "POST",

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
        return notify(
          "EXE route is not available.",
        );
      }

      triggerDownload(
        await response.blob(),
        `${value.clientId}-credentials.exe`,
      );
    } catch {
      notify(
        "Could not generate EXE credentials.",
      );
    }
  }

  function exportCurrent() {
    if (
      section ===
      "clients"
    ) {
      downloadCSV(
        "hcs-clients.csv",
        filteredClients.map(
          (client) => ({
            id: client.id,
            clientId:
              client.clientId,
            username:
              client.username,
            email:
              client.email,
            name:
              client.name,
            companyName:
              client.companyName,
            phone:
              client.phone,
            website:
              client.website,
            plan:
              client.plan,
            assignedManager:
              client.assignedManager,
            status:
              client.status,
            clientPortalEnabled:
              client.clientPortalEnabled,
            assignedWebsiteIds:
              client.assignedWebsiteIds,
            permissions:
              client.permissions,
            tags:
              client.tags,
            notes:
              client.notes,
            createdAt:
              client.createdAt,
            updatedAt:
              client.updatedAt,
          }),
        ),
      );
    } else if (
      isModule(section)
    ) {
      downloadCSV(
        `hcs-${section}.csv`,
        filteredRecords,
      );
    }
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (
    !authorized ||
    !settings
  ) {
    return (
      <main className="auth-loading">
        <Image
          src="/images/logo.png"
          alt="Hind Consultancy Services"
          width={165}
          height={58}
          priority
        />

        <span>
          Checking administrator session…
        </span>
      </main>
    );
  }

  const account =
    settings.account;

  const overview =
    MODULES.map(
      (module) => ({
        key: module,
        label:
          LABEL[module],
        value:
          counts[module] ??
          0,
      }),
    );

  const maxOverview =
    Math.max(
      1,
      ...overview.map(
        (item) =>
          item.value,
      ),
    );

  const stats: Array<
    [
      string,
      number,
      string,
      SectionKey,
    ]
  > = [
    [
      "Clients",
      counts.clients,
      "Manage clients",
      "clients",
    ],
    [
      "Active clients",
      health.active,
      "Active accounts",
      "clients",
    ],
    ...MODULES.map(
      (
        module,
      ): [
        string,
        number,
        string,
        SectionKey,
      ] => [
        LABEL[module],
        counts[
          module
        ] ?? 0,
        `Saved ${LABEL[
          module
        ].toLowerCase()}`,
        module,
      ],
    ),
  ];

  const agencyInputs = (
    list: AF,
  ) => (
    <div className="form-grid">
      {list.map(
        ([
          key,
          label,
          type,
        ]) => (
          <Field
            key={key}
            label={label}
          >
            <input
              type={
                type ??
                "text"
              }
              value={
                draftAgency[
                  key
                ]
              }
              onChange={(
                event,
              ) =>
                patchAgency(
                  key,
                  event
                    .target
                    .value,
                )
              }
            />
          </Field>
        ),
      )}
    </div>
  );

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="hcs-admin-page">
      {/* SIDEBAR */}

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
            aria-label="Close menu"
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
                key={item.key}
                type="button"
                className={`sidebar-navigation-item ${
                  section ===
                  item.key
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  navigate(
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

                {counts[
                  item.key
                ] !==
                undefined ? (
                  <em className="nav-count">
                    {
                      counts[
                        item.key
                      ]
                    }
                  </em>
                ) : null}
              </button>
            ),
          )}
        </nav>

        <div className="sidebar-bottom">
          <span className="sync-dot" />
          Global account store synchronized
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close sidebar"
          onClick={() =>
            setSidebarOpen(
              false,
            )
          }
        />
      ) : null}

      {/* MAIN */}

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-sidebar-button"
              aria-label="Open menu"
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
                {LABEL[section]}
              </h1>
            </div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="topbar-icon-button"
              aria-label="Toggle day / night mode"
              title="Day / Night"
              onClick={
                toggleTheme
              }
            >
              {theme ===
              "dark"
                ? "☀"
                : "☾"}
            </button>

            <button
              type="button"
              className="topbar-icon-button"
              title="Open client panel in a new tab"
              aria-label="Open client panel"
              onClick={() =>
                window.open(
                  CLIENT_PANEL_URL,
                  "_blank",
                  "noopener",
                )
              }
            >
              ↗
            </button>

            <button
              type="button"
              className="topbar-icon-button"
              title="Notifications"
              aria-label="Notifications"
              onClick={() =>
                navigate(
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
                  account?.fullName ??
                    "HCS",
                )}
              </span>

              <span className="profile-copy">
                <strong>
                  {txt(
                    account?.fullName,
                    "HCS Administrator",
                  )}
                </strong>

                <small>
                  {txt(
                    account?.email,
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
                    account?.fullName,
                    "HCS Administrator",
                  )}
                </strong>

                <span>
                  {txt(
                    account?.email,
                  )}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "settings",
                    )
                  }
                >
                  Agency & Security
                </button>

                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      CLIENT_PANEL_URL,
                      "_blank",
                      "noopener",
                    )
                  }
                >
                  Open client panel (new tab)
                </button>

                <button
                  type="button"
                  onClick={
                    logout
                  }
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <section
          className="admin-content"
          key={section}
        >
          {/* PAGE HEADING */}

          <div className="page-heading">
            <div>
              <span className="eyebrow">
                CONTROL CENTER
              </span>

              <h2>
                {LABEL[section]}
              </h2>

              <p>
                {section ===
                "dashboard"
                  ? "Live operational overview from saved HCS data."
                  : section ===
                      "clients"
                    ? "Manage global client accounts, access, permissions and assigned websites."
                    : section ===
                        "settings"
                      ? "Manage HCS agency identity, business details, security and appearance."
                      : `Create, update and manage ${LABEL[
                          section
                        ].toLowerCase()} records from this single control center.`}
              </p>
            </div>

            <div className="heading-actions">
              {section ===
                "clients" ||
              isModule(
                section,
              ) ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    exportCurrent
                  }
                >
                  Export CSV
                </button>
              ) : null}

              {section ===
              "clients" ? (
                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    clientActionLoading
                  }
                  onClick={
                    openCreateClient
                  }
                >
                  ＋ Create Client
                </button>
              ) : null}

              {isModule(
                section,
              ) ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    openRecordEditor(
                      section,
                      buildDefaults(
                        section,
                        agencySettings,
                      ),
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
          </div>

          {/* DASHBOARD */}

          {section ===
          "dashboard" ? (
            <>
              <div className="stats-grid">
                {stats.map(
                  (
                    [
                      label,
                      value,
                      sub,
                      target,
                    ],
                    index,
                  ) => (
                    <button
                      key={label}
                      type="button"
                      className="metric-card"
                      style={{
                        animationDelay:
                          `${index * 30}ms`,
                      }}
                      onClick={() =>
                        navigate(
                          target,
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
                <Panel
                  eyebrow="CLIENT ACCESS"
                  title="Account health"
                  action={
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        navigate(
                          "clients",
                        )
                      }
                    >
                      Manage Clients
                    </button>
                  }
                >
                  <div className="health-list">
                    <div>
                      <span>
                        Active
                      </span>
                      <strong>
                        {health.active}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Portal Enabled
                      </span>
                      <strong>
                        {health.portal}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Suspended
                      </span>
                      <strong>
                        {health.suspended}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Disabled
                      </span>
                      <strong>
                        {health.disabled}
                      </strong>
                    </div>
                  </div>
                </Panel>

                <Panel
                  eyebrow="DATA"
                  title="Records overview"
                >
                  <div className="bars">
                    {overview.map(
                      (item) => (
                        <button
                          key={
                            item.key
                          }
                          type="button"
                          className="bar-row"
                          onClick={() =>
                            navigate(
                              item.key,
                            )
                          }
                        >
                          <span>
                            {
                              item.label
                            }
                          </span>

                          <span className="bar-track">
                            <span
                              className="bar-fill"
                              style={{
                                width: `${
                                  (
                                    item.value /
                                    maxOverview
                                  ) *
                                  100
                                }%`,
                              }}
                            />
                          </span>

                          <strong>
                            {
                              item.value
                            }
                          </strong>
                        </button>
                      ),
                    )}
                  </div>
                </Panel>
              </div>

              <Panel
                eyebrow="AGENCY"
                title="HCS Profile"
                action={
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      navigate(
                        "settings",
                      )
                    }
                  >
                    Open Settings
                  </button>
                }
              >
                <div className="hcs-profile-brand">
                  <div className="hcs-profile-logo">
                    <Image
                      src="/images/logo.png"
                      alt="Hind Consultancy Services"
                      width={190}
                      height={70}
                      priority
                    />
                  </div>

                  <div className="hcs-profile-brand-copy">
                    <strong>
                      {
                        agencySettings.legalBusinessName
                      }
                    </strong>

                    <span>
                      {
                        agencySettings.tagline
                      }
                    </span>
                  </div>
                </div>

                <div className="info-list">
                  <div>
                    <span>
                      Primary Service
                    </span>

                    <strong>
                      {
                        agencySettings.primaryService
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Contact
                    </span>

                    <strong>
                      {txt(
                        agencySettings.supportEmail,
                        "Not configured",
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Timezone
                    </span>

                    <strong>
                      {
                        agencySettings.timezone
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Currency
                    </span>

                    <strong>
                      {
                        agencySettings.currency
                      }
                    </strong>
                  </div>
                </div>
              </Panel>

              <Panel
                eyebrow="QUICK ACTIONS"
                title="Agency operations"
              >
                <div className="quick-actions">
                  {NAV.filter(
                    (navigation) =>
                      navigation.key !==
                        "dashboard" &&
                      navigation.key !==
                        "settings",
                  ).map(
                    (
                      navigation,
                    ) => (
                      <button
                        key={
                          navigation.key
                        }
                        type="button"
                        className="quick-action"
                        onClick={() =>
                          navigate(
                            navigation.key,
                          )
                        }
                      >
                        <span>
                          {
                            navigation.icon
                          }
                        </span>

                        <strong>
                          {
                            navigation.label
                          }
                        </strong>
                      </button>
                    ),
                  )}
                </div>
              </Panel>

              <Panel
                eyebrow="CLIENTS"
                title="Latest accounts"
              >
                {clientLoading ? (
                  <EmptyState
                    title="Loading clients"
                    detail="Fetching global client accounts from MongoDB."
                  />
                ) : latestClients.length ? (
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
                        {latestClients.map(
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
                                  client.name ||
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
                                <StatusBadge
                                  value={
                                    client.status
                                  }
                                />
                              </td>

                              <td>
                                <StatusBadge
                                  value={
                                    client.clientPortalEnabled ===
                                    false
                                      ? "Disabled"
                                      : "Enabled"
                                  }
                                />
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="No client accounts"
                    detail="Create a client from the Clients module."
                  />
                )}
              </Panel>
            </>
          ) : null}

          {/* CLIENTS */}

          {section ===
          "clients" ? (
            <section>
              <div className="toolbar">
                <div className="toolbar-left">
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
                      placeholder="Search client, company, email, username…"
                    />

                    <kbd>
                      Ctrl K
                    </kbd>
                  </div>

                  <select
                    className="toolbar-select"
                    value={
                      statusFilter
                    }
                    onChange={(
                      event,
                    ) =>
                      setStatusFilter(
                        event
                          .target
                          .value,
                      )
                    }
                    aria-label="Filter by status"
                  >
                    {[
                      "All",
                      "Active",
                      "Suspended",
                      "Disabled",
                    ].map(
                      (status) => (
                        <option
                          key={
                            status
                          }
                        >
                          {
                            status
                          }
                        </option>
                      ),
                    )}
                  </select>
                </div>

                {selectedClients.length >
                0 ? (
                  <div className="bulk-action-bar">
                    <span>
                      {
                        selectedClients.length
                      }{" "}
                      selected
                    </span>

                    <button
                      type="button"
                      disabled={
                        clientActionLoading
                      }
                      onClick={() =>
                        applyBulkAction(
                          "enable",
                        )
                      }
                    >
                      Enable
                    </button>

                    <button
                      type="button"
                      disabled={
                        clientActionLoading
                      }
                      onClick={() =>
                        applyBulkAction(
                          "disable",
                        )
                      }
                    >
                      Disable
                    </button>

                    <button
                      type="button"
                      disabled={
                        clientActionLoading
                      }
                      onClick={() =>
                        applyBulkAction(
                          "suspend",
                        )
                      }
                    >
                      Suspend
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedClients(
                          [],
                        )
                      }
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <span className="record-count">
                    {
                      filteredClients.length
                    }{" "}
                    client
                    {filteredClients.length ===
                    1
                      ? ""
                      : "s"}
                  </span>
                )}
              </div>

              <section className="panel">
                {clientLoading ? (
                  <EmptyState
                    title="Loading global clients"
                    detail="Fetching client accounts from MongoDB."
                  />
                ) : filteredClients.length ? (
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>
                            <input
                              type="checkbox"
                              aria-label="Select all"
                              checked={
                                filteredClients.length >
                                  0 &&
                                filteredClients.every(
                                  (
                                    client,
                                  ) =>
                                    selectedClients.includes(
                                      client.id,
                                    ),
                                )
                              }
                              onChange={(
                                event,
                              ) =>
                                setSelectedClients(
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
                            index,
                          ) => (
                            <tr
                              key={
                                client.id
                              }
                              style={{
                                animationDelay:
                                  `${
                                    Math.min(
                                      index,
                                      12,
                                    ) *
                                    18
                                  }ms`,
                              }}
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${client.clientId}`}
                                  checked={selectedClients.includes(
                                    client.id,
                                  )}
                                  onChange={(
                                    event,
                                  ) =>
                                    setSelectedClients(
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
                                      client.name ||
                                        client.companyName,
                                    )}
                                  </span>

                                  <span>
                                    <strong>
                                      {txt(
                                        client.name ||
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
                                <StatusBadge
                                  value={
                                    client.status
                                  }
                                />
                              </td>

                              <td>
                                <StatusBadge
                                  value={
                                    client.clientPortalEnabled ===
                                    false
                                      ? "Disabled"
                                      : "Enabled"
                                  }
                                />
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
                                    disabled={
                                      clientActionLoading
                                    }
                                    onClick={() =>
                                      openEditClient(
                                        client,
                                      )
                                    }
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      clientActionLoading
                                    }
                                    onClick={() =>
                                      void resetClientPassword(
                                        client,
                                      )
                                    }
                                  >
                                    Reset
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      clientActionLoading
                                    }
                                    onClick={() =>
                                      void toggleClientPortal(
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
                                    disabled={
                                      clientActionLoading
                                    }
                                    onClick={() =>
                                      void changeClientStatus(
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
                                        credentialsOf(
                                          client,
                                        ),
                                      )
                                    }
                                  >
                                    Credentials
                                  </button>

                                  <button
                                    type="button"
                                    className="danger"
                                    disabled={
                                      clientActionLoading
                                    }
                                    onClick={() =>
                                      void deleteClient(
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
                  <EmptyState
                    title={
                      search ||
                      statusFilter !==
                        "All"
                        ? "No matching clients"
                        : "No clients yet"
                    }
                    detail={
                      search ||
                      statusFilter !==
                        "All"
                        ? "Try another search or filter."
                        : "Create the first client account."
                    }
                  />
                )}
              </section>
            </section>
          ) : null}

          {/* GENERIC MODULES */}

          {isModule(
            section,
          ) ? (
            <section>
              <div className="toolbar">
                <div className="toolbar-left">
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
                      ].toLowerCase()}…`}
                    />

                    <kbd>
                      Ctrl K
                    </kbd>
                  </div>
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
                            Client
                          </th>

                          <th>
                            Website / Scope
                          </th>

                          <th>
                            Status
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
                          ) => {
                            const realIndex =
                              currentRecords.indexOf(
                                record,
                              );

                            const recordId =
                              idOf(
                                record,
                                realIndex,
                              );

                            const editable =
                              {
                                ...record,
                                id:
                                  record.id ??
                                  recordId,
                              };

                            const client =
                              clientByCode.get(
                                String(
                                  record.clientId,
                                ),
                              );

                            const status =
                              txt(
                                record.status ??
                                  record.state ??
                                  record.priority,
                                "Saved",
                              );

                            return (
                              <tr
                                key={`${recordId}-${realIndex}`}
                                style={{
                                  animationDelay:
                                    `${
                                      Math.min(
                                        index,
                                        12,
                                      ) *
                                      18
                                    }ms`,
                                }}
                              >
                                <td>
                                  <strong>
                                    {
                                      titleOf(
                                        record,
                                        section,
                                      )
                                    }
                                  </strong>
                                </td>

                                <td>
                                  {client
                                    ? client.name ||
                                      client.companyName
                                    : txt(
                                        record.clientId,
                                        "Unassigned",
                                      )}
                                </td>

                                <td>
                                  {txt(
                                    record.website ??
                                      record.domain ??
                                      record.url ??
                                      record.site ??
                                      websiteName.get(
                                        String(
                                          record.websiteId,
                                        ),
                                      ) ??
                                      record.websiteId,
                                  )}
                                </td>

                                <td>
                                  <StatusBadge
                                    value={
                                      status
                                    }
                                  />
                                </td>

                                <td>
                                  {fmtDate(
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
                                        openRecordEditor(
                                          section,
                                          editable,
                                        )
                                      }
                                    >
                                      Edit
                                    </button>

                                    <button
                                      type="button"
                                      className="danger"
                                      onClick={() =>
                                        deleteModuleRecord(
                                          section,
                                          editable,
                                        )
                                      }
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title={`No ${LABEL[
                      section
                    ].toLowerCase()} records`}
                    detail={
                      search
                        ? "Nothing matches your search."
                        : "Create the first real record using the Add button above."
                    }
                  />
                )}
              </section>
            </section>
          ) : null}

          {/* SETTINGS */}

          {section ===
            "settings" &&
          draftSettings ? (
            <section>
              <div
                className="settings-tabs"
                role="tablist"
              >
                {SETTINGS_TABS.map(
                  (tab) => (
                    <button
                      key={
                        tab.key
                      }
                      type="button"
                      role="tab"
                      aria-selected={
                        settingsTab ===
                        tab.key
                      }
                      className={`settings-tab ${
                        settingsTab ===
                        tab.key
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setSettingsTab(
                          tab.key,
                        )
                      }
                    >
                      {
                        tab.label
                      }
                    </button>
                  ),
                )}
              </div>

              <div className="settings-grid">
                {settingsTab ===
                "account" ? (
                  <>
                    <Panel
                      eyebrow="ADMIN ACCOUNT"
                      title="Administrator identity"
                      span
                    >
                      <div className="form-grid">
                        {ACCOUNT_FIELDS.map(
                          ([
                            key,
                            label,
                            type,
                          ]) => (
                            <Field
                              key={key}
                              label={label}
                            >
                              <input
                                type={
                                  type ??
                                  "text"
                                }
                                value={
                                  (
                                    draftSettings.account as AnyRecord
                                  )?.[
                                    key
                                  ] ??
                                  ""
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchAccount(
                                    {
                                      [key]:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                              />
                            </Field>
                          ),
                        )}
                      </div>

                      <p className="field-help">
                        Administrator authentication is handled server-side through MongoDB and the secure HCS session cookie. These local fields are profile/settings data only.
                      </p>
                    </Panel>

                    <Panel
                      eyebrow="SECURITY"
                      title="Administrator access"
                      span
                    >
                      <label className="switch-row">
                        <input
                          type="checkbox"
                          checked={
                            draftSettings.account
                              ?.active !==
                            false
                          }
                          onChange={(
                            event,
                          ) =>
                            patchAccount(
                              {
                                active:
                                  event
                                    .target
                                    .checked,
                              },
                            )
                          }
                        />

                        <span>
                          Administrator profile marked active
                        </span>
                      </label>

                      <p className="field-help">
                        The real login password is stored as a secure MongoDB password hash. It is not stored in this page or localStorage.
                      </p>
                    </Panel>
                  </>
                ) : null}

                {settingsTab ===
                "security" ? (
                  <Panel
                    eyebrow="SECURITY POLICY"
                    title="Password, login and session policy"
                    span
                  >
                    <div className="form-grid">
                      {SECURITY_NUMBERS.map(
                        ([
                          key,
                          label,
                          minimum,
                          fallback,
                        ]) => (
                          <Field
                            key={key}
                            label={
                              label
                            }
                          >
                            <input
                              type="number"
                              min={
                                minimum
                              }
                              value={
                                (
                                  draftSettings.security as AnyRecord
                                )?.[
                                  key
                                ] ??
                                fallback
                              }
                              onChange={(
                                event,
                              ) =>
                                patchSecurity(
                                  {
                                    [key]:
                                      event
                                        .target
                                        .value ===
                                      ""
                                        ? ""
                                        : Number(
                                            event
                                              .target
                                              .value,
                                          ),
                                  },
                                )
                              }
                            />
                          </Field>
                        ),
                      )}
                    </div>

                    <div className="switch-grid">
                      {SECURITY_TOGGLES.map(
                        ([
                          key,
                          label,
                        ]) => (
                          <label
                            className="switch-row"
                            key={key}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(
                                (
                                  draftSettings.security as AnyRecord
                                )?.[
                                  key
                                ],
                              )}
                              onChange={(
                                event,
                              ) =>
                                patchSecurity(
                                  {
                                    [key]:
                                      event
                                        .target
                                        .checked,
                                  },
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
                  </Panel>
                ) : null}

                {settingsTab ===
                "agency" ? (
                  <Panel
                    eyebrow="AGENCY PROFILE"
                    title="Business identity"
                    span
                  >
                    {agencyInputs(
                      AG_IDENTITY,
                    )}

                    <div className="form-grid">
                      <Field label="Registered / Office Address">
                        <textarea
                          rows={4}
                          value={
                            draftAgency.address
                          }
                          onChange={(
                            event,
                          ) =>
                            patchAgency(
                              "address",
                              event
                                .target
                                .value,
                            )
                          }
                        />
                      </Field>

                      <Field label="Business Description">
                        <textarea
                          rows={4}
                          value={
                            draftAgency.businessDescription
                          }
                          onChange={(
                            event,
                          ) =>
                            patchAgency(
                              "businessDescription",
                              event
                                .target
                                .value,
                            )
                          }
                        />
                      </Field>
                    </div>
                  </Panel>
                ) : null}

                {settingsTab ===
                "contact" ? (
                  <>
                    <Panel
                      eyebrow="CONTACT"
                      title="Agency contact channels"
                      span
                    >
                      {agencyInputs(
                        AG_CONTACT,
                      )}
                    </Panel>

                    <Panel
                      eyebrow="SOCIAL"
                      title="Agency social profiles"
                      span
                    >
                      {agencyInputs(
                        AG_SOCIAL,
                      )}
                    </Panel>
                  </>
                ) : null}

                {settingsTab ===
                "branding" ? (
                  <Panel
                    eyebrow="BRANDING"
                    title="Visual identity"
                    span
                  >
                    <div className="branding-preview">
                      <div className="branding-logo-box">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            draftAgency.logoPath ||
                            "/images/logo.png"
                          }
                          alt="HCS logo"
                          width={180}
                          height={70}
                        />
                      </div>

                      <div>
                        <strong>
                          {
                            draftAgency.legalBusinessName
                          }
                        </strong>

                        <span>
                          {
                            draftAgency.tagline
                          }
                        </span>
                      </div>
                    </div>

                    {agencyInputs(
                      AG_BRAND,
                    )}
                  </Panel>
                ) : null}

                {settingsTab ===
                "operations" ? (
                  <Panel
                    eyebrow="OPERATIONS"
                    title="Agency defaults"
                    span
                  >
                    <div className="form-grid">
                      {AG_OPS.map(
                        ([
                          key,
                          label,
                        ]) => (
                          <Field
                            key={key}
                            label={
                              label
                            }
                          >
                            <input
                              value={
                                draftAgency[
                                  key
                                ]
                              }
                              onChange={(
                                event,
                              ) =>
                                patchAgency(
                                  key,
                                  event
                                    .target
                                    .value,
                                )
                              }
                            />
                          </Field>
                        ),
                      )}

                      <Field label="Default Report Period">
                        <select
                          value={
                            draftAgency.defaultReportPeriod
                          }
                          onChange={(
                            event,
                          ) =>
                            patchAgency(
                              "defaultReportPeriod",
                              event
                                .target
                                .value,
                            )
                          }
                        >
                          {[
                            "Weekly",
                            "Monthly",
                            "Quarterly",
                            "Yearly",
                          ].map(
                            (
                              period,
                            ) => (
                              <option
                                key={
                                  period
                                }
                              >
                                {
                                  period
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </Field>
                    </div>
                  </Panel>
                ) : null}

                {settingsTab ===
                "appearance" ? (
                  <Panel
                    eyebrow="APPEARANCE"
                    title="Day / Night mode"
                    span
                  >
                    <div className="theme-choice">
                      {(
                        [
                          "light",
                          "dark",
                        ] as const
                      ).map(
                        (mode) => (
                          <button
                            key={
                              mode
                            }
                            type="button"
                            className={`theme-option ${
                              theme ===
                              mode
                                ? "active"
                                : ""
                            }`}
                            onClick={() =>
                              setTheme(
                                mode,
                              )
                            }
                          >
                            {mode ===
                            "light"
                              ? "☀ Day"
                              : "☾ Night"}
                          </button>
                        ),
                      )}
                    </div>

                    <p className="field-help">
                      The theme applies instantly and stays in sync across the browser.
                    </p>
                  </Panel>
                ) : null}
              </div>

              <div className="sticky-save-bar">
                <span
                  className={`dirty-note ${
                    dirty
                      ? "on"
                      : ""
                  }`}
                >
                  {dirty
                    ? "Unsaved changes"
                    : "All changes saved"}
                </span>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={!dirty}
                  onClick={
                    discardSettings
                  }
                >
                  Discard Changes
                </button>

                <button
                  type="button"
                  className="primary-button"
                  disabled={!dirty}
                  onClick={
                    saveAdminSettings
                  }
                >
                  Save Settings
                </button>
              </div>
            </section>
          ) : null}
        </section>
      </main>

      {/* CLIENT MODAL */}

      {clientModal ? (
        <ClientModal
          key={
            clientModal ===
            "create"
              ? `create-${clientForm.clientId}`
              : `edit-${clientForm.clientId}`
          }
          mode={
            clientModal
          }
          form={
            clientForm
          }
          setForm={
            setClientForm
          }
          security={
            security
          }
          websites={
            websites
          }
          loading={
            clientActionLoading
          }
          onClose={() =>
            setClientModal(
              null,
            )
          }
          onSubmit={
            submitClient
          }
        />
      ) : null}

      {/* GENERIC RECORD MODAL */}

      {recordModal ? (
        <ModuleRecordModal
          key={
            idOf(
              recordModal.record ??
                {},
              0,
            ) +
            recordModal.section
          }
          section={
            recordModal.section
          }
          initial={
            recordModal.record
          }
          isNew={
            !recordModal.record ||
            !currentRecords.some(
              (record) =>
                idOf(
                  record,
                ) ===
                idOf(
                  recordModal.record!,
                ),
            )
          }
          clients={
            clients
          }
          websites={
            websites
          }
          onClose={() =>
            setRecordModal(
              null,
            )
          }
          onSave={
            saveModuleRecord
          }
        />
      ) : null}

      {/* CREDENTIALS MODAL */}

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
          onCopy={
            notify
          }
          onDownloadTxt={() =>
            downloadCredentialsText(
              credentials,
            )
          }
          onDownloadExe={() =>
            downloadCredentialsExe(
              credentials,
            )
          }
        />
      ) : null}

      {toast ? (
        <div
          className="toast"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================
   CLIENT MODAL
========================================================= */

function ClientModal({
  mode,
  form,
  setForm,
  security,
  websites,
  loading,
  onClose,
  onSubmit,
}: {
  mode:
    | "create"
    | "edit";

  form: ClientForm;

  setForm: React.Dispatch<
    React.SetStateAction<ClientForm>
  >;

  security: AnyRecord;

  websites: AnyRecord[];

  loading: boolean;

  onClose: () => void;

  onSubmit:
    (
      event: FormEvent,
    ) => void;
}) {
  const [
    showPassword,
    setShowPassword,
  ] =
    useState(false);

  const update = <
    K extends keyof ClientForm,
  >(
    key: K,
    value: ClientForm[K],
  ) =>
    setForm(
      (current) => ({
        ...current,
        [key]:
          value,
      }),
    );

  const text = (
    key:
      | "name"
      | "companyName"
      | "email"
      | "username"
      | "phone"
      | "website"
      | "plan"
      | "assignedManager",
    label: string,
    options: {
      required?: boolean;
      type?: string;
    } = {},
  ) => (
    <Field
      label={label}
      required={
        options.required
      }
    >
      <input
        required={
          options.required
        }
        type={
          options.type ??
          "text"
        }
        value={
          form[key]
        }
        onChange={(
          event,
        ) =>
          update(
            key,
            event.target
              .value,
          )
        }
      />
    </Field>
  );

  const websiteIds =
    websites.map(
      (
        website,
        index,
      ) =>
        idOf(
          website,
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
        aria-label="Close client modal"
      />

      <section
        className="drawer-modal"
        role="dialog"
        aria-modal="true"
      >
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
            aria-label="Close"
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

              {text(
                "name",
                "Client Name",
                {
                  required:
                    true,
                },
              )}

              {text(
                "companyName",
                "Company",
                {
                  required:
                    true,
                },
              )}

              {text(
                "email",
                "Email",
                {
                  required:
                    true,
                  type: "email",
                },
              )}

              {text(
                "username",
                "Username",
                {
                  required:
                    true,
                },
              )}

              {text(
                "phone",
                "Phone",
              )}

              {text(
                "website",
                "Website",
              )}

              {text(
                "plan",
                "Plan",
              )}

              {text(
                "assignedManager",
                "Manager",
              )}

              <Field label="Status">
                <select
                  value={
                    form.status
                  }
                  onChange={(
                    event,
                  ) =>
                    update(
                      "status",
                      event
                        .target
                        .value as ClientStatus,
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
                onClick={() =>
                  update(
                    "password",
                    generatePassword(
                      security,
                    ),
                  )
                }
              >
                {mode ===
                "create"
                  ? "Regenerate"
                  : "New Password"}
              </button>
            </div>

            <div className="password-field">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                aria-label="Client password"
                placeholder={
                  mode ===
                  "edit"
                    ? "Leave blank to keep current password"
                    : "Client login password"
                }
                value={
                  form.password
                }
                onChange={(
                  event,
                ) =>
                  update(
                    "password",
                    event
                      .target
                      .value,
                  )
                }
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (value) =>
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
              {mode ===
              "edit"
                ? "Leave blank to keep the existing password. Existing passwords cannot be read because only password hashes are stored."
                : "The password is sent securely to the server, hashed and stored in MongoDB. It is not stored in browser localStorage."}
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
                  update(
                    "clientPortalEnabled",
                    event
                      .target
                      .checked,
                  )
                }
              />

              <span>
                Client portal enabled
              </span>
            </label>
          </section>

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
                    update(
                      "permissions",
                      allPerms(
                        true,
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
                    update(
                      "permissions",
                      allPerms(
                        false,
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
                    update(
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
                (permission) => {
                  const enabled =
                    form.permissions[
                      permission.key
                    ];

                  return (
                    <button
                      key={
                        permission.key
                      }
                      type="button"
                      aria-pressed={
                        enabled
                      }
                      className={`permission-card ${
                        enabled
                          ? "enabled"
                          : ""
                      }`}
                      onClick={() =>
                        update(
                          "permissions",
                          {
                            ...form.permissions,
                            [
                              permission.key
                            ]:
                              !enabled,
                          },
                        )
                      }
                    >
                      <span className="permission-check">
                        {enabled
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
                          {
                            permission.description
                          }
                        </small>
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </section>

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
                      update(
                        "assignedWebsiteIds",
                        websiteIds,
                      )
                    }
                  >
                    Select All
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      update(
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
                      website,
                      index,
                    ) => {
                      const websiteId =
                        idOf(
                          website,
                          index,
                        );

                      return (
                        <label
                          className="assignment-row"
                          key={
                            websiteId
                          }
                        >
                          <input
                            type="checkbox"
                            checked={form.assignedWebsiteIds.includes(
                              websiteId,
                            )}
                            onChange={(
                              event,
                            ) =>
                              update(
                                "assignedWebsiteIds",
                                event
                                  .target
                                  .checked
                                  ? [
                                      ...form.assignedWebsiteIds,
                                      websiteId,
                                    ]
                                  : form.assignedWebsiteIds.filter(
                                      (
                                        id,
                                      ) =>
                                        id !==
                                        websiteId,
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
              <EmptyState
                title="No website records available"
                detail="Create real website records first."
              />
            )}
          </section>

          <section className="form-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  SERVICES
                </span>

                <h3>
                  Service scope
                </h3>
              </div>
            </div>

            <div className="form-grid">
              <Field label="Services">
                <input
                  value={
                    form.services
                  }
                  onChange={(
                    event,
                  ) =>
                    update(
                      "services",
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="SEO, Web Development, Content, Backlinks"
                />
              </Field>

              <Field label="Tags">
                <input
                  value={
                    form.tags
                  }
                  onChange={(
                    event,
                  ) =>
                    update(
                      "tags",
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="premium, ecommerce, monthly"
                />
              </Field>

              <Field
                label="Notes"
                wide
              >
                <textarea
                  rows={4}
                  value={
                    form.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    update(
                      "notes",
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Internal HCS notes…"
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
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading
                ? "Saving…"
                : mode ===
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
   MODULE RECORD MODAL
========================================================= */

function ModuleRecordModal({
  section,
  initial,
  isNew,
  clients,
  websites,
  onClose,
  onSave,
}: {
  section: GenericModule;
  initial?: AnyRecord;
  isNew: boolean;
  clients: ExtendedClient[];
  websites: AnyRecord[];
  onClose: () => void;
  onSave: (
    section: GenericModule,
    record: AnyRecord,
  ) => void;
}) {
  const config =
    MODULE_FORMS[section];

  const [
    form,
    setForm,
  ] =
    useState<AnyRecord>(
      () =>
        clone(
          initial ??
            {
              id:
                crypto.randomUUID(),
            },
        ),
    );

  const [
    error,
    setError,
  ] =
    useState("");

  const set =
    (
      key: string,
      value: unknown,
    ) =>
      setForm(
        (current) => ({
          ...current,
          [key]:
            value,
        }),
      );

  const clientOptions =
    clients.map(
      (client) => ({
        value:
          client.clientId,
        label: `${
          client.name ||
          client.companyName
        } — ${
          client.clientId
        }`,
      }),
    );

  const websiteOptions =
    websites.map(
      (
        website,
        index,
      ) => ({
        value:
          idOf(
            website,
            index,
          ),
        label: `${
          titleOf(
            website,
            "websites",
          )
        } — ${txt(
          website.domain ??
            website.url,
        )}`,
      }),
    );

  function selectClient(
    clientId: string,
  ) {
    const client =
      clients.find(
        (item) =>
          item.clientId ===
          clientId,
      );

    setForm(
      (current) => ({
        ...current,
        clientId,
        ...(client &&
        !current.clientEmail
          ? {
              clientEmail:
                client.email,
            }
          : {}),
        ...(client &&
        !current.manager
          ? {
              manager:
                client.assignedManager ??
                "",
            }
          : {}),
      }),
    );
  }

  function submit(
    event: FormEvent,
  ) {
    event.preventDefault();

    setError("");

    if (
      !String(
        form.id ?? "",
      ).trim()
    ) {
      setError(
        "Record ID is required.",
      );

      return;
    }

    const needsClient =
      config.fields.some(
        (field) =>
          field.t ===
            "client" &&
          field.req,
      );

    if (
      needsClient &&
      !String(
        form.clientId ??
          "",
      ).trim()
    ) {
      setError(
        "Please select a client.",
      );

      return;
    }

    onSave(
      section,
      {
        ...form,
        updatedAt:
          new Date().toISOString(),
      },
    );
  }

  function renderField(
    field: FieldDef,
  ) {
    const value =
      form[field.k] ??
      "";

    const isSelect =
      field.t ===
        "select" ||
      field.t ===
        "client" ||
      field.t ===
        "website";

    let control: ReactNode;

    if (
      field.t ===
      "textarea"
    ) {
      control = (
        <textarea
          rows={4}
          required={
            field.req
          }
          value={
            value
          }
          onChange={(
            event,
          ) =>
            set(
              field.k,
              event
                .target
                .value,
            )
          }
        />
      );
    } else if (
      isSelect
    ) {
      const options =
        field.t ===
        "client"
          ? clientOptions
          : field.t ===
              "website"
            ? websiteOptions
            : (
                field.o ??
                []
              ).map(
                (
                  option,
                ) => ({
                  value:
                    option,
                  label:
                    option,
                }),
              );

      control = (
        <select
          required={
            field.req
          }
          value={
            value
          }
          onChange={(
            event,
          ) =>
            field.t ===
            "client"
              ? selectClient(
                  event
                    .target
                    .value,
                )
              : set(
                  field.k,
                  event
                    .target
                    .value,
                )
          }
        >
          <option value="">
            Select{" "}
            {
              field.l
            }
          </option>

          {value &&
          !options.some(
            (option) =>
              option.value ===
              String(
                value,
              ),
          ) ? (
            <option
              value={
                value
              }
            >
              {
                value
              }
            </option>
          ) : null}

          {options.map(
            (option) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {
                  option.label
                }
              </option>
            ),
          )}
        </select>
      );
    } else {
      control = (
        <input
          type={
            field.t ??
            "text"
          }
          required={
            field.req
          }
          min={
            field.min
          }
          max={
            field.max
          }
          step={
            field.step
          }
          value={
            value
          }
          onChange={(
            event,
          ) =>
            set(
              field.k,
              event
                .target
                .value,
            )
          }
        />
      );
    }

    return (
      <Field
        key={
          field.k
        }
        label={
          field.l
        }
        required={
          field.req
        }
        wide={
          field.t ===
          "textarea"
        }
      >
        {
          control
        }
      </Field>
    );
  }

  return (
    <div className="modal-layer">
      <button
        type="button"
        className="modal-backdrop"
        onClick={
          onClose
        }
        aria-label="Close form"
      />

      <section
        className="drawer-modal"
        role="dialog"
        aria-modal="true"
      >
        <div className="drawer-header">
          <div>
            <span className="eyebrow">
              {
                LABEL[
                  section
                ]
              }
            </span>

            <h2>
              {isNew
                ? "Create Record"
                : "Edit Record"}
            </h2>
          </div>

          <button
            type="button"
            className="modal-close"
            aria-label="Close"
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
            submit
          }
        >
          <section className="form-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  {
                    LABEL[
                      section
                    ]
                  }
                </span>

                <h3>
                  {
                    config.sub
                  }
                </h3>
              </div>
            </div>

            <div className="form-grid">
              {config.fields.map(
                renderField,
              )}
            </div>
          </section>

          {error ? (
            <div
              className="form-error"
              role="alert"
            >
              {
                error
              }
            </div>
          ) : null}

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
              {isNew
                ? `Create ${LABEL[
                    section
                  ].replace(
                    /s$/,
                    "",
                  )}`
                : "Save Changes"}
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
  onCopy,
  onDownloadTxt,
  onDownloadExe,
}: {
  value: AnyRecord;
  onClose: () => void;
  onCopy: (
    message: string,
  ) => void;
  onDownloadTxt: () => void;
  onDownloadExe: () => void;
}) {
  const [
    reveal,
    setReveal,
  ] =
    useState(false);

  async function copy(
    text: string,
    message: string,
  ) {
    try {
      await navigator.clipboard.writeText(
        text,
      );

      onCopy(
        message,
      );
    } catch {
      onCopy(
        "Clipboard access is unavailable.",
      );
    }
  }

  const rows: Array<
    [string, string]
  > = [
    [
      "Client ID",
      String(
        value.clientId ??
          "",
      ),
    ],
    [
      "Username",
      String(
        value.username ??
          "",
      ),
    ],
    [
      "Email",
      String(
        value.email ??
          "",
      ),
    ],
  ];

  return (
    <div className="modal-layer">
      <button
        type="button"
        className="modal-backdrop"
        onClick={
          onClose
        }
        aria-label="Close credentials"
      />

      <section
        className="credentials-modal"
        role="dialog"
        aria-modal="true"
      >
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
            aria-label="Close"
            onClick={
              onClose
            }
          >
            ×
          </button>
        </div>

        <div className="credentials-body">
          {rows.map(
            ([
              label,
              valueText,
            ]) => (
              <div
                className="credential-row"
                key={
                  label
                }
              >
                <span>
                  {label}
                </span>

                <strong>
                  {
                    valueText
                  }
                </strong>
              </div>
            ),
          )}

          <div className="credential-row">
            <span>
              Password
            </span>

            <strong>
              {value.password
                ? reveal
                  ? String(
                      value.password,
                    )
                  : "•".repeat(
                      Math.min(
                        String(
                          value.password,
                        ).length,
                        14,
                      ),
                    )
                : "Password is not available for existing accounts"}

              {value.password ? (
                <button
                  type="button"
                  className="secondary-button"
                  style={{
                    minHeight: 26,
                    padding:
                      "0 8px",
                    marginLeft: 6,
                  }}
                  onClick={() =>
                    setReveal(
                      (
                        current,
                      ) =>
                        !current,
                    )
                  }
                >
                  {reveal
                    ? "Hide"
                    : "Show"}
                </button>
              ) : null}
            </strong>
          </div>

          <div className="credential-row">
            <span>
              Status
            </span>

            <strong>
              {
                value.status
              }
            </strong>
          </div>

          <div className="credential-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                copy(
                  String(
                    value.clientId ??
                      "",
                  ),
                  "Client ID copied.",
                )
              }
            >
              Copy Client ID
            </button>

            {value.password ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  copy(
                    String(
                      value.password,
                    ),
                    "Password copied.",
                  )
                }
              >
                Copy Password
              </button>
            ) : null}

            {value.password ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  copy(
                    [
                      `Client ID: ${value.clientId}`,
                      `Username: ${value.username}`,
                      `Email: ${value.email}`,
                      `Password: ${value.password}`,
                    ].join(
                      "\n",
                    ),
                    "Credentials copied.",
                  )
                }
              >
                Copy Credentials
              </button>
            ) : null}

            {value.password ? (
              <button
                type="button"
                className="secondary-button"
                onClick={
                  onDownloadTxt
                }
              >
                Download TXT
              </button>
            ) : null}

            {value.password ? (
              <button
                type="button"
                className="secondary-button"
                onClick={
                  onDownloadExe
                }
              >
                Download EXE
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}