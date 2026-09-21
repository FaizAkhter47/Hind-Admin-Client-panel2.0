"use client";

import Image from "next/image";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteClientAccount,
  getClientAccounts,
  getGlobalAdminSettings,
  saveClientAccount,
  saveGlobalAdminSettings,
  type ClientAccount,
  type GlobalAdminSettings,
} from "./admin-settings";

/* =========================================================
   HCS ADMIN — SINGLE PAGE CONTROL CENTER
   All admin modules stay inside this page. No /admin/* navigation.
   Client/account source of truth: ./admin-settings.ts
========================================================= */

type SectionKey =
  | "dashboard" | "clients" | "websites" | "keywords" | "ranking" | "pages"
  | "blogs" | "backlinks" | "technical" | "reports" | "competitors"
  | "notifications" | "settings";
type ClientStatus = "Active" | "Suspended" | "Disabled";
type PermissionKey =
  | "dashboard" | "websites" | "keywords" | "ranking" | "pages" | "blogs"
  | "backlinks" | "technical" | "reports" | "competitors" | "notifications";
type PermissionMap = Record<PermissionKey, boolean>;
type AnyRecord = Record<string, any>;
type ExtendedClient = Omit<ClientAccount, "services"> & {
  password?: string;
  clientPortalEnabled?: boolean;
  permissions?: Record<string, boolean>;
  assignedWebsiteIds?: string[];
  tags?: string[];
  services?: string[];
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
  services: string[];
};
type AdminAccountWithPassword = NonNullable<GlobalAdminSettings["account"]> & { password?: string; loginPassword?: string };

type GenericModule = Exclude<SectionKey, "dashboard" | "clients" | "settings">;

const AUTH_KEY = "hcs-auth-session";
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
  { key: "settings", label: "Settings", icon: "⚙" },
];

const PERMISSIONS: Array<{ key: PermissionKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "websites", label: "Websites" },
  { key: "keywords", label: "Keywords / SEO" },
  { key: "ranking", label: "Rankings" },
  { key: "pages", label: "Pages" },
  { key: "blogs", label: "Blogs" },
  { key: "backlinks", label: "Backlinks" },
  { key: "technical", label: "Technical SEO" },
  { key: "reports", label: "Reports" },
  { key: "competitors", label: "Competitors" },
  { key: "notifications", label: "Notifications" },
];
const ALL_PERMISSIONS: PermissionMap = Object.fromEntries(PERMISSIONS.map(x => [x.key, true])) as PermissionMap;
const DEFAULT_PERMISSIONS: PermissionMap = {
  dashboard: true, websites: true, keywords: true, ranking: true, pages: true,
  blogs: true, backlinks: true, technical: false, reports: true,
  competitors: false, notifications: true,
};
const LABEL: Record<SectionKey, string> = Object.fromEntries(NAV.map(x => [x.key, x.label])) as Record<SectionKey, string>;

function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
function makeInitials(v: string) { const p = v.trim().split(/\s+/).filter(Boolean).slice(0, 2); return p.length ? p.map((x: string) => x[0].toUpperCase()).join("") : "HC"; }
function txt(v: unknown, fallback = "—") { const x = String(v ?? "").trim(); return x || fallback; }
function idOf(r: AnyRecord, i = 0) { return txt(r.id ?? r._id ?? r.clientId ?? r.websiteId ?? r.keywordId ?? r.pageId ?? r.blogId ?? r.backlinkId ?? r.reportId, String(i + 1)); }
function titleOf(r: AnyRecord, section: GenericModule) {
  if (section === "websites") return txt(r.name ?? r.domain ?? r.url, "Website");
  if (section === "keywords" || section === "ranking") return txt(r.keyword ?? r.query ?? r.name, "Keyword");
  if (section === "pages") return txt(r.title ?? r.name ?? r.url, "Page");
  if (section === "blogs") return txt(r.title ?? r.name, "Blog");
  if (section === "backlinks") return txt(r.targetUrl ?? r.sourceUrl ?? r.anchorText ?? r.name, "Backlink");
  if (section === "technical") return txt(r.title ?? r.issue ?? r.name, "Technical issue");
  if (section === "reports") return txt(r.name ?? r.title, "Report");
  if (section === "competitors") return txt(r.name ?? r.domain, "Competitor");
  return txt(r.title ?? r.subject ?? r.name, "Notification");
}
function readRecords(keys: string[]) {
  if (typeof window === "undefined") return [] as AnyRecord[];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key); if (!raw) continue;
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : parsed?.items ?? parsed?.data;
      if (Array.isArray(list)) return list.filter(x => x && typeof x === "object");
    } catch {}
  }
  return [] as AnyRecord[];
}
function writeRecords(section: GenericModule, records: AnyRecord[]) {
  localStorage.setItem(MODULE_KEYS[section][0], JSON.stringify(records));
  window.dispatchEvent(new CustomEvent("hcs-admin-portal-data-updated", { detail: { section, records } }));
}
function nextClientId(clients: ExtendedClient[]) {
  const nums = clients.map(c => Number(String(c.clientId ?? "").match(/^HCS-CL-(\d+)$/i)?.[1] ?? 0)).filter(Number.isFinite);
  return `HCS-CL-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(6, "0")}`;
}
function passwordFor(security: GlobalAdminSettings["security"]) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ", lower = "abcdefghijkmnopqrstuvwxyz", nums = "23456789", special = "@#$%&*!?";
  const req = [
    security?.requireUppercase !== false ? upper[Math.floor(Math.random() * upper.length)] : "",
    security?.requireNumber !== false ? nums[Math.floor(Math.random() * nums.length)] : "",
    security?.requireSpecialCharacter !== false ? special[Math.floor(Math.random() * special.length)] : "",
  ].filter(Boolean);
  const src = lower + (security?.requireUppercase !== false ? upper : "") + (security?.requireNumber !== false ? nums : "") + (security?.requireSpecialCharacter !== false ? special : "");
  while (req.length < Math.max(Number(security?.minPasswordLength ?? 8), 8)) req.push(src[Math.floor(Math.random() * src.length)]);
  return req.sort(() => Math.random() - 0.5).join("");
}
function validatePassword(password: string, s: GlobalAdminSettings["security"]) {
  const min = Number(s?.minPasswordLength ?? 8);
  if (password.length < min) return `Minimum ${min} characters required.`;
  if (s?.requireUppercase && !/[A-Z]/.test(password)) return "Uppercase letter required.";
  if (s?.requireNumber && !/[0-9]/.test(password)) return "Number required.";
  if (s?.requireSpecialCharacter && !/[^A-Za-z0-9]/.test(password)) return "Special character required.";
  return "";
}
function normalizePermissions(v: unknown): PermissionMap {
  const r = v && typeof v === "object" ? v as Record<string, unknown> : {};
  return Object.fromEntries(PERMISSIONS.map(x => [x.key, r[x.key] !== undefined ? Boolean(r[x.key]) : DEFAULT_PERMISSIONS[x.key]])) as PermissionMap;
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><strong>{title}</strong><span>{detail}</span></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export default function AdminPage() {
  const [section, setSection] = useState<SectionKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [settings, setSettings] = useState<GlobalAdminSettings | null>(null);
  const [draftSettings, setDraftSettings] = useState<GlobalAdminSettings | null>(null);
  const [records, setRecords] = useState<Record<string, AnyRecord[]>>({});
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawer, setDrawer] = useState<"create" | "edit" | null>(null);
  const [editingClient, setEditingClient] = useState<ExtendedClient | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState<AnyRecord | null>(null);
  const [modal, setModal] = useState<{ section: GenericModule; record?: AnyRecord } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [clientForm, setClientForm] = useState<ClientForm>({
    clientId: "", username: "", email: "", password: "", name: "", companyName: "", phone: "", website: "", plan: "",
    assignedManager: "", status: "Active", clientPortalEnabled: true, assignedWebsiteIds: [], permissions: clone(DEFAULT_PERMISSIONS), tags: "", notes: "", services: [],
  });

  const load = useCallback(() => {
    const s = getGlobalAdminSettings(); setSettings(s); setDraftSettings(clone(s));
    const next: Record<string, AnyRecord[]> = {};
    (Object.keys(MODULE_KEYS) as GenericModule[]).forEach(k => { next[k] = readRecords(MODULE_KEYS[k]); });
    setRecords(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const data = await response.json().catch(() => null);

        if (cancelled) return;

        if (
          response.ok &&
          data?.success === true &&
          data?.authenticated === true &&
          data?.user?.role === "admin" &&
          data?.user
        ) {
          const serverUser = data.user;
          const currentRaw = localStorage.getItem(AUTH_KEY);
          let currentSession: Record<string, unknown> = {};

          try {
            currentSession = currentRaw ? JSON.parse(currentRaw) : {};
          } catch {
            currentSession = {};
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
              authenticated: true,
              role: "admin",
              id: userId,
              adminId: serverUser.adminId ?? userId,
              accountId: serverUser.accountId ?? userId,
              username: serverUser.username ?? "",
              email: serverUser.email ?? "",
              name:
                serverUser.name ??
                serverUser.fullName ??
                "HCS Administrator",
              phone: serverUser.phone ?? "",
            }),
          );

          setAuthorized(true);
          return;
        }

        if (response.status === 401 || !response.ok) {
          localStorage.removeItem(AUTH_KEY);
          window.location.replace("/");
          return;
        }

        // A successful HTTP response without a valid admin session
        // is still treated as unauthenticated.
        localStorage.removeItem(AUTH_KEY);
        window.location.replace("/");
      } catch (error) {
        if (cancelled) return;
        console.error("Admin session verification failed:", error);
        localStorage.removeItem(AUTH_KEY);
        window.location.replace("/");
      }
    }

    verifySession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authorized) return;
    load();
  }, [authorized, load]);

  useEffect(() => {
    const sync = () => load();
    window.addEventListener("hcs-admin-settings-updated", sync);
    window.addEventListener("hcs-admin-portal-data-updated", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("hcs-admin-settings-updated", sync); window.removeEventListener("hcs-admin-portal-data-updated", sync); window.removeEventListener("storage", sync); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2500); return () => clearTimeout(t); }, [toast]);

  const clients = useMemo(() => (settings?.clients ?? []) as ExtendedClient[], [settings]);
  const websites = records.websites ?? [];
  const currentRecords = section !== "dashboard" && section !== "clients" && section !== "settings" ? (records[section] ?? []) : [];
  const filteredClients = clients.filter(c => !search.trim() || JSON.stringify(c).toLowerCase().includes(search.toLowerCase()));
  const filteredRecords = currentRecords.filter(r => !search.trim() || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  const metrics = useMemo(() => ({
    clients: clients.length,
    active: clients.filter(c => c.status === "Active").length,
    portal: clients.filter(c => c.clientPortalEnabled !== false).length,
    suspended: clients.filter(c => c.status === "Suspended").length,
    disabled: clients.filter(c => c.status === "Disabled").length,
    websites: websites.length,
    keywords: (records.keywords ?? []).length,
    ranking: (records.ranking ?? []).length,
    pages: (records.pages ?? []).length,
    blogs: (records.blogs ?? []).length,
    backlinks: (records.backlinks ?? []).length,
    technical: (records.technical ?? []).length,
    reports: (records.reports ?? []).length,
    competitors: (records.competitors ?? []).length,
    notifications: (records.notifications ?? []).length,
  }), [clients, websites, records]);

  function nav(k: SectionKey) { setSection(k); setSidebarOpen(false); setProfileOpen(false); setSearch(""); }
  function note(x: string) { setToast(x); }
  function logout() { localStorage.removeItem(AUTH_KEY); window.location.replace("/"); }

  function openCreate() {
    const s = settings?.security ?? {};
    setEditingClient(null); setShowPassword(false);
    setClientForm({ clientId: nextClientId(clients), username: "", email: "", password: passwordFor(s), name: "", companyName: "", phone: "", website: "", plan: "", assignedManager: "", status: "Active", clientPortalEnabled: true, assignedWebsiteIds: [], permissions: clone(DEFAULT_PERMISSIONS), tags: "", notes: "", services: [] });
    setDrawer("create");
  }
  function openEdit(c: ExtendedClient) {
    setEditingClient(c); setShowPassword(false);
    setClientForm({
      clientId: c.clientId, username: c.username, email: c.email, password: c.password ?? "", name: c.name ?? "", companyName: c.companyName ?? "",
      phone: c.phone ?? "", website: c.website ?? "", plan: c.plan ?? "", assignedManager: c.assignedManager ?? "", status: c.status,
      clientPortalEnabled: c.clientPortalEnabled !== false, assignedWebsiteIds: c.assignedWebsiteIds ?? [], permissions: normalizePermissions(c.permissions),
      tags: (c.tags ?? []).join(", "), notes: c.notes ?? "", services: c.services ?? c.assignedServices ?? c.selectedServices ?? [],
    });
    setDrawer("edit");
  }
  function updateForm<K extends keyof ClientForm>(k: K, v: ClientForm[K]) { setClientForm(p => ({ ...p, [k]: v })); }

  function submitClient(e: FormEvent) {
    e.preventDefault();
    const s = settings?.security ?? {};
    if (!clientForm.name.trim() || !clientForm.companyName.trim() || !clientForm.email.trim() || !clientForm.username.trim()) return note("Name, company, email and username are required.");
    const pe = validatePassword(clientForm.password, s); if (pe) return note(pe);
    const existing = clients.find(c => c.username.toLowerCase() === clientForm.username.toLowerCase() && c.id !== editingClient?.id);
    if (existing) return note("Username already exists.");
    const emailExists = clients.find(c => c.email.toLowerCase() === clientForm.email.toLowerCase() && c.id !== editingClient?.id);
    if (emailExists) return note("Email already exists.");
    const base: ExtendedClient = editingClient ? { ...editingClient } : {
      id: crypto.randomUUID(), clientId: clientForm.clientId, username: clientForm.username.trim(), email: clientForm.email.trim(), password: clientForm.password,
      role: "client", status: clientForm.status, active: clientForm.status === "Active" && clientForm.clientPortalEnabled, createdAt: new Date().toISOString(), name: "", companyName: "",
    };
    const saved: ExtendedClient = {
      ...base,
      clientId: editingClient?.clientId ?? clientForm.clientId,
      username: clientForm.username.trim(), email: clientForm.email.trim(), password: clientForm.password,
      name: clientForm.name.trim(), companyName: clientForm.companyName.trim(), phone: clientForm.phone.trim() || undefined, website: clientForm.website.trim() || undefined,
      plan: clientForm.plan.trim() || undefined, assignedManager: clientForm.assignedManager.trim() || undefined, status: clientForm.status,
      active: clientForm.status === "Active" && clientForm.clientPortalEnabled, updatedAt: new Date().toISOString(), clientPortalEnabled: clientForm.clientPortalEnabled,
      permissions: clone(clientForm.permissions), assignedWebsiteIds: [...clientForm.assignedWebsiteIds], tags: clientForm.tags.split(",").map(x => x.trim()).filter(Boolean), notes: clientForm.notes.trim() || undefined, services: [...clientForm.services],
    };
    saveClientAccount({ ...saved, services: saved.services as unknown as ClientAccount["services"] }); setDrawer(null); load(); note(editingClient ? "Client updated." : "Client created.");
    setCredentials({ clientId: saved.clientId, username: saved.username, email: saved.email, password: saved.password, name: saved.name, companyName: saved.companyName, status: saved.status });
  }
  function resetPassword(c: ExtendedClient) {
    const password = passwordFor(settings?.security ?? {}); const saved = { ...c, password, updatedAt: new Date().toISOString() }; saveClientAccount({ ...saved, services: saved.services as ClientAccount["services"] });
    setCredentials({ clientId: saved.clientId, username: saved.username, email: saved.email, password, name: saved.name, companyName: saved.companyName, status: saved.status }); load(); note("Password reset successfully.");
  }
  function togglePortal(c: ExtendedClient) { const enabled = c.clientPortalEnabled === false; saveClientAccount({ ...c, services: c.services as ClientAccount["services"], clientPortalEnabled: enabled, active: enabled && c.status === "Active", updatedAt: new Date().toISOString() }); load(); note(enabled ? "Portal enabled." : "Portal disabled."); }
  function setStatus(c: ExtendedClient, status: ClientStatus) { saveClientAccount({ ...c, services: c.services as ClientAccount["services"], status, active: status === "Active" && c.clientPortalEnabled !== false, updatedAt: new Date().toISOString() }); load(); note(`Client set to ${status}.`); }
  function removeClient(c: ExtendedClient) { if (!confirm(`Delete ${c.clientId}?`)) return; deleteClientAccount(c.id); load(); note("Client deleted."); }
  function bulk(action: "enable" | "disable" | "suspend") {
    const cur = getGlobalAdminSettings(); const ids = new Set(selected); const list = (cur.clients ?? []).map(c => {
      if (!ids.has(c.id)) return c;
      if (action === "disable") return { ...c, status: "Disabled" as const, active: false, clientPortalEnabled: false };
      if (action === "suspend") return { ...c, status: "Suspended" as const, active: false };
      return { ...c, status: "Active" as const, active: c.clientPortalEnabled !== false, clientPortalEnabled: c.clientPortalEnabled !== false };
    });
    saveGlobalAdminSettings({ ...cur, clients: list }); setSelected([]); load(); note("Selected client accounts updated.");
  }
  function editRecord(mod: GenericModule, record?: AnyRecord) { setModal({ section: mod, record }); }
  function saveRecord(mod: GenericModule, record: AnyRecord) {
    const list = readRecords(MODULE_KEYS[mod]); const id = idOf(record); const idx = list.findIndex((x, i) => idOf(x, i) === id);
    const next = idx >= 0 ? list.map((x, i) => i === idx ? record : x) : [...list, record]; writeRecords(mod, next); setModal(null); load(); note(`${LABEL[mod]} record saved.`);
  }
  function deleteRecord(mod: GenericModule, r: AnyRecord) {
    if (!confirm(`Delete this ${LABEL[mod].toLowerCase()} record?`)) return;
    const id = idOf(r); writeRecords(mod, readRecords(MODULE_KEYS[mod]).filter((x, i) => idOf(x, i) !== id)); load(); note("Record deleted.");
  }
  function saveSettings() { if (!draftSettings) return; const account = draftSettings.account as AdminAccountWithPassword | undefined; const e = validatePassword(account?.password ?? account?.loginPassword ?? "", draftSettings.security); if (e) return note(e); saveGlobalAdminSettings(draftSettings); setSettings(clone(draftSettings)); note("Admin settings saved."); }

  if (!authorized || !settings) return <main className="auth-loading"><Image src="/images/logo.png" alt="HCS" width={165} height={58} priority /><span>Checking administrator session…</span></main>;

  return (
    <div className="hcs-admin-page">
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand"><Image src="/images/logo.png" alt="Hind Consultancy Services" width={165} height={58} priority /><button type="button" className="sidebar-close" onClick={() => setSidebarOpen(false)}>×</button></div>
        <div className="sidebar-label">HCS ADMIN PANEL</div>
        <nav className="sidebar-navigation">
          {NAV.map(item => <button key={item.key} type="button" className={`sidebar-navigation-item ${section === item.key ? "active" : ""}`} onClick={() => nav(item.key)}><span>{item.icon}</span><span>{item.label}</span></button>)}
        </nav>
        <div className="sidebar-bottom"><span className="sync-dot" /> Global account store synchronized</div>
      </aside>
      {sidebarOpen && <button type="button" className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />}

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left"><button type="button" className="mobile-sidebar-button" onClick={() => setSidebarOpen(true)}>☰</button><div><span className="eyebrow">HCS ADMINISTRATION</span><h1>{LABEL[section]}</h1></div></div>
          <div className="topbar-right">
            <button type="button" className="topbar-icon-button" onClick={() => nav("notifications")}>♢</button>
            <button type="button" className="profile-button" onClick={() => setProfileOpen(v => !v)}><span className="profile-avatar">{makeInitials(settings.account?.fullName ?? "HCS")}</span><span className="profile-copy"><strong>{txt(settings.account?.fullName, "HCS Administrator")}</strong><small>{txt(settings.account?.email, "Administrator")}</small></span><span>⌄</span></button>
            {profileOpen && <div className="profile-popover"><strong>{txt(settings.account?.fullName, "HCS Administrator")}</strong><span>{txt(settings.account?.email)}</span><button type="button" onClick={() => nav("settings")}>Account & Security</button><button type="button" onClick={logout}>Logout</button></div>}
          </div>
        </header>

        <section className="admin-content">
          <div className="page-heading"><div><span className="eyebrow">CONTROL CENTER</span><h2>{LABEL[section]}</h2><p>{section === "dashboard" ? "Live operational overview from saved HCS data." : section === "clients" ? "Manage client accounts, access, permissions and website scope." : section === "settings" ? "Admin identity and global security policy." : `Manage ${LABEL[section].toLowerCase()} inside this page.`}</p></div>{section === "clients" ? <button type="button" className="primary-button" onClick={openCreate}>＋ Create Client</button> : section !== "dashboard" && section !== "settings" ? <button type="button" className="primary-button" onClick={() => editRecord(section as GenericModule)}>＋ Add {LABEL[section].replace(/s$/, "")}</button> : null}</div>

          {section === "dashboard" && <>
            <div className="stats-grid">
              {[["CLIENTS", metrics.clients, "Manage client accounts", "clients"], ["ACTIVE CLIENTS", metrics.active, "Currently active", "clients"], ["WEBSITES", metrics.websites, "Saved website records", "websites"], ["KEYWORDS", metrics.keywords, "Saved keyword records", "keywords"], ["RANKING", metrics.ranking, "Saved ranking rows", "ranking"], ["REPORTS", metrics.reports, "Saved reports", "reports"], ["TECHNICAL", metrics.technical, "Saved technical records", "technical"], ["NOTIFICATIONS", metrics.notifications, "Saved notifications", "notifications"]].map(([label, value, sub, target]) => <button type="button" className="metric-card" key={label} onClick={() => nav(target as SectionKey)}><span>{label}</span><strong>{value}</strong><small>{sub}</small></button>)}
            </div>
            <div className="dashboard-grid">
              <section className="panel"><div className="panel-heading"><div><span className="eyebrow">CLIENT ACCESS</span><h3>Account health</h3></div><button type="button" className="secondary-button" onClick={() => nav("clients")}>Manage Clients</button></div><div className="health-list"><div><span>Active</span><strong>{metrics.active}</strong></div><div><span>Portal Enabled</span><strong>{metrics.portal}</strong></div><div><span>Suspended</span><strong>{metrics.suspended}</strong></div><div><span>Disabled</span><strong>{metrics.disabled}</strong></div></div></section>
              <section className="panel"><div className="panel-heading"><div><span className="eyebrow">QUICK ACTIONS</span><h3>Open module</h3></div></div><div className="quick-actions">{NAV.filter(x => !["dashboard", "settings"].includes(x.key)).map(x => <button type="button" className="quick-action" key={x.key} onClick={() => nav(x.key)}><span>{x.icon}</span><strong>{x.label}</strong></button>)}</div></section>
            </div>
            <section className="panel"><div className="panel-heading"><div><span className="eyebrow">CLIENTS</span><h3>Latest accounts</h3></div></div>{clients.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Client</th><th>Client ID</th><th>Company</th><th>Status</th><th>Portal</th></tr></thead><tbody>{clients.slice(0, 8).map(c => <tr key={c.id}><td>{txt(c.name || c.companyName)}</td><td>{c.clientId}</td><td>{txt(c.companyName)}</td><td>{c.status}</td><td>{c.clientPortalEnabled === false ? "Disabled" : "Enabled"}</td></tr>)}</tbody></table></div> : <Empty title="No client accounts" detail="Create a client from the Clients module." />}</section>
          </>}

          {section === "clients" && <section className="clients-content"><div className="toolbar"><div className="search-field"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client, company, email, username..." /></div>{selected.length > 0 && <div className="bulk-action-bar"><span>{selected.length} selected</span><button type="button" onClick={() => bulk("enable")}>Enable</button><button type="button" onClick={() => bulk("disable")}>Disable</button><button type="button" onClick={() => bulk("suspend")}>Suspend</button><button type="button" onClick={() => setSelected([])}>Clear</button></div>}</div><section className="panel">{filteredClients.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th><input type="checkbox" checked={filteredClients.length > 0 && filteredClients.every(c => selected.includes(c.id))} onChange={e => setSelected(e.target.checked ? filteredClients.map(c => c.id) : [])} /></th><th>Client</th><th>Client ID</th><th>Company</th><th>Email</th><th>Status</th><th>Portal</th><th>Websites</th><th>Plan</th><th>Actions</th></tr></thead><tbody>{filteredClients.map(c => <tr key={c.id}><td><input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(v => e.target.checked ? [...v, c.id] : v.filter(id => id !== c.id))} /></td><td><div className="table-person"><span className="person-avatar">{makeInitials(c.name || c.companyName)}</span><span><strong>{txt(c.name || c.companyName)}</strong><small>{c.username}</small></span></div></td><td>{c.clientId}</td><td>{txt(c.companyName)}</td><td>{txt(c.email)}</td><td>{c.status}</td><td>{c.clientPortalEnabled === false ? "Disabled" : "Enabled"}</td><td>{c.assignedWebsiteIds?.length ?? 0}</td><td>{txt(c.plan)}</td><td><div className="row-actions"><button type="button" onClick={() => openEdit(c)}>Edit</button><button type="button" onClick={() => resetPassword(c)}>Reset</button><button type="button" onClick={() => togglePortal(c)}>{c.clientPortalEnabled === false ? "Enable" : "Disable"}</button><button type="button" onClick={() => setStatus(c, c.status === "Suspended" ? "Active" : "Suspended")}>{c.status === "Suspended" ? "Unsuspend" : "Suspend"}</button><button type="button" onClick={() => setCredentials({ clientId: c.clientId, username: c.username, email: c.email, password: c.password, name: c.name, companyName: c.companyName, status: c.status })}>Credentials</button><button type="button" onClick={() => removeClient(c)}>Delete</button></div></td></tr>)}</tbody></table></div> : <Empty title={search ? "No matching clients" : "No clients yet"} detail={search ? "Try another search." : "Create the first client account."} />}</section></section>}

          {section !== "dashboard" && section !== "clients" && section !== "settings" && <section className="module-content"><div className="toolbar"><div className="search-field"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${LABEL[section].toLowerCase()}...`} /></div><span className="record-count">{filteredRecords.length} record{filteredRecords.length === 1 ? "" : "s"}</span></div><section className="panel">{filteredRecords.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>ID</th><th>Status</th><th>Website / Scope</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{filteredRecords.map((r, i) => <tr key={`${idOf(r, i)}-${i}`}><td><strong>{titleOf(r, section)}</strong></td><td>{idOf(r, i)}</td><td>{txt(r.status ?? r.state ?? r.priority, "Saved")}</td><td>{txt(r.website ?? r.domain ?? r.url ?? r.site ?? r.websiteId ?? r.clientId)}</td><td>{txt(r.updatedAt ?? r.createdAt ?? r.date)}</td><td><div className="row-actions"><button type="button" onClick={() => editRecord(section, r)}>Edit</button><button type="button" onClick={() => deleteRecord(section, r)}>Delete</button></div></td></tr>)}</tbody></table></div> : <Empty title={`No ${LABEL[section].toLowerCase()} records`} detail="Only saved real records appear here; no demo data is generated." />}</section></section>}

          {section === "settings" && draftSettings && <section className="settings-content"><div className="settings-grid">
            <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ADMIN ACCOUNT</span><h3>Administrator identity</h3></div></div><div className="form-grid"><Field label="Admin ID"><input value={draftSettings.account?.adminId ?? ""} onChange={e => setDraftSettings(v => v ? ({ ...v, account: { ...v.account!, adminId: e.target.value } }) : v)} /></Field><Field label="Username"><input value={draftSettings.account?.username ?? ""} onChange={e => setDraftSettings(v => v ? ({ ...v, account: { ...v.account!, username: e.target.value } }) : v)} /></Field><Field label="Full Name"><input value={draftSettings.account?.fullName ?? ""} onChange={e => setDraftSettings(v => v ? ({ ...v, account: { ...v.account!, fullName: e.target.value } }) : v)} /></Field><Field label="Email"><input value={draftSettings.account?.email ?? ""} onChange={e => setDraftSettings(v => v ? ({ ...v, account: { ...v.account!, email: e.target.value } }) : v)} /></Field><Field label="Phone"><input value={draftSettings.account?.phone ?? ""} onChange={e => setDraftSettings(v => v ? ({ ...v, account: { ...v.account!, phone: e.target.value } }) : v)} /></Field><Field label="Job Title"><input value={draftSettings.account?.jobTitle ?? ""} onChange={e => setDraftSettings(v => v ? ({ ...v, account: { ...v.account!, jobTitle: e.target.value } }) : v)} /></Field></div></section>
            <section className="panel"><div className="panel-heading"><div><span className="eyebrow">SECURITY</span><h3>Admin password</h3></div></div><Field label="Password"><input type="password" value={(draftSettings.account as AdminAccountWithPassword | undefined)?.password ?? ""} onChange={e => setDraftSettings(v => v ? ({ ...v, account: { ...v.account!, password: e.target.value, loginPassword: e.target.value } as AdminAccountWithPassword }) : v)} /></Field><p className="field-help">Changing this password updates the unified Admin login.</p><label className="switch-row"><input type="checkbox" checked={draftSettings.account?.active !== false} onChange={e => setDraftSettings(v => v ? ({ ...v, account: { ...v.account!, active: e.target.checked } }) : v)} /><span>Admin account active</span></label></section>
            <section className="panel settings-span"><div className="panel-heading"><div><span className="eyebrow">CLIENT PASSWORD POLICY</span><h3>Security rules used by generated/reset client passwords</h3></div></div><div className="form-grid"><Field label="Minimum Length"><input type="number" min={6} value={draftSettings.security?.minPasswordLength ?? 8} onChange={e => setDraftSettings(v => v ? ({ ...v, security: { ...v.security, minPasswordLength: Math.max(6, Number(e.target.value) || 8) } }) : v)} /></Field><Field label="Failed Attempts Limit"><input type="number" min={1} value={draftSettings.security?.failedAttemptsLimit ?? 5} onChange={e => setDraftSettings(v => v ? ({ ...v, security: { ...v.security, failedAttemptsLimit: Math.max(1, Number(e.target.value) || 5) } }) : v)} /></Field></div><div className="switch-grid">{[["requireUppercase","Require uppercase"],["requireNumber","Require number"],["requireSpecialCharacter","Require special character"],["blockAfterFailedAttempts","Block after failed attempts"],["loginAlerts","Login alerts"],["suspiciousLoginAlerts","Suspicious login alerts"],["sessionAlerts","Session alerts"],["passwordExpiry","Password expiry"]].map(([key,label]) => <label className="switch-row" key={key}><input type="checkbox" checked={Boolean((draftSettings.security as AnyRecord)?.[key])} onChange={e => setDraftSettings(v => v ? ({ ...v, security: { ...v.security, [key]: e.target.checked } }) : v)} /><span>{label}</span></label>)}</div></section>
            <section className="panel settings-span"><div className="panel-heading"><div><span className="eyebrow">GENERAL</span><h3>Company information</h3></div></div><div className="form-grid"><Field label="Company Name"><input value={draftSettings.general?.companyName ?? ""} onChange={e => setDraftSettings(v => v ? ({ ...v, general: { ...v.general, companyName: e.target.value } }) : v)} /></Field><Field label="Company Email"><input value={draftSettings.general?.companyEmail ?? ""} onChange={e => setDraftSettings(v => v ? ({ ...v, general: { ...v.general, companyEmail: e.target.value } }) : v)} /></Field><Field label="Support Email"><input value={draftSettings.general?.supportEmail ?? ""} onChange={e => setDraftSettings(v => v ? ({ ...v, general: { ...v.general, supportEmail: e.target.value } }) : v)} /></Field><Field label="Phone"><input value={draftSettings.general?.phone ?? ""} onChange={e => setDraftSettings(v => v ? ({ ...v, general: { ...v.general, phone: e.target.value } }) : v)} /></Field><Field label="Website"><input value={draftSettings.general?.website ?? ""} onChange={e => setDraftSettings(v => v ? ({ ...v, general: { ...v.general, website: e.target.value } }) : v)} /></Field><Field label="Timezone"><input value={draftSettings.general?.timezone ?? ""} onChange={e => setDraftSettings(v => v ? ({ ...v, general: { ...v.general, timezone: e.target.value } }) : v)} /></Field></div></section>
          </div><div className="sticky-save-bar"><button type="button" className="secondary-button" onClick={() => setDraftSettings(clone(settings))}>Discard</button><button type="button" className="primary-button" onClick={saveSettings}>Save Settings</button></div></section>}
        </section>
      </main>

      {drawer && <ClientDrawer form={clientForm} setForm={setClientForm} clients={clients} websites={websites} security={settings.security} mode={drawer} showPassword={showPassword} setShowPassword={setShowPassword} onClose={() => setDrawer(null)} onSubmit={submitClient} />}
      {modal && <RecordModal section={modal.section} initial={modal.record} onClose={() => setModal(null)} onSave={saveRecord} />}
      {credentials && <CredentialsModal value={credentials} onClose={() => setCredentials(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function ClientDrawer({ form, setForm, clients, websites, security, mode, showPassword, setShowPassword, onClose, onSubmit }: any) {
  const set = (k: keyof ClientForm, v: any) => setForm((p: ClientForm) => ({ ...p, [k]: v }));
  const toggle = (k: PermissionKey) => set("permissions", { ...form.permissions, [k]: !form.permissions[k] });
  const regenerate = () => set("password", passwordFor(security));
  const allSites = websites.map((r: AnyRecord, i: number) => idOf(r, i));
  return <div className="modal-layer"><button type="button" className="modal-backdrop" onClick={onClose} aria-label="Close" /><section className="drawer-modal"><div className="drawer-header"><div><span className="eyebrow">{mode === "create" ? "NEW CLIENT" : "EDIT CLIENT"}</span><h2>{mode === "create" ? "Create Client" : form.clientId}</h2></div><button type="button" className="modal-close" onClick={onClose}>×</button></div><form className="drawer-body" onSubmit={onSubmit}>
    <section className="form-card"><div className="panel-heading"><div><span className="eyebrow">IDENTITY</span><h3>Client account</h3></div></div><div className="form-grid"><Field label="Client ID"><input value={form.clientId} readOnly /></Field><Field label="Name"><input required value={form.name} onChange={e => set("name", e.target.value)} /></Field><Field label="Company"><input required value={form.companyName} onChange={e => set("companyName", e.target.value)} /></Field><Field label="Email"><input required type="email" value={form.email} onChange={e => set("email", e.target.value)} /></Field><Field label="Username"><input required value={form.username} onChange={e => set("username", e.target.value)} /></Field><Field label="Phone"><input value={form.phone} onChange={e => set("phone", e.target.value)} /></Field><Field label="Website"><input value={form.website} onChange={e => set("website", e.target.value)} /></Field><Field label="Plan"><input value={form.plan} onChange={e => set("plan", e.target.value)} /></Field><Field label="Manager"><input value={form.assignedManager} onChange={e => set("assignedManager", e.target.value)} /></Field><Field label="Status"><select value={form.status} onChange={e => set("status", e.target.value)}><option>Active</option><option>Suspended</option><option>Disabled</option></select></Field></div></section>
    <section className="form-card"><div className="panel-heading"><div><span className="eyebrow">SECURITY</span><h3>Portal credentials</h3></div><button type="button" className="secondary-button" onClick={regenerate}>Regenerate</button></div><div className="password-field"><input type={showPassword ? "text" : "password"} value={form.password} onChange={e => set("password", e.target.value)} /><button type="button" onClick={() => setShowPassword((v: boolean) => !v)}>{showPassword ? "Hide" : "Show"}</button></div><p className="field-help">Uses the Admin security policy.</p><label className="switch-row"><input type="checkbox" checked={form.clientPortalEnabled} onChange={e => set("clientPortalEnabled", e.target.checked)} /><span>Portal enabled</span></label></section>
    <section className="form-card"><div className="panel-heading"><div><span className="eyebrow">PERMISSIONS</span><h3>Client module access</h3></div><div className="inline-actions"><button type="button" className="secondary-button" onClick={() => set("permissions", clone(ALL_PERMISSIONS))}>Grant All</button><button type="button" className="secondary-button" onClick={() => set("permissions", Object.fromEntries(PERMISSIONS.map(x => [x.key, false]))) }>Remove All</button><button type="button" className="secondary-button" onClick={() => set("permissions", clone(DEFAULT_PERMISSIONS))}>Default</button></div></div><div className="permission-grid">{PERMISSIONS.map(p => <button type="button" key={p.key} className={`permission-card ${form.permissions[p.key] ? "enabled" : ""}`} onClick={() => toggle(p.key)}><span className="permission-check">{form.permissions[p.key] ? "✓" : ""}</span><span><strong>{p.label}</strong><small>{p.key === "keywords" ? "SEO and keyword data" : "Client portal module"}</small></span></button>)}</div></section>
    <section className="form-card"><div className="panel-heading"><div><span className="eyebrow">WEBSITE SCOPE</span><h3>Assign existing websites</h3></div><span className="record-count">{form.assignedWebsiteIds.length} selected</span></div>{websites.length ? <><div className="inline-actions"><button type="button" className="secondary-button" onClick={() => set("assignedWebsiteIds", allSites)}>Select All</button><button type="button" className="secondary-button" onClick={() => set("assignedWebsiteIds", [])}>Clear All</button></div><div className="assignment-list">{websites.map((w: AnyRecord, i: number) => { const id = idOf(w, i), checked = form.assignedWebsiteIds.includes(id); return <label className="assignment-row" key={id}><input type="checkbox" checked={checked} onChange={e => set("assignedWebsiteIds", e.target.checked ? [...form.assignedWebsiteIds, id] : form.assignedWebsiteIds.filter((x: string) => x !== id))} /><span><strong>{titleOf(w, "websites")}</strong><small>{txt(w.domain ?? w.url ?? w.website)}</small></span></label>; })}</div></> : <Empty title="No website records available" detail="Create real website records first. No placeholder website is added." />}</section>
    <section className="form-card"><div className="panel-heading"><div><span className="eyebrow">SERVICES</span><h3>Service scope</h3></div></div><p className="field-help">This page keeps service assignments on the same ClientAccount. No fake service records are created here.</p><div className="selected-chip-list">{form.services.length ? form.services.map((s: string) => <span key={s} className="selected-chip">{s}</span>) : <span className="empty-inline">No service records assigned.</span>}</div></section>
    <section className="form-card"><div className="panel-heading"><div><span className="eyebrow">NOTES</span><h3>Internal information</h3></div></div><div className="form-grid"><Field label="Tags"><input value={form.tags} onChange={e => set("tags", e.target.value)} /></Field><Field label="Notes"><textarea rows={5} value={form.notes} onChange={e => set("notes", e.target.value)} /></Field></div></section>
    <div className="drawer-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">{mode === "create" ? "Create Client" : "Save Client Access"}</button></div>
  </form></section></div>;
}

function RecordModal({ section, initial, onClose, onSave }: { section: GenericModule; initial?: AnyRecord; onClose: () => void; onSave: (section: GenericModule, record: AnyRecord) => void }) {
  const [value, setValue] = useState(() => JSON.stringify(initial ?? { id: crypto.randomUUID(), status: "Active", createdAt: new Date().toISOString() }, null, 2));
  const [error, setError] = useState("");
  function save() { try { const parsed = JSON.parse(value); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return setError("Record must be an object."); onSave(section, { ...parsed, updatedAt: new Date().toISOString() }); } catch { setError("Invalid JSON."); } }
  return <div className="modal-layer"><button type="button" className="modal-backdrop" onClick={onClose} aria-label="Close" /><section className="json-editor-modal"><div className="drawer-header"><div><span className="eyebrow">{initial ? "EDIT" : "ADD"}</span><h2>{LABEL[section]}</h2></div><button type="button" className="modal-close" onClick={onClose}>×</button></div><div className="json-editor-body"><p className="field-help">Single-page module editor. Existing record shape is preserved.</p><textarea className="json-editor" rows={25} value={value} onChange={e => { setValue(e.target.value); setError(""); }} spellCheck={false} />{error && <div className="form-error">{error}</div>}<div className="drawer-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" onClick={save}>Save Record</button></div></div></section></div>;
}

function CredentialsModal({ value, onClose }: { value: AnyRecord; onClose: () => void }) {
  const copy = (v: string) => { navigator.clipboard?.writeText(v); };
  const downloadTxt = () => { const body = `HIND CONSULTANCY SERVICES\nCLIENT PORTAL CREDENTIALS\n\nClient ID: ${value.clientId}\nUsername: ${value.username}\nEmail: ${value.email}\nPassword: ${value.password}\nStatus: ${value.status}`; const url = URL.createObjectURL(new Blob([body], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = `${value.clientId}-credentials.txt`; a.click(); URL.revokeObjectURL(url); };
  const downloadExe = async () => { try { const r = await fetch("/api/client-credentials-exe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }); if (!r.ok) return; const url = URL.createObjectURL(await r.blob()); const a = document.createElement("a"); a.href = url; a.download = `${value.clientId}-credentials.exe`; a.click(); URL.revokeObjectURL(url); } catch {} };
  return <div className="modal-layer"><button type="button" className="modal-backdrop" onClick={onClose} aria-label="Close" /><section className="credentials-modal"><div className="drawer-header"><div><span className="eyebrow">CLIENT CREDENTIALS</span><h2>{value.clientId}</h2></div><button type="button" className="modal-close" onClick={onClose}>×</button></div><div className="credentials-body">{[["Client ID", value.clientId], ["Username", value.username], ["Email", value.email], ["Password", value.password], ["Status", value.status]].map(([k, v]) => <div className="credential-row" key={k}><span>{k}</span><strong>{v}</strong></div>)}<div className="credential-actions"><button type="button" className="secondary-button" onClick={() => copy(value.clientId)}>Copy Client ID</button><button type="button" className="secondary-button" onClick={() => copy(value.password)}>Copy Password</button><button type="button" className="secondary-button" onClick={() => copy(`Client ID: ${value.clientId}\nUsername: ${value.username}\nEmail: ${value.email}\nPassword: ${value.password}`)}>Copy Credentials</button><button type="button" className="secondary-button" onClick={downloadTxt}>Download TXT</button><button type="button" className="secondary-button" onClick={downloadExe}>Download EXE</button></div></div></section></div>;
}
