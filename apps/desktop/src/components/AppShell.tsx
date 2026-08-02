import { Button, Text, Tooltip } from "@fluentui/react-components";
import {
  BookOpen24Regular,
  Bot24Regular,
  Briefcase24Regular,
  ClipboardTask24Regular,
  Database24Regular,
  FolderOpen24Regular,
  Home24Regular,
  Navigation24Regular,
  Search24Regular,
  Settings24Regular,
  ShieldCheckmark24Regular,
  Sparkle24Regular,
} from "@fluentui/react-icons";
import type { HealthResponse, Project } from "../types/api";
import { BackendStatus } from "./BackendStatus";

export type PrimaryView = "home" | "projects" | "project" | "settings";
export type ProjectSection =
  | "overview"
  | "files"
  | "ai"
  | "reviews"
  | "memory"
  | "guide"
  | "project-settings";

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
  description?: string;
  active: boolean;
  icon: React.ReactElement;
  compact: boolean;
  onClick: () => void;
}

function NavItem({
  label,
  description,
  active,
  icon,
  compact,
  onClick,
}: NavItemProps): React.JSX.Element {
  const button = (
    <Button
      className={`nav-item nav-item-v3${active ? " nav-item--active" : ""}`}
      appearance="subtle"
      icon={icon}
      aria-label={label}
      onClick={onClick}
    >
      {compact ? null : (
        <span className="nav-item-v3__copy">
          <span>{label}</span>
          {description ? <small>{description}</small> : null}
        </span>
      )}
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

const sectionTitle: Record<ProjectSection, string> = {
  overview: "Project command center",
  files: "Project files",
  ai: "AI workspace",
  reviews: "Reviews & CRS",
  memory: "Project memory",
  guide: "Workflow guide",
  "project-settings": "Project controls",
};

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
  const currentTitle =
    view === "home"
      ? "Home"
      : view === "projects"
        ? "Projects"
        : view === "settings"
          ? "Application settings"
          : sectionTitle[projectSection];

  return (
    <div
      className={`app-frame app-frame-v3${compact ? " app-frame--compact" : ""}`}
      data-projectmind-surface
    >
      <div className="ambient-orb ambient-orb--one" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--two" aria-hidden="true" />
      <aside className="sidebar sidebar-v3 glass-surface">
        <div className="brand-block brand-block-v3">
          <div className="brand-mark brand-mark-v3" aria-hidden="true">
            <ShieldCheckmark24Regular />
          </div>
          {compact ? null : (
            <div className="brand-copy">
              <Text weight="semibold" truncate title={brandName}>
                {brandName}
              </Text>
              <Text size={100}>Engineering document intelligence</Text>
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
          <div className="project-navigation project-navigation-v3">
            {compact ? (
              <div className="nav-divider" />
            ) : (
              <>
                <Text className="nav-kicker">ACTIVE PROJECT</Text>
                <div className="active-project-card" title={project.name}>
                  <span className="active-project-card__mark">
                    {project.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="active-project-card__copy">
                    <Text weight="semibold" truncate>
                      {project.name}
                    </Text>
                    <Text size={100}>{project.project_number}</Text>
                  </span>
                  <Navigation24Regular />
                </div>
              </>
            )}
            <NavItem
              label="Command center"
              description="Project health and activity"
              active={projectSection === "overview"}
              icon={<Home24Regular />}
              compact={compact}
              onClick={() => onProjectSectionChange("overview")}
            />
            <NavItem
              label="Project files"
              description="Browse, search, and classify"
              active={projectSection === "files"}
              icon={<FolderOpen24Regular />}
              compact={compact}
              onClick={() => onProjectSectionChange("files")}
            />
            <NavItem
              label="AI workspace"
              description="Chats with controlled context"
              active={projectSection === "ai"}
              icon={<Bot24Regular />}
              compact={compact}
              onClick={() => onProjectSectionChange("ai")}
            />
            <NavItem
              label="Reviews & CRS"
              description="Decisions and comment replies"
              active={projectSection === "reviews"}
              icon={<ClipboardTask24Regular />}
              compact={compact}
              onClick={() => onProjectSectionChange("reviews")}
            />
            <NavItem
              label="Project memory"
              description="Contracts and permanent context"
              active={projectSection === "memory"}
              icon={<Sparkle24Regular />}
              compact={compact}
              onClick={() => onProjectSectionChange("memory")}
            />
            <NavItem
              label="How to use"
              description="Recommended review workflow"
              active={projectSection === "guide"}
              icon={<BookOpen24Regular />}
              compact={compact}
              onClick={() => onProjectSectionChange("guide")}
            />
            <NavItem
              label="Project controls"
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
        {compact ? null : (
          <div className="local-data-note local-data-note-v3">
            <Database24Regular />
            <div>
              <Text weight="semibold" size={200}>
                Local workspace
              </Text>
              <Text size={100}>External AI remains opt-in</Text>
            </div>
          </div>
        )}
        <div className="sidebar-status">
          <BackendStatus connected version={health.version} />
        </div>
      </aside>

      <main className="main-content main-content-v3">
        <header className="app-command-bar glass-surface">
          <div className="app-command-bar__title">
            <Text size={100} className="eyebrow">
              {project ? project.project_number : "PROJECTMIND"}
            </Text>
            <Text weight="semibold">{currentTitle}</Text>
          </div>
          <div className="app-command-bar__actions">
            {project ? (
              <Button
                appearance="subtle"
                icon={<Search24Regular />}
                onClick={() => onProjectSectionChange("files")}
              >
                Search project
              </Button>
            ) : null}
            {project ? (
              <Button
                appearance="subtle"
                icon={<BookOpen24Regular />}
                onClick={() => onProjectSectionChange("guide")}
              >
                Workflow
              </Button>
            ) : null}
            <span className="connection-chip">
              <span /> Local service ready
            </span>
          </div>
        </header>
        <div className="main-scroll-region">{children}</div>
      </main>
    </div>
  );
}
