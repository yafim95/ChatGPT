import { Button, Text, Tooltip } from "@fluentui/react-components";
import {
  Briefcase24Regular,
  Chat24Regular,
  ClipboardTask24Regular,
  Database24Regular,
  Document24Regular,
  Home24Regular,
  Settings24Regular,
  ShieldCheckmark24Regular,
} from "@fluentui/react-icons";
import type { HealthResponse, Project } from "../types/api";
import { BackendStatus } from "./BackendStatus";

export type PrimaryView = "home" | "projects" | "project" | "settings";
export type ProjectSection =
  "overview" | "documents" | "ask" | "reviews" | "project-settings";

interface AppShellProps {
  brandName: string;
  view: PrimaryView;
  project?: Project;
  projectSection?: ProjectSection;
  compact?: boolean;
  health: HealthResponse;
  onNavigate: (view: "home" | "projects" | "settings") => void;
  onProjectSectionChange: (section: ProjectSection) => void;
  children: React.ReactNode;
}

interface NavItemProps {
  label: string;
  active: boolean;
  icon: React.ReactElement;
  compact: boolean;
  onClick: () => void;
}

function NavItem({
  label,
  active,
  icon,
  compact,
  onClick,
}: NavItemProps): React.JSX.Element {
  const button = (
    <Button
      className={`nav-item${active ? " nav-item--active" : ""}`}
      appearance="subtle"
      icon={icon}
      aria-label={label}
      onClick={onClick}
    >
      {compact ? null : label}
    </Button>
  );
  return compact ? (
    <Tooltip content={label} relationship="label" positioning="after">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

export function AppShell({
  brandName,
  view,
  project,
  projectSection = "overview",
  compact = false,
  health,
  onNavigate,
  onProjectSectionChange,
  children,
}: AppShellProps): React.JSX.Element {
  return (
    <div
      className={`app-frame${compact ? " app-frame--compact" : ""}`}
      data-projectmind-surface
    >
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <ShieldCheckmark24Regular />
          </div>
          {compact ? null : (
            <div className="brand-copy">
              <Text weight="semibold" truncate title={brandName}>
                {brandName}
              </Text>
              <Text size={200}>Engineering intelligence</Text>
            </div>
          )}
        </div>

        <nav className="primary-nav" aria-label="Application navigation">
          <NavItem
            label="Home"
            active={view === "home"}
            icon={<Home24Regular />}
            compact={compact}
            onClick={() => onNavigate("home")}
          />
          <NavItem
            label="Projects"
            active={view === "projects"}
            icon={<Briefcase24Regular />}
            compact={compact}
            onClick={() => onNavigate("projects")}
          />
        </nav>

        {project && view === "project" ? (
          <div className="project-navigation">
            {compact ? (
              <div className="nav-divider" />
            ) : (
              <Text className="nav-kicker">WORKSPACE</Text>
            )}
            {compact ? null : (
              <div className="active-project-label" title={project.name}>
                <span className="active-project-label__mark">
                  {project.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <Text weight="semibold" truncate>
                    {project.name}
                  </Text>
                  <Text size={100}>{project.project_number}</Text>
                </span>
              </div>
            )}
            <NavItem
              label="Overview"
              active={projectSection === "overview"}
              icon={<Home24Regular />}
              compact={compact}
              onClick={() => onProjectSectionChange("overview")}
            />
            <NavItem
              label="Documents"
              active={projectSection === "documents"}
              icon={<Document24Regular />}
              compact={compact}
              onClick={() => onProjectSectionChange("documents")}
            />
            <NavItem
              label="Ask Project"
              active={projectSection === "ask"}
              icon={<Chat24Regular />}
              compact={compact}
              onClick={() => onProjectSectionChange("ask")}
            />
            <NavItem
              label="Reviews"
              active={projectSection === "reviews"}
              icon={<ClipboardTask24Regular />}
              compact={compact}
              onClick={() => onProjectSectionChange("reviews")}
            />
            <NavItem
              label="Project settings"
              active={projectSection === "project-settings"}
              icon={<Settings24Regular />}
              compact={compact}
              onClick={() => onProjectSectionChange("project-settings")}
            />
          </div>
        ) : null}

        <div className="sidebar-spacer" />
        <nav className="primary-nav primary-nav--bottom">
          <NavItem
            label="Settings"
            active={view === "settings"}
            icon={<Settings24Regular />}
            compact={compact}
            onClick={() => onNavigate("settings")}
          />
        </nav>
        <Tooltip
          content="Documents and indexes stay on this Windows account."
          relationship="description"
        >
          <div className="local-data-note" tabIndex={0}>
            <Database24Regular />
            {compact ? null : (
              <div>
                <Text weight="semibold" size={200}>
                  Local-first workspace
                </Text>
                <Text size={100}>External AI is opt-in</Text>
              </div>
            )}
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
