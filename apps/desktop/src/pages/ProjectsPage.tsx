import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Title2,
} from "@fluentui/react-components";
import { Add24Regular, Briefcase24Regular } from "@fluentui/react-icons";
import { api, ApiClientError } from "../api/client";
import { ProjectCard } from "../components/ProjectCard";
import { ProjectFormDialog } from "../components/ProjectFormDialog";
import type { Project, ProjectPayload } from "../types/api";

export function ProjectsPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project>();
  const [archiveTarget, setArchiveTarget] = useState<Project>();

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: ProjectPayload) =>
      editingProject
        ? api.updateProject(editingProject.id, payload)
        : api.createProject(payload),
    onSuccess: async () => {
      setDialogOpen(false);
      setEditingProject(undefined);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: api.archiveProject,
    onSuccess: async () => {
      setArchiveTarget(undefined);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const openCreate = (): void => {
    saveMutation.reset();
    setEditingProject(undefined);
    setDialogOpen(true);
  };

  const openEdit = (project: Project): void => {
    saveMutation.reset();
    setEditingProject(project);
    setDialogOpen(true);
  };

  const errorMessage =
    saveMutation.error instanceof ApiClientError
      ? saveMutation.error.message
      : saveMutation.isError
        ? "The project could not be saved."
        : undefined;

  return (
    <section className="page" aria-labelledby="projects-title">
      <header className="page-header">
        <div>
          <Text className="eyebrow">PROJECT WORKSPACES</Text>
          <Title2 id="projects-title">Projects</Title2>
          <Text className="page-description">
            Controlled local workspaces for project identity, parties, and
            document defaults.
          </Text>
        </div>
        <Button
          appearance="primary"
          icon={<Add24Regular />}
          onClick={openCreate}
        >
          New project
        </Button>
      </header>

      {projectsQuery.isPending ? (
        <div className="center-state">
          <Spinner label="Loading projects…" />
        </div>
      ) : projectsQuery.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>
            Projects could not be loaded from the local service.
          </MessageBarBody>
        </MessageBar>
      ) : projectsQuery.data.total === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <Briefcase24Regular />
          </div>
          <Title2>No projects yet</Title2>
          <Text>
            Create the first controlled workspace for your engineering project.
          </Text>
          <Button
            appearance="primary"
            icon={<Add24Regular />}
            onClick={openCreate}
          >
            Create first project
          </Button>
        </div>
      ) : (
        <div className="project-grid">
          {projectsQuery.data.items.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={openEdit}
              onArchive={setArchiveTarget}
            />
          ))}
        </div>
      )}

      {dialogOpen ? (
        <ProjectFormDialog
          key={editingProject?.id ?? "new-project"}
          open
          project={editingProject}
          saving={saveMutation.isPending}
          error={errorMessage}
          onDismiss={() => {
            if (!saveMutation.isPending) {
              setDialogOpen(false);
              setEditingProject(undefined);
            }
          }}
          onSubmit={async (payload) =>
            saveMutation.mutateAsync(payload).then(() => undefined)
          }
        />
      ) : null}

      <Dialog
        open={archiveTarget !== undefined}
        onOpenChange={(_, data) => !data.open && setArchiveTarget(undefined)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Archive project?</DialogTitle>
            <DialogContent>
              <Text>
                {archiveTarget?.name} will be hidden from the active project
                list. Its database record is retained for audit and recovery.
              </Text>
              {archiveMutation.isError ? (
                <div className="form-error" role="alert">
                  The project could not be archived.
                </div>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button
                disabled={archiveMutation.isPending}
                onClick={() => setArchiveTarget(undefined)}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                disabled={archiveMutation.isPending || !archiveTarget}
                onClick={() =>
                  archiveTarget && archiveMutation.mutate(archiveTarget.id)
                }
              >
                {archiveMutation.isPending ? "Archiving…" : "Archive project"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </section>
  );
}
