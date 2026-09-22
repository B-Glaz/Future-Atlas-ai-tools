import OpenAI from "openai";

type ProviderRequest = {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  structured: boolean;
  maxTokens: number;
  validate: (content: string) => boolean;
  onAttemptStart?: () => void;
  onChunk?: (text: string) => void;
};

type Provider = {
  name: string;
  apiKey: string;
  model: string;
  baseURL: string;
  extraBody?: Record<string, unknown>;
};

type ProviderHealth = { failures: number; blockedUntil: number };
const providerHealth = ((globalThis as typeof globalThis & { futureAtlasProviderHealth?: Map<string, ProviderHealth> }).futureAtlasProviderHealth ??= new Map());

function timeoutError() {
  return new DOMException("The operation was aborted due to timeout", "TimeoutError");
}

function createStreamingSignal() {
  const idleMs = Math.max(1, Number(process.env.AI_PROVIDER_IDLE_TIMEOUT_MS) || 40_000);
  const overallMs = Math.max(idleMs, Number(process.env.AI_PROVIDER_TIMEOUT_MS) || 120_000);
  const controller = new AbortController();
  const startedAt = Date.now();
  let idleTimer: ReturnType<typeof setTimeout>;

  const abort = () => {
    if (!controller.signal.aborted) controller.abort(timeoutError());
  };

  const touch = () => {
    clearTimeout(idleTimer);
    const remaining = Math.max(1, overallMs - (Date.now() - startedAt));
    idleTimer = setTimeout(abort, Math.min(idleMs, remaining));
  };

  const overallTimer = setTimeout(abort, overallMs);
  controller.signal.addEventListener("abort", () => {
    clearTimeout(idleTimer);
    clearTimeout(overallTimer);
  });

  return {
    signal: controller.signal,
    touch,
    dispose: () => {
      clearTimeout(idleTimer);
      clearTimeout(overallTimer);
    },
  };
}

function errorDetails(error: unknown) {
  if (!(error instanceof Error)) return { name: "UnknownError" };
  const status = "status" in error && typeof error.status === "number" ? error.status : undefined;
  return { name: error.name, status, message: error.message.slice(0, 180) };
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

async function runProvider(provider: Provider, request: ProviderRequest) {
  const health = providerHealth.get(provider.name);
  if (health && health.blockedUntil > Date.now()) throw new Error(`${provider.name} circuit is open.`);
  const startedAt = Date.now();
  const { signal, touch, dispose } = createStreamingSignal();
  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    timeout: Math.max(1, Number(process.env.AI_PROVIDER_TIMEOUT_MS) || 120_000),
    maxRetries: 0,
  });

  try {
    const stream = await client.chat.completions.create(
      {
        model: provider.model,
        messages: request.messages,
        temperature: request.structured ? 0.2 : 0.5,
        top_p: 0.95,
        max_tokens: request.maxTokens,
        stream: true,
        ...provider.extraBody,
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
      { signal }
    );

    let content = "";
    let finishReason: string | null = null;

    for await (const chunk of stream) {
      touch();
      const text = chunk.choices[0]?.delta?.content || "";
      if (text) {
        content += text;
        request.onChunk?.(text);
      }
      finishReason = chunk.choices[0]?.finish_reason || finishReason;
    }

    if (signal.aborted) throw timeoutError();

    content = content.trim();

    if (finishReason === "length") {
      throw new Error(`${provider.name} response was cut off.`);
    }
    if (!content || !request.validate(content)) {
      throw new Error(`${provider.name} returned an invalid response.`);
    }

    console.log(`[AI] ${provider.name} completed in ${Date.now() - startedAt}ms`);
    providerHealth.delete(provider.name);
    return { content, provider: provider.name };
  } catch (caught) {
    const error = signal.aborted ? timeoutError() : caught;
    const failures = (providerHealth.get(provider.name)?.failures || 0) + 1;
    providerHealth.set(provider.name, { failures, blockedUntil: failures >= 3 ? Date.now() + 30_000 : 0 });
    console.warn(JSON.stringify({
      event: "ai_provider_failed",
      provider: provider.name,
      durationMs: Date.now() - startedAt,
      ...errorDetails(error),
    }));
    throw error;
  } finally {
    dispose();
  }
}

export async function requestAI(request: ProviderRequest) {
  let lastError: unknown;
  for (const provider of configuredProviders()) {
    request.onAttemptStart?.();
    try {
      return await runProvider(provider, request);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No AI provider completed the request.");
}
