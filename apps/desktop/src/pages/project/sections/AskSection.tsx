import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Dropdown,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Text,
  Textarea,
  Title3,
} from "@fluentui/react-components";
import {
  Add20Regular,
  Bot24Regular,
  Chat24Regular,
  DocumentText20Regular,
  Send20Regular,
  ShieldLock20Regular,
} from "@fluentui/react-icons";
import { api, ApiClientError } from "../../../api/client";
import { useAppLocale } from "../../../app/LocaleContext";
import type {
  ChatMessage,
  ChatMode,
  CitationSource,
  Project,
} from "../../../types/api";

interface AskSectionProps {
  project: Project;
  onOpenSettings: () => void;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: CitationSource[];
}

function storedMessage(message: ChatMessage): DisplayMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    sources: message.sources as unknown as CitationSource[],
  };
}

export function AskSection({
  project,
  onOpenSettings,
}: AskSectionProps): React.JSX.Element {
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [mode, setMode] = useState<ChatMode>("evidence");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);

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
  const displayedMessages = useMemo(
    () =>
      messages.length
        ? messages
        : (activeConversation.data?.messages.map(storedMessage) ?? []),
    [activeConversation.data?.messages, messages],
  );

  const send = useMutation({
    mutationFn: (message: string) =>
      api.askProject(project.id, message, mode, activeConversationId),
    onMutate: (message) => {
      const previousMessages = messages.length ? messages : displayedMessages;
      setMessages([
        ...previousMessages,
        {
          id: `pending-user-${String(Date.now())}`,
          role: "user",
          content: message,
          sources: [],
        },
      ]);
      setDraft("");
      return { message, previousMessages };
    },
    onSuccess: async (response) => {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${String(Date.now())}`,
          role: "assistant",
          content: response.message,
          sources: response.sources,
        },
      ]);
      if (response.conversation_id)
        setActiveConversationId(response.conversation_id);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["conversations", project.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-summary", project.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (_error, _message, context) => {
      if (context?.message) {
        setDraft(context.message);
        setMessages(context.previousMessages);
      }
    },
  });

  const errorMessage =
    send.error instanceof ApiClientError
      ? send.error.message
      : send.isError
        ? "ProjectMind could not complete the request."
        : undefined;
  const requiresSettings =
    send.error instanceof ApiClientError &&
    [
      "provider_key_required",
      "external_ai_disabled",
      "configuration_required",
    ].includes(send.error.code);
  const modeDescription = useMemo(
    () =>
      ({
        evidence: "Answer only when matching indexed evidence is found.",
        project:
          "Use indexed evidence first; allow a clearly limited general answer if evidence is missing.",
        general: "General AI answer without sending project document evidence.",
      })[mode],
    [mode],
  );

  const startNew = (): void => {
    setActiveConversationId(undefined);
    setMessages([]);
    setDraft("");
    send.reset();
  };
  const submit = (): void => {
    const message = draft.trim();
    if (message.length >= 2 && !send.isPending) send.mutate(message);
  };

  return (
    <div className="ask-layout">
      <aside className="conversation-sidebar surface-card">
        <div className="conversation-sidebar__header">
          <div>
            <Text className="eyebrow">HISTORY</Text>
            <Title3>Conversations</Title3>
          </div>
          <Button
            appearance="subtle"
            icon={<Add20Regular />}
            aria-label="New conversation"
            disabled={send.isPending}
            onClick={startNew}
          />
        </div>
        <Button
          appearance="primary"
          icon={<Add20Regular />}
          disabled={send.isPending}
          onClick={startNew}
        >
          New conversation
        </Button>
        <div className="conversation-list">
          {conversations.isPending ? (
            <Spinner size="tiny" label="Loading history…" />
          ) : conversations.isError ? (
            <MessageBar intent="error">
              <MessageBarBody>
                Conversation history could not be loaded.
              </MessageBarBody>
            </MessageBar>
          ) : conversations.data.length ? (
            conversations.data.map((conversation) => (
              <button
                key={conversation.id}
                className={
                  conversation.id === activeConversationId
                    ? "conversation-item conversation-item--active"
                    : "conversation-item"
                }
                disabled={send.isPending}
                onClick={() => {
                  setMessages([]);
                  setMode(conversation.mode);
                  setActiveConversationId(conversation.id);
                }}
              >
                <Chat24Regular />
                <span>
                  <Text weight="semibold" truncate>
                    {conversation.title}
                  </Text>
                  <Text size={100}>
                    {new Date(conversation.updated_at).toLocaleDateString(
                      locale,
                    )}
                  </Text>
                </span>
              </button>
            ))
          ) : (
            <div className="panel-empty panel-empty--small">
              <Text className="muted-text">
                Your saved project conversations will appear here.
              </Text>
            </div>
          )}
        </div>
      </aside>

      <div className="chat-panel surface-card">
        <header className="chat-header">
          <div>
            <Text className="eyebrow">PROJECT INTELLIGENCE</Text>
            <Title3>Ask {project.name}</Title3>
            <Text className="muted-text">
              Only retrieved excerpts are sent externally when project evidence
              is used.
            </Text>
          </div>
          <div className="chat-mode">
            <Dropdown
              value={
                mode === "evidence"
                  ? "Evidence only"
                  : mode === "project"
                    ? "Project mode"
                    : "General"
              }
              selectedOptions={[mode]}
              onOptionSelect={(_, data) =>
                data.optionValue && setMode(data.optionValue as ChatMode)
              }
              disabled={send.isPending}
            >
              <Option value="evidence">Evidence only</Option>
              <Option value="project">Project mode</Option>
              <Option value="general">General</Option>
            </Dropdown>
            <Text size={100}>{modeDescription}</Text>
          </div>
        </header>

        <div className="chat-messages" aria-live="polite">
          {activeConversation.isError &&
          activeConversationId &&
          displayedMessages.length === 0 ? (
            <MessageBar intent="error">
              <MessageBarBody>
                This conversation could not be loaded. Start a new conversation
                or select another one.
              </MessageBarBody>
            </MessageBar>
          ) : activeConversation.isPending &&
            activeConversationId &&
            displayedMessages.length === 0 ? (
            <div className="center-state">
              <Spinner label="Loading conversation…" />
            </div>
          ) : displayedMessages.length === 0 ? (
            <div className="chat-welcome">
              <div className="chat-welcome__icon">
                <Bot24Regular />
              </div>
              <Title3>What do you need to verify?</Title3>
              <Text>
                Ask about exact project requirements, compare obligations,
                locate clauses, or prepare a concise engineering review.
              </Text>
              <div className="prompt-suggestions">
                <button
                  onClick={() =>
                    setDraft(
                      "What are the applicable concrete durability requirements?",
                    )
                  }
                >
                  Concrete durability requirements
                </button>
                <button
                  onClick={() =>
                    setDraft(
                      "Find the warranty requirements for the proposed system.",
                    )
                  }
                >
                  Warranty requirements
                </button>
                <button
                  onClick={() =>
                    setDraft(
                      "Identify conflicts between current project requirements.",
                    )
                  }
                >
                  Requirement conflicts
                </button>
              </div>
            </div>
          ) : (
            displayedMessages.map((message) => (
              <article
                className={`chat-message chat-message--${message.role}`}
                key={message.id}
              >
                <div className="chat-message__avatar">
                  {message.role === "assistant" ? (
                    <Bot24Regular />
                  ) : (
                    project.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="chat-message__body">
                  <Text weight="semibold">
                    {message.role === "assistant" ? "ProjectMind" : "You"}
                  </Text>
                  <div className="chat-message__content">{message.content}</div>
                  {message.sources.length ? (
                    <div className="citation-list">
                      <Text size={200} weight="semibold">
                        <DocumentText20Regular /> Sources used
                      </Text>
                      {message.sources.map((source) => (
                        <details key={`${message.id}-${source.reference}`}>
                          <summary>
                            <Badge appearance="tint">{source.reference}</Badge>
                            <span>{source.file_name}</span>
                          </summary>
                          <Text size={200}>
                            {source.relative_path} · Version{" "}
                            {source.version_number}
                          </Text>
                          <p>{source.excerpt}</p>
                        </details>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          )}
          {send.isPending ? (
            <article className="chat-message chat-message--assistant">
              <div className="chat-message__avatar">
                <Bot24Regular />
              </div>
              <div className="chat-message__body">
                <Text weight="semibold">ProjectMind</Text>
                <Spinner size="tiny" label="Reviewing indexed evidence…" />
              </div>
            </article>
          ) : null}
        </div>

        <div className="chat-composer">
          {errorMessage ? (
            <MessageBar intent="error">
              <MessageBarBody>
                {errorMessage}
                {requiresSettings ? (
                  <Button appearance="transparent" onClick={onOpenSettings}>
                    Open AI settings
                  </Button>
                ) : null}
              </MessageBarBody>
            </MessageBar>
          ) : null}
          <div className="privacy-line">
            <ShieldLock20Regular />
            <Text size={100}>
              {mode === "general"
                ? "No project excerpts will be attached."
                : "Only selected search excerpts may be sent to the configured provider."}
            </Text>
          </div>
          <div className="composer-row">
            <Textarea
              resize="vertical"
              value={draft}
              placeholder="Ask a project question…"
              onChange={(_, data) => setDraft(data.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <Button
              appearance="primary"
              icon={<Send20Regular />}
              disabled={draft.trim().length < 2 || send.isPending}
              onClick={submit}
            >
              Send
            </Button>
          </div>
          <Text size={100} className="muted-text">
            Ctrl + Enter to send. Verify engineering conclusions before use.
          </Text>
        </div>
      </div>
    </div>
  );
}
