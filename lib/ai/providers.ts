import OpenAI from "openai";

type ProviderRequest = {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  structured: boolean;
  maxTokens: number;
  validate: (content: string) => boolean;
};

type Provider = {
  name: string;
  delayMs: number;
  apiKey: string;
  model: string;
};

const PROVIDER_TIMEOUT_MS = 25_000;

function configuredProviders(): Provider[] {
  const candidates = [
    {
      name: "NVIDIA Nemotron Lightning",
      delayMs: 0,
      apiKey: process.env.NVIDIA_API_KEY,
      model: process.env.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3.5-lightning-30b-a3b",
    },
    {
      name: "NVIDIA Gemma 4",
      delayMs: 4_500,
      apiKey:
        process.env.NVIDIA_FALLBACK_API_KEY_1 ||
        process.env.DIFFUSSIONGEMMA_API_KEY,
      model: "google/gemma-4-31b-it",
    },
    {
      name: "NVIDIA Mistral Nemotron",
      delayMs: 7_000,
      apiKey:
        process.env.NVIDIA_FALLBACK_API_KEY_2 || process.env.MUSE_API_KEY,
      model: "mistralai/mistral-nemotron",
    },
  ];

  return candidates
    .filter((provider): provider is Provider => typeof provider.apiKey === "string" && provider.apiKey.trim().length > 0)
    .map((provider) => ({ ...provider, apiKey: provider.apiKey.trim() }));
}

function waitFor(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

async function runProvider(provider: Provider, request: ProviderRequest, signal: AbortSignal) {
  await waitFor(provider.delayMs, signal);
  const startedAt = Date.now();
  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
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
      chat_template_kwargs: { enable_thinking: false },
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, { signal });
    const content = completion.choices[0]?.message?.content?.trim();

    if (!content || !request.validate(content)) {
      throw new Error(`${provider.name} returned an invalid response.`);
    }

    console.log(`[AI] ${provider.name} completed in ${Date.now() - startedAt}ms`);
    return { content, provider: provider.name };
  } catch (error) {
    console.warn(`[AI] ${provider.name} failed after ${Date.now() - startedAt}ms`, error);
    throw error;
  }
}

export async function requestAI(request: ProviderRequest) {
  const providers = configuredProviders();

  if (!providers.length) throw new Error("No NVIDIA AI provider credentials are configured.");

  const controllers = providers.map(() => new AbortController());

  try {
    const winner = await Promise.any(
      providers.map((provider, index) => runProvider(provider, request, controllers[index].signal))
    );
    controllers.forEach((controller) => controller.abort());
    return winner;
  } catch {
    throw new Error("All configured NVIDIA AI providers failed.");
  }
}
