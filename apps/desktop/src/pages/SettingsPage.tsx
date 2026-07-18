import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Text,
  Title2,
} from "@fluentui/react-components";
import { Save24Regular, Settings24Regular } from "@fluentui/react-icons";
import { api, ApiClientError } from "../api/client";
import type { ApplicationSettings } from "../types/api";

interface SettingsFormProps {
  initial: ApplicationSettings;
}

function SettingsForm({ initial }: SettingsFormProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [brandName, setBrandName] = useState(initial.brand_name);
  const [theme, setTheme] = useState<ApplicationSettings["theme"]>(
    initial.theme,
  );
  const [locale, setLocale] = useState(initial.locale);

  const mutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(["settings"], settings);
    },
  });

  const save = (): void => {
    mutation.mutate({
      brand_name: brandName.trim(),
      theme,
      locale: locale.trim(),
    });
  };

  return (
    <Card className="settings-card" appearance="outline">
      <div className="settings-card__heading">
        <div className="settings-icon">
          <Settings24Regular />
        </div>
        <div>
          <Text weight="semibold" size={400}>
            General
          </Text>
          <Text className="muted-text">
            These preferences do not contain API credentials.
          </Text>
        </div>
      </div>
      <Field
        label="Application name"
        hint="Shown in the desktop navigation and title."
      >
        <Input
          value={brandName}
          onChange={(_, data) => setBrandName(data.value)}
          maxLength={120}
        />
      </Field>
      <div className="two-column-fields">
        <Field label="Theme">
          <Dropdown
            value={
              theme === "system"
                ? "Use Windows setting"
                : theme === "dark"
                  ? "Dark"
                  : "Light"
            }
            selectedOptions={[theme]}
            onOptionSelect={(_, data) =>
              setTheme(data.optionValue as ApplicationSettings["theme"])
            }
          >
            <Option value="system">Use Windows setting</Option>
            <Option value="light">Light</Option>
            <Option value="dark">Dark</Option>
          </Dropdown>
        </Field>
        <Field label="Interface locale">
          <Dropdown
            value={locale === "ar-AE" ? "Arabic (UAE)" : "English (UAE)"}
            selectedOptions={[locale]}
            onOptionSelect={(_, data) =>
              data.optionValue && setLocale(data.optionValue)
            }
          >
            <Option value="en-AE">English (UAE)</Option>
            <Option value="ar-AE">Arabic (UAE)</Option>
          </Dropdown>
        </Field>
      </div>
      {mutation.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>
            {mutation.error instanceof ApiClientError
              ? mutation.error.message
              : "Settings could not be saved."}
          </MessageBarBody>
        </MessageBar>
      ) : null}
      {mutation.isSuccess ? (
        <MessageBar intent="success">
          <MessageBarBody>Settings saved locally.</MessageBarBody>
        </MessageBar>
      ) : null}
      <div className="settings-actions">
        <Button
          appearance="primary"
          icon={<Save24Regular />}
          disabled={mutation.isPending || brandName.trim().length < 2}
          onClick={save}
        >
          {mutation.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </Card>
  );
}

export function SettingsPage(): React.JSX.Element {
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  return (
    <section className="page settings-page" aria-labelledby="settings-title">
      <header className="page-header">
        <div>
          <Text className="eyebrow">APPLICATION</Text>
          <Title2 id="settings-title">Settings</Title2>
          <Text className="page-description">
            Branding and interface preferences stored locally.
          </Text>
        </div>
      </header>

      {settingsQuery.isPending ? (
        <div className="center-state">
          <Spinner label="Loading settings…" />
        </div>
      ) : settingsQuery.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>Settings could not be loaded.</MessageBarBody>
        </MessageBar>
      ) : (
        <SettingsForm initial={settingsQuery.data} />
      )}
    </section>
  );
}
