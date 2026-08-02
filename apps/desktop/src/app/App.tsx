import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  FluentProvider,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Title2,
  webDarkTheme,
  webLightTheme,
} from "@fluentui/react-components";
import {
  ArrowClockwise24Regular,
  ErrorCircle24Regular,
  ShieldCheckmark24Regular,
} from "@fluentui/react-icons";
import { api, ApiClientError } from "../api/client";
import {
  getBackendRuntimeStatus,
  reportFrontendReady,
  restartBackend,
  type BackendRuntimeStatus,
} from "../api/bootstrap";
import {
  AppShell,
  type PrimaryView,
  type ProjectSection,
} from "../components/AppShell";
import { ProjectFormDialog } from "../components/ProjectFormDialog";
import { HomePage } from "../pages/HomePage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { ProjectWorkspace } from "../pages/project/ProjectWorkspace";
import { SettingsPage, type SettingsSection } from "../pages/SettingsPage";
import type { HealthResponse, Project, ProjectPayload } from "../types/api";
import { AppLocaleProvider } from "./AppLocaleProvider";

class BackendStoppedError extends Error {
  constructor(readonly status: BackendRuntimeStatus) {
    super(status.lastError ?? "The local backend process stopped.");
    this.name = "BackendStoppedError";
  }
}

interface AppRoute {
  view: PrimaryView;
  projectId?: string;
  projectSection?: ProjectSection;
  settingsSection?: SettingsSection;
}

const ROUTE_STORAGE_KEY = "projectmind.active-route.v3";
const PROJECT_SECTIONS: ProjectSection[] = [
  "overview",
  "files",
  "ai",
  "reviews",
  "memory",
  "guide",
  "project-settings",
];
const SETTINGS_SECTIONS: SettingsSection[] = [
  "general",
  "ai",
  "retrieval",
  "documents",
  "privacy",
  "backups",
  "advanced",
];

function hasStoredRoute(): boolean {
  try {
    return localStorage.getItem(ROUTE_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function loadRoute(): AppRoute {
  try {
    const stored = JSON.parse(
      localStorage.getItem(ROUTE_STORAGE_KEY) ?? "null",
    ) as AppRoute | null;
    if (
      stored &&
      ["home", "projects", "project", "settings"].includes(stored.view)
    ) {
      if (stored.view === "settings") {
        return {
          view: "settings",
          settingsSection: SETTINGS_SECTIONS.includes(
            stored.settingsSection as SettingsSection,
          )
            ? stored.settingsSection
            : undefined,
        };
      }
      if (stored.view !== "project") return { view: stored.view };
      if (stored.projectId) {
        return {
          view: "project",
          projectId: stored.projectId,
          projectSection: PROJECT_SECTIONS.includes(
            stored.projectSection as ProjectSection,
          )
            ? stored.projectSection
            : "overview",
        };
      }
    }
  } catch {
    // A malformed preference should never block the desktop application.
  }
  return { view: "home" };
}

async function loadBackendHealth(): Promise<HealthResponse> {
  try {
    return await api.health();
  } catch (error) {
    const status = await getBackendRuntimeStatus().catch(() => undefined);
    if (status?.managed && !status.running && status.lastError) {
      throw new BackendStoppedError(status);
    }
    throw error;
  }
}

function preferredDarkMode(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function App(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [hadStoredRouteAtLaunch] = useState(hasStoredRoute);
  const [storedRouteAtLaunch] = useState(loadRoute);
  const readyReported = useRef(false);
  const autoScanSignatures = useRef(new Map<string, string>());
  const [route, setRoute] = useState<AppRoute>();
  const [dialog, setDialog] = useState<{ open: boolean; project?: Project }>({
    open: false,
  });
  const [systemDark, setSystemDark] = useState(preferredDarkMode);
  const [restarting, setRestarting] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<BackendRuntimeStatus>();

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: loadBackendHealth,
    retry: (failureCount, error) =>
      !(error instanceof BackendStoppedError) && failureCount < 180,
    retryDelay: 500,
    staleTime: 10_000,
  });
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    enabled: healthQuery.isSuccess,
  });
  const startupRoute = useMemo<AppRoute>(() => {
    if (settingsQuery.data?.start_view === "home") return { view: "home" };
    if (settingsQuery.data?.start_view === "projects")
      return { view: "projects" };
    return hadStoredRouteAtLaunch ? storedRouteAtLaunch : { view: "home" };
  }, [
    hadStoredRouteAtLaunch,
    settingsQuery.data?.start_view,
    storedRouteAtLaunch,
  ]);
  const activeRoute = route ?? startupRoute;
  const startupRouteReady = settingsQuery.isSuccess;
  const projectQuery = useQuery({
    queryKey: ["project", activeRoute.projectId],
    queryFn: () => api.getProject(activeRoute.projectId as string),
    enabled:
      activeRoute.view === "project" &&
      Boolean(activeRoute.projectId) &&
      healthQuery.isSuccess &&
      startupRouteReady,
  });
  const projectSummary = useQuery({
    queryKey: ["project-summary", activeRoute.projectId],
    queryFn: () => api.projectSummary(activeRoute.projectId as string),
    enabled:
      activeRoute.view === "project" &&
      Boolean(activeRoute.projectId) &&
      healthQuery.isSuccess &&
      startupRouteReady,
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent): void =>
      setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  useEffect(() => {
    document.title =
      settingsQuery.data?.brand_name ?? "ProjectMind Engineering AI";
  }, [settingsQuery.data?.brand_name]);
  useEffect(() => {
    if (startupRouteReady) {
      try {
        localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(activeRoute));
      } catch {
        // Navigation remains usable when WebView storage is unavailable.
      }
    }
  }, [activeRoute, startupRouteReady]);
  useEffect(() => {
    if (healthQuery.isSuccess && startupRouteReady && !readyReported.current) {
      readyReported.current = true;
      window.requestAnimationFrame(
        () => void reportFrontendReady().catch(() => undefined),
      );
    }
  }, [healthQuery.isSuccess, startupRouteReady]);
  useEffect(() => {
    if (healthQuery.isError) {
      void getBackendRuntimeStatus()
        .then(setRuntimeStatus)
        .catch(() => setRuntimeStatus(undefined));
    }
  }, [healthQuery.isError]);
  useEffect(() => {
    const project = projectQuery.data;
    const scanSignature = project
      ? `${project.settings.workspace_path ?? ""}|${String(project.settings.include_subfolders)}|${project.settings.excluded_patterns.join("|")}`
      : "";
    if (
      project &&
      (!project.settings.auto_scan_enabled || !project.settings.workspace_path)
    ) {
      autoScanSignatures.current.delete(project.id);
    }
    if (
      activeRoute.view === "project" &&
      project?.settings.auto_scan_enabled &&
      project.settings.workspace_path &&
      autoScanSignatures.current.get(project.id) !== scanSignature
    ) {
      autoScanSignatures.current.set(project.id, scanSignature);
      void api
        .scanDocuments(project.id)
        .then(async () => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ["documents", project.id],
            }),
            queryClient.invalidateQueries({
              queryKey: ["project-files", project.id],
            }),
            queryClient.invalidateQueries({
              queryKey: ["project-summary", project.id],
            }),
            queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
          ]);
        })
        .catch(() => autoScanSignatures.current.delete(project.id));
    }
  }, [activeRoute.view, projectQuery.data, queryClient]);

  const useDarkTheme = useMemo(() => {
    const selected = settingsQuery.data?.theme ?? "system";
    return selected === "dark" || (selected === "system" && systemDark);
  }, [settingsQuery.data?.theme, systemDark]);
  const theme = useDarkTheme ? webDarkTheme : webLightTheme;
  const visibleRuntimeStatus =
    healthQuery.error instanceof BackendStoppedError
      ? healthQuery.error.status
      : runtimeStatus;

  const retryConnection = async (): Promise<void> => {
    setRestarting(true);
    try {
      await restartBackend();
      const result = await healthQuery.refetch();
      if (result.isError) setRuntimeStatus(await getBackendRuntimeStatus());
    } catch {
      setRuntimeStatus(await getBackendRuntimeStatus().catch(() => undefined));
    } finally {
      setRestarting(false);
    }
  };

  const saveProject = useMutation({
    mutationFn: async (payload: ProjectPayload) => {
      const { settings, ...identity } = payload;
      if (dialog.project) {
        let updated = await api.updateProject(dialog.project.id, identity);
        if (settings)
          updated = await api.updateProjectSettings(
            dialog.project.id,
            settings,
          );
        return updated;
      }
      return api.createProject(payload);
    },
    onSuccess: async (project) => {
      setDialog({ open: false });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["project", project.id] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setRoute({
        view: "project",
        projectId: project.id,
        projectSection: "overview",
      });
    },
  });

  const navigate = (view: "home" | "projects" | "settings"): void =>
    setRoute({ view });
  const openAiSettings = (): void =>
    setRoute({ view: "settings", settingsSection: "ai" });
  const openProject = (project: Project): void => {
    setRoute({
      view: "project",
      projectId: project.id,
      projectSection: "overview",
    });
  };
  const editProject = (project: Project): void => {
    saveProject.reset();
    setDialog({ open: true, project });
  };
  const createProject = (): void => {
    saveProject.reset();
    setDialog({ open: true });
  };

  if (healthQuery.isError) {
    return (
      <FluentProvider theme={theme} className="root-provider">
        <div
          className="startup-state startup-state--error"
          data-projectmind-surface
        >
          <div className="startup-mark startup-mark--error">
            <ErrorCircle24Regular />
          </div>
          <Title2>Local service unavailable</Title2>
          <Text>
            ProjectMind could not connect to its local backend. No project data
            was sent externally.
          </Text>
          {visibleRuntimeStatus?.lastError ? (
            <Text className="startup-diagnostic" role="status">
              {visibleRuntimeStatus.lastError}
            </Text>
          ) : null}
          {visibleRuntimeStatus?.logPath ? (
            <Text className="startup-log-path" size={200}>
              Diagnostic log: {visibleRuntimeStatus.logPath}
            </Text>
          ) : null}
          <Button
            icon={<ArrowClockwise24Regular />}
            appearance="primary"
            disabled={restarting}
            onClick={() => void retryConnection()}
          >
            {restarting ? "Restarting local service…" : "Restart local service"}
          </Button>
        </div>
      </FluentProvider>
    );
  }
  if (settingsQuery.isError) {
    return (
      <FluentProvider theme={theme} className="root-provider">
        <div
          className="startup-state startup-state--error"
          data-projectmind-surface
        >
          <div className="startup-mark startup-mark--error">
            <ErrorCircle24Regular />
          </div>
          <Title2>Settings could not be loaded</Title2>
          <Text>
            The local service is running, but ProjectMind could not load its
            application settings.
          </Text>
          <Button
            icon={<ArrowClockwise24Regular />}
            appearance="primary"
            onClick={() => void settingsQuery.refetch()}
          >
            Retry settings
          </Button>
        </div>
      </FluentProvider>
    );
  }
  if (healthQuery.isPending || settingsQuery.isPending) {
    return (
      <FluentProvider theme={theme} className="root-provider">
        <div className="startup-state" data-projectmind-surface>
          <div className="startup-mark">
            <ShieldCheckmark24Regular />
          </div>
          <Title2>Starting ProjectMind</Title2>
          <Spinner label="Preparing the secure local workspace…" />
        </div>
      </FluentProvider>
    );
  }

  const settings = settingsQuery.data;
  const currentSection = activeRoute.projectSection ?? "overview";
  const providerClassName = [
    "root-provider",
    `visual-${settings.visual_style}`,
    `density-${settings.interface_density}`,
    settings.reduce_motion ? "reduce-motion" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <FluentProvider theme={theme} className={providerClassName}>
      <AppLocaleProvider locale={settings.locale}>
        <AppShell
          brandName={settings.brand_name}
          view={activeRoute.view}
          project={projectQuery.data}
          projectSection={currentSection}
          compact={settings.compact_navigation}
          health={healthQuery.data}
          onNavigate={navigate}
          onProjectSectionChange={(section) =>
            setRoute((current) => ({
              ...(current ?? activeRoute),
              view: "project",
              projectSection: section,
            }))
          }
        >
          {activeRoute.view === "home" ? (
            <HomePage
              onCreateProject={createProject}
              onOpenProject={openProject}
              onShowProjects={() => navigate("projects")}
              onShowSettings={openAiSettings}
            />
          ) : activeRoute.view === "projects" ? (
            <ProjectsPage
              onCreate={createProject}
              onEdit={editProject}
              onOpen={openProject}
            />
          ) : activeRoute.view === "settings" ? (
            <SettingsPage initialSection={activeRoute.settingsSection} />
          ) : projectQuery.isPending ? (
            <div className="center-state">
              <Spinner label="Opening project workspace…" />
            </div>
          ) : projectQuery.isError ? (
            <div className="page">
              <MessageBar intent="error">
                <MessageBarBody>
                  This project could not be opened. It may have been archived.
                </MessageBarBody>
              </MessageBar>
              <Button onClick={() => navigate("projects")}>
                Back to projects
              </Button>
            </div>
          ) : (
            <ProjectWorkspace
              project={projectQuery.data}
              summary={projectSummary.data}
              summaryError={projectSummary.isError}
              section={currentSection}
              onBack={() => navigate("projects")}
              onSectionChange={(section) =>
                setRoute((current) => ({
                  ...(current ?? activeRoute),
                  projectSection: section,
                }))
              }
              onEditProject={editProject}
              onOpenGlobalSettings={openAiSettings}
              autoIncludeCoreMemory={settings.auto_include_core_memory}
            />
          )}
        </AppShell>

        {dialog.open ? (
          <ProjectFormDialog
            key={dialog.project?.id ?? "new-project"}
            open
            project={dialog.project}
            defaultWorkspacePath={settings.default_project_root}
            saving={saveProject.isPending}
            error={
              saveProject.error instanceof ApiClientError
                ? saveProject.error.message
                : saveProject.isError
                  ? "The project could not be saved."
                  : undefined
            }
            onDismiss={() =>
              !saveProject.isPending && setDialog({ open: false })
            }
            onSubmit={(payload) =>
              saveProject.mutateAsync(payload).then(() => undefined)
            }
          />
        ) : null}
      </AppLocaleProvider>
    </FluentProvider>
  );
}
