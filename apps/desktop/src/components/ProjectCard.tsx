import { Badge, Button, Card, Text, Tooltip } from "@fluentui/react-components";
import {
  Building24Regular,
  Delete20Regular,
  Edit20Regular,
} from "@fluentui/react-icons";
import type { Project } from "../types/api";

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onArchive: (project: Project) => void;
}

export function ProjectCard({
  project,
  onEdit,
  onArchive,
}: ProjectCardProps): React.JSX.Element {
  return (
    <Card className="project-card" appearance="outline">
      <div className="project-card__top">
        <div className="project-card__icon" aria-hidden="true">
          <Building24Regular />
        </div>
        <Badge appearance="tint" color="success">
          Active
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
      <dl className="project-card__details">
        <div>
          <dt>Client</dt>
          <dd>{project.client ?? "Not specified"}</dd>
        </div>
        <div>
          <dt>Consultant</dt>
          <dd>{project.consultant ?? "Not specified"}</dd>
        </div>
        <div>
          <dt>Contractor</dt>
          <dd>{project.contractor ?? "Not specified"}</dd>
        </div>
      </dl>
      <div className="project-card__actions">
        <Button
          appearance="subtle"
          icon={<Edit20Regular />}
          onClick={() => onEdit(project)}
        >
          Edit
        </Button>
        <Tooltip content="Archive project" relationship="label">
          <Button
            appearance="subtle"
            icon={<Delete20Regular />}
            aria-label={`Archive ${project.name}`}
            onClick={() => onArchive(project)}
          />
        </Tooltip>
      </div>
    </Card>
  );
}
