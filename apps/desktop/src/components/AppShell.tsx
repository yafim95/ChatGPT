import { Button, Text, Tooltip } from "@fluentui/react-components";
import {
  Briefcase24Regular,
  Database24Regular,
  Settings24Regular,
  ShieldCheckmark24Regular,
} from "@fluentui/react-icons";
import { BackendStatus } from "./BackendStatus";
import type { HealthResponse } from "../types/api";

export type AppView = "projects" | "settings";

interface AppShellProps {
  brandName: string;
  view: AppView;
  health: HealthResponse;
  onViewChange: (view: AppView) => void;
  children: React.ReactNode;
}

export function AppShell({
  brandName,
  view,
  health,
  onViewChange,
  children,
}: AppShellProps): React.JSX.Element {
  return (
    <div className="app-frame" data-projectmind-surface>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <ShieldCheckmark24Regular />
          </div>
          <div className="brand-copy">
            <Text weight="semibold" truncate title={brandName}>
              {brandName}
            </Text>
            <Text size={200}>Engineering intelligence</Text>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Primary navigation">
          <Button
            appearance={view === "projects" ? "primary" : "subtle"}
            icon={<Briefcase24Regular />}
            onClick={() => onViewChange("projects")}
          >
            Projects
          </Button>
          <Button
            appearance={view === "settings" ? "primary" : "subtle"}
            icon={<Settings24Regular />}
            onClick={() => onViewChange("settings")}
          >
            Settings
          </Button>
        </nav>
        <div className="sidebar-spacer" />
        <Tooltip
          content="All Phase 1 data remains in the local SQLite project database."
          relationship="description"
        >
          <div className="local-data-note" tabIndex={0}>
            <Database24Regular />
            <div>
              <Text weight="semibold" size={200}>
                Local workspace
              </Text>
              <Text size={100}>No cloud document upload</Text>
            </div>
          </div>
        </Tooltip>
        <div className="sidebar-status">
          <BackendStatus connected version={health.version} />
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
