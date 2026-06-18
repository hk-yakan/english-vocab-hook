import { readFileSync, writeFileSync } from "fs";

export type VocabCache = Record<string, string>;

export const vocabLineRe = /^([a-zA-Z][\w-]*)\s*—\s*🔧\s*.+,\s*💬\s*.+$/;

export function parseVocabLine(
  line: string,
): { word: string; translation: string } | null {
  const trimmed = line.trim();
  if (!vocabLineRe.test(trimmed)) return null;
  const idx = trimmed.indexOf("—");
  const word = trimmed.slice(0, idx).trim().toLowerCase();
  return { word, translation: trimmed };
}

export function hookResult(systemMessage: string) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify({ systemMessage }) },
    ],
  };
}

export function loadCache(cachePath: string): VocabCache {
  try {
    return JSON.parse(readFileSync(cachePath, "utf-8"));
  } catch {
    return {};
  }
}

export function saveCache(cachePath: string, cache: VocabCache): void {
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

export type CallHaikuFn = (
  text: string,
  knownWords: string[],
) => Promise<string>;

export function asciiRatio(text: string): number {
  if (text.length === 0) return 0;
  let ascii = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 128) ascii++;
  }
  return ascii / text.length;
}

export function createTranslateVocabHandler(
  cachePath: string,
  callHaiku: CallHaikuFn,
) {
  return async ({ text }: { text: string }) => {
    if (text.length < 30) {
      return hookResult("--- Vocab: skipped (text too short) ---");
    }

    if (asciiRatio(text) < 0.5) {
      return hookResult("--- Vocab: skipped (non-English text) ---");
    }

    const cache = loadCache(cachePath);
    const textLower = text.toLowerCase();
    const cachedLines: string[] = [];
    const knownWords: string[] = [];

    for (const [word, translation] of Object.entries(cache)) {
      knownWords.push(word);
      if (textLower.includes(word)) {
        cachedLines.push(`  ${translation}`);
      }
    }

    if (cachedLines.length >= 8) {
      return hookResult(
        `--- Vocab (cache) ---\n${cachedLines.slice(0, 8).join("\n")}\n---`,
      );
    }

    try {
      const t0 = performance.now();
      const result = await callHaiku(text, knownWords);
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

      const newLines: string[] = [];
      for (const line of result.split("\n")) {
        const parsed = parseVocabLine(line);
        if (parsed) {
          newLines.push(`  ${parsed.translation}`);
          cache[parsed.word] = parsed.translation;
        }
      }

      if (newLines.length > 0) {
        saveCache(cachePath, cache);
      }

      const allLines = [...cachedLines, ...newLines].slice(0, 8);

      if (allLines.length === 0) {
        return hookResult(`--- Vocab (${elapsed}s): no difficult words ---`);
      }

      return hookResult(
        `--- Vocab (${elapsed}s) ---\n${allLines.join("\n")}\n---`,
      );
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      return hookResult(`--- Vocab: error (${err}) ---`);
    }
  };
}
