import assert from "node:assert/strict";

process.env.AI_API_KEY = "test";
process.env.AI_BASE_URL = "https://first.invalid/v1";
process.env.AI_MODEL = "first";
process.env.NVIDIA_API_KEY = "test";
process.env.AI_PROVIDER_ORDER = "custom,nvidia";
process.env.AI_MAX_PROVIDER_ATTEMPTS = "2";

let calls = 0;
globalThis.fetch = async () => {
  calls += 1;
  return new Response(JSON.stringify({
    id: "test", object: "chat.completion", created: 0, model: "test",
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: calls === 1 ? "" : "valid fallback" } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};

const { requestAI } = await import("../lib/ai/providers.ts");
const result = await requestAI({ messages: [{ role: "user", content: "test" }], structured: false, maxTokens: 20, validate: Boolean });
assert.equal(result.content, "valid fallback");
assert.equal(result.provider, "NVIDIA Nemotron Lightning");
assert.equal(calls, 2);
console.log("Provider fallback contract passed.");
