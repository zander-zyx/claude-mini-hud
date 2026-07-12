# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

claude-mini-hud is a minimal, zero-dependency Claude Code StatusLine plugin. It reads JSON from stdin (per the StatusLine contract) and outputs ANSI-colored status lines (context usage, token breakdown, current todo, optional model name). Multi-module architecture under `src/`.

## Commands

```bash
npm install          # Install dev dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode compilation
npm run typecheck    # Type-check tests (tsconfig.test.json, no emit)
npm test             # Full suite: build + typecheck + 57 tests
```

No linter is configured. Tests use Node.js built-in `node:test` + `node:assert/strict`, run via `tsx`.

## Architecture

**Multi-module design** — `src/` contains:

1. **index.ts** — Entry point, stdin reader, main() orchestrator
2. **types.ts** — Shared type definitions (`StdinData`, `TodoItem`, etc.)
3. **i18n.ts** — `STRINGS` object with `zh`/`en`/`minimal`/`ultra-minimal` keys, selected by `CLAUDE_MINI_HUD_LANG`
4. **colors.ts** — ANSI color helpers (zero-dependency)
5. **themes.ts** — Progress bar theme system (`ThemeConfig`), selected by `CLAUDE_MINI_HUD_THEME`
6. **render.ts** — All render functions (context, token, model, todo, usage)
7. **transcript.ts** — Transcript JSONL parser
8. **usage.ts** — Multi-platform usage/quota query (13 providers)

**Plugin integration** via `.claude-plugin/plugin.json` (registers the setup command) and `commands/setup.md` (interactive setup skill).

**Two tsconfig files** — `tsconfig.json` compiles only `src/` → `dist/`; `tsconfig.test.json` adds `tests/` with `noEmit: true`.

## Supported Platforms

| Platform | Detection | Query Method |
|----------|-----------|--------------|
| Claude native | `rate_limits` in stdin | stdin (no HTTP) |
| MiniMax | URL contains `minimaxi.com` / `minimax.io` | HTTP API |
| 智谱 (GLM) | URL contains `bigmodel.cn` / `z.ai` | HTTP API |
| 小米 (MiMo) | URL contains `xiaomimimo` | HTTP + Cookie (`XIAOMI_COOKIE`) |
| 阿里 (DashScope) | URL contains `dashscope` | Aliyun BSS OpenAPI (`ALIYUN_AK_ID`/`ALIYUN_AK_SECRET`) |
| 火山引擎 (Ark) | URL contains `volces.com` | Detection only (management API not integrated) |
| 百度千帆 (Qianfan) | URL contains `qianfan` / `baidubce` | No public API |
| 腾讯混元 (Hunyuan) | URL contains `hunyuan` | No public API |
| 讯飞星辰 (Astron) | URL contains `xfyun` / `spark-api` | Subscription (no API) |
| DeepSeek | URL contains `deepseek.com` | HTTP API |
| Kimi | URL contains `moonshot.cn` / `moonshot.ai` | HTTP API (`MOONSHOT_API_KEY` or proxy token) |
| 阶跃星辰 (StepFun) | URL contains `stepfun.com` / `stepfun.ai` | HTTP API |
| 硅基流动 (SiliconFlow) | URL contains `siliconflow.cn` / `siliconflow.com` | HTTP API |

## Key Design Constraints

- **Zero runtime dependencies** — only Node.js built-ins
- **Never crash Claude Code** — all errors caught, fallback message printed
- **Compiled output is lightweight** — `dist/` contains multi-module JS files, must stay small
- **Environment variables control behavior**: `CLAUDE_MINI_HUD_LANG` (zh/en/minimal/ultra-minimal), `CLAUDE_MINI_HUD_SHOW_MODEL` (1 to show model line), `CLAUDE_MINI_HUD_TOKEN_MODE` (session/context/both), `CLAUDE_MINI_HUD_THEME` (default/neon/braille/hardcore/minimal/pixel/diamond/arrow/wave/tide/dot/target/gradient/shades/retro/ascii/rail/star/spark/heart/love), `CLAUDE_MINI_HUD_MARKS` (same values, controls tool/agent icons independently)
- **Optional status lines**: `CLAUDE_MINI_HUD_SHOW_COST=1` (cost/duration/rate line from `stdin.cost`), `CLAUDE_MINI_HUD_SHOW_GIT=1` (branch/dirty/ahead-behind via spawned git with 500ms cache), `CLAUDE_MINI_HUD_WARN=0` (disable threshold alert line; default on, fires at context >=85% or any usage window >=90%), `CLAUDE_MINI_HUD_COMPACT=1` (single-line mode joining context% / usage / cost / todo / ETA with `|`)
- **Layout control**: `CLAUDE_MINI_HUD_LAYOUT` (comma-separated line names: context,token,usage,alert,todo,tools,agent,cost,git,model -- controls which lines render and in what order; default layout includes context+token, while explicit LAYOUT is followed exactly)
- **Context ETA & adaptive width**: progress bar width auto-adapts to terminal width (`COLUMNS`/`stdout.columns`); context line appends an estimated time-to-fill derived from a cached context fill rate
- **Provider credentials**: proxy mode uses `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`; direct Kimi uses `MOONSHOT_API_KEY`; Xiaomi uses `XIAOMI_COOKIE`; Alibaba (DashScope) balance uses Aliyun BSS OpenAPI (`ALIYUN_AK_ID`/`ALIYUN_AK_SECRET`, HMAC-SHA1 RPC signature; not the DashScope API key)
