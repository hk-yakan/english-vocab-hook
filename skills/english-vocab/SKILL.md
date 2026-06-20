---
name: english-vocab
description: アシスタント応答から難しい英単語(CEFR B2+)を自動抽出し、技術訳と一般訳をバナー表示する英単語学習スキル。
disable-model-invocation: true
allowed-tools:
  - mcp__plugin_english-vocab-hook_vocab-mcp__translate_vocab
hooks:
  Stop:
    - matcher: ""
      hooks:
        - type: mcp_tool
          server: "plugin:english-vocab-hook:vocab-mcp"
          tool: translate_vocab
          input:
            text: "${last_assistant_message}"
          timeout: 60
---

# English Vocab

アシスタントの応答から難しい英単語 (CEFR B2+) を自動抽出し、技術訳と一般訳をバナー表示するスキル。

## 出力形式

```
--- Vocab (1.2s) ---
  ephemeral — 🔧 一時的な, 💬 はかない
  ubiquitous — 🔧 ユビキタスな, 💬 どこにでもある
---
```

各単語に対して 🔧 技術/ドメイン訳と 💬 一般訳のペアを表示する。最大 8 語まで。翻訳済み単語はキャッシュされ、次回から即座に表示される。
