import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Switch,
  Text,
  Textarea,
} from "@fluentui/react-components";
import {
  Add20Regular,
  Attach20Regular,
  Bot20Regular,
  Chat20Regular,
  Checkmark20Regular,
  Document20Regular,
  Search20Regular,
  Send20Regular,
  Settings20Regular,
  Sparkle20Regular,
} from "@fluentui/react-icons";
import { api, ApiClientError } from "../../../api/client";
import type {
  ChatMessage,
  ChatMode,
  Conversation,
  Project,
  ProjectDocument,
} from "../../../types/api";

interface AIWorkspaceSectionProps {
  project: Project;
  contextDocuments: ProjectDocument[];
  onContextDocumentsChange: (documents: ProjectDocument[]) => void;
  onConversationChange: (conversationId?: string) => void;
  onOpenSettings: () => void;
  defaultIncludeCoreMemory: boolean;
  initialConversationId?: string;
}

const prompts = [
  "Summarize the selected document and identify key contractual obligations.",
  "Find conflicts between the selected file and the permanent project memory.",
  "Draft concise consultant review comments with exact source citations.",
  "List missing submissions, tests, or approvals evidenced by the project documents.",
];

function sourceLabel(source: Record<string, unknown>): string {
  const fileName =
    typeof source.file_name === "string" ? source.file_name : "Project source";
  const reference =
    typeof source.reference === "string" ? source.reference : "Source";
  const tier =
    typeof source.source_tier === "string" ? source.source_tier : "project";
  return `${reference} · ${fileName} · ${tier.replace("_", " ")}`;
}

function ChatMessageCard({
  message,
}: {
  message: ChatMessage;
}): React.JSX.Element {
  return (
    <article className={`chat-message chat-message--${message.role}`}>
      <div className="chat-message__avatar">
        {message.role === "assistant" ? <Bot20Regular /> : "You"}
      </div>
      <div className="chat-message__body">
        <div className="chat-message__meta">
          <Text weight="semibold">
            {message.role === "assistant" ? "ProjectMind" : "You"}
          </Text>
          <Text size={100}>
            {new Date(message.created_at).toLocaleTimeString()}
          </Text>
        </div>
        <div className="chat-message__content">{message.content}</div>
        {message.sources.length ? (
          <div className="chat-citations">
            {message.sources.map((source, index) => (
              <span key={`${message.id}-${String(index)}`}>
                <Document20Regular /> {sourceLabel(source)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function AIWorkspaceSection({
  project,
  contextDocuments,
  onContextDocumentsChange,
  onConversationChange,
  onOpenSettings,
  defaultIncludeCoreMemory,
  initialConversationId,
}: AIWorkspaceSectionProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [activeConversationId, setActiveConversationId] = useState<
    string | undefined
  >(initialConversationId);
  const [conversationSearch, setConversationSearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<ChatMode>("evidence");
  const [includeCoreMemory, setIncludeCoreMemory] = useState(
    defaultIncludeCoreMemory,
  );
  const [pendingPrompt, setPendingPrompt] = useState<string>();

  const conversations = useQuery({
    queryKey: ["conversations", project.id],
    queryFn: () => api.listConversations(project.id),
  });
  const activeConversation = useQuery({
    queryKey: ["conversation", project.id, activeConversationId],
    queryFn: () =>
      api.getConversation(project.id, activeConversationId as string),
    enabled: Boolean(activeConversationId),
  });
  const documents = useQuery({
    queryKey: ["documents", project.id, "ai-picker"],
    queryFn: () => api.listDocuments(project.id),
  });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversation.data?.messages.length, pendingPrompt]);

  const send = useMutation({
    mutationFn: (prompt: string) =>
      api.askProject(project.id, prompt, mode, activeConversationId, {
        documentIds: contextDocuments.map((document) => document.id),
        includeCoreMemory,
      }),
    onMutate: (prompt) => setPendingPrompt(prompt),
    onSuccess: async (response) => {
      setMessage("");
      if (response.conversation_id) {
        setActiveConversationId(response.conversation_id);
        onConversationChange(response.conversation_id);
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["conversations", project.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["conversation", project.id, response.conversation_id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["document-relationships", project.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-summary", project.id],
        }),
      ]);
      setPendingPrompt(undefined);
    },
    onError: () => setPendingPrompt(undefined),
  });

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    return (conversations.data ?? []).filter(
      (conversation) =>
        !query || conversation.title.toLowerCase().includes(query),
    );
  }, [conversationSearch, conversations.data]);
  const filteredDocuments = useMemo(() => {
    const query = documentSearch.trim().toLowerCase();
    return (documents.data?.items ?? []).filter(
      (document) =>
        document.extraction_status === "ready" &&
        (!query ||
          document.file_name.toLowerCase().includes(query) ||
          document.relative_path.toLowerCase().includes(query)),
    );
  }, [documentSearch, documents.data?.items]);
  const coreDocuments = useMemo(
    () =>
      (documents.data?.items ?? []).filter(
        (document) =>
          document.is_core_memory && document.extraction_status === "ready",
      ),
    [documents.data?.items],
  );
  const currentConversation: Conversation | undefined = activeConversation.data;
  const submit = (prompt = message): void => {
    const clean = prompt.trim();
    if (clean.length < 2 || send.isPending) return;
    send.mutate(clean);
  };
  const toggleDocument = (document: ProjectDocument): void => {
    const selected = contextDocuments.some((item) => item.id === document.id);
    onContextDocumentsChange(
      selected
        ? contextDocuments.filter((item) => item.id !== document.id)
        : [...contextDocuments, document].slice(-20),
    );
  };

  return (
    <div className="ai-workspace feature-workspace feature-workspace--wide">
      <aside className="chat-rail glass-surface">
        <Button
          className="new-chat-button"
          appearance="primary"
          icon={<Add20Regular />}
          onClick={() => {
            setActiveConversationId(undefined);
            onConversationChange(undefined);
            setMessage("");
          }}
        >
          New chat
        </Button>
        <Input
          contentBefore={<Search20Regular />}
          value={conversationSearch}
          placeholder="Search chats"
          aria-label="Search project chats"
          onChange={(_, data) => setConversationSearch(data.value)}
        />
        <div className="chat-rail__heading">
          <Text className="eyebrow">PROJECT CHATS</Text>
          <span>{filteredConversations.length}</span>
        </div>
        <div className="conversation-list">
          {conversations.isPending ? (
            <Spinner size="tiny" label="Loading chats…" />
          ) : filteredConversations.length ? (
            filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                className={
                  activeConversationId === conversation.id
                    ? "is-active"
                    : undefined
                }
                onClick={() => {
                  setActiveConversationId(conversation.id);
                  onConversationChange(conversation.id);
                }}
              >
                <Chat20Regular />
                <span>
                  <strong>{conversation.title}</strong>
                  <small>
                    {conversation.documents.length
                      ? `${String(conversation.documents.length)} linked files`
                      : conversation.mode}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <div className="rail-empty">
              <Chat20Regular />
              <Text>No saved chats yet.</Text>
            </div>
          )}
        </div>
        <div className="chat-rail__footer">
          <Sparkle20Regular />
          <span>
            <Text weight="semibold">Persistent project context</Text>
            <Text size={100}>Chats and file links are saved locally.</Text>
          </span>
        </div>
      </aside>

      <section className="chat-stage glass-surface">
        <header className="chat-stage__header">
          <div>
            <Text className="eyebrow">AI WORKSPACE</Text>
            <Text weight="semibold" size={500}>
              {currentConversation?.title ?? "New project conversation"}
            </Text>
          </div>
          <div className="chat-controls">
            <label>
              <span>Answer mode</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as ChatMode)}
              >
                <option value="evidence">Evidence only</option>
                <option value="project">Project + professional context</option>
                <option value="general">General</option>
              </select>
            </label>
            <Badge
              appearance="tint"
              color={
                settings.data?.ai_api_key_configured ? "success" : "warning"
              }
            >
              {settings.data?.ai_api_key_configured
                ? settings.data.ai_model
                : "AI not configured"}
            </Badge>
          </div>
        </header>

        <div className="chat-stage__messages">
          {activeConversation.isPending ? (
            <div className="chat-loading">
              <Spinner label="Opening conversation…" />
            </div>
          ) : currentConversation?.messages.length ? (
            currentConversation.messages.map((item) => (
              <ChatMessageCard key={item.id} message={item} />
            ))
          ) : (
            <div className="chat-welcome">
              <div className="chat-welcome__mark">
                <Bot20Regular />
              </div>
              <Text className="eyebrow">PROJECTMIND AI</Text>
              <h2>What do you want to review?</h2>
              <Text>
                Select review files on the right. Core contracts and project
                documents marked as memory are reused automatically, while every
                project claim remains linked to retrieved evidence.
              </Text>
              <div className="prompt-grid">
                {prompts.map((prompt) => (
                  <button key={prompt} onClick={() => setMessage(prompt)}>
                    <Sparkle20Regular />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {pendingPrompt ? (
            <>
              <ChatMessageCard
                message={{
                  id: "pending-user",
                  role: "user",
                  content: pendingPrompt,
                  sources: [],
                  created_at: new Date().toISOString(),
                }}
              />
              <div className="assistant-thinking">
                <span className="chat-message__avatar">
                  <Bot20Regular />
                </span>
                <Spinner size="tiny" />
                <Text>Reviewing controlled project context…</Text>
              </div>
            </>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {send.isError ? (
          <MessageBar intent="error">
            <MessageBarBody>
              {send.error instanceof ApiClientError
                ? send.error.message
                : "ProjectMind could not complete this request."}
              {send.error instanceof ApiClientError &&
              ["external_ai_disabled", "provider_key_required"].includes(
                send.error.code,
              ) ? (
                <Button
                  appearance="transparent"
                  icon={<Settings20Regular />}
                  onClick={onOpenSettings}
                >
                  Open AI settings
                </Button>
              ) : null}
            </MessageBarBody>
          </MessageBar>
        ) : null}

        <footer className="chat-composer">
          <div className="context-chip-row">
            <span>
              <Attach20Regular /> {contextDocuments.length} selected review
              files
            </span>
            <span>
              <Sparkle20Regular />{" "}
              {includeCoreMemory ? coreDocuments.length : 0} memory files
            </span>
          </div>
          <Textarea
            value={message}
            placeholder="Ask about the project, review selected files, or draft consultant comments…"
            resize="none"
            aria-label="Message ProjectMind"
            onChange={(_, data) => setMessage(data.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <div className="composer-actions">
            <Text size={100}>
              Enter to send · Shift+Enter for a new line · Engineering judgment
              remains required
            </Text>
            <Button
              appearance="primary"
              icon={<Send20Regular />}
              disabled={send.isPending || message.trim().length < 2}
              onClick={() => submit()}
            >
              Send
            </Button>
          </div>
        </footer>
      </section>

      <aside className="context-rail glass-surface">
        <div className="context-rail__heading">
          <div>
            <Text className="eyebrow">CONTROLLED CONTEXT</Text>
            <Text weight="semibold">Files in this chat</Text>
          </div>
          <Badge appearance="filled">{contextDocuments.length}</Badge>
        </div>

        <div className="core-memory-switch">
          <span>
            <Sparkle20Regular />
            <span>
              <Text weight="semibold">Include project memory</Text>
              <Text size={100}>
                {coreDocuments.length} permanent files available
              </Text>
            </span>
          </span>
          <Switch
            checked={includeCoreMemory}
            onChange={(_, data) => setIncludeCoreMemory(data.checked)}
          />
        </div>

        <div className="selected-context-list">
          {contextDocuments.map((document) => (
            <button key={document.id} onClick={() => toggleDocument(document)}>
              <span className="file-kind-icon">
                <Document20Regular />
              </span>
              <span>
                <strong>{document.file_name}</strong>
                <small>{document.relative_path}</small>
              </span>
              <Checkmark20Regular />
            </button>
          ))}
          {!contextDocuments.length ? (
            <div className="context-empty">
              <Attach20Regular />
              <Text>Select the file being discussed or reviewed.</Text>
            </div>
          ) : null}
        </div>

        <div className="document-picker">
          <Text weight="semibold">Add project files</Text>
          <Input
            contentBefore={<Search20Regular />}
            value={documentSearch}
            placeholder="Search indexed files"
            onChange={(_, data) => setDocumentSearch(data.value)}
          />
          <div className="document-picker__list">
            {documents.isPending ? (
              <Spinner size="tiny" />
            ) : (
              filteredDocuments.slice(0, 80).map((document) => {
                const selected = contextDocuments.some(
                  (item) => item.id === document.id,
                );
                return (
                  <button
                    key={document.id}
                    className={selected ? "is-selected" : undefined}
                    onClick={() => toggleDocument(document)}
                  >
                    <Document20Regular />
                    <span>
                      <strong>{document.file_name}</strong>
                      <small>
                        {document.is_core_memory
                          ? `Memory · ${document.memory_category ?? "Other"}`
                          : document.relative_path}
                      </small>
                    </span>
                    {selected ? <Checkmark20Regular /> : <Add20Regular />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
