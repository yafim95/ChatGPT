import { describe, expect, it, vi } from "vitest";
import { api } from "./client";

vi.mock("./bootstrap", () => ({
  getBackendBootstrap: vi.fn().mockResolvedValue({
    baseUrl: "http://127.0.0.1:9999",
    sessionToken: "test-token",
    managed: false,
  }),
}));

describe("API client", () => {
  it("adds the launch token to local service requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          version: "0.3.0",
          database: "ok",
          environment: "test",
          timestamp: "2026-07-18T00:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await api.health();

    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request[0]).toBe("http://127.0.0.1:9999/api/health");
    expect(new Headers(request[1].headers).get("X-ProjectMind-Session")).toBe(
      "test-token",
    );
  });

  it("normalizes the backend error envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "conflict",
            message: "Project number already exists.",
            details: [],
            trace_id: "trace-1",
          },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    const request = api.createProject({
      name: "Test",
      project_number: "P-001",
    });
    await expect(request).rejects.toMatchObject({
      code: "conflict",
      status: 409,
      traceId: "trace-1",
    });
  });

  it("sends explicit review files and project-memory preference with chat", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          conversation_id: "conversation-1",
          message: "Evidence-linked answer",
          sources: [],
          model: "kimi-k3",
          local_only: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await api.askProject(
      "project-1",
      "Review this file",
      "evidence",
      undefined,
      {
        documentIds: ["document-1"],
        includeCoreMemory: true,
      },
    );

    const request = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request[0]).toBe(
      "http://127.0.0.1:9999/api/projects/project-1/chat",
    );
    expect(JSON.parse(request[1].body as string)).toMatchObject({
      message: "Review this file",
      mode: "evidence",
      document_ids: ["document-1"],
      include_core_memory: true,
    });
  });
});
