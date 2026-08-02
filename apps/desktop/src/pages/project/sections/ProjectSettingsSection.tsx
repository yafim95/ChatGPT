import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Switch,
  Text,
  Textarea,
  Title3,
} from "@fluentui/react-components";
import {
  Bot24Regular,
  ClipboardTask24Regular,
  Edit20Regular,
  FolderOpen20Regular,
  Open20Regular,
  Save20Regular,
  Settings24Regular,
} from "@fluentui/react-icons";
import { api, ApiClientError } from "../../../api/client";
import {
  nativeErrorMessage,
  revealLocalPath,
  selectProjectFolder,
} from "../../../api/native";
import type { Project } from "../../../types/api";

interface ProjectSettingsSectionProps {
  project: Project;
  onEditProject: () => void;
}

interface FormState {
  workspacePath: string;
  includeSubfolders: boolean;
  autoScan: boolean;
  excludedPatterns: string;
  timezone: string;
  locale: string;
  disciplines: string;
  reviewCodes: string;
  documentHierarchy: string;
  documentPrecedence: string;
  aiInstructions: string;
  autoCreateCrs: boolean;
  defaultReviewDueDays: string;
}

function projectForm(project: Project): FormState {
  return {
    workspacePath: project.settings.workspace_path ?? "",
    includeSubfolders: project.settings.include_subfolders,
    autoScan: project.settings.auto_scan_enabled,
    excludedPatterns: project.settings.excluded_patterns.join("\n"),
    timezone: project.settings.timezone,
    locale: project.settings.locale,
    disciplines: project.settings.disciplines.join("\n"),
    reviewCodes: project.settings.review_codes
      .map((item) => `${item.code} | ${item.label}`)
      .join("\n"),
    documentHierarchy: project.settings.document_hierarchy.join("\n"),
    documentPrecedence: project.settings.document_precedence.join("\n"),
    aiInstructions: project.settings.ai_project_instructions ?? "",
    autoCreateCrs: project.settings.auto_create_crs,
    defaultReviewDueDays: String(project.settings.default_review_due_days),
  };
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsedReviewCodes(value: string): Array<{
  code: string;
  label: string;
}> {
  return lines(value).flatMap((item) => {
    const [code, ...labelParts] = item.split("|");
    const label = labelParts.join("|").trim();
    return code?.trim() && label ? [{ code: code.trim(), label }] : [];
  });
}

function reviewCodesAreValid(value: string): boolean {
  const sourceLines = lines(value);
  const parsed = parsedReviewCodes(value);
  const normalizedCodes = parsed.map((item) => item.code.toLowerCase());
  return (
    sourceLines.length > 0 &&
    parsed.length === sourceLines.length &&
    new Set(normalizedCodes).size === normalizedCodes.length &&
    parsed.every((item) => item.code.length <= 20 && item.label.length <= 120)
  );
}

export function ProjectSettingsSection({
  project,
  onEditProject,
}: ProjectSettingsSectionProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => projectForm(project));
  const [nativeError, setNativeError] = useState<string>();
  const save = useMutation({
    mutationFn: () =>
      api.updateProjectSettings(project.id, {
        workspace_path: form.workspacePath.trim() || null,
        include_subfolders: form.includeSubfolders,
        auto_scan_enabled: form.autoScan,
        excluded_patterns: lines(form.excludedPatterns),
        timezone: form.timezone,
        locale: form.locale,
        disciplines: lines(form.disciplines),
        review_codes: parsedReviewCodes(form.reviewCodes),
        document_hierarchy: lines(form.documentHierarchy),
        document_precedence: lines(form.documentPrecedence),
        ai_project_instructions: form.aiInstructions.trim() || null,
        auto_create_crs: form.autoCreateCrs,
        default_review_due_days: Number(form.defaultReviewDueDays),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", project.id] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
    },
  });
  const set = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ): void => {
    setForm((current) => ({ ...current, [key]: value }));
    save.reset();
    setNativeError(undefined);
  };

  const chooseWorkspace = async (): Promise<void> => {
    setNativeError(undefined);
    try {
      const selected = await selectProjectFolder(form.workspacePath);
      if (selected) set("workspacePath", selected);
    } catch (error) {
      setNativeError(
        nativeErrorMessage(error, "Windows could not open the folder picker."),
      );
    }
  };

  const openWorkspace = async (): Promise<void> => {
    setNativeError(undefined);
    try {
      await revealLocalPath(form.workspacePath);
    } catch (error) {
      setNativeError(
        nativeErrorMessage(
          error,
          "Windows could not open the selected project folder.",
        ),
      );
    }
  };

  return (
    <div className="section-stack project-settings-section">
      <div className="section-heading">
        <div>
          <Text className="eyebrow">WORKSPACE CONTROL</Text>
          <Title3>Project settings</Title3>
          <Text className="section-description">
            Control where documents come from and how ProjectMind classifies
            project evidence.
          </Text>
        </div>
        <Button icon={<Edit20Regular />} onClick={onEditProject}>
          Edit project identity
        </Button>
      </div>

      <Card className="settings-module" appearance="outline">
        <div className="settings-module__heading">
          <div className="settings-module__icon">
            <FolderOpen20Regular />
          </div>
          <div>
            <Text weight="semibold" size={400}>
              Document workspace
            </Text>
            <Text className="muted-text">
              The source folder remains under your control. ProjectMind does not
              move or delete its files.
            </Text>
          </div>
        </div>
        <Field
          label="Project folder"
          hint="Select a project-specific folder rather than an entire drive."
        >
          <div className="path-picker">
            <Input
              value={form.workspacePath}
              placeholder="Choose the local project folder"
              onChange={(_, data) => set("workspacePath", data.value)}
            />
            <Button
              icon={<FolderOpen20Regular />}
              onClick={() => void chooseWorkspace()}
            >
              Browse
            </Button>
            {form.workspacePath ? (
              <Button
                appearance="subtle"
                icon={<Open20Regular />}
                aria-label="Open selected folder"
                onClick={() => void openWorkspace()}
              />
            ) : null}
          </div>
        </Field>
        <div className="setting-switch-row">
          <div>
            <Text weight="semibold">Include subfolders</Text>
            <Text size={200}>
              Scan all nested folders under the selected project folder.
            </Text>
          </div>
          <Switch
            checked={form.includeSubfolders}
            onChange={(_, data) => set("includeSubfolders", data.checked)}
          />
        </div>
        {nativeError ? (
          <MessageBar intent="error">
            <MessageBarBody>{nativeError}</MessageBarBody>
          </MessageBar>
        ) : null}
        <div className="setting-switch-row">
          <div>
            <Text weight="semibold">Scan when this project opens</Text>
            <Text size={200}>
              Check for new, changed, and missing supported documents
              automatically.
            </Text>
          </div>
          <Switch
            checked={form.autoScan}
            onChange={(_, data) => set("autoScan", data.checked)}
          />
        </div>
        <Field
          label="Excluded names and patterns"
          hint="One folder name or wildcard per line. These paths remain visible only when not excluded."
        >
          <Textarea
            value={form.excludedPatterns}
            resize="vertical"
            placeholder={".git\nnode_modules\n~$*"}
            onChange={(_, data) => set("excludedPatterns", data.value)}
          />
        </Field>
      </Card>

      <Card className="settings-module" appearance="outline">
        <div className="settings-module__heading">
          <div className="settings-module__icon">
            <Settings24Regular />
          </div>
          <div>
            <Text weight="semibold" size={400}>
              Project defaults
            </Text>
            <Text className="muted-text">
              Included as controlled project context for questions and
              engineering review workflows.
            </Text>
          </div>
        </div>
        <div className="two-column-fields">
          <Field
            label="Timezone"
            hint="IANA timezone, such as Asia/Dubai or UTC."
          >
            <Input
              value={form.timezone}
              maxLength={80}
              placeholder="Asia/Dubai"
              onChange={(_, data) => set("timezone", data.value)}
            />
          </Field>
          <Field
            label="Project locale"
            hint="BCP 47 locale, such as en-AE or ar-AE."
          >
            <Input
              value={form.locale}
              maxLength={20}
              placeholder="en-AE"
              onChange={(_, data) => set("locale", data.value)}
            />
          </Field>
        </div>
        <div className="two-column-fields">
          <Field label="Disciplines" hint="One discipline per line.">
            <Textarea
              value={form.disciplines}
              onChange={(_, data) => set("disciplines", data.value)}
              resize="vertical"
            />
          </Field>
          <Field
            label="Review codes"
            hint="One per line in CODE | Label format."
            validationState={
              reviewCodesAreValid(form.reviewCodes) ? "none" : "error"
            }
            validationMessage={
              reviewCodesAreValid(form.reviewCodes)
                ? undefined
                : "Add at least one code in CODE | Label format."
            }
          >
            <Textarea
              value={form.reviewCodes}
              onChange={(_, data) => set("reviewCodes", data.value)}
              resize="vertical"
            />
          </Field>
        </div>
        <div className="two-column-fields">
          <Field label="Document hierarchy" hint="One category per line.">
            <Textarea
              value={form.documentHierarchy}
              onChange={(_, data) => set("documentHierarchy", data.value)}
              resize="vertical"
            />
          </Field>
          <Field
            label="Document precedence"
            hint="Highest precedence first, one rule per line."
          >
            <Textarea
              value={form.documentPrecedence}
              onChange={(_, data) => set("documentPrecedence", data.value)}
              resize="vertical"
            />
          </Field>
        </div>
      </Card>

      <Card className="settings-module" appearance="outline">
        <div className="settings-module__heading">
          <div className="settings-module__icon">
            <ClipboardTask24Regular />
          </div>
          <div>
            <Text weight="semibold" size={400}>
              Review workflow & CRS
            </Text>
            <Text className="muted-text">
              Set review-register defaults without removing per-review control.
            </Text>
          </div>
        </div>
        <div className="two-column-fields">
          <Field
            label="Default review period (days)"
            hint="Used to calculate the initial target date for new reviews."
          >
            <Input
              type="number"
              min={1}
              max={365}
              value={form.defaultReviewDueDays}
              onChange={(_, data) => set("defaultReviewDueDays", data.value)}
            />
          </Field>
          <div className="setting-switch-row setting-switch-row--embedded">
            <div>
              <Text weight="semibold">Create CRS with each review</Text>
              <Text size={200}>
                Attach an empty Comment Reply Sheet automatically.
              </Text>
            </div>
            <Switch
              checked={form.autoCreateCrs}
              onChange={(_, data) => set("autoCreateCrs", data.checked)}
            />
          </div>
        </div>
      </Card>

      <Card className="settings-module" appearance="outline">
        <div className="settings-module__heading">
          <div className="settings-module__icon">
            <Bot24Regular />
          </div>
          <div>
            <Text weight="semibold" size={400}>
              Project-specific AI rules
            </Text>
            <Text className="muted-text">
              Durable instructions included with this project’s chats and
              reviews.
            </Text>
          </div>
        </div>
        <Field
          label="Controlled instructions"
          hint="Define terminology, precedence, authority constraints, and required response conventions."
        >
          <Textarea
            value={form.aiInstructions}
            resize="vertical"
            placeholder="Example: Never infer approval. Treat the Contract and Employer’s Requirements as higher precedence than submittals."
            onChange={(_, data) => set("aiInstructions", data.value)}
          />
        </Field>
      </Card>

      {save.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>
            {save.error instanceof ApiClientError
              ? save.error.message
              : "Project settings could not be saved."}
          </MessageBarBody>
        </MessageBar>
      ) : null}
      {save.isSuccess ? (
        <MessageBar intent="success">
          <MessageBarBody>Project settings saved locally.</MessageBarBody>
        </MessageBar>
      ) : null}
      <div className="sticky-save-bar">
        <div>
          <Text weight="semibold">Project workspace configuration</Text>
          <Text size={200}>Changes affect future scans and retrieval.</Text>
        </div>
        <Button
          appearance="primary"
          icon={<Save20Regular />}
          disabled={
            save.isPending ||
            form.disciplines.trim().length === 0 ||
            form.timezone.trim().length === 0 ||
            form.locale.trim().length < 2 ||
            Number(form.defaultReviewDueDays) < 1 ||
            Number(form.defaultReviewDueDays) > 365 ||
            !reviewCodesAreValid(form.reviewCodes)
          }
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save project settings"}
        </Button>
      </div>
    </div>
  );
}
