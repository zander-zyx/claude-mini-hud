# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

claude-mini-hud is a minimal, zero-dependency Claude Code StatusLine plugin. It reads JSON from stdin (per the StatusLine contract) and outputs ANSI-colored status lines (context usage, token breakdown, current todo, optional model name). Single-file architecture: all source logic lives in `src/index.ts` (~440 lines).

## Commands

```bash
npm install          # Install dev dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode compilation
npm run typecheck    # Type-check tests (tsconfig.test.json, no emit)
npm test             # Full suite: build + typecheck + 13 smoke tests
```

No linter is configured. Tests use Node.js built-in `node:test` + `node:assert/strict`, run via `tsx`.

## Architecture

**Single-file design** — `src/index.ts` contains everything:

1. **i18n** — `STRINGS` object with `zh`/`en`/`minimal` keys, selected by `CLAUDE_MINI_HUD_LANG` env var
2. **Type contracts** — `StdinData`, `TodoItem`, `TranscriptEntry` interfaces
3. **ANSI colors** — Zero-dependency color helpers (no chalk)
4. **`readStdin()`** — Async stdin JSON reader with 500ms timeout, 256KB limit
5. **Render functions** — `renderContextLine()`, `renderTokenLine()`, `renderModelLine()`, `renderTodoLine()`
6. **`main()`** — Entry point, orchestrates render functions, catch-all error handler

**Plugin integration** via `.claude-plugin/plugin.json` (registers the setup command) and `commands/setup.md` (interactive setup skill that compiles and configures `~/.claude/settings.json`).

**Two tsconfig files** — `tsconfig.json` compiles only `src/` → `dist/`; `tsconfig.test.json` adds `tests/` with `noEmit: true` to avoid rootDir conflicts.

## Key Design Constraints

- **Zero runtime dependencies** — only Node.js built-ins (`node:fs/promises`, `node:child_process`)
- **Never crash Claude Code** — all errors caught, fallback message printed
- **Compiled output is a single file** — `dist/index.js`, must stay small
- **Environment variables control behavior**: `CLAUDE_MINI_HUD_LANG` (zh/en/minimal), `CLAUDE_MINI_HUD_SHOW_MODEL` (1 to show model line)
