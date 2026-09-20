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

import {
  deleteClientAccount,
  getGlobalAdminSettings,
  saveClientAccount,
  saveGlobalAdminSettings,
  type ClientAccount,
  type GlobalAdminSettings,
} from "./admin-settings";

/* =========================================================
   HCS ADMIN PANEL
   SINGLE PAGE CONTROL CENTER

   RULES
   ---------------------------------------------------------
   1. No /admin/websites route
   2. No /admin/clients route
   3. No /admin/settings route
   4. Everything works inside this single page
   5. Canonical client/account source = admin-settings.ts
   6. No Users role/system
   7. No fake/demo data
   8. Black & white design classes are preserved
   9. Existing HCS logo path = /images/logo.png
  10. Client access + permissions remain connected
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

type PermissionMap = Record<
  PermissionKey,
  boolean
>;

type AnyRecord = Record<string, any>;

type ExtendedClient = ClientAccount & {
  clientPortalEnabled?: boolean;
  permissions?: Record<string, boolean>;
  assignedWebsiteIds?: string[];
  tags?: string[];
  services?: string[];
  assignedServices?: string[];
  selectedServices?: string[];
  notes?: string;
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
  services: string[];
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

const AUTH_KEY =
  "hcs-auth-session";

const AGENCY_SETTINGS_KEY =
  "hcs-agency-settings-v1";

const AGENCY_SETTINGS_EVENT =
  "hcs-agency-settings-updated";

const PORTAL_DATA_EVENT =
  "hcs-admin-portal-data-updated";

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
    description:
      "Keyword and SEO data",
  },
  {
    key: "ranking",
    label: "Rankings",
    description:
      "Keyword positions",
  },
  {
    key: "pages",
    label: "Pages",
    description:
      "Page performance",
  },
  {
    key: "blogs",
    label: "Blogs",
    description:
      "Blog/content data",
  },
  {
    key: "backlinks",
    label: "Backlinks",
    description:
      "Backlink records",
  },
  {
    key: "technical",
    label: "Technical SEO",
    description:
      "Technical audits",
  },
  {
    key: "reports",
    label: "Reports",
    description:
      "Client reports",
  },
  {
    key: "competitors",
    label: "Competitors",
    description:
      "Competitor records",
  },
  {
    key: "notifications",
    label: "Notifications",
    description:
      "Client notifications",
  },
];

const DEFAULT_PERMISSIONS: PermissionMap = {
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

const ALL_PERMISSIONS: PermissionMap = {
  dashboard: true,
  websites: true,
  keywords: true,
  ranking: true,
  pages: true,
  blogs: true,
  backlinks: true,
  technical: true,
  reports: true,
  competitors: true,
  notifications: true,
};

const LABEL: Record<
  SectionKey,
  string
> = {
  dashboard: "Dashboard",
  clients: "Clients",
  websites: "Websites",
  keywords: "Keywords",
  ranking: "Ranking",
  pages: "Pages",
  blogs: "Blogs",
  backlinks: "Backlinks",
  technical: "Technical",
  reports: "Reports",
  competitors: "Competitors",
  notifications:
    "Notifications",
  settings: "Settings",
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

/* =========================================================
   HELPERS
========================================================= */

function clone<T>(
  value: T,
): T {
  return JSON.parse(
    JSON.stringify(value),
  ) as T;
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
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "HC";
  }

  return parts
    .map(
      (item) =>
        item[0]?.toUpperCase() ??
        "",
    )
    .join("");
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
      record.reportId ??
      record.notificationId,
    String(index + 1),
  );
}

function titleOf(
  record: AnyRecord,
  section: GenericModule,
) {
  switch (section) {
    case "websites":
      return txt(
        record.name ??
          record.domain ??
          record.url,
        "Website",
      );

    case "keywords":
    case "ranking":
      return txt(
        record.keyword ??
          record.query ??
          record.name,
        "Keyword",
      );

    case "pages":
      return txt(
        record.title ??
          record.name ??
          record.url,
        "Page",
      );

    case "blogs":
      return txt(
        record.title ??
          record.name,
        "Blog",
      );

    case "backlinks":
      return txt(
        record.targetUrl ??
          record.sourceUrl ??
          record.anchorText ??
          record.name,
        "Backlink",
      );

    case "technical":
      return txt(
        record.title ??
          record.issue ??
          record.name,
        "Technical issue",
      );

    case "reports":
      return txt(
        record.name ??
          record.title,
        "Report",
      );

    case "competitors":
      return txt(
        record.name ??
          record.domain,
        "Competitor",
      );

    case "notifications":
      return txt(
        record.title ??
          record.subject ??
          record.name,
        "Notification",
      );

    default:
      return "Record";
  }
}

/* =========================================================
   AGENCY STORAGE
========================================================= */

function defaultAgencySettings(): AgencySettings {
  return clone(
    DEFAULT_AGENCY_SETTINGS,
  );
}

function readAgencySettings(): AgencySettings {
  if (
    typeof window ===
    "undefined"
  ) {
    return defaultAgencySettings();
  }

  try {
    const raw =
      window.localStorage.getItem(
        AGENCY_SETTINGS_KEY,
      );

    if (!raw) {
      return defaultAgencySettings();
    }

    const parsed =
      JSON.parse(raw);

    return {
      ...defaultAgencySettings(),
      ...(parsed ?? {}),
    };
  } catch {
    return defaultAgencySettings();
  }
}

function saveAgencySettings(
  value: AgencySettings,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

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

/* =========================================================
   MODULE STORAGE
========================================================= */

function readRecords(
  keys: string[],
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return [] as AnyRecord[];
  }

  for (const key of keys) {
    try {
      const raw =
        window.localStorage.getItem(
          key,
        );

      if (!raw) {
        continue;
      }

      const parsed =
        JSON.parse(raw);

      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item) =>
            item &&
            typeof item ===
              "object" &&
            !Array.isArray(item),
        );
      }

      if (
        parsed &&
        typeof parsed ===
          "object" &&
        Array.isArray(
          parsed.items,
        )
      ) {
        return parsed.items.filter(
          (item: unknown) =>
            item &&
            typeof item ===
              "object" &&
            !Array.isArray(item),
        );
      }

      if (
        parsed &&
        typeof parsed ===
          "object" &&
        Array.isArray(
          parsed.data,
        )
      ) {
        return parsed.data.filter(
          (item: unknown) =>
            item &&
            typeof item ===
              "object" &&
            !Array.isArray(item),
        );
      }
    } catch {
      // Ignore invalid legacy storage.
    }
  }

  return [] as AnyRecord[];
}

function writeRecords(
  section: GenericModule,
  records: AnyRecord[],
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

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

/* =========================================================
   CLIENT HELPERS
========================================================= */

function nextClientId(
  clients: ExtendedClient[],
) {
  const numbers = clients
    .map((client) => {
      const match =
        String(
          client.clientId ?? "",
        ).match(
          /^HCS-CL-(\d+)$/i,
        );

      return match
        ? Number(match[1])
        : 0;
    })
    .filter(Number.isFinite);

  const next =
    numbers.length > 0
      ? Math.max(...numbers) + 1
      : 1;

  return `HCS-CL-${String(
    next,
  ).padStart(6, "0")}`;
}

function generatePassword(
  security:
    | GlobalAdminSettings["security"]
    | AnyRecord,
) {
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

  const required: string[] =
    [];

  if (useUpper) {
    required.push(
      upper[
        Math.floor(
          Math.random() *
            upper.length,
        )
      ],
    );
  }

  if (useNumber) {
    required.push(
      numbers[
        Math.floor(
          Math.random() *
            numbers.length,
        )
      ],
    );
  }

  if (useSpecial) {
    required.push(
      special[
        Math.floor(
          Math.random() *
            special.length,
        )
      ],
    );
  }

  const source =
    lower +
    (useUpper
      ? upper
      : "") +
    (useNumber
      ? numbers
      : "") +
    (useSpecial
      ? special
      : "");

  const minimum =
    Math.max(
      Number(
        security?.minPasswordLength ??
          8,
      ),
      8,
    );

  while (
    required.length <
    minimum
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
  security:
    | GlobalAdminSettings["security"]
    | AnyRecord,
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
    value &&
    typeof value ===
      "object"
      ? (value as Record<
          string,
          unknown
        >)
      : {};

  return {
    dashboard:
      source.dashboard !==
      undefined
        ? Boolean(
            source.dashboard,
          )
        : DEFAULT_PERMISSIONS.dashboard,

    websites:
      source.websites !==
      undefined
        ? Boolean(
            source.websites,
          )
        : DEFAULT_PERMISSIONS.websites,

    keywords:
      source.keywords !==
      undefined
        ? Boolean(
            source.keywords,
          )
        : DEFAULT_PERMISSIONS.keywords,

    ranking:
      source.ranking !==
      undefined
        ? Boolean(
            source.ranking,
          )
        : DEFAULT_PERMISSIONS.ranking,

    pages:
      source.pages !==
      undefined
        ? Boolean(
            source.pages,
          )
        : DEFAULT_PERMISSIONS.pages,

    blogs:
      source.blogs !==
      undefined
        ? Boolean(
            source.blogs,
          )
        : DEFAULT_PERMISSIONS.blogs,

    backlinks:
      source.backlinks !==
      undefined
        ? Boolean(
            source.backlinks,
          )
        : DEFAULT_PERMISSIONS.backlinks,

    technical:
      source.technical !==
      undefined
        ? Boolean(
            source.technical,
          )
        : DEFAULT_PERMISSIONS.technical,

    reports:
      source.reports !==
      undefined
        ? Boolean(
            source.reports,
          )
        : DEFAULT_PERMISSIONS.reports,

    competitors:
      source.competitors !==
      undefined
        ? Boolean(
            source.competitors,
          )
        : DEFAULT_PERMISSIONS.competitors,

    notifications:
      source.notifications !==
      undefined
        ? Boolean(
            source.notifications,
          )
        : DEFAULT_PERMISSIONS.notifications,
  };
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
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="field">
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

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  options: Array<{
    value: string;
    label: string;
  }>;
  required?: boolean;
}) {
  return (
    <Field
      label={label}
      required={required}
    >
      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
      >
        <option value="">
          Select {label}
        </option>

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
    </Field>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <Field
      label={label}
      required={required}
    >
      <textarea
        rows={rows}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        placeholder={
          placeholder
        }
      />
    </Field>
  );
}

/* =========================================================
   ADMIN PAGE
========================================================= */

export default function AdminPage() {
  const [section, setSection] =
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
    agencySettings,
    setAgencySettings,
  ] =
    useState<AgencySettings>(
      defaultAgencySettings(),
    );

  const [
    draftAgencySettings,
    setDraftAgencySettings,
  ] =
    useState<AgencySettings>(
      defaultAgencySettings(),
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
    useState<ExtendedClient | null>(
      null,
    );

  const [
    credentials,
    setCredentials,
  ] =
    useState<AnyRecord | null>(
      null,
    );

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    selectedClients,
    setSelectedClients,
  ] = useState<string[]>(
    [],
  );

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
     LOAD EVERYTHING
  ======================================================= */

  const loadEverything =
    useCallback(() => {
      const current =
        getGlobalAdminSettings();

      setSettings(current);

      setDraftSettings(
        clone(current),
      );

      const agency =
        readAgencySettings();

      setAgencySettings(
        agency,
      );

      setDraftAgencySettings(
        clone(agency),
      );

      const next: Record<
        string,
        AnyRecord[]
      > = {};

      (
        Object.keys(
          MODULE_KEYS,
        ) as GenericModule[]
      ).forEach(
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

  /* =======================================================
     AUTH CHECK
  ======================================================= */

  useEffect(() => {
    try {
      const raw =
        window.localStorage.getItem(
          AUTH_KEY,
        );

      if (!raw) {
        window.location.replace(
          "/",
        );
        return;
      }

      const session =
        JSON.parse(raw);

      const current =
        getGlobalAdminSettings();

      const account =
        current.account;

      const identifier =
        String(
          session?.adminId ??
            session?.username ??
            session?.email ??
            "",
        ).toLowerCase();

      const valid =
        session?.role ===
          "admin" &&
        account?.active !==
          false &&
        [
          account?.adminId,
          account?.username,
          account?.email,
        ]
          .filter(Boolean)
          .some(
            (value) =>
              String(
                value,
              ).toLowerCase() ===
              identifier,
          );

      if (!valid) {
        window.localStorage.removeItem(
          AUTH_KEY,
        );

        window.location.replace(
          "/",
        );

        return;
      }

      setAuthorized(true);

      loadEverything();
    } catch {
      window.localStorage.removeItem(
        AUTH_KEY,
      );

      window.location.replace(
        "/",
      );
    }
  }, [loadEverything]);

  /* =======================================================
     REAL-TIME LOCAL STORAGE SYNC
  ======================================================= */

  useEffect(() => {
    const sync = () => {
      loadEverything();
    };

    window.addEventListener(
      "hcs-admin-settings-updated",
      sync,
    );

    window.addEventListener(
      PORTAL_DATA_EVENT,
      sync,
    );

    window.addEventListener(
      AGENCY_SETTINGS_EVENT,
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
        PORTAL_DATA_EVENT,
        sync,
      );

      window.removeEventListener(
        AGENCY_SETTINGS_EVENT,
        sync,
      );

      window.removeEventListener(
        "storage",
        sync,
      );
    };
  }, [loadEverything]);

  /* =======================================================
     TOAST
  ======================================================= */

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer =
      window.setTimeout(
        () => setToast(""),
        2500,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [toast]);

  /* =======================================================
     MEMOS
  ======================================================= */

  const clients =
    useMemo(
      () =>
        (settings?.clients ??
          []) as ExtendedClient[],
      [settings],
    );

  const websites =
    records.websites ?? [];

  const currentRecords =
    section !== "dashboard" &&
    section !== "clients" &&
    section !== "settings"
      ? records[
          section
        ] ?? []
      : [];

  const filteredClients =
    clients.filter(
      (client) => {
        const term =
          search
            .trim()
            .toLowerCase();

        if (!term) {
          return true;
        }

        return JSON.stringify(
          client,
        )
          .toLowerCase()
          .includes(term);
      },
    );

  const filteredRecords =
    currentRecords.filter(
      (record) => {
        const term =
          search
            .trim()
            .toLowerCase();

        if (!term) {
          return true;
        }

        return JSON.stringify(
          record,
        )
          .toLowerCase()
          .includes(term);
      },
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
  ======================================================= */

  function navigate(
    next: SectionKey,
  ) {
    setSection(next);

    setSidebarOpen(false);

    setProfileOpen(false);

    setSearch("");
  }

  function notify(
    message: string,
  ) {
    setToast(message);
  }

  function logout() {
    window.localStorage.removeItem(
      AUTH_KEY,
    );

    window.location.replace(
      "/",
    );
  }

  /* =======================================================
     CLIENT FORM
  ======================================================= */

  function updateClientForm<
    K extends keyof ClientForm,
  >(
    key: K,
    value: ClientForm[K],
  ) {
    setClientForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  }

  function openCreateClient() {
    const security =
      settings?.security ??
      {};

    setEditingClient(null);

    setShowPassword(false);

    setClientForm({
      clientId:
        nextClientId(
          clients,
        ),

      username: "",
      email: "",

      password:
        generatePassword(
          security,
        ),

      name: "",
      companyName: "",
      phone: "",
      website: "",

      plan:
        agencySettings.defaultClientPlan,

      assignedManager:
        agencySettings.defaultManager,

      status: "Active",

      clientPortalEnabled:
        true,

      assignedWebsiteIds:
        [],

      permissions:
        clone(
          DEFAULT_PERMISSIONS,
        ),

      tags: "",
      notes: "",
      services: [],
    });

    setClientModal(
      "create",
    );
  }

  function openEditClient(
    client: ExtendedClient,
  ) {
    setEditingClient(client);

    setShowPassword(false);

    setClientForm({
      clientId:
        client.clientId,

      username:
        client.username,

      email:
        client.email,

      password:
        client.password,

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
        client.notes ??
        "",

      services:
        client.services ??
        client.assignedServices ??
        client.selectedServices ??
        [],
    });

    setClientModal(
      "edit",
    );
  }

  function submitClient(
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
      notify(
        "Name, company, email and username are required.",
      );

      return;
    }

    const passwordError =
      validatePassword(
        clientForm.password,
        security,
      );

    if (passwordError) {
      notify(
        passwordError,
      );

      return;
    }

    const duplicateUsername =
      clients.find(
        (client) =>
          client.id !==
            editingClient?.id &&
          client.username
            .toLowerCase() ===
            clientForm.username
              .trim()
              .toLowerCase(),
      );

    if (
      duplicateUsername
    ) {
      notify(
        "Username already exists.",
      );

      return;
    }

    const duplicateEmail =
      clients.find(
        (client) =>
          client.id !==
            editingClient?.id &&
          client.email
            .toLowerCase() ===
            clientForm.email
              .trim()
              .toLowerCase(),
      );

    if (duplicateEmail) {
      notify(
        "Email already exists.",
      );

      return;
    }

    const now =
      new Date().toISOString();

    const base:
      ExtendedClient =
      editingClient
        ? {
            ...editingClient,
          }
        : {
            id:
              crypto.randomUUID(),

            clientId:
              clientForm.clientId,

            username:
              clientForm.username,

            email:
              clientForm.email,

            password:
              clientForm.password,

            role: "client",

            name: "",

            companyName: "",

            status:
              clientForm.status,

            active:
              clientForm.status ===
                "Active" &&
              clientForm.clientPortalEnabled,

            createdAt: now,
          };

    const saved:
      ExtendedClient =
      {
        ...base,

        clientId:
          editingClient?.clientId ??
          clientForm.clientId,

        username:
          clientForm.username.trim(),

        email:
          clientForm.email.trim(),

        password:
          clientForm.password,

        name:
          clientForm.name.trim(),

        companyName:
          clientForm.companyName.trim(),

        phone:
          clientForm.phone.trim() ||
          undefined,

        website:
          clientForm.website.trim() ||
          undefined,

        plan:
          clientForm.plan.trim() ||
          undefined,

        assignedManager:
          clientForm.assignedManager.trim() ||
          undefined,

        status:
          clientForm.status,

        active:
          clientForm.status ===
            "Active" &&
          clientForm.clientPortalEnabled,

        updatedAt:
          now,

        clientPortalEnabled:
          clientForm.clientPortalEnabled,

        permissions:
          clone(
            clientForm.permissions,
          ),

        assignedWebsiteIds:
          [
            ...clientForm.assignedWebsiteIds,
          ],

        tags:
          clientForm.tags
            .split(",")
            .map(
              (item) =>
                item.trim(),
            )
            .filter(Boolean),

        notes:
          clientForm.notes.trim() ||
          undefined,

        services:
          [...clientForm.services] as unknown as ExtendedClient["services"],
      };

    saveClientAccount(
      saved,
    );

    setClientModal(null);

    loadEverything();

    setCredentials({
      clientId:
        saved.clientId,

      username:
        saved.username,

      email:
        saved.email,

      password:
        saved.password,

      name:
        saved.name,

      companyName:
        saved.companyName,

      status:
        saved.status,
    });

    notify(
      editingClient
        ? "Client updated successfully."
        : "Client created successfully.",
    );
  }

  function resetClientPassword(
    client: ExtendedClient,
  ) {
    const password =
      generatePassword(
        settings?.security ??
          {},
      );

    const updated:
      ExtendedClient =
      {
        ...client,

        password,

        updatedAt:
          new Date().toISOString(),
      };

    saveClientAccount(
      updated,
    );

    setCredentials({
      clientId:
        updated.clientId,

      username:
        updated.username,

      email:
        updated.email,

      password,

      name:
        updated.name,

      companyName:
        updated.companyName,

      status:
        updated.status,
    });

    loadEverything();

    notify(
      "Client password reset successfully.",
    );
  }

  function toggleClientPortal(
    client: ExtendedClient,
  ) {
    const enabled =
      client.clientPortalEnabled ===
      false;

    const updated:
      ExtendedClient =
      {
        ...client,

        clientPortalEnabled:
          enabled,

        active:
          enabled &&
          client.status ===
            "Active",

        updatedAt:
          new Date().toISOString(),
      };

    saveClientAccount(
      updated,
    );

    loadEverything();

    notify(
      enabled
        ? "Client portal enabled."
        : "Client portal disabled.",
    );
  }

  function changeClientStatus(
    client: ExtendedClient,
    status: ClientStatus,
  ) {
    const updated:
      ExtendedClient =
      {
        ...client,

        status,

        active:
          status ===
            "Active" &&
          client.clientPortalEnabled !==
            false,

        updatedAt:
          new Date().toISOString(),
      };

    saveClientAccount(
      updated,
    );

    loadEverything();

    notify(
      `Client status changed to ${status}.`,
    );
  }

  function deleteClient(
    client: ExtendedClient,
  ) {
    if (
      !window.confirm(
        `Delete ${client.clientId}?`,
      )
    ) {
      return;
    }

    deleteClientAccount(
      client.id,
    );

    setSelectedClients(
      (current) =>
        current.filter(
          (id) =>
            id !==
            client.id,
        ),
    );

    loadEverything();

    notify(
      "Client deleted successfully.",
    );
  }

  function applyBulkAction(
    action:
      | "enable"
      | "disable"
      | "suspend",
  ) {
    if (
      selectedClients.length ===
      0
    ) {
      return;
    }

    const current =
      getGlobalAdminSettings();

    const selectedSet =
      new Set(
        selectedClients,
      );

    const nextClients =
      (
        current.clients ??
        []
      ).map(
        (client) => {
          if (
            !selectedSet.has(
              client.id,
            )
          ) {
            return client;
          }

          if (
            action ===
            "disable"
          ) {
            return {
              ...client,

              status:
                "Disabled" as const,

              active: false,

              clientPortalEnabled:
                false,
            };
          }

          if (
            action ===
            "suspend"
          ) {
            return {
              ...client,

              status:
                "Suspended" as const,

              active: false,
            };
          }

          return {
            ...client,

            status:
              "Active" as const,

            active:
              client.clientPortalEnabled !==
              false,

            clientPortalEnabled:
              client.clientPortalEnabled !==
              false,
          };
        },
      );

    saveGlobalAdminSettings(
      {
        ...current,
        clients:
          nextClients,
      },
    );

    setSelectedClients(
      [],
    );

    loadEverything();

    notify(
      "Selected client accounts updated.",
    );
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

    const existingIndex =
      current.findIndex(
        (
          item: AnyRecord,
          index: number,
        ) =>
          idOf(
            item,
            index,
          ) === recordId,
      );

    const next =
      existingIndex >=
      0
        ? current.map(
            (
              item: AnyRecord,
              index: number,
            ) =>
              index ===
              existingIndex
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

    setRecordModal(null);

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

    const current =
      readRecords(
        MODULE_KEYS[module],
      );

    const next =
      current.filter(
        (
          item: AnyRecord,
          index: number,
        ) =>
          idOf(
            item,
            index,
          ) !==
          recordId,
      );

    writeRecords(
      module,
      next,
    );

    loadEverything();

    notify(
      "Record deleted successfully.",
    );
  }

  /* =======================================================
     SETTINGS
  ======================================================= */

  function saveAdminSettings() {
    if (!draftSettings) {
      return;
    }

    const passwordError =
      validatePassword(
        draftSettings.account
          ?.password ?? "",
        draftSettings.security,
      );

    if (passwordError) {
      notify(
        passwordError,
      );

      return;
    }

    saveGlobalAdminSettings(
      draftSettings,
    );

    saveAgencySettings(
      draftAgencySettings,
    );

    setSettings(
      clone(draftSettings),
    );

    setAgencySettings(
      clone(
        draftAgencySettings,
      ),
    );

    notify(
      "Agency and admin settings saved successfully.",
    );
  }

  function updateDraftAgency<
    K extends keyof AgencySettings,
  >(
    key: K,
    value: AgencySettings[K],
  ) {
    setDraftAgencySettings(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  }

  /* =======================================================
     DOWNLOAD CREDENTIALS
  ======================================================= */

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

    const blob =
      new Blob(
        [body],
        {
          type:
            "text/plain;charset=utf-8",
        },
      );

    const url =
      URL.createObjectURL(
        blob,
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

      if (!response.ok) {
        notify(
          "EXE route is not available.",
        );

        return;
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(
          blob,
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
      notify(
        "Could not generate EXE credentials.",
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
          Checking administrator
          session…
        </span>
      </main>
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="hcs-admin-page">
      {/* =================================================
          SIDEBAR
      ================================================= */}

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
                  {
                    item.icon
                  }
                </span>

                <span>
                  {
                    item.label
                  }
                </span>
              </button>
            ),
          )}
        </nav>

        <div className="sidebar-bottom">
          <span className="sync-dot" />

          Global account
          store synchronized
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

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="admin-main">
        {/* TOPBAR */}

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
                {LABEL[section]}
              </h1>
            </div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="topbar-icon-button"
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
                    navigate(
                      "settings",
                    )
                  }
                >
                  Agency & Security
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

        {/* CONTENT */}

        <section className="admin-content">
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
                    ? "Manage client accounts, access, permissions and assigned websites."
                    : section ===
                        "settings"
                      ? "Manage HCS agency identity, business details, security and operating defaults."
                      : `Create, update and manage ${LABEL[
                          section
                        ].toLowerCase()} records from this single control center.`}
              </p>
            </div>

            <div>
              {section ===
              "clients" ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    openCreateClient
                  }
                >
                  ＋ Create Client
                </button>
              ) : null}

              {section !==
                "dashboard" &&
              section !==
                "clients" &&
              section !==
                "settings" ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    openRecordEditor(
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
          </div>

          {/* =================================================
              DASHBOARD
          ================================================= */}

          {section ===
          "dashboard" ? (
            <>
              {/* STATS */}

              <div className="stats-grid">
                {[
                  [
                    "CLIENTS",
                    metrics.clients,
                    "Manage clients",
                    "clients",
                  ],

                  [
                    "ACTIVE CLIENTS",
                    metrics.active,
                    "Active accounts",
                    "clients",
                  ],

                  [
                    "WEBSITES",
                    metrics.websites,
                    "Saved websites",
                    "websites",
                  ],

                  [
                    "KEYWORDS",
                    metrics.keywords,
                    "Saved keywords",
                    "keywords",
                  ],

                  [
                    "RANKING",
                    metrics.ranking,
                    "Ranking records",
                    "ranking",
                  ],

                  [
                    "PAGES",
                    metrics.pages,
                    "Saved pages",
                    "pages",
                  ],

                  [
                    "BLOGS",
                    metrics.blogs,
                    "Saved blogs",
                    "blogs",
                  ],

                  [
                    "BACKLINKS",
                    metrics.backlinks,
                    "Saved backlinks",
                    "backlinks",
                  ],

                  [
                    "TECHNICAL",
                    metrics.technical,
                    "Technical issues",
                    "technical",
                  ],

                  [
                    "REPORTS",
                    metrics.reports,
                    "Saved reports",
                    "reports",
                  ],

                  [
                    "COMPETITORS",
                    metrics.competitors,
                    "Competitor records",
                    "competitors",
                  ],

                  [
                    "NOTIFICATIONS",
                    metrics.notifications,
                    "Saved notifications",
                    "notifications",
                  ],
                ].map(
                  (item) => (
                    <button
                      key={
                        item[0]
                      }
                      type="button"
                      className="metric-card"
                      onClick={() =>
                        navigate(
                          item[3] as SectionKey,
                        )
                      }
                    >
                      <span>
                        {
                          item[0]
                        }
                      </span>

                      <strong>
                        {
                          item[1]
                        }
                      </strong>

                      <small>
                        {
                          item[2]
                        }
                      </small>
                    </button>
                  ),
                )}
              </div>

              {/* DASHBOARD GRID */}

              <div className="dashboard-grid">
                {/* CLIENT ACCESS */}

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
                        navigate(
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

                {/* AGENCY PROFILE + SECOND LOGO */}

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        AGENCY
                      </span>

                      <h3>
                        HCS Profile
                      </h3>
                    </div>

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
                  </div>

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
                        Business
                      </span>

                      <strong>
                        {
                          agencySettings.legalBusinessName
                        }
                      </strong>
                    </div>

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
                </section>
              </div>

              {/* QUICK ACTIONS */}

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      QUICK ACTIONS
                    </span>

                    <h3>
                      Agency operations
                    </h3>
                  </div>
                </div>

                <div className="quick-actions">
                  {NAV.filter(
                    (item) =>
                      item.key !==
                        "dashboard" &&
                      item.key !==
                        "settings",
                  ).map(
                    (item) => (
                      <button
                        key={
                          item.key
                        }
                        type="button"
                        className="quick-action"
                        onClick={() =>
                          navigate(
                            item.key,
                          )
                        }
                      >
                        <span>
                          {
                            item.icon
                          }
                        </span>

                        <strong>
                          {
                            item.label
                          }
                        </strong>
                      </button>
                    ),
                  )}
                </div>
              </section>

              {/* LATEST CLIENTS */}

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
                  <EmptyState
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
                    value={search}
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
                          ) => (
                            <tr
                              key={
                                client.id
                              }
                            >
                              <td>
                                <input
                                  type="checkbox"
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
                                      openEditClient(
                                        client,
                                      )
                                    }
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      resetClientPassword(
                                        client,
                                      )
                                    }
                                  >
                                    Reset
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleClientPortal(
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
                                      changeClientStatus(
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
                                          password:
                                            client.password,
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
                                      deleteClient(
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
              GENERIC MODULES
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
                    value={search}
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
                            const client =
                              clients.find(
                                (
                                  item,
                                ) =>
                                  String(
                                    item.clientId,
                                  ) ===
                                  String(
                                    record.clientId,
                                  ),
                              );

                            return (
                              <tr
                                key={`${idOf(
                                  record,
                                  index,
                                )}-${index}`}
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
                                      record.websiteId,
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
                                        deleteModuleRecord(
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
                    detail="Create the first real record using the Add button above."
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
                {/* ADMIN ACCOUNT */}

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
                                        ...current.account!,

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
                                        ...current.account!,

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
                                        ...current.account!,

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
                        type="email"
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
                                        ...current.account!,

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
                                        ...current.account!,

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
                                        ...current.account!,

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

                {/* ADMIN PASSWORD */}

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        SECURITY
                      </span>

                      <h3>
                        Admin login security
                      </h3>
                    </div>
                  </div>

                  <Field label="Admin Password">
                    <input
                      type="password"
                      value={
                        draftSettings
                          .account
                          ?.password ??
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
                                      ...current.account!,

                                      password:
                                        event
                                          .target
                                          .value,

                                      loginPassword:
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

                  <p className="field-help">
                    This password is
                    used by the unified
                    Admin login.
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
                                      ...current.account!,

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
                      Administrator account
                      active
                    </span>
                  </label>
                </section>

                {/* SECURITY POLICY */}

                <section className="panel settings-span">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        SECURITY POLICY
                      </span>

                      <h3>
                        Password, login and
                        session policy
                      </h3>
                    </div>
                  </div>

                  <div className="form-grid">
                    <Field label="Minimum Password Length">
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

                    <Field label="Session Timeout (minutes)">
                      <input
                        type="number"
                        min={5}
                        value={
                          (
                            draftSettings.security as AnyRecord
                          )
                            ?.sessionTimeoutMinutes ??
                          60
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

                                        sessionTimeoutMinutes:
                                          Math.max(
                                            5,
                                            Number(
                                              event
                                                .target
                                                .value,
                                            ) ||
                                              60,
                                          ),
                                      } as any,
                                  }
                                : current,
                          )
                        }
                      />
                    </Field>

                    <Field label="Password Expiry Days">
                      <input
                        type="number"
                        min={0}
                        value={
                          (
                            draftSettings.security as AnyRecord
                          )
                            ?.passwordExpiryDays ??
                          0
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

                                        passwordExpiryDays:
                                          Math.max(
                                            0,
                                            Number(
                                              event
                                                .target
                                                .value,
                                            ) ||
                                              0,
                                          ),
                                      } as any,
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
                      (setting) => (
                        <label
                          className="switch-row"
                          key={
                            setting[0]
                          }
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(
                              (
                                (
                                  draftSettings.security ??
                                  {}
                                ) as AnyRecord
                              )[
                                setting[0]
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

                                            [setting[0]]:
                                              event
                                                .target
                                                .checked,
                                          } as any,
                                      }
                                    : current,
                              )
                            }
                          />

                          <span>
                            {
                              setting[1]
                            }
                          </span>
                        </label>
                      ),
                    )}
                  </div>
                </section>

                {/* AGENCY PROFILE */}

                <section className="panel settings-span">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        AGENCY PROFILE
                      </span>

                      <h3>
                        Business identity
                      </h3>
                    </div>
                  </div>

                  <div className="form-grid">
                    <Field label="Legal Business Name">
                      <input
                        value={
                          draftAgencySettings.legalBusinessName
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "legalBusinessName",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Tagline">
                      <input
                        value={
                          draftAgencySettings.tagline
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "tagline",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Registration Type">
                      <input
                        value={
                          draftAgencySettings.registrationType
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "registrationType",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="GSTIN">
                      <input
                        value={
                          draftAgencySettings.gstin
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "gstin",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="PAN">
                      <input
                        value={
                          draftAgencySettings.pan
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "pan",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="CIN / Registration Number">
                      <input
                        value={
                          draftAgencySettings.cin
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "cin",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Primary Service">
                      <input
                        value={
                          draftAgencySettings.primaryService
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "primaryService",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Default Client Plan">
                      <input
                        value={
                          draftAgencySettings.defaultClientPlan
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "defaultClientPlan",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Business Hours">
                      <input
                        value={
                          draftAgencySettings.businessHours
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "businessHours",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Currency">
                      <input
                        value={
                          draftAgencySettings.currency
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "currency",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Timezone">
                      <input
                        value={
                          draftAgencySettings.timezone
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "timezone",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Country">
                      <input
                        value={
                          draftAgencySettings.country
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "country",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="City">
                      <input
                        value={
                          draftAgencySettings.city
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "city",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="State">
                      <input
                        value={
                          draftAgencySettings.state
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "state",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Pincode">
                      <input
                        value={
                          draftAgencySettings.pincode
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "pincode",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>
                  </div>

                  <div className="form-grid">
                    <TextAreaField
                      label="Registered / Office Address"
                      value={
                        draftAgencySettings.address
                      }
                      onChange={(
                        value,
                      ) =>
                        updateDraftAgency(
                          "address",
                          value,
                        )
                      }
                    />

                    <TextAreaField
                      label="Business Description"
                      value={
                        draftAgencySettings.businessDescription
                      }
                      onChange={(
                        value,
                      ) =>
                        updateDraftAgency(
                          "businessDescription",
                          value,
                        )
                      }
                    />
                  </div>
                </section>

                {/* CONTACT */}

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        CONTACT
                      </span>

                      <h3>
                        Agency contact channels
                      </h3>
                    </div>
                  </div>

                  <div className="form-grid">
                    <Field label="WhatsApp Number">
                      <input
                        value={
                          draftAgencySettings.whatsappNumber
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "whatsappNumber",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Support Phone">
                      <input
                        value={
                          draftAgencySettings.supportPhone
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "supportPhone",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Sales Phone">
                      <input
                        value={
                          draftAgencySettings.salesPhone
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "salesPhone",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Support Email">
                      <input
                        type="email"
                        value={
                          draftAgencySettings.supportEmail
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "supportEmail",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Sales Email">
                      <input
                        type="email"
                        value={
                          draftAgencySettings.salesEmail
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "salesEmail",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Billing Email">
                      <input
                        type="email"
                        value={
                          draftAgencySettings.billingEmail
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "billingEmail",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Business Website">
                      <input
                        value={
                          draftAgencySettings.brandWebsite
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "brandWebsite",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>
                  </div>
                </section>

                {/* BRANDING */}

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        BRANDING
                      </span>

                      <h3>
                        Visual identity
                      </h3>
                    </div>
                  </div>

                  <div className="branding-preview">
                    <div className="branding-logo-box">
                      <Image
                        src={
                          draftAgencySettings.logoPath ||
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
                          draftAgencySettings.legalBusinessName
                        }
                      </strong>

                      <span>
                        {
                          draftAgencySettings.tagline
                        }
                      </span>
                    </div>
                  </div>

                  <div className="form-grid">
                    <Field label="Logo Path">
                      <input
                        value={
                          draftAgencySettings.logoPath
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "logoPath",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Favicon Path">
                      <input
                        value={
                          draftAgencySettings.faviconPath
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "faviconPath",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>
                  </div>
                </section>

                {/* SOCIAL */}

                <section className="panel settings-span">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        SOCIAL
                      </span>

                      <h3>
                        Agency social profiles
                      </h3>
                    </div>
                  </div>

                  <div className="form-grid">
                    <Field label="LinkedIn">
                      <input
                        value={
                          draftAgencySettings.linkedin
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "linkedin",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Instagram">
                      <input
                        value={
                          draftAgencySettings.instagram
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "instagram",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Facebook">
                      <input
                        value={
                          draftAgencySettings.facebook
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "facebook",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="X / Twitter">
                      <input
                        value={
                          draftAgencySettings.x
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "x",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="YouTube">
                      <input
                        value={
                          draftAgencySettings.youtube
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "youtube",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>
                  </div>
                </section>

                {/* OPERATIONS */}

                <section className="panel settings-span">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        OPERATIONS
                      </span>

                      <h3>
                        Agency defaults
                      </h3>
                    </div>
                  </div>

                  <div className="form-grid">
                    <Field label="Default Manager">
                      <input
                        value={
                          draftAgencySettings.defaultManager
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "defaultManager",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Lead Source">
                      <input
                        value={
                          draftAgencySettings.leadSource
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "leadSource",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Default Report Name">
                      <input
                        value={
                          draftAgencySettings.defaultReportName
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "defaultReportName",
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Default Report Period">
                      <select
                        value={
                          draftAgencySettings.defaultReportPeriod
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDraftAgency(
                            "defaultReportPeriod",
                            event
                              .target
                              .value,
                          )
                        }
                      >
                        <option value="Weekly">
                          Weekly
                        </option>

                        <option value="Monthly">
                          Monthly
                        </option>

                        <option value="Quarterly">
                          Quarterly
                        </option>

                        <option value="Yearly">
                          Yearly
                        </option>
                      </select>
                    </Field>
                  </div>
                </section>
              </div>

              <div className="sticky-save-bar">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setDraftSettings(
                      clone(
                        settings,
                      ),
                    );

                    setDraftAgencySettings(
                      clone(
                        agencySettings,
                      ),
                    );
                  }}
                >
                  Discard Changes
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    saveAdminSettings
                  }
                >
                  Save Agency Settings
                </button>
              </div>
            </section>
          ) : null}
        </section>
      </main>

      {/* =====================================================
          CLIENT MODAL
      ===================================================== */}

      {clientModal ? (
        <ClientModal
          mode={
            clientModal
          }
          form={
            clientForm
          }
          setForm={
            setClientForm
          }
          showPassword={
            showPassword
          }
          setShowPassword={
            setShowPassword
          }
          security={
            settings?.security ??
            {}
          }
          websites={
            websites
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

      {/* =====================================================
          MODULE FORM MODAL
      ===================================================== */}

      {recordModal ? (
        <ModuleRecordModal
          section={
            recordModal.section
          }
          initial={
            recordModal.record
          }
          clients={
            clients
          }
          websites={
            websites
          }
          agencySettings={
            agencySettings
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

      {/* =====================================================
          CREDENTIAL MODAL
      ===================================================== */}

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
          onCopy={(message) =>
            notify(message)
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
        <div className="toast">
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
  showPassword,
  setShowPassword,
  security,
  websites,
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

  showPassword: boolean;

  setShowPassword: React.Dispatch<
    React.SetStateAction<boolean>
  >;

  security:
    | GlobalAdminSettings["security"]
    | AnyRecord;

  websites: AnyRecord[];

  onClose: () => void;

  onSubmit: (
    event: FormEvent,
  ) => void;
}) {
  function update<
    K extends keyof ClientForm,
  >(
    key: K,
    value: ClientForm[K],
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  }

  function regeneratePassword() {
    update(
      "password",
      generatePassword(
        security,
      ),
    );
  }

  function togglePermission(
    key: PermissionKey,
  ) {
    update(
      "permissions",
      {
        ...form.permissions,

        [key]:
          !form.permissions[
            key
          ],
      },
    );
  }

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
        onClick={onClose}
        aria-label="Close client modal"
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
            onClick={onClose}
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
                  01 / IDENTITY
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

              <Field
                label="Client Name"
                required
              >
                <input
                  required
                  value={
                    form.name
                  }
                  onChange={(
                    event,
                  ) =>
                    update(
                      "name",
                      event
                        .target
                        .value,
                    )
                  }
                />
              </Field>

              <Field
                label="Company"
                required
              >
                <input
                  required
                  value={
                    form.companyName
                  }
                  onChange={(
                    event,
                  ) =>
                    update(
                      "companyName",
                      event
                        .target
                        .value,
                    )
                  }
                />
              </Field>

              <Field
                label="Email"
                required
              >
                <input
                  required
                  type="email"
                  value={
                    form.email
                  }
                  onChange={(
                    event,
                  ) =>
                    update(
                      "email",
                      event
                        .target
                        .value,
                    )
                  }
                />
              </Field>

              <Field
                label="Username"
                required
              >
                <input
                  required
                  value={
                    form.username
                  }
                  onChange={(
                    event,
                  ) =>
                    update(
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
                    update(
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
                    update(
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
                    update(
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
                    update(
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
                    update(
                      "status",
                      event
                        .target
                        .value as ClientStatus,
                    )
                  }
                >
                  <option value="Active">
                    Active
                  </option>

                  <option value="Suspended">
                    Suspended
                  </option>

                  <option value="Disabled">
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
                  02 / SECURITY
                </span>

                <h3>
                  Portal credentials
                </h3>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={
                  regeneratePassword
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
              Uses the Admin password
              security policy.
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

          {/* PERMISSIONS */}

          <section className="form-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  03 / PERMISSIONS
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
                    update(
                      "permissions",
                      {
                        dashboard:
                          false,
                        websites:
                          false,
                        keywords:
                          false,
                        ranking:
                          false,
                        pages:
                          false,
                        blogs:
                          false,
                        backlinks:
                          false,
                        technical:
                          false,
                        reports:
                          false,
                        competitors:
                          false,
                        notifications:
                          false,
                      },
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
                (
                  permission,
                ) => {
                  const enabled =
                    form
                      .permissions[
                      permission.key
                    ];

                  return (
                    <button
                      key={
                        permission.key
                      }
                      type="button"
                      className={`permission-card ${
                        enabled
                          ? "enabled"
                          : ""
                      }`}
                      onClick={() =>
                        togglePermission(
                          permission.key,
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

          {/* WEBSITES */}

          <section className="form-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  04 / WEBSITE SCOPE
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

                      const checked =
                        form.assignedWebsiteIds.includes(
                          websiteId,
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
                            checked={
                              checked
                            }
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
                              {titleOf(
                                website,
                                "websites",
                              )}
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

          {/* SERVICES */}

          <section className="form-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  05 / SERVICES
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
                    form.services.join(
                      ", ",
                    )
                  }
                  onChange={(
                    event,
                  ) =>
                    update(
                      "services",
                      event
                        .target
                        .value
                        .split(",")
                        .map(
                          (
                            item,
                          ) =>
                            item.trim(),
                        )
                        .filter(
                          Boolean,
                        ),
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

              <TextAreaField
                label="Notes"
                value={
                  form.notes
                }
                onChange={(
                  value,
                ) =>
                  update(
                    "notes",
                    value,
                  )
                }
                placeholder="Internal HCS notes..."
              />
            </div>
          </section>

          {/* FOOTER */}

          <div className="drawer-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
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
   MODULE RECORD MODAL
========================================================= */

function ModuleRecordModal({
  section,
  initial,
  clients,
  websites,
  agencySettings,
  onClose,
  onSave,
}: {
  section: GenericModule;

  initial?: AnyRecord;

  clients: ExtendedClient[];

  websites: AnyRecord[];

  agencySettings: AgencySettings;

  onClose: () => void;

  onSave: (
    section: GenericModule,
    record: AnyRecord,
  ) => void;
}) {
  const [
    form,
    setForm,
  ] =
    useState<AnyRecord>(
      () =>
        initial
          ? clone(initial)
          : {
              id:
                crypto.randomUUID(),

              status:
                "Active",

              createdAt:
                new Date().toISOString(),
            },
    );

  const [
    error,
    setError,
  ] = useState("");

  const clientOptions =
    clients.map(
      (client) => ({
        value:
          client.clientId,

        label: `${client.name || client.companyName} — ${client.clientId}`,
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

        label: `${titleOf(
          website,
          "websites",
        )} — ${txt(
          website.domain ??
            website.url,
        )}`,
      }),
    );

  function set(
    key: string,
    value: unknown,
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  }

  function selectClient(
    clientId: string,
  ) {
    set(
      "clientId",
      clientId,
    );

    const client =
      clients.find(
        (item) =>
          item.clientId ===
          clientId,
      );

    if (
      client &&
      !form.clientEmail
    ) {
      set(
        "clientEmail",
        client.email,
      );
    }

    if (
      client &&
      !form.manager
    ) {
      set(
        "manager",
        client.assignedManager ??
          "",
      );
    }
  }

  function submit(
    event: FormEvent,
  ) {
    event.preventDefault();

    setError("");

    if (
      !form.id ||
      !String(
        form.id,
      ).trim()
    ) {
      setError(
        "Record ID is required.",
      );

      return;
    }

    if (
      section !==
        "websites" &&
      section !==
        "notifications" &&
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

    const prepared = {
      ...form,

      updatedAt:
        new Date().toISOString(),
    };

    onSave(
      section,
      prepared,
    );
  }

  const formTitle =
    initial
      ? "Edit Record"
      : "Create Record";

  return (
    <div className="modal-layer">
      <button
        type="button"
        className="modal-backdrop"
        onClick={onClose}
        aria-label="Close module form"
      />

      <section className="drawer-modal">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">
              {LABEL[section]}
            </span>

            <h2>
              {formTitle}
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
          onSubmit={submit}
        >
          {/* ==============================================
              WEBSITES
          ============================================== */}

          {section ===
          "websites" ? (
            <>
              <section className="form-card">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      WEBSITE
                    </span>

                    <h3>
                      Website profile
                    </h3>
                  </div>
                </div>

                <div className="form-grid">
                  <Field
                    label="Website Name"
                    required
                  >
                    <input
                      required
                      value={
                        form.name ??
                        ""
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

                  <Field
                    label="Domain"
                    required
                  >
                    <input
                      required
                      value={
                        form.domain ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "domain",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Website URL">
                    <input
                      type="url"
                      value={
                        form.url ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "url",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <SelectField
                    label="Client"
                    value={
                      form.clientId ??
                      ""
                    }
                    onChange={
                      selectClient
                    }
                    options={
                      clientOptions
                    }
                  />

                  <Field label="Manager">
                    <input
                      value={
                        form.manager ??
                        agencySettings.defaultManager
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "manager",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <SelectField
                    label="Status"
                    value={
                      form.status ??
                      "Active"
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "status",
                        value,
                      )
                    }
                    options={[
                      {
                        value:
                          "Active",
                        label:
                          "Active",
                      },
                      {
                        value:
                          "Paused",
                        label:
                          "Paused",
                      },
                      {
                        value:
                          "Completed",
                        label:
                          "Completed",
                      },
                      {
                        value:
                          "Inactive",
                        label:
                          "Inactive",
                      },
                    ]}
                  />
                </div>
              </section>

              <section className="form-card">
                <div className="form-grid">
                  <Field label="Primary Service">
                    <input
                      value={
                        form.service ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "service",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Start Date">
                    <input
                      type="date"
                      value={
                        form.startDate ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "startDate",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Target Country">
                    <input
                      value={
                        form.targetCountry ??
                        "India"
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "targetCountry",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <TextAreaField
                    label="Notes"
                    value={
                      form.notes ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "notes",
                        value,
                      )
                    }
                  />
                </div>
              </section>
            </>
          ) : null}

          {/* ==============================================
              KEYWORDS
          ============================================== */}

          {section ===
          "keywords" ? (
            <>
              <section className="form-card">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      KEYWORD
                    </span>

                    <h3>
                      SEO keyword record
                    </h3>
                  </div>
                </div>

                <div className="form-grid">
                  <SelectField
                    label="Client"
                    value={
                      form.clientId ??
                      ""
                    }
                    onChange={
                      selectClient
                    }
                    options={
                      clientOptions
                    }
                    required
                  />

                  <SelectField
                    label="Website"
                    value={
                      form.websiteId ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "websiteId",
                        value,
                      )
                    }
                    options={
                      websiteOptions
                    }
                  />

                  <Field
                    label="Keyword"
                    required
                  >
                    <input
                      required
                      value={
                        form.keyword ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "keyword",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <SelectField
                    label="Search Intent"
                    value={
                      form.intent ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "intent",
                        value,
                      )
                    }
                    options={[
                      {
                        value:
                          "Informational",
                        label:
                          "Informational",
                      },
                      {
                        value:
                          "Commercial",
                        label:
                          "Commercial",
                      },
                      {
                        value:
                          "Transactional",
                        label:
                          "Transactional",
                      },
                      {
                        value:
                          "Navigational",
                        label:
                          "Navigational",
                      },
                    ]}
                  />

                  <Field label="Search Volume">
                    <input
                      type="number"
                      min={0}
                      value={
                        form.searchVolume ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "searchVolume",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Difficulty">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={
                        form.difficulty ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "difficulty",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Target URL">
                    <input
                      value={
                        form.targetUrl ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "targetUrl",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <SelectField
                    label="Status"
                    value={
                      form.status ??
                      "Active"
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "status",
                        value,
                      )
                    }
                    options={[
                      {
                        value:
                          "Active",
                        label:
                          "Active",
                      },
                      {
                        value:
                          "Tracking",
                        label:
                          "Tracking",
                      },
                      {
                        value:
                          "Paused",
                        label:
                          "Paused",
                      },
                    ]}
                  />
                </div>
              </section>

              <section className="form-card">
                <TextAreaField
                  label="Keyword Notes"
                  value={
                    form.notes ??
                    ""
                  }
                  onChange={(
                    value,
                  ) =>
                    set(
                      "notes",
                      value,
                    )
                  }
                />
              </section>
            </>
          ) : null}

          {/* ==============================================
              RANKING
          ============================================== */}

          {section ===
          "ranking" ? (
            <>
              <section className="form-card">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      RANKING
                    </span>

                    <h3>
                      Keyword ranking
                      snapshot
                    </h3>
                  </div>
                </div>

                <div className="form-grid">
                  <SelectField
                    label="Client"
                    value={
                      form.clientId ??
                      ""
                    }
                    onChange={
                      selectClient
                    }
                    options={
                      clientOptions
                    }
                    required
                  />

                  <SelectField
                    label="Website"
                    value={
                      form.websiteId ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "websiteId",
                        value,
                      )
                    }
                    options={
                      websiteOptions
                    }
                  />

                  <Field
                    label="Keyword"
                    required
                  >
                    <input
                      required
                      value={
                        form.keyword ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "keyword",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Search Engine">
                    <select
                      value={
                        form.searchEngine ??
                        "Google"
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "searchEngine",
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      <option>
                        Google
                      </option>

                      <option>
                        Bing
                      </option>

                      <option>
                        Yahoo
                      </option>
                    </select>
                  </Field>

                  <Field label="Device">
                    <select
                      value={
                        form.device ??
                        "Desktop"
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "device",
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      <option>
                        Desktop
                      </option>

                      <option>
                        Mobile
                      </option>

                      <option>
                        Tablet
                      </option>
                    </select>
                  </Field>

                  <Field label="Current Position">
                    <input
                      type="number"
                      min={0}
                      value={
                        form.currentPosition ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "currentPosition",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Previous Position">
                    <input
                      type="number"
                      min={0}
                      value={
                        form.previousPosition ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "previousPosition",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Tracking Date">
                    <input
                      type="date"
                      value={
                        form.date ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "date",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>
                </div>
              </section>

              <section className="form-card">
                <div className="form-grid">
                  <Field label="Target URL">
                    <input
                      value={
                        form.targetUrl ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "targetUrl",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="SERP Feature">
                    <input
                      value={
                        form.serpFeature ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "serpFeature",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <TextAreaField
                    label="Ranking Notes"
                    value={
                      form.notes ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "notes",
                        value,
                      )
                    }
                  />
                </div>
              </section>
            </>
          ) : null}

          {/* ==============================================
              PAGES
          ============================================== */}

          {section ===
          "pages" ? (
            <>
              <section className="form-card">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      PAGE
                    </span>

                    <h3>
                      Website page performance
                    </h3>
                  </div>
                </div>

                <div className="form-grid">
                  <SelectField
                    label="Client"
                    value={
                      form.clientId ??
                      ""
                    }
                    onChange={
                      selectClient
                    }
                    options={
                      clientOptions
                    }
                    required
                  />

                  <SelectField
                    label="Website"
                    value={
                      form.websiteId ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "websiteId",
                        value,
                      )
                    }
                    options={
                      websiteOptions
                    }
                    required
                  />

                  <Field
                    label="Page Title"
                    required
                  >
                    <input
                      required
                      value={
                        form.title ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "title",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field
                    label="Page URL"
                    required
                  >
                    <input
                      required
                      value={
                        form.url ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "url",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Clicks">
                    <input
                      type="number"
                      min={0}
                      value={
                        form.clicks ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "clicks",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Impressions">
                    <input
                      type="number"
                      min={0}
                      value={
                        form.impressions ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "impressions",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Average Position">
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={
                        form.averagePosition ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "averagePosition",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <SelectField
                    label="Status"
                    value={
                      form.status ??
                      "Active"
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "status",
                        value,
                      )
                    }
                    options={[
                      {
                        value:
                          "Active",
                        label:
                          "Active",
                      },
                      {
                        value:
                          "Needs Update",
                        label:
                          "Needs Update",
                      },
                      {
                        value:
                          "Optimized",
                        label:
                          "Optimized",
                      },
                    ]}
                  />
                </div>
              </section>

              <section className="form-card">
                <div className="form-grid">
                  <Field label="Primary Keyword">
                    <input
                      value={
                        form.keyword ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "keyword",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Last Audited">
                    <input
                      type="date"
                      value={
                        form.lastAudited ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "lastAudited",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <TextAreaField
                    label="Page Notes"
                    value={
                      form.notes ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "notes",
                        value,
                      )
                    }
                  />
                </div>
              </section>
            </>
          ) : null}

          {/* ==============================================
              BLOGS
          ============================================== */}

          {section ===
          "blogs" ? (
            <>
              <section className="form-card">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      CONTENT
                    </span>

                    <h3>
                      Blog / content
                      record
                    </h3>
                  </div>
                </div>

                <div className="form-grid">
                  <SelectField
                    label="Client"
                    value={
                      form.clientId ??
                      ""
                    }
                    onChange={
                      selectClient
                    }
                    options={
                      clientOptions
                    }
                    required
                  />

                  <SelectField
                    label="Website"
                    value={
                      form.websiteId ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "websiteId",
                        value,
                      )
                    }
                    options={
                      websiteOptions
                    }
                  />

                  <Field
                    label="Blog Title"
                    required
                  >
                    <input
                      required
                      value={
                        form.title ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "title",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Author">
                    <input
                      value={
                        form.author ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "author",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Target Keyword">
                    <input
                      value={
                        form.keyword ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "keyword",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Publish Date">
                    <input
                      type="date"
                      value={
                        form.publishDate ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "publishDate",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Content URL">
                    <input
                      value={
                        form.url ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "url",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <SelectField
                    label="Status"
                    value={
                      form.status ??
                      "Draft"
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "status",
                        value,
                      )
                    }
                    options={[
                      {
                        value:
                          "Draft",
                        label:
                          "Draft",
                      },
                      {
                        value:
                          "Planned",
                        label:
                          "Planned",
                      },
                      {
                        value:
                          "Published",
                        label:
                          "Published",
                      },
                      {
                        value:
                          "Updated",
                        label:
                          "Updated",
                      },
                    ]}
                  />
                </div>
              </section>

              <section className="form-card">
                <div className="form-grid">
                  <Field label="Category">
                    <input
                      value={
                        form.category ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "category",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Word Count">
                    <input
                      type="number"
                      min={0}
                      value={
                        form.wordCount ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "wordCount",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <TextAreaField
                    label="Content Notes"
                    value={
                      form.notes ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "notes",
                        value,
                      )
                    }
                  />
                </div>
              </section>
            </>
          ) : null}

          {/* ==============================================
              BACKLINKS
          ============================================== */}

          {section ===
          "backlinks" ? (
            <>
              <section className="form-card">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      OFF-PAGE SEO
                    </span>

                    <h3>
                      Create backlink
                      record
                    </h3>
                  </div>
                </div>

                <div className="form-grid">
                  <SelectField
                    label="Client"
                    value={
                      form.clientId ??
                      ""
                    }
                    onChange={
                      selectClient
                    }
                    options={
                      clientOptions
                    }
                    required
                  />

                  <SelectField
                    label="Target Website"
                    value={
                      form.websiteId ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "websiteId",
                        value,
                      )
                    }
                    options={
                      websiteOptions
                    }
                    required
                  />

                  <Field
                    label="Source URL"
                    required
                  >
                    <input
                      required
                      type="url"
                      value={
                        form.sourceUrl ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "sourceUrl",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field
                    label="Target URL"
                    required
                  >
                    <input
                      required
                      type="url"
                      value={
                        form.targetUrl ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "targetUrl",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Anchor Text">
                    <input
                      value={
                        form.anchorText ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "anchorText",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <SelectField
                    label="Link Type"
                    value={
                      form.linkType ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "linkType",
                        value,
                      )
                    }
                    options={[
                      {
                        value:
                          "DoFollow",
                        label:
                          "DoFollow",
                      },
                      {
                        value:
                          "NoFollow",
                        label:
                          "NoFollow",
                      },
                      {
                        value:
                          "Sponsored",
                        label:
                          "Sponsored",
                      },
                      {
                        value:
                          "UGC",
                        label:
                          "UGC",
                      },
                    ]}
                  />

                  <SelectField
                    label="Status"
                    value={
                      form.status ??
                      "Active"
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "status",
                        value,
                      )
                    }
                    options={[
                      {
                        value:
                          "Active",
                        label:
                          "Active",
                      },
                      {
                        value:
                          "Pending",
                        label:
                          "Pending",
                      },
                      {
                        value:
                          "Removed",
                        label:
                          "Removed",
                      },
                      {
                        value:
                          "Lost",
                        label:
                          "Lost",
                      },
                    ]}
                  />

                  <Field label="Published Date">
                    <input
                      type="date"
                      value={
                        form.date ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "date",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>
                </div>
              </section>

              <section className="form-card">
                <div className="form-grid">
                  <Field label="Domain Authority">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={
                        form.domainAuthority ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "domainAuthority",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Domain Rating">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={
                        form.domainRating ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "domainRating",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Traffic Estimate">
                    <input
                      type="number"
                      min={0}
                      value={
                        form.traffic ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "traffic",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <TextAreaField
                    label="Backlink Notes"
                    value={
                      form.notes ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "notes",
                        value,
                      )
                    }
                  />
                </div>
              </section>
            </>
          ) : null}

          {/* ==============================================
              TECHNICAL
          ============================================== */}

          {section ===
          "technical" ? (
            <>
              <section className="form-card">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      TECHNICAL SEO
                    </span>

                    <h3>
                      Technical audit
                      issue
                    </h3>
                  </div>
                </div>

                <div className="form-grid">
                  <SelectField
                    label="Client"
                    value={
                      form.clientId ??
                      ""
                    }
                    onChange={
                      selectClient
                    }
                    options={
                      clientOptions
                    }
                    required
                  />

                  <SelectField
                    label="Website"
                    value={
                      form.websiteId ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "websiteId",
                        value,
                      )
                    }
                    options={
                      websiteOptions
                    }
                    required
                  />

                  <Field
                    label="Issue Title"
                    required
                  >
                    <input
                      required
                      value={
                        form.title ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "title",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Category">
                    <select
                      value={
                        form.category ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "category",
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      <option value="">
                        Select category
                      </option>

                      <option>
                        Crawlability
                      </option>

                      <option>
                        Indexing
                      </option>

                      <option>
                        Core Web Vitals
                      </option>

                      <option>
                        Meta / On-page
                      </option>

                      <option>
                        Structured Data
                      </option>

                      <option>
                        Mobile SEO
                      </option>

                      <option>
                        Security
                      </option>

                      <option>
                        Internal Links
                      </option>
                    </select>
                  </Field>

                  <Field label="Severity">
                    <select
                      value={
                        form.severity ??
                        "Medium"
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "severity",
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      <option>
                        Critical
                      </option>

                      <option>
                        High
                      </option>

                      <option>
                        Medium
                      </option>

                      <option>
                        Low
                      </option>
                    </select>
                  </Field>

                  <Field label="Affected URL">
                    <input
                      value={
                        form.url ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "url",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <SelectField
                    label="Status"
                    value={
                      form.status ??
                      "Open"
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "status",
                        value,
                      )
                    }
                    options={[
                      {
                        value:
                          "Open",
                        label:
                          "Open",
                      },
                      {
                        value:
                          "In Progress",
                        label:
                          "In Progress",
                      },
                      {
                        value:
                          "Resolved",
                        label:
                          "Resolved",
                      },
                      {
                        value:
                          "Ignored",
                        label:
                          "Ignored",
                      },
                    ]}
                  />

                  <Field label="Due Date">
                    <input
                      type="date"
                      value={
                        form.dueDate ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "dueDate",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>
                </div>
              </section>

              <section className="form-card">
                <div className="form-grid">
                  <Field label="Assigned To">
                    <input
                      value={
                        form.assignedTo ??
                        agencySettings.defaultManager
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "assignedTo",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Recommendation">
                    <input
                      value={
                        form.recommendation ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "recommendation",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <TextAreaField
                    label="Audit Notes"
                    value={
                      form.notes ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "notes",
                        value,
                      )
                    }
                  />
                </div>
              </section>
            </>
          ) : null}

          {/* ==============================================
              REPORTS
          ============================================== */}

          {section ===
          "reports" ? (
            <>
              <section className="form-card">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      REPORTING
                    </span>

                    <h3>
                      SEO / client
                      report
                    </h3>
                  </div>
                </div>

                <div className="form-grid">
                  <SelectField
                    label="Client"
                    value={
                      form.clientId ??
                      ""
                    }
                    onChange={
                      selectClient
                    }
                    options={
                      clientOptions
                    }
                    required
                  />

                  <SelectField
                    label="Website"
                    value={
                      form.websiteId ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "websiteId",
                        value,
                      )
                    }
                    options={
                      websiteOptions
                    }
                  />

                  <Field
                    label="Report Name"
                    required
                  >
                    <input
                      required
                      value={
                        form.name ??
                        agencySettings.defaultReportName
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

                  <Field label="Report Type">
                    <select
                      value={
                        form.type ??
                        "SEO"
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "type",
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      <option>
                        SEO
                      </option>

                      <option>
                        Technical SEO
                      </option>

                      <option>
                        Backlink
                      </option>

                      <option>
                        Monthly Performance
                      </option>

                      <option>
                        Competitor
                      </option>
                    </select>
                  </Field>

                  <Field label="Period">
                    <select
                      value={
                        form.period ??
                        agencySettings.defaultReportPeriod
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "period",
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      <option>
                        Weekly
                      </option>

                      <option>
                        Monthly
                      </option>

                      <option>
                        Quarterly
                      </option>

                      <option>
                        Yearly
                      </option>
                    </select>
                  </Field>

                  <Field label="Report Date">
                    <input
                      type="date"
                      value={
                        form.date ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "date",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <SelectField
                    label="Status"
                    value={
                      form.status ??
                      "Draft"
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "status",
                        value,
                      )
                    }
                    options={[
                      {
                        value:
                          "Draft",
                        label:
                          "Draft",
                      },
                      {
                        value:
                          "Ready",
                        label:
                          "Ready",
                      },
                      {
                        value:
                          "Delivered",
                        label:
                          "Delivered",
                      },
                      {
                        value:
                          "Archived",
                        label:
                          "Archived",
                      },
                    ]}
                  />

                  <Field label="Report URL">
                    <input
                      value={
                        form.url ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "url",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>
                </div>
              </section>

              <section className="form-card">
                <TextAreaField
                  label="Report Summary"
                  value={
                    form.summary ??
                    ""
                  }
                  onChange={(
                    value,
                  ) =>
                    set(
                      "summary",
                      value,
                    )
                  }
                />
              </section>
            </>
          ) : null}

          {/* ==============================================
              COMPETITORS
          ============================================== */}

          {section ===
          "competitors" ? (
            <>
              <section className="form-card">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      COMPETITOR RESEARCH
                    </span>

                    <h3>
                      Competitor profile
                    </h3>
                  </div>
                </div>

                <div className="form-grid">
                  <SelectField
                    label="Client"
                    value={
                      form.clientId ??
                      ""
                    }
                    onChange={
                      selectClient
                    }
                    options={
                      clientOptions
                    }
                    required
                  />

                  <SelectField
                    label="Website"
                    value={
                      form.websiteId ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "websiteId",
                        value,
                      )
                    }
                    options={
                      websiteOptions
                    }
                  />

                  <Field
                    label="Competitor Name"
                    required
                  >
                    <input
                      required
                      value={
                        form.name ??
                        ""
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

                  <Field
                    label="Domain"
                    required
                  >
                    <input
                      required
                      value={
                        form.domain ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "domain",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Industry">
                    <input
                      value={
                        form.industry ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "industry",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Competitor Type">
                    <select
                      value={
                        form.type ??
                        "Direct"
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "type",
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      <option>
                        Direct
                      </option>

                      <option>
                        Indirect
                      </option>

                      <option>
                        Local
                      </option>

                      <option>
                        National
                      </option>
                    </select>
                  </Field>

                  <Field label="Estimated Traffic">
                    <input
                      type="number"
                      min={0}
                      value={
                        form.traffic ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "traffic",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <SelectField
                    label="Status"
                    value={
                      form.status ??
                      "Monitoring"
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "status",
                        value,
                      )
                    }
                    options={[
                      {
                        value:
                          "Monitoring",
                        label:
                          "Monitoring",
                      },
                      {
                        value:
                          "Active",
                        label:
                          "Active",
                      },
                      {
                        value:
                          "Archived",
                        label:
                          "Archived",
                      },
                    ]}
                  />
                </div>
              </section>

              <section className="form-card">
                <div className="form-grid">
                  <Field label="Top Keyword">
                    <input
                      value={
                        form.topKeyword ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "topKeyword",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Estimated Domain Authority">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={
                        form.domainAuthority ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "domainAuthority",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <TextAreaField
                    label="Competitor Notes"
                    value={
                      form.notes ??
                      ""
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "notes",
                        value,
                      )
                    }
                  />
                </div>
              </section>
            </>
          ) : null}

          {/* ==============================================
              NOTIFICATIONS
          ============================================== */}

          {section ===
          "notifications" ? (
            <>
              <section className="form-card">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      CLIENT COMMUNICATION
                    </span>

                    <h3>
                      Notification
                    </h3>
                  </div>
                </div>

                <div className="form-grid">
                  <SelectField
                    label="Client"
                    value={
                      form.clientId ??
                      ""
                    }
                    onChange={
                      selectClient
                    }
                    options={
                      clientOptions
                    }
                  />

                  <Field
                    label="Title"
                    required
                  >
                    <input
                      required
                      value={
                        form.title ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "title",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Type">
                    <select
                      value={
                        form.type ??
                        "General"
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "type",
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      <option>
                        General
                      </option>

                      <option>
                        SEO Update
                      </option>

                      <option>
                        Report
                      </option>

                      <option>
                        Website
                      </option>

                      <option>
                        Payment
                      </option>

                      <option>
                        Maintenance
                      </option>

                      <option>
                        Important
                      </option>
                    </select>
                  </Field>

                  <SelectField
                    label="Status"
                    value={
                      form.status ??
                      "Unread"
                    }
                    onChange={(
                      value,
                    ) =>
                      set(
                        "status",
                        value,
                      )
                    }
                    options={[
                      {
                        value:
                          "Unread",
                        label:
                          "Unread",
                      },
                      {
                        value:
                          "Read",
                        label:
                          "Read",
                      },
                      {
                        value:
                          "Archived",
                        label:
                          "Archived",
                      },
                    ]}
                  />

                  <Field label="Date">
                    <input
                      type="datetime-local"
                      value={
                        form.date ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "date",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Action URL">
                    <input
                      value={
                        form.url ??
                        ""
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "url",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </Field>
                </div>
              </section>

              <section className="form-card">
                <TextAreaField
                  label="Message"
                  value={
                    form.message ??
                    ""
                  }
                  onChange={(
                    value,
                  ) =>
                    set(
                      "message",
                      value,
                    )
                  }
                  required
                />
              </section>
            </>
          ) : null}

          {/* ERROR */}

          {error ? (
            <div className="form-error">
              {error}
            </div>
          ) : null}

          {/* FOOTER */}

          <div className="drawer-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
            >
              {initial
                ? "Save Changes"
                : `Create ${LABEL[
                    section
                  ].replace(
                    /s$/,
                    "",
                  )}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* =========================================================
   CREDENTIAL MODAL
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
  async function copy(
    text: string,
    message: string,
  ) {
    try {
      await navigator.clipboard.writeText(
        text,
      );

      onCopy(message);
    } catch {
      onCopy(
        "Clipboard access is unavailable.",
      );
    }
  }

  return (
    <div className="modal-layer">
      <button
        type="button"
        className="modal-backdrop"
        onClick={onClose}
        aria-label="Close credentials"
      />

      <section className="credentials-modal">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">
              CLIENT CREDENTIALS
            </span>

            <h2>
              {value.clientId}
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

        <div className="credentials-body">
          <div className="credential-row">
            <span>
              Client ID
            </span>

            <strong>
              {
                value.clientId
              }
            </strong>
          </div>

          <div className="credential-row">
            <span>
              Username
            </span>

            <strong>
              {
                value.username
              }
            </strong>
          </div>

          <div className="credential-row">
            <span>
              Email
            </span>

            <strong>
              {value.email}
            </strong>
          </div>

          <div className="credential-row">
            <span>
              Password
            </span>

            <strong>
              {
                value.password
              }
            </strong>
          </div>

          <div className="credential-row">
            <span>
              Status
            </span>

            <strong>
              {value.status}
            </strong>
          </div>

          <div className="credential-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                copy(
                  String(
                    value.clientId,
                  ),
                  "Client ID copied.",
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
                  "Password copied.",
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

            <button
              type="button"
              className="secondary-button"
              onClick={
                onDownloadTxt
              }
            >
              Download TXT
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={
                onDownloadExe
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