import { Badge, Button, Card, Text, Tooltip } from "@fluentui/react-components";
import {
  ArrowRight20Regular,
  ArrowUndo20Regular,
  Building24Regular,
  Delete20Regular,
  Edit20Regular,
  Folder20Regular,
} from "@fluentui/react-icons";
import type { Project } from "../types/api";
import { useAppLocale } from "../app/LocaleContext";

interface ProjectCardProps {
  project: Project;
  onOpen: (project: Project) => void;
  onEdit: (project: Project) => void;
  onArchive: (project: Project) => void;
  archived?: boolean;
  onRestore?: (project: Project) => void;
  restoring?: boolean;
}

function updatedLabel(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function ProjectCard({
  project,
  onOpen,
  onEdit,
  onArchive,
  archived = false,
  onRestore,
  restoring = false,
}: ProjectCardProps): React.JSX.Element {
  const locale = useAppLocale();
  return (
    <Card
      className={`project-card${archived ? " project-card--archived" : ""}`}
      appearance="outline"
    >
      <div className="project-card__top">
        <div className="project-card__icon" aria-hidden="true">
          <Building24Regular />
        </div>
        <Badge appearance="tint" color={archived ? "subtle" : "success"}>
          {archived ? "Archived" : "Active"}
        </Badge>
      </div>
      <div className="project-card__identity">
        <Text weight="semibold" size={500} truncate title={project.name}>
          {project.name}
        </Text>
        <Text className="muted-text" size={200}>
          {project.project_number}
        </Text>
      </div>
      <div className="project-card__folder">
        <Folder20Regular />
        <Text
          size={200}
          truncate
          title={project.settings.workspace_path ?? undefined}
        >
          {project.settings.workspace_path ?? "Project folder not selected"}
        </Text>
      </div>
      <dl className="project-card__details">
        <div>
          <dt>Client</dt>
          <dd>{project.client ?? "Not specified"}</dd>
        </div>
        <div>
          <dt>Consultant</dt>
          <dd>{project.consultant ?? "Not specified"}</dd>
        </div>
      </dl>
      <Text className="project-card__updated" size={100}>
        Updated {updatedLabel(project.updated_at, locale)}
      </Text>
      <div className="project-card__actions">
        {archived ? (
          <Button
            appearance="primary"
            icon={<ArrowUndo20Regular />}
            disabled={!onRestore || restoring}
            onClick={() => onRestore?.(project)}
          >
            {restoring ? "Restoring…" : "Restore project"}
          </Button>
        ) : (
          <>
            <Button
              appearance="primary"
              icon={<ArrowRight20Regular />}
              iconPosition="after"
              onClick={() => onOpen(project)}
            >
              Open workspace
            </Button>
            <Tooltip content="Edit project" relationship="label">
              <Button
                appearance="subtle"
                icon={<Edit20Regular />}
                aria-label={`Edit ${project.name}`}
                onClick={() => onEdit(project)}
              />
            </Tooltip>
            <Tooltip content="Archive project" relationship="label">
              <Button
                appearance="subtle"
                icon={<Delete20Regular />}
                aria-label={`Archive ${project.name}`}
                onClick={() => onArchive(project)}
              />
            </Tooltip>
          </>
        )}
      </div>
    </Card>
  );
}
