import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Title2,
} from "@fluentui/react-components";
import {
  Add24Regular,
  Briefcase24Regular,
  Search20Regular,
} from "@fluentui/react-icons";
import { api } from "../api/client";
import { useAppLocale } from "../app/LocaleContext";
import { ProjectCard } from "../components/ProjectCard";
import type { Project } from "../types/api";

interface ProjectsPageProps {
  onCreate: () => void;
  onEdit: (project: Project) => void;
  onOpen: (project: Project) => void;
}

export function ProjectsPage({
  onCreate,
  onEdit,
  onOpen,
}: ProjectsPageProps): React.JSX.Element {
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [portfolioView, setPortfolioView] = useState<"active" | "archived">(
    "active",
  );
  const [archiveTarget, setArchiveTarget] = useState<Project>();
  const projectsQuery = useQuery({
    queryKey: ["projects", portfolioView],
    queryFn: () => api.listProjects(portfolioView),
  });
  const restoreMutation = useMutation({
    mutationFn: api.restoreProject,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setSearch("");
      setPortfolioView("active");
    },
  });
  const archiveMutation = useMutation({
    mutationFn: api.archiveProject,
    onSuccess: async () => {
      setArchiveTarget(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });

  const visibleProjects = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase(locale);
    if (!normalized) return projectsQuery.data?.items ?? [];
    return (projectsQuery.data?.items ?? []).filter((project) =>
      [project.name, project.project_number, project.client, project.consultant]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase(locale).includes(normalized)),
    );
  }, [locale, projectsQuery.data?.items, search]);

  return (
    <section className="page page--wide" aria-labelledby="projects-title">
      <header className="page-header">
        <div>
          <Text className="eyebrow">PROJECT PORTFOLIO</Text>
          <Title2 id="projects-title">Projects</Title2>
          <Text className="page-description">
            Open a complete project workspace, manage its local document folder,
            and continue previous work.
          </Text>
        </div>
        <Button appearance="primary" icon={<Add24Regular />} onClick={onCreate}>
          New project
        </Button>
      </header>

      <div
        className="portfolio-tabs"
        role="tablist"
        aria-label="Project status"
      >
        {(["active", "archived"] as const).map((value) => (
          <Button
            key={value}
            role="tab"
            appearance={portfolioView === value ? "primary" : "subtle"}
            aria-selected={portfolioView === value}
            onClick={() => {
              setPortfolioView(value);
              setSearch("");
              restoreMutation.reset();
            }}
          >
            {value === "active" ? "Active projects" : "Archived projects"}
          </Button>
        ))}
      </div>

      {restoreMutation.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>The project could not be restored.</MessageBarBody>
        </MessageBar>
      ) : null}

      {projectsQuery.data?.total ? (
        <div className="toolbar surface-card">
          <Input
            className="toolbar-search"
            contentBefore={<Search20Regular />}
            placeholder="Search projects, numbers, clients, or consultants"
            value={search}
            onChange={(_, data) => setSearch(data.value)}
          />
          <Text size={200} className="muted-text">
            {visibleProjects.length} of {projectsQuery.data.total} projects
          </Text>
        </div>
      ) : null}

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
      ) : projectsQuery.data.total === 0 && portfolioView === "archived" ? (
        <div className="empty-state empty-state--large">
          <div className="empty-state__icon">
            <Briefcase24Regular />
          </div>
          <Title2>No archived projects</Title2>
          <Text>Projects you archive can be restored from this view.</Text>
          <Button onClick={() => setPortfolioView("active")}>
            View active projects
          </Button>
        </div>
      ) : projectsQuery.data.total === 0 ? (
        <div className="empty-state empty-state--large">
          <div className="empty-state__icon">
            <Briefcase24Regular />
          </div>
          <Title2>Create your first project workspace</Title2>
          <Text>
            Add the project identity and choose its document folder. You can
            then scan, search, ask questions, and run controlled reviews.
          </Text>
          <Button
            appearance="primary"
            icon={<Add24Regular />}
            onClick={onCreate}
          >
            Create first project
          </Button>
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="empty-state">
          <Title2>No matching projects</Title2>
          <Text>Clear the search or try a project number.</Text>
          <Button onClick={() => setSearch("")}>Clear search</Button>
        </div>
      ) : (
        <div className="project-grid">
          {visibleProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={onOpen}
              onEdit={onEdit}
              onArchive={(project) => {
                archiveMutation.reset();
                setArchiveTarget(project);
              }}
              archived={portfolioView === "archived"}
              onRestore={(project) => restoreMutation.mutate(project.id)}
              restoring={restoreMutation.isPending}
            />
          ))}
        </div>
      )}

      <Dialog
        open={archiveTarget !== undefined}
        onOpenChange={(_, data) => !data.open && setArchiveTarget(undefined)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Archive project?</DialogTitle>
            <DialogContent>
              <Text>
                {archiveTarget?.name} will leave the active list. Its database
                history and local source documents will not be deleted.
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
