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
  Textarea,
} from "@fluentui/react-components";
import type { Project, ProjectPayload } from "../types/api";

interface ProjectFormDialogProps {
  open: boolean;
  project?: Project;
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
}

const emptyForm: ProjectFormState = {
  name: "",
  projectNumber: "",
  client: "",
  consultant: "",
  contractor: "",
  description: "",
};

export function ProjectFormDialog({
  open,
  project,
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
        }
      : emptyForm,
  );
  const [submitted, setSubmitted] = useState(false);

  const setField = (field: keyof ProjectFormState, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
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
    await onSubmit({
      name: form.name.trim(),
      project_number: form.projectNumber.trim(),
      client: form.client.trim() || null,
      consultant: form.consultant.trim() || null,
      contractor: form.contractor.trim() || null,
      description: form.description.trim() || null,
    });
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
