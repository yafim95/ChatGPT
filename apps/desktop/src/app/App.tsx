import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  FluentProvider,
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
import { api } from "../api/client";
import {
  getBackendRuntimeStatus,
  reportFrontendReady,
  restartBackend,
  type BackendRuntimeStatus,
} from "../api/bootstrap";
import { AppShell, type AppView } from "../components/AppShell";
import { ProjectsPage } from "../pages/ProjectsPage";
import { SettingsPage } from "../pages/SettingsPage";
import type { HealthResponse } from "../types/api";

class BackendStoppedError extends Error {
  constructor(readonly status: BackendRuntimeStatus) {
    super(status.lastError ?? "The local backend process stopped.");
    this.name = "BackendStoppedError";
  }
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
  const [view, setView] = useState<AppView>("projects");
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
    if (healthQuery.isSuccess) {
      void reportFrontendReady().catch(() => undefined);
    } else if (healthQuery.isError) {
      void getBackendRuntimeStatus()
        .then(setRuntimeStatus)
        .catch(() => setRuntimeStatus(undefined));
    }
  }, [healthQuery.isError, healthQuery.isSuccess]);

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
      if (result.isError) {
        setRuntimeStatus(await getBackendRuntimeStatus());
      }
    } catch {
      setRuntimeStatus(await getBackendRuntimeStatus().catch(() => undefined));
    } finally {
      setRestarting(false);
    }
  };

  if (healthQuery.isPending) {
    return (
      <FluentProvider theme={theme} className="root-provider">
        <div className="startup-state">
          <div className="startup-mark">
            <ShieldCheckmark24Regular />
          </div>
          <Title2>Starting ProjectMind</Title2>
          <Spinner label="Preparing the secure local workspace…" />
        </div>
      </FluentProvider>
    );
  }

  if (healthQuery.isError) {
    return (
      <FluentProvider theme={theme} className="root-provider">
        <div className="startup-state startup-state--error">
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

  return (
    <FluentProvider theme={theme} className="root-provider">
      <AppShell
        brandName={
          settingsQuery.data?.brand_name ?? "ProjectMind Engineering AI"
        }
        view={view}
        health={healthQuery.data}
        onViewChange={setView}
      >
        {view === "projects" ? <ProjectsPage /> : <SettingsPage />}
      </AppShell>
    </FluentProvider>
  );
}
