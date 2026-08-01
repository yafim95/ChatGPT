import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Dropdown,
  Field,
  Input,
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
  ClipboardTask24Regular,
  Copy20Regular,
  DocumentText20Regular,
} from "@fluentui/react-icons";
import { api, ApiClientError } from "../../../api/client";
import { useAppLocale } from "../../../app/LocaleContext";
import type { Project, ReviewRecord, ReviewType } from "../../../types/api";

interface ReviewsSectionProps {
  project: Project;
  onOpenSettings: () => void;
}

const reviewLabels: Record<ReviewType, string> = {
  material_submittal: "Material submittal",
  method_statement: "Method statement / MSRA",
  itp: "Inspection and test plan",
  shop_drawing: "Shop drawing",
  technical_report: "Technical report",
  general: "General engineering review",
};

export function ReviewsSection({
  project,
  onOpenSettings,
}: ReviewsSectionProps): React.JSX.Element {
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<ReviewRecord>();
  const [title, setTitle] = useState("");
  const [reviewType, setReviewType] =
    useState<ReviewType>("material_submittal");
  const [instructions, setInstructions] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const reviews = useQuery({
    queryKey: ["reviews", project.id],
    queryFn: () => api.listReviews(project.id),
  });
  const activeReview = selected ?? reviews.data?.[0];

  const create = useMutation({
    mutationFn: () =>
      api.createReview(project.id, {
        title: title.trim(),
        review_type: reviewType,
        instructions: instructions.trim(),
      }),
    onSuccess: async (review) => {
      setSelected(review);
      setCreating(false);
      setTitle("");
      setInstructions("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reviews", project.id] }),
        queryClient.invalidateQueries({
          queryKey: ["project-summary", project.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
  const error =
    create.error instanceof ApiClientError ? create.error : undefined;
  const requiresSettings =
    error &&
    ["provider_key_required", "external_ai_disabled"].includes(error.code);

  if (creating) {
    return (
      <div className="review-create section-stack">
        <div className="section-heading">
          <div>
            <Text className="eyebrow">CONTROLLED WORKFLOW</Text>
            <Title3>New engineering review</Title3>
            <Text className="section-description">
              ProjectMind searches indexed project evidence and drafts concise
              source-linked comments. The result remains a draft for
              professional review.
            </Text>
          </div>
          <Button onClick={() => setCreating(false)}>Cancel</Button>
        </div>
        <Card className="form-card" appearance="outline">
          <div className="two-column-fields">
            <Field label="Review title" required>
              <Input
                value={title}
                placeholder="e.g. Roof sandwich panel MAR review"
                onChange={(_, data) => setTitle(data.value)}
              />
            </Field>
            <Field label="Review type" required>
              <Dropdown
                value={reviewLabels[reviewType]}
                selectedOptions={[reviewType]}
                onOptionSelect={(_, data) =>
                  data.optionValue &&
                  setReviewType(data.optionValue as ReviewType)
                }
              >
                {Object.entries(reviewLabels).map(([value, label]) => (
                  <Option key={value} value={value}>
                    {label}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </div>
          <Field
            label="Review scope and instructions"
            required
            hint="Describe what is being reviewed, the critical focus, and the preferred comment style."
          >
            <Textarea
              className="review-instructions"
              resize="vertical"
              value={instructions}
              placeholder="Review the proposed product against the indexed project specifications and Employer Requirements. Focus on authority approval, performance, warranty, sustainability, and project-specific structural calculations. Keep comments concise."
              onChange={(_, data) => setInstructions(data.value)}
            />
          </Field>
          <div className="review-template-grid">
            {[
              "Check compliance and identify missing evidence.",
              "Compare the submittal with current project requirements.",
              "Provide only critical consultant comments with source citations.",
            ].map((template) => (
              <button
                key={template}
                onClick={() =>
                  setInstructions(
                    (current) => `${current}${current ? "\n" : ""}${template}`,
                  )
                }
              >
                {template}
              </button>
            ))}
          </div>
          {create.isError ? (
            <MessageBar intent="error">
              <MessageBarBody>
                {error?.message ?? "The review could not be created."}
                {requiresSettings ? (
                  <Button appearance="transparent" onClick={onOpenSettings}>
                    Open AI settings
                  </Button>
                ) : null}
              </MessageBarBody>
            </MessageBar>
          ) : null}
          <div className="form-actions">
            <Button
              onClick={() => setCreating(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button
              appearance="primary"
              icon={<ClipboardTask24Regular />}
              disabled={
                title.trim().length < 2 ||
                instructions.trim().length < 5 ||
                create.isPending
              }
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Reviewing evidence…" : "Create draft review"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="section-stack">
      <div className="section-heading">
        <div>
          <Text className="eyebrow">ENGINEERING WORKFLOWS</Text>
          <Title3>Reviews</Title3>
          <Text className="section-description">
            Create and retain evidence-linked draft reviews for common
            construction deliverables.
          </Text>
        </div>
        <Button
          appearance="primary"
          icon={<Add20Regular />}
          onClick={() => setCreating(true)}
        >
          New review
        </Button>
      </div>
      {reviews.isPending ? (
        <div className="center-state">
          <Spinner label="Loading reviews…" />
        </div>
      ) : reviews.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>
            Saved reviews could not be loaded from the local service.
          </MessageBarBody>
        </MessageBar>
      ) : reviews.data.length ? (
        <div className="reviews-layout">
          <aside className="review-list surface-card">
            {reviews.data.map((review) => (
              <button
                key={review.id}
                className={
                  activeReview?.id === review.id
                    ? "review-list-item review-list-item--active"
                    : "review-list-item"
                }
                onClick={() => {
                  setSelected(review);
                  setCopied(false);
                  setCopyError(false);
                }}
              >
                <span className="review-list-item__icon">
                  <ClipboardTask24Regular />
                </span>
                <span>
                  <Text weight="semibold" truncate>
                    {review.title}
                  </Text>
                  <Text size={100}>
                    {reviewLabels[review.review_type]} ·{" "}
                    {new Date(review.updated_at).toLocaleDateString(locale)}
                  </Text>
                </span>
                <Badge appearance="tint">Draft</Badge>
              </button>
            ))}
          </aside>
          <article className="review-result surface-card">
            {activeReview ? (
              <>
                <header>
                  <div>
                    <Text className="eyebrow">
                      {reviewLabels[activeReview.review_type].toUpperCase()}
                    </Text>
                    <Title3>{activeReview.title}</Title3>
                    <Text className="muted-text">
                      Created{" "}
                      {new Date(activeReview.created_at).toLocaleString(locale)}{" "}
                      · {activeReview.sources.length} sources
                    </Text>
                  </div>
                  <Button
                    icon={<Copy20Regular />}
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(activeReview.result)
                        .then(() => {
                          setCopied(true);
                          setCopyError(false);
                        })
                        .catch(() => {
                          setCopied(false);
                          setCopyError(true);
                        })
                    }
                  >
                    {copied ? "Copied" : "Copy comments"}
                  </Button>
                </header>
                {copyError ? (
                  <MessageBar intent="error">
                    <MessageBarBody>
                      Windows did not allow clipboard access. Select the review
                      text and copy it manually.
                    </MessageBarBody>
                  </MessageBar>
                ) : null}
                <div className="review-result__content">
                  {activeReview.result}
                </div>
                {activeReview.sources.length ? (
                  <div className="review-sources">
                    <Text weight="semibold">
                      <DocumentText20Regular /> Evidence sources
                    </Text>
                    {activeReview.sources.map((source, index) => {
                      const item = source as {
                        reference?: string;
                        file_name?: string;
                        relative_path?: string;
                      };
                      return (
                        <div key={`${activeReview.id}-${String(index)}`}>
                          <Badge appearance="tint">
                            {item.reference ?? `S${String(index + 1)}`}
                          </Badge>
                          <span>
                            <Text weight="semibold">
                              {item.file_name ?? "Indexed document"}
                            </Text>
                            <Text size={100}>{item.relative_path ?? ""}</Text>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <MessageBar intent="warning">
                  <MessageBarBody>
                    Draft assistance only. Verify every comment against the
                    source documents and qualified professional judgment before
                    issuing.
                  </MessageBarBody>
                </MessageBar>
              </>
            ) : null}
          </article>
        </div>
      ) : (
        <div className="empty-state empty-state--large">
          <div className="empty-state__icon">
            <ClipboardTask24Regular />
          </div>
          <Title3>No engineering reviews yet</Title3>
          <Text>
            Create a source-linked draft for a material submittal, method
            statement, ITP, shop drawing, or technical report.
          </Text>
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            onClick={() => setCreating(true)}
          >
            Create first review
          </Button>
        </div>
      )}
    </div>
  );
}
