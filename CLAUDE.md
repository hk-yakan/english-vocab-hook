# CLAUDE.md

## Project

Claude Code plugin: english-vocab-hook. Extracts difficult English vocabulary from assistant responses and displays Japanese translations.

## Architecture

- `vocab-mcp/src/vocab.ts` — Core logic: parsing, caching, handler factory (testable, no side effects)
- `vocab-mcp/src/index.ts` — MCP server wiring shell (env vars, Agent SDK, transport)
- `hooks/hooks.json` — Stop hook, `mcp_tool` type calling `translate_vocab`
- `.mcp.json` — MCP server launch config. `args` field passes `${CLAUDE_PLUGIN_DATA}` for cache dir
- `scripts/start_vocab-mcp.sh` — Bootstrap script (bun install + exec)

## Key Constraints

- Agent SDK (`@anthropic-ai/claude-agent-sdk`) for Haiku calls — reuses Claude Code auth, no API key
- Cache at `${CLAUDE_PLUGIN_DATA}/vocab-cache.json` — テキスト中にキャッシュ済み単語が8個以上見つかれば Haiku 呼び出しをスキップ
- `${CLAUDE_PLUGIN_DATA}` must be passed via `.mcp.json` `args` field (not `env` — env does not expand template variables)

## Development / Testing

@README.md
