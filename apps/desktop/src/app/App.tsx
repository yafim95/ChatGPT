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
import { AppShell, type AppView } from "../components/AppShell";
import { ProjectsPage } from "../pages/ProjectsPage";
import { SettingsPage } from "../pages/SettingsPage";

function preferredDarkMode(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function App(): React.JSX.Element {
  const [view, setView] = useState<AppView>("projects");
  const [systemDark, setSystemDark] = useState(preferredDarkMode);
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    retry: 60,
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

  const useDarkTheme = useMemo(() => {
    const selected = settingsQuery.data?.theme ?? "system";
    return selected === "dark" || (selected === "system" && systemDark);
  }, [settingsQuery.data?.theme, systemDark]);

  const theme = useDarkTheme ? webDarkTheme : webLightTheme;

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
          <Button
            icon={<ArrowClockwise24Regular />}
            appearance="primary"
            onClick={() => void healthQuery.refetch()}
          >
            Retry connection
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
