import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mkdirSync } from "fs";
import { join } from "path";
import { createTranslateVocabHandler } from "./vocab.js";

const dataDir =
  process.env.CLAUDE_PLUGIN_DATA ??
  join(process.env.CLAUDE_PLUGIN_ROOT ?? ".", "data");
mkdirSync(dataDir, { recursive: true });
const cachePath = join(dataDir, "vocab-cache.json");

const vocabSystemPrompt = `You are a vocabulary helper for a Japanese software engineer. From the following English text, extract up to 8 difficult words (CEFR B2+ level) that a Japanese intermediate learner would not know. Skip common words, programming keywords, proper nouns.
IMPORTANT: Also skip any words listed in the "Already known" section below.

For each word, provide both a technical/domain Japanese translation and a general Japanese translation. All translations MUST be in Japanese. Output ONLY this format (no other text):
word — 🔧 技術的な日本語訳, 💬 一般的な日本語訳

If no difficult words, output nothing.`;

const queryOpts = {
  model: "haiku",
  maxTurns: 1,
  persistSession: false,
  settingSources: [] as ("user" | "project" | "local")[],
};

async function callHaiku(
  text: string,
  knownWords: string[],
): Promise<string> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  let result = "";

  const knownSection =
    knownWords.length > 0
      ? `\n\nAlready known (skip these): ${knownWords.join(", ")}`
      : "";

  for await (const message of query({
    prompt: `Text:\n${text.slice(0, 2000)}${knownSection}`,
    options: { ...queryOpts, systemPrompt: vocabSystemPrompt },
  })) {
    if (
      "result" in message &&
      typeof (message as any).result === "string"
    ) {
      result = (message as any).result;
    }
  }

  return result;
}

const server = new McpServer({ name: "vocab-mcp", version: "1.0.0" });

server.tool(
  "translate_vocab",
  "Extract difficult English words and provide Japanese translations",
  { text: z.string().describe("English text to extract vocabulary from") },
  createTranslateVocabHandler(cachePath, callHaiku),
);

const transport = new StdioServerTransport();
await server.connect(transport);
