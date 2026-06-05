import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "@/lib/ai/providers/openai";

function mockOpenAIResponse() {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 4, completion_tokens: 3 },
        model: "test-model"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  );

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function getRequestBody(fetchMock: ReturnType<typeof mockOpenAIResponse>) {
  const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
  return JSON.parse(init.body as string) as {
    messages: Array<{ role: string; content: string }>;
    response_format?: { type: string };
  };
}

describe("OpenAIProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds a JSON instruction when json_object mode is used without one", async () => {
    const fetchMock = mockOpenAIResponse();
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      model: "test-model"
    });

    await provider.complete([{ role: "user", content: "Return ok true." }]);

    const body = getRequestBody(fetchMock);

    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0]).toEqual({
      role: "system",
      content: "Return only a valid JSON object or JSON array. Do not include any other text."
    });
    expect(body.messages[1]).toEqual({
      role: "user",
      content: "Return ok true."
    });
  });

  it("keeps existing JSON instructions unchanged", async () => {
    const fetchMock = mockOpenAIResponse();
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      model: "test-model"
    });

    await provider.complete([
      {
        role: "system",
        content: "Sadece geçerli JSON döndür."
      },
      { role: "user", content: "Ping" }
    ]);

    const body = getRequestBody(fetchMock);

    expect(body.messages).toEqual([
      {
        role: "system",
        content: "Sadece geçerli JSON döndür."
      },
      { role: "user", content: "Ping" }
    ]);
  });
});
