# english-vocab-hook

**Claude Code と会話するだけで英語力が上がるプラグイン**

アシスタントの応答から難しい英単語 (CEFR B2+) を自動抽出し、技術訳と一般訳を表示します。プログラミングしながら、いつの間にかボキャブラリーが増えていく体験を。

```
--- Vocab (1.2s) ---
  ephemeral — 🔧 一時的な, 💬 はかない
  ubiquitous — 🔧 ユビキタスな, 💬 どこにでもある
  idempotent — 🔧 冪等な, 💬 何度やっても同じ結果
---
```

## Install

```bash
claude plugin marketplace add hk-yakan/english-vocab-hook
claude plugin install english-vocab-hook
```

API キー不要 — Claude Code の認証をそのまま使います。

## How It Works

1. アシスタントが応答するたびに **Stop hook** が自動発火
2. MCP サーバが Haiku モデルに単語抽出を依頼
3. 🔧 技術/ドメイン訳 + 💬 一般訳 のペアでバナー表示
4. 翻訳済み単語はキャッシュされ、次回から即座に表示

```
Stop hook → vocab-mcp (MCP server) → Haiku → vocab-cache.json
                                                 ↓
                                          systemMessage banner
```

## Features

- **ゼロ設定**: インストールするだけで動く
- **デュアル翻訳**: 技術的な文脈と日常的な意味の両方を表示
- **キャッシュ**: 一度調べた単語は即座に返る。8 語以上キャッシュヒットなら API 呼び出しゼロ
- **軽量**: MCP サーバとして常駐するためコールドスタートなし

## Development

[Nix](https://nixos.org/) と [devenv](https://devenv.sh/) が必要です。

```bash
devenv shell                    # bun, lefthook, gitleaks が揃う
cd vocab-mcp && bun test        # 21 tests
tsc --noEmit                    # type check
```

## License

MIT
