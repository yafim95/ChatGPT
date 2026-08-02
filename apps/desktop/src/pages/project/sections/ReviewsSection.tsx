import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Textarea,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowDownload20Regular,
  Bot20Regular,
  Chat20Regular,
  CheckmarkCircle20Regular,
  ClipboardTask20Regular,
  Delete20Regular,
  Document20Regular,
  Save20Regular,
  Settings20Regular,
} from "@fluentui/react-icons";
import { api, ApiClientError } from "../../../api/client";
import type {
  CrsItem,
  CrsItemPayload,
  CrsSheet,
  Project,
  ProjectDocument,
  ReviewPayload,
  ReviewType,
} from "../../../types/api";

interface ReviewsSectionProps {
  project: Project;
  initialDocument?: ProjectDocument;
  onOpenSettings: () => void;
  onDiscuss: (document: ProjectDocument) => void;
}

const reviewTypes: Array<{ value: ReviewType; label: string }> = [
  { value: "material_submittal", label: "Material submittal" },
  { value: "method_statement", label: "Method statement / risk assessment" },
  { value: "itp", label: "Inspection and test plan" },
  { value: "shop_drawing", label: "Shop drawing" },
  { value: "technical_report", label: "Technical report" },
  { value: "general", label: "General document review" },
];

interface ReviewForm {
  title: string;
  documentId: string;
  reviewType: ReviewType;
  referenceNumber: string;
  discipline: string;
  dueAt: string;
  instructions: string;
  generateWithAi: boolean;
  createCrs: boolean;
}

function defaultDueDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function newReviewForm(
  project: Project,
  document?: ProjectDocument,
): ReviewForm {
  return {
    title: document ? `Review · ${document.file_name}` : "",
    documentId: document?.id ?? "",
    reviewType: "general",
    referenceNumber: "",
    discipline: project.settings.disciplines[0] ?? "",
    dueAt: defaultDueDate(project.settings.default_review_due_days),
    instructions:
      "Check compliance with the contract documents, specifications, approved IFC information, authority requirements, and related submissions. Identify only material comments and cite the supporting evidence.",
    generateWithAi: true,
    createCrs: project.settings.auto_create_crs,
  };
}

function CrsItemEditor({
  item,
  pending,
  onSave,
  onDelete,
}: {
  item: CrsItem;
  pending: boolean;
  onSave: (payload: Partial<CrsItemPayload>) => void;
  onDelete: () => void;
}): React.JSX.Element {
  const [location, setLocation] = useState(item.location ?? "");
  const [comment, setComment] = useState(item.consultant_comment);
  const [reply, setReply] = useState(item.contractor_reply ?? "");
  const [response, setResponse] = useState(item.consultant_response ?? "");

  return (
    <article className={`crs-item crs-item--${item.status}`}>
      <header>
        <span className="crs-item__number">
          {String(item.item_number).padStart(2, "0")}
        </span>
        <label className="native-field crs-location-field">
          <span>Drawing / clause / location</span>
          <input
            value={location}
            placeholder="e.g. A-203 / Detail 6"
            onChange={(event) => setLocation(event.target.value)}
          />
        </label>
        <span className={`workflow-pill workflow-pill--${item.status}`}>
          {item.status}
        </span>
      </header>
      <div className="crs-item__columns">
        <label>
          <span>Consultant comment</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        <label>
          <span>Contractor reply</span>
          <textarea
            value={reply}
            placeholder="Awaiting contractor reply"
            onChange={(event) => setReply(event.target.value)}
          />
        </label>
        <label>
          <span>Consultant response</span>
          <textarea
            value={response}
            placeholder="Consultant follow-up / closure statement"
            onChange={(event) => setResponse(event.target.value)}
          />
        </label>
      </div>
      <footer>
        <Button
          appearance="subtle"
          icon={<Delete20Regular />}
          disabled={pending}
          onClick={onDelete}
        >
          Delete
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            onSave({ status: item.status === "open" ? "closed" : "open" })
          }
        >
          Mark {item.status === "open" ? "closed" : "open"}
        </Button>
        <Button
          appearance="primary"
          icon={<Save20Regular />}
          disabled={pending || comment.trim().length < 2}
          onClick={() =>
            onSave({
              location: location.trim() || null,
              consultant_comment: comment.trim(),
              contractor_reply: reply.trim() || null,
              consultant_response: response.trim() || null,
            })
          }
        >
          Save row
        </Button>
      </footer>
    </article>
  );
}

export function ReviewsSection({
  project,
  initialDocument,
  onOpenSettings,
  onDiscuss,
}: ReviewsSectionProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"open" | "closed" | "all">("open");
  const [selectedReviewId, setSelectedReviewId] = useState<string>();
  const [showCreate, setShowCreate] = useState(Boolean(initialDocument));
  const [form, setForm] = useState<ReviewForm>(() =>
    newReviewForm(project, initialDocument),
  );
  const [newComment, setNewComment] = useState("");
  const [newLocation, setNewLocation] = useState("");

  const reviews = useQuery({
    queryKey: ["reviews", project.id],
    queryFn: () => api.listReviews(project.id),
  });
  const documents = useQuery({
    queryKey: ["documents", project.id, "reviews"],
    queryFn: () => api.listDocuments(project.id),
  });
  const sheets = useQuery({
    queryKey: ["crs", project.id],
    queryFn: () => api.listCrs(project.id),
  });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const visibleReviews = useMemo(
    () =>
      (reviews.data ?? []).filter(
        (review) => filter === "all" || review.workflow_state === filter,
      ),
    [filter, reviews.data],
  );
  const activeReviewId = visibleReviews.some(
    (review) => review.id === selectedReviewId,
  )
    ? selectedReviewId
    : visibleReviews[0]?.id;
  const selectedReview = reviews.data?.find(
    (review) => review.id === activeReviewId,
  );
  const selectedDocument = documents.data?.items.find(
    (document) => document.id === selectedReview?.document_id,
  );
  const selectedSheets = (sheets.data ?? []).filter(
    (sheet) => sheet.review_id === activeReviewId,
  );
  const selectedSheet = selectedSheets[0];

  const invalidateReviewData = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["reviews", project.id] }),
      queryClient.invalidateQueries({ queryKey: ["crs", project.id] }),
      queryClient.invalidateQueries({ queryKey: ["documents", project.id] }),
      queryClient.invalidateQueries({
        queryKey: ["project-files", project.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ["project-summary", project.id],
      }),
    ]);
  };
  const create = useMutation({
    mutationFn: () => {
      const payload: ReviewPayload = {
        title: form.title.trim(),
        review_type: form.reviewType,
        instructions: form.instructions.trim(),
        document_id: form.documentId || null,
        reference_number: form.referenceNumber.trim() || null,
        discipline: form.discipline || null,
        due_at: form.dueAt
          ? new Date(`${form.dueAt}T12:00:00`).toISOString()
          : null,
        generate_with_ai: form.generateWithAi,
        create_crs: form.createCrs,
      };
      return api.createReview(project.id, payload);
    },
    onSuccess: async (review) => {
      setSelectedReviewId(review.id);
      setShowCreate(false);
      setForm(newReviewForm(project));
      await invalidateReviewData();
    },
  });
  const updateReview = useMutation({
    mutationFn: (payload: Parameters<typeof api.updateReview>[2]) =>
      api.updateReview(project.id, activeReviewId as string, payload),
    onSuccess: invalidateReviewData,
  });
  const createSheet = useMutation({
    mutationFn: () =>
      api.createCrs(project.id, {
        document_id: selectedReview?.document_id as string,
        review_id: activeReviewId,
        title: `CRS · ${selectedReview?.title ?? "Document review"}`,
        reference_number: selectedReview?.reference_number,
      }),
    onSuccess: invalidateReviewData,
  });
  const addItem = useMutation({
    mutationFn: () =>
      api.addCrsItem(project.id, selectedSheet?.id as string, {
        location: newLocation.trim() || null,
        consultant_comment: newComment.trim(),
      }),
    onSuccess: async () => {
      setNewComment("");
      setNewLocation("");
      await invalidateReviewData();
    },
  });
  const updateItem = useMutation({
    mutationFn: ({
      itemId,
      payload,
    }: {
      itemId: string;
      payload: Partial<CrsItemPayload>;
    }) =>
      api.updateCrsItem(
        project.id,
        selectedSheet?.id as string,
        itemId,
        payload,
      ),
    onSuccess: invalidateReviewData,
  });
  const deleteItem = useMutation({
    mutationFn: (itemId: string) =>
      api.deleteCrsItem(project.id, selectedSheet?.id as string, itemId),
    onSuccess: invalidateReviewData,
  });
  const exportSheet = async (sheet: CrsSheet): Promise<void> => {
    const content = await api.exportCrs(project.id, sheet.id);
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sheet.title.replace(/[^a-z0-9-_]+/gi, "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="reviews-workspace feature-workspace feature-workspace--reviews">
      <aside className="review-queue glass-surface">
        <Button
          appearance="primary"
          icon={<Add20Regular />}
          onClick={() => {
            setForm(newReviewForm(project));
            setShowCreate(true);
          }}
        >
          New review
        </Button>
        <div
          className="segmented-control"
          role="group"
          aria-label="Review filter"
        >
          {(["open", "closed", "all"] as const).map((value) => (
            <button
              key={value}
              className={filter === value ? "is-active" : undefined}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="review-queue__heading">
          <Text className="eyebrow">REVIEW REGISTER</Text>
          <span>{visibleReviews.length}</span>
        </div>
        <div className="review-list">
          {reviews.isPending ? (
            <Spinner size="tiny" />
          ) : visibleReviews.length ? (
            visibleReviews.map((review) => (
              <button
                key={review.id}
                className={
                  activeReviewId === review.id ? "is-active" : undefined
                }
                onClick={() => {
                  setSelectedReviewId(review.id);
                  setShowCreate(false);
                }}
              >
                <span
                  className={`review-state-dot review-state-dot--${review.workflow_state}`}
                />
                <span>
                  <strong>{review.title}</strong>
                  <small>
                    {review.document_file_name ??
                      review.review_type.replaceAll("_", " ")}
                  </small>
                  <span>
                    {review.decision_code
                      ? `Code ${review.decision_code}`
                      : "Decision pending"}
                    {review.due_at
                      ? ` · Due ${new Date(review.due_at).toLocaleDateString()}`
                      : ""}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="rail-empty">
              <ClipboardTask20Regular />
              <Text>No {filter === "all" ? "" : filter} reviews.</Text>
            </div>
          )}
        </div>
      </aside>

      <section className="review-stage glass-surface">
        {showCreate ? (
          <div className="review-create">
            <header>
              <div>
                <Text className="eyebrow">NEW DOCUMENT REVIEW</Text>
                <h2>Create a controlled review</h2>
                <Text>
                  Select the submitted file. Project memory supplies the
                  contract baseline, while the CRS records each consultant
                  comment and reply.
                </Text>
              </div>
              <Button appearance="subtle" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </header>
            <div className="review-form-grid">
              <label className="native-field span-two">
                <span>Review title</span>
                <input
                  value={form.title}
                  placeholder="e.g. Structural shop drawing review · Rev 02"
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                />
              </label>
              <label className="native-field span-two">
                <span>File under review</span>
                <select
                  value={form.documentId}
                  onChange={(event) => {
                    const document = documents.data?.items.find(
                      (item) => item.id === event.target.value,
                    );
                    setForm({
                      ...form,
                      documentId: event.target.value,
                      title:
                        form.title ||
                        (document ? `Review · ${document.file_name}` : ""),
                    });
                  }}
                >
                  <option value="">Choose an indexed file</option>
                  {documents.data?.items.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.file_name} · {document.relative_path}
                    </option>
                  ))}
                </select>
              </label>
              <label className="native-field">
                <span>Review type</span>
                <select
                  value={form.reviewType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      reviewType: event.target.value as ReviewType,
                    })
                  }
                >
                  {reviewTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="native-field">
                <span>Discipline</span>
                <select
                  value={form.discipline}
                  onChange={(event) =>
                    setForm({ ...form, discipline: event.target.value })
                  }
                >
                  <option value="">Not specified</option>
                  {project.settings.disciplines.map((discipline) => (
                    <option key={discipline}>{discipline}</option>
                  ))}
                </select>
              </label>
              <label className="native-field">
                <span>Submittal / review reference</span>
                <input
                  value={form.referenceNumber}
                  placeholder="e.g. SD-STR-0042"
                  onChange={(event) =>
                    setForm({ ...form, referenceNumber: event.target.value })
                  }
                />
              </label>
              <label className="native-field">
                <span>Target date</span>
                <input
                  type="date"
                  value={form.dueAt}
                  onChange={(event) =>
                    setForm({ ...form, dueAt: event.target.value })
                  }
                />
              </label>
              <label className="native-field span-two">
                <span>Review instructions</span>
                <textarea
                  value={form.instructions}
                  onChange={(event) =>
                    setForm({ ...form, instructions: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="review-options">
              <Checkbox
                checked={form.generateWithAi}
                label="Generate the first review draft with AI"
                onChange={(_, data) =>
                  setForm({ ...form, generateWithAi: data.checked === true })
                }
              />
              <Checkbox
                checked={form.createCrs}
                label="Create and attach a Comment Reply Sheet (CRS)"
                onChange={(_, data) =>
                  setForm({ ...form, createCrs: data.checked === true })
                }
              />
            </div>
            {create.isError ? (
              <MessageBar intent="error">
                <MessageBarBody>
                  {create.error instanceof ApiClientError
                    ? create.error.message
                    : "The review could not be created."}
                  {create.error instanceof ApiClientError &&
                  ["external_ai_disabled", "provider_key_required"].includes(
                    create.error.code,
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
            <footer>
              <Text size={100}>
                Manual reviews remain available when external AI is disabled.
              </Text>
              <Button
                appearance="primary"
                icon={
                  form.generateWithAi ? (
                    <Bot20Regular />
                  ) : (
                    <ClipboardTask20Regular />
                  )
                }
                disabled={
                  create.isPending ||
                  form.title.trim().length < 2 ||
                  form.instructions.trim().length < 5 ||
                  !form.documentId
                }
                onClick={() => create.mutate()}
              >
                {create.isPending
                  ? "Preparing review…"
                  : form.generateWithAi
                    ? "Create & review with AI"
                    : "Create manual review"}
              </Button>
            </footer>
          </div>
        ) : !selectedReview ? (
          <div className="feature-empty">
            <ClipboardTask20Regular />
            <h2>No review selected</h2>
            <Text>Create a review or choose one from the register.</Text>
          </div>
        ) : (
          <div className="review-detail">
            <header className="review-detail__header">
              <div>
                <div className="review-detail__badges">
                  <Badge
                    appearance="tint"
                    color={
                      selectedReview.workflow_state === "open"
                        ? "warning"
                        : "success"
                    }
                  >
                    {selectedReview.workflow_state}
                  </Badge>
                  <Badge appearance="outline">
                    {selectedReview.review_type.replaceAll("_", " ")}
                  </Badge>
                  {selectedReview.decision_code ? (
                    <Badge appearance="filled">
                      Code {selectedReview.decision_code}
                    </Badge>
                  ) : null}
                </div>
                <h2>{selectedReview.title}</h2>
                <Text>
                  {selectedReview.document_file_name ?? "No file attached"}
                  {selectedReview.reference_number
                    ? ` · ${selectedReview.reference_number}`
                    : ""}
                </Text>
              </div>
              <div className="review-detail__actions">
                {selectedDocument ? (
                  <Button
                    icon={<Chat20Regular />}
                    onClick={() => onDiscuss(selectedDocument)}
                  >
                    Discuss file
                  </Button>
                ) : null}
                <Button
                  appearance={
                    selectedReview.workflow_state === "open"
                      ? "primary"
                      : "secondary"
                  }
                  icon={<CheckmarkCircle20Regular />}
                  disabled={updateReview.isPending}
                  onClick={() =>
                    updateReview.mutate({
                      workflow_state:
                        selectedReview.workflow_state === "open"
                          ? "closed"
                          : "open",
                    })
                  }
                >
                  {selectedReview.workflow_state === "open"
                    ? "Close review"
                    : "Reopen"}
                </Button>
              </div>
            </header>

            <div className="review-decision-bar">
              <label className="native-field">
                <span>Consultant decision code</span>
                <select
                  value={selectedReview.decision_code ?? ""}
                  onChange={(event) =>
                    updateReview.mutate({
                      decision_code: event.target.value || null,
                    })
                  }
                >
                  <option value="">Decision pending</option>
                  {project.settings.review_codes.map((code) => (
                    <option key={code.code} value={code.code}>
                      Code {code.code} · {code.label}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <span>Due</span>
                <strong>
                  {selectedReview.due_at
                    ? new Date(selectedReview.due_at).toLocaleDateString()
                    : "No target"}
                </strong>
              </div>
              <div>
                <span>Discipline</span>
                <strong>{selectedReview.discipline ?? "Not specified"}</strong>
              </div>
              <div>
                <span>CRS comments</span>
                <strong>
                  {selectedSheet
                    ? `${String(selectedSheet.items.filter((item) => item.status === "open").length)} open / ${String(selectedSheet.items.length)} total`
                    : "Not created"}
                </strong>
              </div>
            </div>

            <section className="review-result-panel">
              <div className="panel-heading">
                <div>
                  <Text className="eyebrow">REVIEW DRAFT</Text>
                  <Text weight="semibold">AI-assisted findings</Text>
                </div>
                {selectedReview.conversation_id ? (
                  <Badge appearance="outline">Linked AI chat</Badge>
                ) : (
                  <Badge appearance="outline">Manual review</Badge>
                )}
              </div>
              <div className="review-result-copy">
                {selectedReview.result ||
                  "No AI draft was generated. Add controlled comments in the CRS below or update the review notes manually."}
              </div>
            </section>

            <section className="crs-panel">
              <header>
                <div>
                  <Text className="eyebrow">COMMENT REPLY SHEET</Text>
                  <h3>{selectedSheet?.title ?? "No CRS attached"}</h3>
                  <Text>
                    Track consultant comments, contractor replies, and final
                    closure row by row.
                  </Text>
                </div>
                {selectedSheet ? (
                  <Button
                    icon={<ArrowDownload20Regular />}
                    onClick={() => void exportSheet(selectedSheet)}
                  >
                    Export CSV
                  </Button>
                ) : selectedReview.document_id ? (
                  <Button
                    appearance="primary"
                    icon={<Add20Regular />}
                    disabled={createSheet.isPending}
                    onClick={() => createSheet.mutate()}
                  >
                    Create CRS
                  </Button>
                ) : null}
              </header>

              {selectedSheet ? (
                <>
                  <div className="crs-items">
                    {selectedSheet.items.map((item) => (
                      <CrsItemEditor
                        key={item.id}
                        item={item}
                        pending={updateItem.isPending || deleteItem.isPending}
                        onSave={(payload) =>
                          updateItem.mutate({ itemId: item.id, payload })
                        }
                        onDelete={() => deleteItem.mutate(item.id)}
                      />
                    ))}
                  </div>
                  <div className="crs-add-row">
                    <div>
                      <Text weight="semibold">Add consultant comment</Text>
                      <Text size={100}>
                        Each row remains open until the reply is accepted and
                        the comment is closed.
                      </Text>
                    </div>
                    <Input
                      value={newLocation}
                      placeholder="Location / clause"
                      onChange={(_, data) => setNewLocation(data.value)}
                    />
                    <Textarea
                      value={newComment}
                      placeholder="Enter a clear, actionable consultant comment"
                      resize="vertical"
                      onChange={(_, data) => setNewComment(data.value)}
                    />
                    <Button
                      appearance="primary"
                      icon={<Add20Regular />}
                      disabled={
                        addItem.isPending || newComment.trim().length < 2
                      }
                      onClick={() => addItem.mutate()}
                    >
                      Add to CRS
                    </Button>
                  </div>
                </>
              ) : (
                <div className="crs-empty">
                  <Document20Regular />
                  <Text>
                    No Comment Reply Sheet is attached to this review.
                  </Text>
                </div>
              )}
            </section>
          </div>
        )}

        {updateReview.isError || updateItem.isError || deleteItem.isError ? (
          <MessageBar intent="error">
            <MessageBarBody>
              A review or CRS change could not be saved. Your existing records
              were not removed.
            </MessageBarBody>
          </MessageBar>
        ) : null}
      </section>

      <aside className="review-context glass-surface">
        <Text className="eyebrow">DECISION CODES</Text>
        <div className="decision-code-list">
          {project.settings.review_codes.map((code) => (
            <div key={code.code}>
              <span>{code.code}</span>
              <Text>{code.label}</Text>
            </div>
          ))}
        </div>
        <div className="review-context__note">
          <CheckmarkCircle20Regular />
          <span>
            <Text weight="semibold">Close only after response</Text>
            <Text size={100}>
              A closed review stores the decision on the document. A new file
              revision reopens the workflow for assessment.
            </Text>
          </span>
        </div>
        <div className="review-context__note">
          <Bot20Regular />
          <span>
            <Text weight="semibold">Evidence before opinion</Text>
            <Text size={100}>
              AI review prioritizes the selected submission, then permanent
              project memory, then project-wide retrieval.
            </Text>
          </span>
        </div>
        {!settings.data?.external_ai_enabled ? (
          <Button icon={<Settings20Regular />} onClick={onOpenSettings}>
            Configure AI provider
          </Button>
        ) : null}
      </aside>
    </div>
  );
}
