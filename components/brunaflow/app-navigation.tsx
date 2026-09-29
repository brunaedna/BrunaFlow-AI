import {
  Activity,
  ArrowRight,
  Boxes,
  GitBranch,
  LayoutDashboard,
  Mail,
  Menu,
  Search,
  Settings,
  Sparkles,
  Webhook,
  Zap,
} from "lucide-react";
import type { GmailStatus, SearchResult, Tab } from "@/lib/brunaflow/types";

type SidebarProps = {
  activeTab: Tab;
  isOpen: boolean;
  automationCount: number;
  emailCount: number;
  onNavigate: (tab: Tab) => void;
  onAbout: () => void;
};

export function Sidebar({
  activeTab,
  isOpen,
  automationCount,
  emailCount,
  onNavigate,
  onAbout,
}: SidebarProps) {
  const navigation = [
    { tab: "overview" as const, label: "Visão geral", icon: LayoutDashboard },
    {
      tab: "automations" as const,
      label: "Automações",
      icon: Zap,
      count: automationCount,
    },
    { tab: "runs" as const, label: "Execuções", icon: Activity },
    {
      tab: "emails" as const,
      label: "E-mails",
      icon: Mail,
      count: emailCount,
    },
  ];
  const workspaceNavigation = [
    { tab: "integrations" as const, label: "Integrações", icon: Boxes },
    { tab: "webhooks" as const, label: "Webhooks", icon: Webhook },
    { tab: "settings" as const, label: "Configurações", icon: Settings },
  ];

  const renderNavigation = (
    items: Array<{
      tab: Tab;
      label: string;
      icon: typeof LayoutDashboard;
      count?: number;
    }>,
  ) => (
    <nav>
      {items.map(({ tab, label, icon: Icon, count }) => (
        <button
          key={tab}
          className={activeTab === tab ? "active" : ""}
          onClick={() => onNavigate(tab)}
        >
          <Icon size={18} />
          {label}
          {count !== undefined && <span className="nav-count">{count}</span>}
        </button>
      ))}
    </nav>
  );

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="brand">
        <span className="brand-mark">
          <GitBranch size={20} />
        </span>
        <div>
          <strong>BrunaFlow</strong>
          <span>AI automation</span>
        </div>
      </div>
      {renderNavigation(navigation)}
      <div className="nav-section">Workspace</div>
      {renderNavigation(workspaceNavigation)}
      <div className="sidebar-footer">
        <div className="plan-pill">
          <Sparkles size={15} />
          <span>
            <strong>Projeto de portfólio</strong>
            <small>Dados do visitante isolados</small>
          </span>
        </div>
        <button onClick={onAbout} className="text-link">
          Como o projeto funciona <ArrowRight size={14} />
        </button>
        <a href="/privacidade" className="privacy-link">
          Privacidade e dados
        </a>
      </div>
    </aside>
  );
}

type TopbarProps = {
  gmail: GmailStatus;
  query: string;
  searchOpen: boolean;
  results: SearchResult[];
  onQueryChange: (query: string) => void;
  onSearchOpenChange: (open: boolean) => void;
  onToggleMenu: () => void;
  onNavigate: (tab: Tab) => void;
};

export function Topbar({
  gmail,
  query,
  searchOpen,
  results,
  onQueryChange,
  onSearchOpenChange,
  onToggleMenu,
  onNavigate,
}: TopbarProps) {
  function selectResult(result: SearchResult) {
    onNavigate(result.tab);
    onQueryChange("");
    onSearchOpenChange(false);
  }

  return (
    <header className="topbar">
      <button
        className="icon-button menu"
        onClick={onToggleMenu}
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>
      <div className="search-wrap">
        <div className="search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              onSearchOpenChange(true);
            }}
            onFocus={() => onSearchOpenChange(true)}
            onBlur={() =>
              window.setTimeout(() => onSearchOpenChange(false), 150)
            }
            placeholder="Buscar automações, modelos, envios…"
            aria-label="Buscar no workspace"
          />
        </div>
        {searchOpen && query.trim() && (
          <div className="search-results">
            {results.length ? (
              results.map((result) => (
                <button
                  key={result.key}
                  onMouseDown={() => selectResult(result)}
                >
                  <b>{result.label}</b>
                  <small>{result.detail}</small>
                </button>
              ))
            ) : (
              <span>Nenhum resultado encontrado</span>
            )}
          </div>
        )}
      </div>
      <div className="top-actions">
        <span className={`system-status ${gmail.connected ? "" : "offline"}`}>
          <i />
          {gmail.connected ? `Gmail: ${gmail.email}` : "Gmail não conectado"}
        </span>
        <button
          className="avatar"
          onClick={() => onNavigate("settings")}
          title="Abrir configurações"
          aria-label="Abrir configurações"
        >
          {gmail.email?.slice(0, 2).toUpperCase() || "BF"}
        </button>
      </div>
    </header>
  );
}
