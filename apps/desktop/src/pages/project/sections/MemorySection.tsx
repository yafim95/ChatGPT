import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Textarea,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowSync20Regular,
  CheckmarkCircle20Regular,
  Document20Regular,
  FolderOpen20Regular,
  Search20Regular,
  Sparkle20Regular,
  Star20Regular,
  Subtract20Regular,
} from "@fluentui/react-icons";
import { api, ApiClientError } from "../../../api/client";
import type { Project, ProjectDocument } from "../../../types/api";

interface MemorySectionProps {
  project: Project;
  onOpenFiles: () => void;
}

const categories = [
  "Contract",
  "Employer Requirements",
  "Specifications",
  "IFC Drawings",
  "Authority Requirements",
  "Other",
];

export function MemorySection({
  project,
  onOpenFiles,
}: MemorySectionProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [instructions, setInstructions] = useState(
    project.settings.ai_project_instructions ?? "",
  );
  const documents = useQuery({
    queryKey: ["documents", project.id, "memory"],
    queryFn: () => api.listDocuments(project.id),
  });
  const invalidate = async (documentId?: string): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["documents", project.id] }),
      queryClient.invalidateQueries({
        queryKey: ["project-files", project.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ["project-summary", project.id],
      }),
      documentId
        ? queryClient.invalidateQueries({
            queryKey: ["document-preview", project.id, documentId],
          })
        : Promise.resolve(),
    ]);
  };
  const updateMemory = useMutation({
    mutationFn: ({
      document,
      isCore,
      category,
    }: {
      document: ProjectDocument;
      isCore?: boolean;
      category?: string;
    }) =>
      api.updateDocumentWorkflow(project.id, document.id, {
        is_core_memory: isCore,
        memory_category: category,
      }),
    onSuccess: (document) => invalidate(document.id),
  });
  const saveInstructions = useMutation({
    mutationFn: () =>
      api.updateProjectSettings(project.id, {
        ai_project_instructions: instructions.trim() || null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", project.id] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
    },
  });
  const reindex = useMutation({
    mutationFn: () => api.rebuildPassages(project.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["documents", project.id],
      });
    },
  });

  const memoryDocuments = useMemo(
    () =>
      (documents.data?.items ?? []).filter(
        (document) => document.is_core_memory,
      ),
    [documents.data?.items],
  );
  const candidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (documents.data?.items ?? []).filter(
      (document) =>
        !document.is_core_memory &&
        document.extraction_status === "ready" &&
        (!query ||
          document.file_name.toLowerCase().includes(query) ||
          document.relative_path.toLowerCase().includes(query)),
    );
  }, [documents.data?.items, search]);
  const memoryWords = memoryDocuments.reduce(
    (total, document) => total + document.word_count,
    0,
  );

  return (
    <div className="memory-page section-stack">
      <section className="memory-hero glass-surface">
        <div className="memory-hero__mark">
          <Sparkle20Regular />
        </div>
        <div>
          <Text className="eyebrow">PERSISTENT PROJECT KNOWLEDGE</Text>
          <h2>Project memory</h2>
          <Text>
            Mark the main contract and control documents once. ProjectMind keeps
            their extracted passages locally and automatically retrieves the
            relevant parts in later chats and reviews—no repeated upload is
            required.
          </Text>
        </div>
        <div className="memory-hero__stats">
          <span>
            <strong>{memoryDocuments.length}</strong>
            <small>memory files</small>
          </span>
          <span>
            <strong>{memoryWords.toLocaleString()}</strong>
            <small>indexed words</small>
          </span>
        </div>
      </section>

      <section className="retrieval-flow glass-surface">
        <div className="panel-heading">
          <div>
            <Text className="eyebrow">HOW CONTEXT IS BUILT</Text>
            <h3>Efficient three-tier retrieval</h3>
          </div>
          <div className="panel-actions">
            <Badge appearance="tint" color="success">
              Local index
            </Badge>
            <Button
              icon={<ArrowSync20Regular />}
              disabled={reindex.isPending}
              onClick={() => reindex.mutate()}
            >
              {reindex.isPending ? "Rebuilding…" : "Rebuild passages"}
            </Button>
          </div>
        </div>
        <div className="retrieval-tier-grid">
          <article>
            <span>01</span>
            <Star20Regular />
            <strong>Selected review files</strong>
            <Text>
              The file you are actively discussing receives first priority.
            </Text>
          </article>
          <article>
            <span>02</span>
            <Sparkle20Regular />
            <strong>Permanent project memory</strong>
            <Text>
              Relevant contract, specification, IFC, and authority passages are
              reused.
            </Text>
          </article>
          <article>
            <span>03</span>
            <Search20Regular />
            <strong>Project-wide evidence</strong>
            <Text>
              Chunk search fills remaining gaps and keeps every source
              traceable.
            </Text>
          </article>
        </div>
      </section>

      <div className="memory-layout">
        <section className="memory-library glass-surface">
          <div className="panel-heading">
            <div>
              <Text className="eyebrow">CONTROLLED BASELINE</Text>
              <h3>Main project files</h3>
            </div>
            <Button icon={<FolderOpen20Regular />} onClick={onOpenFiles}>
              Browse directory
            </Button>
          </div>
          {documents.isPending ? (
            <Spinner label="Loading project memory…" />
          ) : memoryDocuments.length ? (
            <div className="memory-document-list">
              {memoryDocuments.map((document) => (
                <article key={document.id}>
                  <span className="file-kind-icon">
                    <Document20Regular />
                  </span>
                  <div>
                    <strong>{document.file_name}</strong>
                    <small>{document.relative_path}</small>
                    <span>
                      {document.word_count.toLocaleString()} words · version{" "}
                      {document.version_number}
                    </span>
                  </div>
                  <label className="native-field">
                    <span>Category</span>
                    <select
                      value={document.memory_category ?? "Other"}
                      disabled={updateMemory.isPending}
                      onChange={(event) =>
                        updateMemory.mutate({
                          document,
                          category: event.target.value,
                        })
                      }
                    >
                      {categories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <Button
                    appearance="subtle"
                    icon={<Subtract20Regular />}
                    disabled={updateMemory.isPending}
                    onClick={() =>
                      updateMemory.mutate({ document, isCore: false })
                    }
                  >
                    Remove
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="panel-empty panel-empty--large">
              <Star20Regular />
              <Text weight="semibold">No permanent memory files yet</Text>
              <Text>
                Add the contract, Employer’s Requirements, specifications,
                approved IFC drawings, and authority requirements below.
              </Text>
              <Button appearance="primary" onClick={onOpenFiles}>
                Open project files
              </Button>
            </div>
          )}
        </section>

        <aside className="memory-add glass-surface">
          <Text className="eyebrow">ADD TO MEMORY</Text>
          <h3>Indexed documents</h3>
          <Input
            contentBefore={<Search20Regular />}
            value={search}
            placeholder="Search project documents"
            onChange={(_, data) => setSearch(data.value)}
          />
          <div className="memory-candidate-list">
            {candidates.slice(0, 80).map((document) => (
              <button
                key={document.id}
                disabled={updateMemory.isPending}
                onClick={() => updateMemory.mutate({ document, isCore: true })}
              >
                <Document20Regular />
                <span>
                  <strong>{document.file_name}</strong>
                  <small>{document.relative_path}</small>
                </span>
                <Add20Regular />
              </button>
            ))}
            {!candidates.length ? (
              <div className="context-empty">
                <CheckmarkCircle20Regular />
                <Text>No additional matching indexed files.</Text>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      <section className="memory-instructions glass-surface">
        <div>
          <Text className="eyebrow">PROJECT-SPECIFIC AI RULES</Text>
          <h3>Controlled project instructions</h3>
          <Text>
            Add durable project rules that should accompany every project
            chat—terminology, contractual precedence, authority constraints, or
            consultant response conventions.
          </Text>
        </div>
        <Textarea
          value={instructions}
          resize="vertical"
          placeholder="Example: Treat the Contract and Employer’s Requirements as higher precedence than approved submittals. Never infer authority approval. Use UAE consultant terminology."
          onChange={(_, data) => {
            setInstructions(data.value);
            saveInstructions.reset();
          }}
        />
        <Button
          appearance="primary"
          icon={<Sparkle20Regular />}
          disabled={saveInstructions.isPending}
          onClick={() => saveInstructions.mutate()}
        >
          Save project instructions
        </Button>
      </section>

      {updateMemory.isError || saveInstructions.isError || reindex.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>
            {updateMemory.error instanceof ApiClientError
              ? updateMemory.error.message
              : saveInstructions.error instanceof ApiClientError
                ? saveInstructions.error.message
                : reindex.error instanceof ApiClientError
                  ? reindex.error.message
                  : "Project memory could not be updated."}
          </MessageBarBody>
        </MessageBar>
      ) : null}
      {saveInstructions.isSuccess ? (
        <MessageBar intent="success">
          <MessageBarBody>
            Project AI instructions saved locally.
          </MessageBarBody>
        </MessageBar>
      ) : null}
      {reindex.isSuccess ? (
        <MessageBar intent="success">
          <MessageBarBody>
            Rebuilt {reindex.data.passages.toLocaleString()} passages across{" "}
            {reindex.data.documents.toLocaleString()} indexed documents.
          </MessageBarBody>
        </MessageBar>
      ) : null}
    </div>
  );
}
