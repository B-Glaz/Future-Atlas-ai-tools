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
};

const PROVIDER_TIMEOUT_MS = 25_000;

function errorDetails(error: unknown) {
  if (!(error instanceof Error)) return { name: "UnknownError" };
  const status = "status" in error && typeof error.status === "number" ? error.status : undefined;
  return { name: error.name, status };
}

function configuredProvider(): Provider {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not configured.");
  return {
    name: "NVIDIA Nemotron Lightning",
    apiKey,
    model: process.env.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3.5-lightning-30b-a3b",
  };
}

async function runProvider(provider: Provider, request: ProviderRequest, signal: AbortSignal) {
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
  const controller = new AbortController();
  return runProvider(configuredProvider(), request, controller.signal);
}
