import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  parseVocabLine,
  hookResult,
  loadCache,
  saveCache,
  createTranslateVocabHandler,
  type CallHaikuFn,
} from "./vocab.js";

describe("parseVocabLine", () => {
  test("正しい形式の行をパースする", () => {
    expect(
      parseVocabLine("ubiquitous — 🔧 ユビキタスな, 💬 どこにでもある"),
    ).toEqual({
      word: "ubiquitous",
      translation: "ubiquitous — 🔧 ユビキタスな, 💬 どこにでもある",
    });
  });

  test("単語を小文字化し translation は元の行を保持する", () => {
    expect(
      parseVocabLine("Ephemeral — 🔧 一時的な, 💬 はかない"),
    ).toEqual({
      word: "ephemeral",
      translation: "Ephemeral — 🔧 一時的な, 💬 はかない",
    });
  });

  test("形式不正の行は null を返す", () => {
    expect(parseVocabLine("just a normal sentence")).toBeNull();
  });

  test("前後の空白を除去してパースする", () => {
    expect(
      parseVocabLine("  ubiquitous — 🔧 ユビキタスな, 💬 どこにでもある  "),
    ).toEqual({
      word: "ubiquitous",
      translation: "ubiquitous — 🔧 ユビキタスな, 💬 どこにでもある",
    });
  });

  test("ハイフン付き単語を受容する", () => {
    expect(
      parseVocabLine("well-known — 🔧 よく知られた, 💬 有名な"),
    ).toEqual({
      word: "well-known",
      translation: "well-known — 🔧 よく知られた, 💬 有名な",
    });
  });

  test("数字始まりの行を拒否する", () => {
    expect(parseVocabLine("123abc — 🔧 テスト, 💬 テスト")).toBeNull();
  });
});

describe("hookResult", () => {
  test("MCP レスポンス形状にラップする", () => {
    const result = hookResult("test message");
    expect(result).toEqual({
      content: [{ type: "text", text: '{"systemMessage":"test message"}' }],
    });
  });

  test("systemMessage に特殊文字を含む場合も正しくエンコードされる", () => {
    const msg = '--- Vocab "test" ---\nnewline';
    const result = hookResult(msg);
    expect(JSON.parse(result.content[0].text).systemMessage).toBe(msg);
  });
});

describe("loadCache", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "vocab-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("ファイル未存在で空オブジェクトを返す", () => {
    expect(loadCache(join(dir, "nonexistent.json"))).toEqual({});
  });

  test("有効な JSON をパースして返す", () => {
    const path = join(dir, "cache.json");
    writeFileSync(path, JSON.stringify({ hello: "world" }));
    expect(loadCache(path)).toEqual({ hello: "world" });
  });

  test("不正な JSON で空オブジェクトを返す", () => {
    const path = join(dir, "bad.json");
    writeFileSync(path, "not json{{{");
    expect(loadCache(path)).toEqual({});
  });
});

describe("saveCache", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "vocab-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("JSON ファイルを作成し読み返し可能", () => {
    const path = join(dir, "cache.json");
    saveCache(path, { foo: "bar" });
    expect(JSON.parse(readFileSync(path, "utf-8"))).toEqual({ foo: "bar" });
  });

  test("既存ファイルを上書き可能", () => {
    const path = join(dir, "cache.json");
    saveCache(path, { old: "value" });
    saveCache(path, { new: "value" });
    expect(JSON.parse(readFileSync(path, "utf-8"))).toEqual({ new: "value" });
  });
});

function parseSystemMessage(result: { content: { text: string }[] }): string {
  return JSON.parse(result.content[0].text).systemMessage;
}

describe("createTranslateVocabHandler", () => {
  let dir: string;
  let cachePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "vocab-test-"));
    cachePath = join(dir, "vocab-cache.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("テキスト短すぎで callHaiku を呼ばずスキップ", async () => {
    const stub: CallHaikuFn = async () => {
      throw new Error("should not be called");
    };
    const handler = createTranslateVocabHandler(cachePath, stub);
    const result = await handler({ text: "short" });
    const msg = parseSystemMessage(result);
    expect(msg).toBe("--- Vocab: skipped (text too short) ---");
    expect(existsSync(cachePath)).toBe(false);
  });

  test("キャッシュ済み 8 語以上マッチで callHaiku を呼ばずキャッシュから返す", async () => {
    const words: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      const w = `word${i}`;
      words[w] = `${w} — 🔧 訳${i}, 💬 訳${i}`;
    }
    saveCache(cachePath, words);

    let called = false;
    const stub: CallHaikuFn = async () => {
      called = true;
      return "";
    };
    const handler = createTranslateVocabHandler(cachePath, stub);
    const text = Object.keys(words).join(" ").padEnd(30, " ");
    const msg = parseSystemMessage(await handler({ text }));

    expect(called).toBe(false);
    expect(msg).toStartWith("--- Vocab (cache) ---\n");
    expect(msg).toEndWith("\n---");
    const vocabLines = msg.split("\n").filter((l) => l.includes("—"));
    expect(vocabLines.length).toBe(8);
  });

  test("API 成功で新語をキャッシュに永続化する", async () => {
    const apiResponse =
      "ubiquitous — 🔧 ユビキタスな, 💬 どこにでもある\nephemeral — 🔧 一時的な, 💬 はかない";

    let receivedArgs: { text: string; knownWords: string[] } | null = null;
    const stub: CallHaikuFn = async (text, knownWords) => {
      receivedArgs = { text, knownWords };
      return apiResponse;
    };

    const handler = createTranslateVocabHandler(cachePath, stub);
    const inputText =
      "This is a sufficiently long text with ubiquitous and ephemeral words in it for testing.";
    const msg = parseSystemMessage(await handler({ text: inputText }));

    expect(msg).toMatch(/^--- Vocab \(\d+\.\d+s\) ---\n/);
    expect(msg).toContain(
      "ubiquitous — 🔧 ユビキタスな, 💬 どこにでもある",
    );
    expect(msg).toContain("ephemeral — 🔧 一時的な, 💬 はかない");
    expect(msg).toEndWith("\n---");

    const cached = JSON.parse(readFileSync(cachePath, "utf-8"));
    expect(cached).toEqual({
      ubiquitous: "ubiquitous — 🔧 ユビキタスな, 💬 どこにでもある",
      ephemeral: "ephemeral — 🔧 一時的な, 💬 はかない",
    });

    expect(receivedArgs).not.toBeNull();
    expect(receivedArgs!.knownWords).toEqual([]);
  });

  test("API が空行を返しキャッシュもなければ no difficult words", async () => {
    const stub: CallHaikuFn = async () => "";
    const handler = createTranslateVocabHandler(cachePath, stub);
    const msg = parseSystemMessage(
      await handler({
        text: "This is a sufficiently long text for testing purposes with no vocab.",
      }),
    );
    expect(msg).toMatch(/^--- Vocab \(\d+\.\d+s\): no difficult words ---$/);
    expect(existsSync(cachePath)).toBe(false);
  });

  test("API が不正行を返すがキャッシュ語ありなら cached 行を含む", async () => {
    saveCache(cachePath, {
      ubiquitous: "ubiquitous — 🔧 ユビキタスな, 💬 どこにでもある",
    });
    const stub: CallHaikuFn = async () => "invalid line without format";
    const handler = createTranslateVocabHandler(cachePath, stub);
    const msg = parseSystemMessage(
      await handler({
        text: "This text contains the word ubiquitous in a sufficiently long passage.",
      }),
    );

    expect(msg).toMatch(/^--- Vocab \(\d+\.\d+s\) ---\n/);
    expect(msg).toContain(
      "ubiquitous — 🔧 ユビキタスな, 💬 どこにでもある",
    );

    const cachedAfter = JSON.parse(readFileSync(cachePath, "utf-8"));
    expect(cachedAfter).toEqual({
      ubiquitous: "ubiquitous — 🔧 ユビキタスな, 💬 どこにでもある",
    });
  });

  test("API エラー時にエラーメッセージを返しキャッシュは書かない", async () => {
    const stub: CallHaikuFn = async () => {
      throw new Error("network failure");
    };
    const handler = createTranslateVocabHandler(cachePath, stub);
    const msg = parseSystemMessage(
      await handler({
        text: "This is a sufficiently long text for testing purposes with vocab.",
      }),
    );
    expect(msg).toBe("--- Vocab: error (network failure) ---");
    expect(existsSync(cachePath)).toBe(false);
  });

  test("API が 12 行返しても出力は 8 行に制限される", async () => {
    const lines = Array.from(
      { length: 12 },
      (_, i) => `word${i} — 🔧 訳${i}, 💬 意味${i}`,
    );
    const stub: CallHaikuFn = async () => lines.join("\n");
    const handler = createTranslateVocabHandler(cachePath, stub);
    const msg = parseSystemMessage(
      await handler({
        text: "This is a sufficiently long text for testing the maximum line limit.",
      }),
    );

    const vocabLines = msg.split("\n").filter((l) => l.includes("—"));
    expect(vocabLines.length).toBe(8);

    const cached = JSON.parse(readFileSync(cachePath, "utf-8"));
    expect(Object.keys(cached).length).toBe(12);
  });

  test("成功時に経過時間が含まれる", async () => {
    const stub: CallHaikuFn = async () =>
      "ubiquitous — 🔧 ユビキタスな, 💬 どこにでもある";
    const handler = createTranslateVocabHandler(cachePath, stub);
    const msg = parseSystemMessage(
      await handler({
        text: "This is a sufficiently long text for testing elapsed time display.",
      }),
    );
    expect(msg).toMatch(/^--- Vocab \(\d+\.\d+s\) ---$/m);
  });
});
