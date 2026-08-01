import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Switch,
  Text,
  Title2,
  Title3,
} from "@fluentui/react-components";
import {
  ArrowSync20Regular,
  Bot24Regular,
  Database24Regular,
  Delete20Regular,
  FolderOpen20Regular,
  LockClosed24Regular,
  Open20Regular,
  Save20Regular,
  Search24Regular,
  Settings24Regular,
  ShieldLock24Regular,
} from "@fluentui/react-icons";
import { api, ApiClientError } from "../api/client";
import { useAppLocale } from "../app/LocaleContext";
import {
  nativeErrorMessage,
  openDiagnosticsFolder,
  resetRenderer,
  revealLocalPath,
  selectProjectFolder,
} from "../api/native";
import type { ApplicationSettings } from "../types/api";

export type SettingsSection =
  "general" | "ai" | "retrieval" | "privacy" | "backups" | "advanced";

const sectionItems: Array<{
  id: SettingsSection;
  label: string;
  description: string;
  icon: React.ReactElement;
}> = [
  {
    id: "general",
    label: "General",
    description: "Appearance and startup",
    icon: <Settings24Regular />,
  },
  {
    id: "ai",
    label: "AI Provider",
    description: "Kimi and credentials",
    icon: <Bot24Regular />,
  },
  {
    id: "retrieval",
    label: "Retrieval",
    description: "Search behavior",
    icon: <Search24Regular />,
  },
  {
    id: "privacy",
    label: "Privacy",
    description: "Data and history",
    icon: <LockClosed24Regular />,
  },
  {
    id: "backups",
    label: "Backups",
    description: "Database protection",
    icon: <Database24Regular />,
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Diagnostics and recovery",
    icon: <ShieldLock24Regular />,
  },
];

function numeric(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

interface SettingsFormProps {
  initial: ApplicationSettings;
  initialSection?: SettingsSection;
}

function SettingsForm({
  initial,
  initialSection = "general",
}: SettingsFormProps): React.JSX.Element {
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [form, setForm] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [nativeError, setNativeError] = useState<string>();
  const maintenance = useQuery({
    queryKey: ["maintenance"],
    queryFn: api.maintenanceInfo,
  });
  const provider = useQuery({
    queryKey: ["provider"],
    queryFn: api.providerStatus,
  });

  const save = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (settings) => {
      setForm(settings);
      queryClient.setQueryData(["settings"], settings);
    },
  });
  const saveAi = useMutation({
    mutationFn: async () => {
      const settings = await api.updateSettings({
        external_ai_enabled: form.external_ai_enabled,
        ai_provider: form.ai_provider,
        ai_base_url: form.ai_base_url,
        ai_model: form.ai_model,
        ai_reasoning_effort: form.ai_reasoning_effort,
        ai_timeout_seconds: form.ai_timeout_seconds,
        ai_max_output_tokens: form.ai_max_output_tokens,
      });
      if (apiKey.trim()) await api.saveProviderKey(apiKey.trim());
      return settings;
    },
    onSuccess: async (settings) => {
      const normalizedSettings = {
        ...settings,
        ai_api_key_configured:
          apiKey.trim().length > 0 || settings.ai_api_key_configured,
      };
      setApiKey("");
      setForm(normalizedSettings);
      queryClient.setQueryData(["settings"], normalizedSettings);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["provider"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
  const testProvider = useMutation({ mutationFn: api.testProvider });
  const removeKey = useMutation({
    mutationFn: api.removeProviderKey,
    onSuccess: async () => {
      setForm((current) => ({ ...current, ai_api_key_configured: false }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["provider"] }),
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
  const backup = useMutation({
    mutationFn: api.createBackup,
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["maintenance"] }),
  });

  const set = <K extends keyof ApplicationSettings>(
    key: K,
    value: ApplicationSettings[K],
  ): void => {
    setForm((current) => ({ ...current, [key]: value }));
    save.reset();
    saveAi.reset();
    testProvider.reset();
  };
  const saveMessage =
    save.error instanceof ApiClientError
      ? save.error.message
      : save.isError
        ? "Settings could not be saved."
        : undefined;
  const aiError = [saveAi.error, testProvider.error, removeKey.error].find(
    Boolean,
  );
  const aiErrorMessage =
    aiError instanceof ApiClientError
      ? aiError.message
      : aiError
        ? "The AI provider action could not be completed."
        : undefined;

  const runNativeAction = async (
    action: () => Promise<unknown>,
    fallback: string,
  ): Promise<void> => {
    setNativeError(undefined);
    try {
      await action();
    } catch (error) {
      setNativeError(nativeErrorMessage(error, fallback));
    }
  };

  const chooseDefaultRoot = async (): Promise<void> => {
    await runNativeAction(async () => {
      const selected = await selectProjectFolder(
        form.default_project_root ?? undefined,
      );
      if (selected) set("default_project_root", selected);
    }, "Windows could not open the folder picker.");
  };

  return (
    <div className="settings-layout">
      <aside
        className="settings-nav surface-card"
        aria-label="Settings categories"
      >
        {sectionItems.map((item) => (
          <button
            key={item.id}
            className={
              section === item.id
                ? "settings-nav-item settings-nav-item--active"
                : "settings-nav-item"
            }
            onClick={() => {
              setSection(item.id);
              save.reset();
              saveAi.reset();
              testProvider.reset();
              setNativeError(undefined);
            }}
          >
            <span>{item.icon}</span>
            <span>
              <Text weight="semibold">{item.label}</Text>
              <Text size={100}>{item.description}</Text>
            </span>
          </button>
        ))}
      </aside>

      <div className="settings-content">
        {nativeError ? (
          <MessageBar intent="error">
            <MessageBarBody>{nativeError}</MessageBarBody>
          </MessageBar>
        ) : null}
        {section === "general" ? (
          <>
            <div className="section-heading">
              <div>
                <Text className="eyebrow">APPLICATION</Text>
                <Title3>General</Title3>
                <Text className="section-description">
                  Control the appearance, name, and starting location.
                </Text>
              </div>
            </div>
            <Card className="settings-module" appearance="outline">
              <div className="settings-module__heading">
                <div className="settings-module__icon">
                  <Settings24Regular />
                </div>
                <div>
                  <Text weight="semibold" size={400}>
                    Appearance
                  </Text>
                  <Text className="muted-text">
                    Changes apply to the local desktop interface.
                  </Text>
                </div>
              </div>
              <Field
                label="Application name"
                hint="Shown in the title bar and navigation."
              >
                <Input
                  value={form.brand_name}
                  maxLength={120}
                  onChange={(_, data) => set("brand_name", data.value)}
                />
              </Field>
              <div className="two-column-fields">
                <Field label="Theme">
                  <Dropdown
                    value={
                      form.theme === "system"
                        ? "Use Windows setting"
                        : form.theme === "dark"
                          ? "Dark"
                          : "Light"
                    }
                    selectedOptions={[form.theme]}
                    onOptionSelect={(_, data) =>
                      data.optionValue &&
                      set(
                        "theme",
                        data.optionValue as ApplicationSettings["theme"],
                      )
                    }
                  >
                    <Option value="system">Use Windows setting</Option>
                    <Option value="light">Light</Option>
                    <Option value="dark">Dark</Option>
                  </Dropdown>
                </Field>
                <Field
                  label="Regional format"
                  hint="Controls local date and number formatting; interface text remains English."
                >
                  <Dropdown
                    value={
                      form.locale === "ar-AE" ? "Arabic (UAE)" : "English (UAE)"
                    }
                    selectedOptions={[form.locale]}
                    onOptionSelect={(_, data) =>
                      data.optionValue && set("locale", data.optionValue)
                    }
                  >
                    <Option value="en-AE">English (UAE)</Option>
                    <Option value="ar-AE">Arabic (UAE)</Option>
                  </Dropdown>
                </Field>
              </div>
              <div className="two-column-fields">
                <Field label="Start page">
                  <Dropdown
                    value={
                      form.start_view === "projects"
                        ? "Projects"
                        : form.start_view === "home"
                          ? "Home dashboard"
                          : "Resume last workspace"
                    }
                    selectedOptions={[form.start_view]}
                    onOptionSelect={(_, data) =>
                      data.optionValue &&
                      set(
                        "start_view",
                        data.optionValue as ApplicationSettings["start_view"],
                      )
                    }
                  >
                    <Option value="home">Home dashboard</Option>
                    <Option value="projects">Projects</Option>
                    <Option value="last">Resume last workspace</Option>
                  </Dropdown>
                </Field>
                <div className="setting-switch-row setting-switch-row--field">
                  <div>
                    <Text weight="semibold">Compact navigation</Text>
                    <Text size={200}>Use icons and more content space.</Text>
                  </div>
                  <Switch
                    checked={form.compact_navigation}
                    onChange={(_, data) =>
                      set("compact_navigation", data.checked)
                    }
                  />
                </div>
              </div>
            </Card>
            <div className="settings-save-row">
              <Button
                appearance="primary"
                icon={<Save20Regular />}
                disabled={save.isPending || form.brand_name.trim().length < 2}
                onClick={() =>
                  save.mutate({
                    brand_name: form.brand_name.trim(),
                    theme: form.theme,
                    locale: form.locale,
                    start_view: form.start_view,
                    compact_navigation: form.compact_navigation,
                  })
                }
              >
                {save.isPending ? "Saving…" : "Save general settings"}
              </Button>
            </div>
          </>
        ) : null}

        {section === "ai" ? (
          <>
            <div className="section-heading">
              <div>
                <Text className="eyebrow">EXTERNAL REASONING</Text>
                <Title3>AI Provider</Title3>
                <Text className="section-description">
                  Configure Kimi or another OpenAI-compatible endpoint. The API
                  key is protected with Windows DPAPI and never stored in
                  SQLite.
                </Text>
              </div>
              <Badge
                color={provider.data?.configured ? "success" : "warning"}
                appearance="tint"
              >
                {provider.isError
                  ? "Status unavailable"
                  : provider.data?.configured
                    ? "Key saved"
                    : "Not configured"}
              </Badge>
            </div>
            <MessageBar intent="info">
              <MessageBarBody>
                Project documents remain local. Only retrieved excerpts needed
                for a question or review are included when external AI is
                enabled.
              </MessageBarBody>
            </MessageBar>
            {provider.isError ? (
              <MessageBar intent="error">
                <MessageBarBody>
                  Provider status could not be loaded from the local service.
                </MessageBarBody>
              </MessageBar>
            ) : null}
            <Card className="settings-module" appearance="outline">
              <div className="setting-switch-row">
                <div>
                  <Text weight="semibold">Allow external AI requests</Text>
                  <Text size={200}>
                    Required for chat and engineering review generation. Local
                    scanning and search work without it.
                  </Text>
                </div>
                <Switch
                  checked={form.external_ai_enabled}
                  onChange={(_, data) =>
                    set("external_ai_enabled", data.checked)
                  }
                />
              </div>
              <div className="three-column-fields">
                <Field label="Provider">
                  <Dropdown
                    value={
                      form.ai_provider === "moonshot"
                        ? "Moonshot AI / Kimi"
                        : "OpenAI-compatible"
                    }
                    selectedOptions={[form.ai_provider]}
                    onOptionSelect={(_, data) =>
                      data.optionValue &&
                      set(
                        "ai_provider",
                        data.optionValue as ApplicationSettings["ai_provider"],
                      )
                    }
                  >
                    <Option value="moonshot">Moonshot AI / Kimi</Option>
                    <Option value="openai_compatible">OpenAI-compatible</Option>
                  </Dropdown>
                </Field>
                <Field label="Model">
                  <Input
                    value={form.ai_model}
                    onChange={(_, data) => set("ai_model", data.value)}
                  />
                </Field>
                <Field
                  label="K3 reasoning effort"
                  hint="Applied when the selected model is Kimi K3."
                >
                  <Dropdown
                    value={
                      form.ai_reasoning_effort === "low"
                        ? "Low"
                        : form.ai_reasoning_effort === "max"
                          ? "Maximum"
                          : "High"
                    }
                    selectedOptions={[form.ai_reasoning_effort]}
                    disabled={
                      !form.ai_model.toLowerCase().startsWith("kimi-k3")
                    }
                    onOptionSelect={(_, data) =>
                      data.optionValue &&
                      set(
                        "ai_reasoning_effort",
                        data.optionValue as ApplicationSettings["ai_reasoning_effort"],
                      )
                    }
                  >
                    <Option value="low">Low — faster and lower cost</Option>
                    <Option value="high">High — balanced</Option>
                    <Option value="max">Maximum — deepest reasoning</Option>
                  </Dropdown>
                </Field>
              </div>
              <Field
                label="Base URL"
                hint="OpenAI-compatible API root; use HTTPS remotely and do not include /chat/completions."
              >
                <Input
                  value={form.ai_base_url}
                  onChange={(_, data) => set("ai_base_url", data.value)}
                />
              </Field>
              <Field
                label={
                  form.ai_api_key_configured ? "Replace API key" : "API key"
                }
                hint={
                  form.ai_api_key_configured
                    ? "A protected key is already saved. Leave blank to keep it."
                    : "Stored for the current Windows user only."
                }
              >
                <Input
                  type="password"
                  value={apiKey}
                  autoComplete="off"
                  placeholder={
                    form.ai_api_key_configured
                      ? "Protected key saved"
                      : "Enter provider API key"
                  }
                  onChange={(_, data) => setApiKey(data.value)}
                />
              </Field>
              <div className="two-column-fields">
                <Field label="Request timeout (seconds)">
                  <Input
                    type="number"
                    min={10}
                    max={300}
                    value={String(form.ai_timeout_seconds)}
                    onChange={(_, data) =>
                      set("ai_timeout_seconds", numeric(data.value, 180))
                    }
                  />
                </Field>
                <Field
                  label="Maximum completion tokens"
                  hint="For Kimi K3 this budget includes reasoning and the final answer."
                >
                  <Input
                    type="number"
                    min={256}
                    max={131072}
                    value={String(form.ai_max_output_tokens)}
                    onChange={(_, data) =>
                      set("ai_max_output_tokens", numeric(data.value, 16000))
                    }
                  />
                </Field>
              </div>
              {aiErrorMessage ? (
                <MessageBar intent="error">
                  <MessageBarBody>{aiErrorMessage}</MessageBarBody>
                </MessageBar>
              ) : null}
              {saveAi.isSuccess ? (
                <MessageBar intent="success">
                  <MessageBarBody>
                    AI provider settings saved securely.
                  </MessageBarBody>
                </MessageBar>
              ) : null}
              {testProvider.isSuccess ? (
                <MessageBar intent="success">
                  <MessageBarBody>{testProvider.data.message}</MessageBarBody>
                </MessageBar>
              ) : null}
              <div className="settings-module__actions">
                <Button
                  appearance="primary"
                  icon={<Save20Regular />}
                  disabled={
                    saveAi.isPending ||
                    form.ai_model.trim().length === 0 ||
                    form.ai_base_url.trim().length === 0
                  }
                  onClick={() => saveAi.mutate()}
                >
                  {saveAi.isPending ? "Saving…" : "Save provider"}
                </Button>
                <Button
                  icon={<ArrowSync20Regular />}
                  disabled={
                    !form.ai_api_key_configured || testProvider.isPending
                  }
                  onClick={() => testProvider.mutate()}
                >
                  {testProvider.isPending ? "Testing…" : "Test connection"}
                </Button>
                {form.ai_api_key_configured ? (
                  <Button
                    appearance="subtle"
                    icon={<Delete20Regular />}
                    disabled={removeKey.isPending}
                    onClick={() => removeKey.mutate()}
                  >
                    Remove key
                  </Button>
                ) : null}
              </div>
            </Card>
          </>
        ) : null}

        {section === "retrieval" ? (
          <>
            <div className="section-heading">
              <div>
                <Text className="eyebrow">LOCAL SEARCH</Text>
                <Title3>Retrieval</Title3>
                <Text className="section-description">
                  Control how much indexed evidence is selected for answers and
                  reviews.
                </Text>
              </div>
            </div>
            <Card className="settings-module" appearance="outline">
              <div className="settings-module__heading">
                <div className="settings-module__icon">
                  <Search24Regular />
                </div>
                <div>
                  <Text weight="semibold" size={400}>
                    Search behavior
                  </Text>
                  <Text className="muted-text">
                    Current approved sources should normally be preferred over
                    superseded versions.
                  </Text>
                </div>
              </div>
              <Field
                label="Evidence results per AI request"
                hint="Recommended: 6–10. Larger values send more extracted text and may cost more."
              >
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={String(form.retrieval_result_limit)}
                  onChange={(_, data) =>
                    set("retrieval_result_limit", numeric(data.value, 8))
                  }
                />
              </Field>
              <div className="setting-switch-row">
                <div>
                  <Text weight="semibold">
                    Include superseded versions in AI retrieval
                  </Text>
                  <Text size={200}>
                    Useful for comparisons, but may introduce outdated
                    requirements. Full manual search can still include versions
                    separately.
                  </Text>
                </div>
                <Switch
                  checked={form.include_superseded_search}
                  onChange={(_, data) =>
                    set("include_superseded_search", data.checked)
                  }
                />
              </div>
              <Field
                label="Default project root"
                hint="Optional starting folder when creating projects."
              >
                <div className="path-picker">
                  <Input
                    value={form.default_project_root ?? ""}
                    placeholder="No default folder"
                    onChange={(_, data) =>
                      set("default_project_root", data.value || null)
                    }
                  />
                  <Button
                    icon={<FolderOpen20Regular />}
                    onClick={() => void chooseDefaultRoot()}
                  >
                    Browse
                  </Button>
                </div>
              </Field>
            </Card>
            <div className="settings-save-row">
              <Button
                appearance="primary"
                icon={<Save20Regular />}
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({
                    retrieval_result_limit: form.retrieval_result_limit,
                    include_superseded_search: form.include_superseded_search,
                    default_project_root: form.default_project_root,
                  })
                }
              >
                Save retrieval settings
              </Button>
            </div>
          </>
        ) : null}

        {section === "privacy" ? (
          <>
            <div className="section-heading">
              <div>
                <Text className="eyebrow">DATA CONTROL</Text>
                <Title3>Privacy</Title3>
                <Text className="section-description">
                  Decide what is retained locally and whether external reasoning
                  is allowed.
                </Text>
              </div>
            </div>
            <Card className="settings-module" appearance="outline">
              <div className="settings-module__heading">
                <div className="settings-module__icon">
                  <LockClosed24Regular />
                </div>
                <div>
                  <Text weight="semibold" size={400}>
                    Data and history
                  </Text>
                  <Text className="muted-text">
                    Document bytes and indexes stay on this Windows account.
                  </Text>
                </div>
              </div>
              <div className="setting-switch-row">
                <div>
                  <Text weight="semibold">Allow external AI requests</Text>
                  <Text size={200}>
                    Sends your prompt, project identity, limited prior chat
                    context, and selected retrieved excerpts to the configured
                    provider.
                  </Text>
                </div>
                <Switch
                  checked={form.external_ai_enabled}
                  onChange={(_, data) =>
                    set("external_ai_enabled", data.checked)
                  }
                />
              </div>
              <div className="setting-switch-row">
                <div>
                  <Text weight="semibold">Save conversation history</Text>
                  <Text size={200}>
                    Store questions, answers, and citation metadata in the local
                    database.
                  </Text>
                </div>
                <Switch
                  checked={form.save_chat_history}
                  onChange={(_, data) => set("save_chat_history", data.checked)}
                />
              </div>
              <div className="setting-switch-row">
                <div>
                  <Text weight="semibold">Application telemetry</Text>
                  <Text size={200}>
                    This build sends no telemetry, project identity, document
                    text, or usage analytics.
                  </Text>
                </div>
                <Badge appearance="tint" color="success">
                  Off
                </Badge>
              </div>
            </Card>
            <div className="privacy-summary">
              <ShieldLock24Regular />
              <div>
                <Text weight="semibold">Local by default</Text>
                <Text size={200}>
                  Scanning, revision tracking, previews, full-text search,
                  settings, and backups work without external AI.
                </Text>
              </div>
            </div>
            <div className="settings-save-row">
              <Button
                appearance="primary"
                icon={<Save20Regular />}
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({
                    external_ai_enabled: form.external_ai_enabled,
                    save_chat_history: form.save_chat_history,
                  })
                }
              >
                Save privacy settings
              </Button>
            </div>
          </>
        ) : null}

        {section === "backups" ? (
          <>
            <div className="section-heading">
              <div>
                <Text className="eyebrow">RECOVERY</Text>
                <Title3>Backups</Title3>
                <Text className="section-description">
                  Protect the local database containing projects, indexes,
                  conversations, and reviews. Original source documents remain
                  in their project folders.
                </Text>
              </div>
              <Button
                appearance="primary"
                icon={<Database24Regular />}
                disabled={backup.isPending}
                onClick={() => backup.mutate()}
              >
                {backup.isPending ? "Creating…" : "Back up now"}
              </Button>
            </div>
            {backup.isSuccess ? (
              <MessageBar intent="success">
                <MessageBarBody>
                  Database backup created successfully.
                </MessageBarBody>
              </MessageBar>
            ) : null}
            {backup.isError ? (
              <MessageBar intent="error">
                <MessageBarBody>
                  {backup.error instanceof ApiClientError
                    ? backup.error.message
                    : "Backup could not be created."}
                </MessageBarBody>
              </MessageBar>
            ) : null}
            <Card className="settings-module" appearance="outline">
              <div className="setting-switch-row">
                <div>
                  <Text weight="semibold">Automatic backups</Text>
                  <Text size={200}>
                    Create a local database backup according to the selected
                    interval.
                  </Text>
                </div>
                <Switch
                  checked={form.auto_backup_enabled}
                  onChange={(_, data) =>
                    set("auto_backup_enabled", data.checked)
                  }
                />
              </div>
              <div className="two-column-fields">
                <Field label="Backup interval (days)">
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={String(form.backup_interval_days)}
                    onChange={(_, data) =>
                      set("backup_interval_days", numeric(data.value, 7))
                    }
                  />
                </Field>
                <Field label="Backups to retain">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={String(form.backup_retention_count)}
                    onChange={(_, data) =>
                      set("backup_retention_count", numeric(data.value, 10))
                    }
                  />
                </Field>
              </div>
              <div className="settings-module__actions">
                <Button
                  icon={<FolderOpen20Regular />}
                  disabled={!maintenance.data}
                  onClick={() =>
                    maintenance.data &&
                    void runNativeAction(
                      () => revealLocalPath(maintenance.data.backup_directory),
                      "Windows could not open the backup folder.",
                    )
                  }
                >
                  Open backup folder
                </Button>
              </div>
            </Card>
            <Card className="backup-history" appearance="outline">
              <div className="panel-heading">
                <div>
                  <Text className="eyebrow">AVAILABLE COPIES</Text>
                  <Title3>Recent backups</Title3>
                </div>
              </div>
              {maintenance.isPending ? (
                <Spinner label="Loading backups…" />
              ) : maintenance.isError ? (
                <MessageBar intent="error">
                  <MessageBarBody>
                    Backup history could not be loaded.
                  </MessageBarBody>
                </MessageBar>
              ) : maintenance.data.backups.length ? (
                <div>
                  {maintenance.data.backups.slice(0, 10).map((item) => (
                    <button
                      key={item.path}
                      onClick={() =>
                        void runNativeAction(
                          () => revealLocalPath(item.path),
                          "Windows could not reveal this backup.",
                        )
                      }
                    >
                      <Database24Regular />
                      <span>
                        <Text weight="semibold">{item.file_name}</Text>
                        <Text size={100}>
                          {new Date(item.created_at).toLocaleString(locale)} ·{" "}
                          {(item.size_bytes / 1024).toFixed(0)} KB
                        </Text>
                      </span>
                      <Open20Regular />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="panel-empty">
                  <Text className="muted-text">
                    No local backups have been created yet.
                  </Text>
                </div>
              )}
            </Card>
            <div className="settings-save-row">
              <Button
                appearance="primary"
                icon={<Save20Regular />}
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({
                    auto_backup_enabled: form.auto_backup_enabled,
                    backup_interval_days: form.backup_interval_days,
                    backup_retention_count: form.backup_retention_count,
                  })
                }
              >
                Save backup settings
              </Button>
            </div>
          </>
        ) : null}

        {section === "advanced" ? (
          <>
            <div className="section-heading">
              <div>
                <Text className="eyebrow">SYSTEM</Text>
                <Title3>Advanced</Title3>
                <Text className="section-description">
                  Diagnostics, storage locations, and safe interface recovery.
                </Text>
              </div>
            </div>
            <Card className="settings-module" appearance="outline">
              <div className="settings-module__heading">
                <div className="settings-module__icon">
                  <ShieldLock24Regular />
                </div>
                <div>
                  <Text weight="semibold" size={400}>
                    Local service
                  </Text>
                  <Text className="muted-text">
                    Technical logs exclude request bodies, document text, launch
                    tokens, and provider keys.
                  </Text>
                </div>
              </div>
              {maintenance.isError ? (
                <MessageBar intent="error">
                  <MessageBarBody>
                    Storage information could not be loaded. Diagnostics can
                    still be opened directly.
                  </MessageBarBody>
                </MessageBar>
              ) : null}
              <div className="setting-switch-row">
                <div>
                  <Text weight="semibold">Diagnostic logging</Text>
                  <Text size={200}>
                    Keep rotating backend service logs. Essential native startup
                    and migration recovery diagnostics remain bounded and
                    sanitized.
                  </Text>
                </div>
                <Switch
                  checked={form.diagnostic_logging_enabled}
                  onChange={(_, data) =>
                    set("diagnostic_logging_enabled", data.checked)
                  }
                />
              </div>
              {maintenance.data ? (
                <dl className="system-paths">
                  <div>
                    <dt>Data directory</dt>
                    <dd>{maintenance.data.data_directory}</dd>
                  </div>
                  <div>
                    <dt>Database</dt>
                    <dd>
                      {maintenance.data.database_path} ·{" "}
                      {(maintenance.data.database_size_bytes / 1024).toFixed(0)}{" "}
                      KB
                    </dd>
                  </div>
                  <div>
                    <dt>Logs</dt>
                    <dd>{maintenance.data.logs_directory}</dd>
                  </div>
                </dl>
              ) : null}
              <div className="settings-module__actions">
                <Button
                  icon={<FolderOpen20Regular />}
                  disabled={!maintenance.data}
                  onClick={() =>
                    maintenance.data &&
                    void runNativeAction(
                      () => revealLocalPath(maintenance.data.data_directory),
                      "Windows could not open the data folder.",
                    )
                  }
                >
                  Open data folder
                </Button>
                <Button
                  icon={<Open20Regular />}
                  onClick={() =>
                    void runNativeAction(
                      openDiagnosticsFolder,
                      "Windows could not open the diagnostics folder.",
                    )
                  }
                >
                  Open diagnostics
                </Button>
              </div>
            </Card>
            <Card
              className="settings-module recovery-card"
              appearance="outline"
            >
              <div>
                <Text weight="semibold">Reset interface cache</Text>
                <Text className="muted-text">
                  Use only if the desktop interface becomes blank or corrupted.
                  This clears WebView browsing data and reloads the UI;
                  projects, documents, database records, and provider
                  credentials are not deleted.
                </Text>
              </div>
              <Button
                icon={<ArrowSync20Regular />}
                onClick={() =>
                  void runNativeAction(
                    resetRenderer,
                    "The interface cache could not be reset.",
                  )
                }
              >
                Reset and reload interface
              </Button>
            </Card>
            <div className="settings-save-row">
              <Button
                appearance="primary"
                icon={<Save20Regular />}
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({
                    diagnostic_logging_enabled: form.diagnostic_logging_enabled,
                  })
                }
              >
                Save advanced settings
              </Button>
            </div>
          </>
        ) : null}

        {saveMessage ? (
          <MessageBar intent="error">
            <MessageBarBody>{saveMessage}</MessageBarBody>
          </MessageBar>
        ) : null}
        {save.isSuccess ? (
          <MessageBar intent="success">
            <MessageBarBody>Settings saved locally.</MessageBarBody>
          </MessageBar>
        ) : null}
      </div>
    </div>
  );
}

export function SettingsPage({
  initialSection,
}: {
  initialSection?: SettingsSection;
}): React.JSX.Element {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });
  return (
    <section className="page page--settings" aria-labelledby="settings-title">
      <header className="page-header">
        <div>
          <Text className="eyebrow">APPLICATION CONTROL</Text>
          <Title2 id="settings-title">Settings</Title2>
          <Text className="page-description">
            Configure the interface, AI provider, local retrieval, privacy,
            backups, and recovery.
          </Text>
        </div>
      </header>
      {settings.isPending ? (
        <div className="center-state">
          <Spinner label="Loading settings…" />
        </div>
      ) : settings.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>Settings could not be loaded.</MessageBarBody>
        </MessageBar>
      ) : (
        <SettingsForm
          key={initialSection ?? "general"}
          initial={settings.data}
          initialSection={initialSection}
        />
      )}
    </section>
  );
}
