# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

claude-mini-hud is a minimal, zero-dependency Claude Code StatusLine plugin. It reads JSON from stdin (per the StatusLine contract) and outputs ANSI-colored status lines (context usage, token breakdown, current todo, optional model name). Multi-module architecture under `src/`.

## Commands

```bash
npm install          # Install dev dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode compilation
npm run typecheck    # Type-check tests (tsconfig.test.json, no emit)
npm test             # Full suite: build + typecheck + 35 tests
```

No linter is configured. Tests use Node.js built-in `node:test` + `node:assert/strict`, run via `tsx`.

## Architecture

**Multi-module design** — `src/` contains:

1. **index.ts** — Entry point, stdin reader, main() orchestrator
2. **types.ts** — Shared type definitions (`StdinData`, `TodoItem`, etc.)
3. **i18n.ts** — `STRINGS` object with `zh`/`en`/`minimal` keys, selected by `CLAUDE_MINI_HUD_LANG`
4. **colors.ts** — ANSI color helpers (zero-dependency)
5. **themes.ts** — Progress bar theme system (`ThemeConfig`), selected by `CLAUDE_MINI_HUD_THEME`
6. **render.ts** — All render functions (context, token, model, todo, usage)
7. **transcript.ts** — Transcript JSONL parser
8. **usage.ts** — Multi-platform usage/quota query (8 providers)

**Plugin integration** via `.claude-plugin/plugin.json` (registers the setup command) and `commands/setup.md` (interactive setup skill).

**Two tsconfig files** — `tsconfig.json` compiles only `src/` → `dist/`; `tsconfig.test.json` adds `tests/` with `noEmit: true`.

## Supported Platforms

| Platform | Detection | Query Method |
|----------|-----------|--------------|
| Claude native | `rate_limits` in stdin | stdin (no HTTP) |
| MiniMax | URL contains `minimaxi.com` / `minimax.io` | HTTP API |
| 智谱 (GLM) | URL contains `bigmodel.cn` / `z.ai` | HTTP API |
| 小米 (MiMo) | URL contains `xiaomimimo` | HTTP + Cookie |
| 阿里 (DashScope) | URL contains `dashscope` | No public API |
| 火山引擎 (Ark) | URL contains `volces.com` | No public API |
| DeepSeek | URL contains `deepseek.com` | HTTP API |
| Kimi | URL contains `moonshot.cn` / `moonshot.ai` | HTTP API |

## Key Design Constraints

- **Zero runtime dependencies** — only Node.js built-ins
- **Never crash Claude Code** — all errors caught, fallback message printed
- **Compiled output is lightweight** — `dist/` contains multi-module JS files, must stay small
- **Environment variables control behavior**: `CLAUDE_MINI_HUD_LANG` (zh/en/minimal), `CLAUDE_MINI_HUD_SHOW_MODEL` (1 to show model line), `CLAUDE_MINI_HUD_TOKEN_MODE` (session/context/both), `CLAUDE_MINI_HUD_THEME` (default/neon/braille/hardcore/minimal/pixel/diamond/arrow/wave/tide/dot/target/gradient/shades/retro/ascii/rail/star/spark/heart/love), `CLAUDE_MINI_HUD_MARKS` (same values, controls tool/agent icons independently)
