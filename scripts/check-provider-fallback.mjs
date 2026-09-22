import assert from "node:assert/strict";
import { encodeSseEvent, parseSseBuffer } from "../lib/ai/sse.ts";

const encoded = `${encodeSseEvent("delta", { text: "Hel" })}${encodeSseEvent("delta", { text: "lo" })}${encodeSseEvent("done", { response: "Hello" })}`;
const first = parseSseBuffer(encoded.slice(0, 24));
const second = parseSseBuffer(first.rest + encoded.slice(24));
assert.equal(second.events.at(-1)?.event, "done");
assert.deepEqual(second.events.find((item) => item.event === "done")?.data, { response: "Hello" });

process.env.AI_API_KEY = "test";
process.env.AI_BASE_URL = "https://first.invalid/v1";
process.env.AI_MODEL = "first";
process.env.NVIDIA_API_KEY = "test";
process.env.AI_PROVIDER_ORDER = "custom,nvidia";
process.env.AI_MAX_PROVIDER_ATTEMPTS = "2";

let calls = 0;
globalThis.fetch = async () => {
  calls += 1;
  const content = calls === 1 ? "" : "valid fallback";
  return new Response(`data: {"choices":[{"delta":{"content":"${content}"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
};

const { requestAI } = await import("../lib/ai/providers.ts");
const chunks = [];
const result = await requestAI({
  messages: [{ role: "user", content: "test" }],
  structured: false,
  maxTokens: 20,
  validate: Boolean,
  onChunk: (text) => chunks.push(text),
});
assert.equal(result.content, "valid fallback");
assert.equal(result.provider, "NVIDIA Nemotron Lightning");
assert.equal(calls, 2);
assert.deepEqual(chunks, ["valid fallback"]);
console.log("Provider fallback contract passed.");
