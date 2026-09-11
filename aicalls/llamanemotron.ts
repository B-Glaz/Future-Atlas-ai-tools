import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "<OPENROUTER_API_KEY>",
  defaultHeaders: {
    "HTTP-Referer": "<YOUR_SITE_URL>", // Optional. Site URL for rankings on openrouter.ai.
    "X-OpenRouter-Title": "<YOUR_SITE_NAME>", // Optional. Site title for rankings on openrouter.ai.
  },
});

async function main() {
  // Image input embeddings use multimodal content format
  const embedding = await openai.embeddings.create({
    model: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    input: [
      {
        content: [
          { type: "text", text: "What is in this image?" },
          { type: "image_url", image_url: { url: "https://live.staticflickr.com/3851/14825276609_098cac593d_b.jpg" } }
        ]
      }
    ] as unknown as string[],
    encoding_format: "float"
  });

  console.log(embedding.data[0].embedding.slice(0, 5));
}

main();