import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Textarea,
} from "@fluentui/react-components";
import { FolderOpen20Regular } from "@fluentui/react-icons";
import { nativeErrorMessage, selectProjectFolder } from "../api/native";
import type { Project, ProjectPayload } from "../types/api";

interface ProjectFormDialogProps {
  open: boolean;
  project?: Project;
  defaultWorkspacePath?: string | null;
  saving: boolean;
  error?: string;
  onDismiss: () => void;
  onSubmit: (payload: ProjectPayload) => Promise<void>;
}

interface ProjectFormState {
  name: string;
  projectNumber: string;
  client: string;
  consultant: string;
  contractor: string;
  description: string;
  workspacePath: string;
}

const emptyForm: ProjectFormState = {
  name: "",
  projectNumber: "",
  client: "",
  consultant: "",
  contractor: "",
  description: "",
  workspacePath: "",
};

export function ProjectFormDialog({
  open,
  project,
  defaultWorkspacePath,
  saving,
  error,
  onDismiss,
  onSubmit,
}: ProjectFormDialogProps): React.JSX.Element {
  const [form, setForm] = useState<ProjectFormState>(() =>
    project
      ? {
          name: project.name,
          projectNumber: project.project_number,
          client: project.client ?? "",
          consultant: project.consultant ?? "",
          contractor: project.contractor ?? "",
          description: project.description ?? "",
          workspacePath: project.settings.workspace_path ?? "",
        }
      : { ...emptyForm, workspacePath: defaultWorkspacePath ?? "" },
  );
  const [submitted, setSubmitted] = useState(false);
  const [folderError, setFolderError] = useState<string>();

  const setField = (field: keyof ProjectFormState, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "workspacePath") setFolderError(undefined);
  };

  const chooseWorkspace = async (): Promise<void> => {
    setFolderError(undefined);
    try {
      const selected = await selectProjectFolder(form.workspacePath);
      if (selected) setField("workspacePath", selected);
    } catch (error) {
      setFolderError(
        nativeErrorMessage(error, "Windows could not open the folder picker."),
      );
    }
  };

  const nameInvalid = submitted && form.name.trim().length < 2;
  const numberInvalid = submitted && form.projectNumber.trim().length === 0;

  const submit = async (
    event: React.SyntheticEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    if (form.name.trim().length < 2 || form.projectNumber.trim().length === 0)
      return;
    try {
      await onSubmit({
        name: form.name.trim(),
        project_number: form.projectNumber.trim(),
        client: form.client.trim() || null,
        consultant: form.consultant.trim() || null,
        contractor: form.contractor.trim() || null,
        description: form.description.trim() || null,
        settings: {
          workspace_path: form.workspacePath.trim() || null,
        },
      });
    } catch {
      // The parent mutation owns the user-facing error state.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => !data.open && !saving && onDismiss()}
    >
      <DialogSurface>
        <form onSubmit={(event) => void submit(event)}>
          <DialogBody>
            <DialogTitle>
              {project ? "Edit project" : "Create project"}
            </DialogTitle>
            <DialogContent className="project-form">
              <Field
                label="Project name"
                required
                validationState={nameInvalid ? "error" : "none"}
                validationMessage={
                  nameInvalid ? "Enter at least two characters." : undefined
                }
              >
                <Input
                  autoFocus
                  value={form.name}
                  onChange={(_, data) => setField("name", data.value)}
                  maxLength={200}
                />
              </Field>
              <Field
                label="Project folder"
                hint="ProjectMind scans supported documents in this folder. You can change it later."
              >
                <div className="path-picker">
                  <Input
                    value={form.workspacePath}
                    placeholder="Choose the local project document folder"
                    onChange={(_, data) =>
                      setField("workspacePath", data.value)
                    }
                  />
                  <Button
                    type="button"
                    icon={<FolderOpen20Regular />}
                    onClick={() => void chooseWorkspace()}
                  >
                    Browse
                  </Button>
                </div>
                {folderError ? (
                  <MessageBar intent="error">
                    <MessageBarBody>{folderError}</MessageBarBody>
                  </MessageBar>
                ) : null}
              </Field>
              <Field
                label="Project number"
                required
                validationState={numberInvalid ? "error" : "none"}
                validationMessage={
                  numberInvalid ? "Project number is required." : undefined
                }
              >
                <Input
                  value={form.projectNumber}
                  onChange={(_, data) => setField("projectNumber", data.value)}
                  maxLength={80}
                />
              </Field>
              <div className="two-column-fields">
                <Field label="Client">
                  <Input
                    value={form.client}
                    onChange={(_, data) => setField("client", data.value)}
                    maxLength={200}
                  />
                </Field>
                <Field label="Consultant">
                  <Input
                    value={form.consultant}
                    onChange={(_, data) => setField("consultant", data.value)}
                    maxLength={200}
                  />
                </Field>
              </div>
              <Field label="Main contractor">
                <Input
                  value={form.contractor}
                  onChange={(_, data) => setField("contractor", data.value)}
                  maxLength={200}
                />
              </Field>
              <Field
                label="Description"
                hint="Optional project context; do not enter credentials."
              >
                <Textarea
                  resize="vertical"
                  value={form.description}
                  onChange={(_, data) => setField("description", data.value)}
                  maxLength={2000}
                />
              </Field>
              {error ? (
                <div className="form-error" role="alert">
                  {error}
                </div>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                disabled={saving}
                onClick={onDismiss}
              >
                Cancel
              </Button>
              <Button appearance="primary" type="submit" disabled={saving}>
                {saving
                  ? "Saving…"
                  : project
                    ? "Save changes"
                    : "Create project"}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
