import OpenAI from "openai";

type ProviderRequest = {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  structured: boolean;
  maxTokens: number;
  validate: (content: string) => boolean;
};

type Provider = {
  name: string;
  apiKey: string;
  model: string;
  baseURL: string;
  extraBody?: Record<string, unknown>;
};

const PROVIDER_TIMEOUT_MS = 120_000;
type ProviderHealth = { failures: number; blockedUntil: number };
const providerHealth = ((globalThis as typeof globalThis & { futureAtlasProviderHealth?: Map<string, ProviderHealth> }).futureAtlasProviderHealth ??= new Map());

function errorDetails(error: unknown) {
  if (!(error instanceof Error)) return { name: "UnknownError" };
  const status = "status" in error && typeof error.status === "number" ? error.status : undefined;
  return { name: error.name, status };
}

function configuredProviders(): Provider[] {
  const providers: Record<string, Provider | undefined> = {
    custom: process.env.AI_API_KEY && process.env.AI_BASE_URL && process.env.AI_MODEL ? {
      name: process.env.AI_PROVIDER_NAME?.trim() || "Custom AI",
      apiKey: process.env.AI_API_KEY.trim(),
      baseURL: process.env.AI_BASE_URL.trim(),
      model: process.env.AI_MODEL.trim(),
    } : undefined,
    nvidia: process.env.NVIDIA_API_KEY ? {
      name: "NVIDIA Nemotron Lightning",
      apiKey: process.env.NVIDIA_API_KEY.trim(),
      baseURL: "https://integrate.api.nvidia.com/v1",
      model: process.env.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3.5-lightning-30b-a3b",
      extraBody: { chat_template_kwargs: { enable_thinking: false } },
    } : undefined,
    openrouter: process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_MODEL ? {
      name: "OpenRouter",
      apiKey: process.env.OPENROUTER_API_KEY.trim(),
      baseURL: "https://openrouter.ai/api/v1",
      model: process.env.OPENROUTER_MODEL.trim(),
    } : undefined,
    openai: process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL ? {
      name: "OpenAI",
      apiKey: process.env.OPENAI_API_KEY.trim(),
      baseURL: "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL.trim(),
    } : undefined,
    deepseek: process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_MODEL ? {
      name: "DeepSeek",
      apiKey: process.env.DEEPSEEK_API_KEY.trim(),
      baseURL: "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL.trim(),
    } : undefined,
  };
  const order = (process.env.AI_PROVIDER_ORDER || "custom,nvidia,openrouter,openai,deepseek")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const maxAttempts = Math.max(1, Math.min(3, Number(process.env.AI_MAX_PROVIDER_ATTEMPTS) || 2));
  const configured = order.map((name) => providers[name]).filter((provider): provider is Provider => Boolean(provider));
  if (!configured.length) throw new Error("No AI provider is configured.");
  return configured.slice(0, maxAttempts);
}

async function runProvider(provider: Provider, request: ProviderRequest, signal: AbortSignal) {
  const health = providerHealth.get(provider.name);
  if (health && health.blockedUntil > Date.now()) throw new Error(`${provider.name} circuit is open.`);
  const startedAt = Date.now();
  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    timeout: PROVIDER_TIMEOUT_MS,
    maxRetries: 0,
  });

  try {
    const completion = await client.chat.completions.create({
      model: provider.model,
      messages: request.messages,
      temperature: request.structured ? 0.2 : 0.5,
      top_p: 0.95,
      max_tokens: request.maxTokens,
      response_format: request.structured ? { type: "json_object" } : undefined,
      ...provider.extraBody,
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, { signal });
    const content = completion.choices[0]?.message?.content?.trim();

    if (completion.choices[0]?.finish_reason === "length" || !content || !request.validate(content)) {
      throw new Error(`${provider.name} returned an invalid response.`);
    }

    console.log(`[AI] ${provider.name} completed in ${Date.now() - startedAt}ms`);
    providerHealth.delete(provider.name);
    return { content, provider: provider.name };
  } catch (error) {
    const failures = (providerHealth.get(provider.name)?.failures || 0) + 1;
    providerHealth.set(provider.name, { failures, blockedUntil: failures >= 3 ? Date.now() + 30_000 : 0 });
    console.warn(JSON.stringify({
      event: "ai_provider_failed",
      provider: provider.name,
      durationMs: Date.now() - startedAt,
      ...errorDetails(error),
    }));
    throw error;
  }
}

export async function requestAI(request: ProviderRequest) {
  let lastError: unknown;
  for (const provider of configuredProviders()) {
    try {
      return await runProvider(provider, request, AbortSignal.timeout(PROVIDER_TIMEOUT_MS));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No AI provider completed the request.");
}
