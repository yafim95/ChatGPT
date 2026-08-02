import { Button, Text } from "@fluentui/react-components";
import {
  Bot20Regular,
  CheckmarkCircle20Regular,
  ClipboardTask20Regular,
  Document20Regular,
  FolderOpen20Regular,
  Settings20Regular,
  Sparkle20Regular,
} from "@fluentui/react-icons";
import type { Project } from "../../../types/api";
import type { ProjectSection } from "../../../components/AppShell";

interface GuideSectionProps {
  project: Project;
  onNavigate: (section: ProjectSection) => void;
}

const steps = [
  {
    number: "01",
    icon: <Settings20Regular />,
    title: "Connect the existing folder",
    description:
      "In Project controls, choose the project’s current document directory. ProjectMind reads it in place and never reorganizes or deletes source files.",
    action: "Open controls",
    section: "project-settings" as const,
  },
  {
    number: "02",
    icon: <FolderOpen20Regular />,
    title: "Browse and synchronize",
    description:
      "Project files shows the real directory tree, including folders and unsupported formats. Sync the index to extract supported files and detect revisions.",
    action: "Open files",
    section: "files" as const,
  },
  {
    number: "03",
    icon: <Sparkle20Regular />,
    title: "Define project memory once",
    description:
      "Mark the Contract, Employer’s Requirements, specifications, approved IFC drawings, and authority requirements as permanent memory.",
    action: "Set up memory",
    section: "memory" as const,
  },
  {
    number: "04",
    icon: <Bot20Regular />,
    title: "Select the file being discussed",
    description:
      "From Project files, choose Discuss with AI, or add indexed documents in the AI context rail. The selected file receives retrieval priority.",
    action: "Open AI workspace",
    section: "ai" as const,
  },
  {
    number: "05",
    icon: <ClipboardTask20Regular />,
    title: "Create the review and CRS",
    description:
      "Attach the submitted file, choose the review type, generate an evidence-linked draft if needed, and track every formal comment in the CRS.",
    action: "Open reviews",
    section: "reviews" as const,
  },
  {
    number: "06",
    icon: <CheckmarkCircle20Regular />,
    title: "Record the decision and close",
    description:
      "Select Code 1, 2, or 3, close individual CRS comments after acceptable replies, then close the review. A new file revision reopens assessment.",
    action: "View register",
    section: "reviews" as const,
  },
];

export function GuideSection({
  project,
  onNavigate,
}: GuideSectionProps): React.JSX.Element {
  return (
    <div className="guide-page section-stack">
      <section className="guide-hero glass-surface">
        <div>
          <Text className="eyebrow">PROJECT WORKFLOW</Text>
          <h2>From project folder to closed consultant review</h2>
          <Text>
            ProjectMind is organized around the actual engineering process:
            establish the controlled baseline, select the submitted file,
            discuss it with evidence, issue review comments, receive replies,
            and record the final decision.
          </Text>
        </div>
        <Document20Regular />
      </section>

      <div className="workflow-steps">
        {steps.map((step) => (
          <article key={step.number} className="workflow-step glass-surface">
            <span className="workflow-step__number">{step.number}</span>
            <span className="workflow-step__icon">{step.icon}</span>
            <div>
              <h3>{step.title}</h3>
              <Text>{step.description}</Text>
            </div>
            <Button onClick={() => onNavigate(step.section)}>
              {step.action}
            </Button>
          </article>
        ))}
      </div>

      <div className="guide-reference-grid">
        <section className="glass-surface">
          <Text className="eyebrow">DEFAULT DECISION CODES</Text>
          <h3>Consultant document status</h3>
          <div className="decision-code-list decision-code-list--large">
            {project.settings.review_codes.map((code) => (
              <div key={code.code}>
                <span>{code.code}</span>
                <Text>{code.label}</Text>
              </div>
            ))}
          </div>
          <Text size={100}>
            These labels are controlled in Project controls and can be adapted
            to the project’s approved document-control procedure.
          </Text>
        </section>
        <section className="glass-surface">
          <Text className="eyebrow">CONTEXT RULES</Text>
          <h3>What the AI receives</h3>
          <ul>
            <li>The current question and recent messages in that chat.</li>
            <li>Relevant passages from explicitly selected review files.</li>
            <li>Relevant passages from documents marked as project memory.</li>
            <li>
              Additional project-wide search results needed to fill evidence
              gaps.
            </li>
          </ul>
          <Text size={100}>
            Source files, indexes, chats, review records, and CRS data remain
            local. Extracted passages are sent externally only when AI is
            enabled and a user initiates a request.
          </Text>
        </section>
      </div>
    </div>
  );
}
