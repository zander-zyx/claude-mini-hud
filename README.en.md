# 📊 claude-mini-hud

> Claude Code statusline — context / token / todos / tools / agents + deep multi-provider usage (lightweight claude-hud alternative)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-blue)
![Language: TS](https://img.shields.io/badge/TypeScript-ES2022-blue)
![StatusLine](https://img.shields.io/badge/Claude_Code-StatusLine-blueviolet)

[简体中文](./README.md) · [English](#) · [Installation](#installation) · [FAQ](#faq) · [Contributing](#contributing)

---

## What is this?

**claude-mini-hud** is a [Claude Code](https://docs.claude.com/en/docs/claude-code) StatusLine plugin that continuously displays key session metrics below your input field. **Up to 7 lines**, high information density — a lighter alternative to [claude-hud](https://github.com/jarrodwatts/claude-hud).

### Preview

**Chinese (zh, default)** — full Chinese + emoji:
```
📊 上下文 ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
🪙 Token 4.8M (入 3.5M · 出 1.2M · 缓存 103k · ⚡ 45 tok/s)
▶️  当前任务 ▸ 正在写 skill  (1/4)
  ◐ 读取 index.ts
  ◐ 写入 utils.ts
  ✓ 搜索 ×3  ✓ 执行 ×1
  [Explore] ◐ 搜索相关代码 2m 15s
🤖 模型 deepseek-v4-pro  [deepseek]
```

**English (en)**:
```
📊 Context ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  left 900k
🪙 Token 4.8M (in 3.5M · out 1.2M · cache 103k · ⚡ 45 tok/s)
▶️ Todos   ▸ Writing skill  (1/4)
  ◐ reading index.ts
  ◐ writing utils.ts
  ✓ searching ×3  ✓ running ×1
  [Explore] ◐ Searching code 2m 15s
🤖 Model deepseek-v4-pro  [deepseek]
```

**Minimal (minimal)** — English-Chinese hybrid + no emoji:
```
 Context ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
 Token 4.8M (in 3.5M · out 1.2M · cache 103k · ⚡ 45 tok/s)
 当前任务 ▸ 正在写 skill  (1/4)
  ◐ reading index.ts
  ◐ writing utils.ts
  ✓ searching ×3  ✓ running ×1
  [Explore] ◐ Searching code 2m 15s
```

Switch with: `CLAUDE_MINI_HUD_LANG=zh|en|minimal` (see [Configuration](#configuration))

**Key Features**:
- ⚡ **Zero Dependencies**: Multi-module TypeScript architecture, lightweight compiled output
- 🌍 **Three Languages**: Chinese / English / Minimal (hybrid)
- 🔧 **Tool Activity**: Real-time file reads/writes, searches, command execution (◐ running / ✓ completed ×N)
- 🤖 **Agent Tracking**: Shows active sub-agents and their duration
- 🔥 **Token Speed**: Real-time decoding speed (tok/s)
- 📊 **Token Modes**: Session cumulative / context snapshot / both — three switchable modes
- 🚀 **~10ms Startup**: Won't slow down Claude Code
- 🔌 **Plug & Play**: Just run `/claude-mini-hud:setup`

### Multi-Platform Usage / Balance Query

Automatically detects your platform based on `ANTHROPIC_BASE_URL` and shows usage/balance in real time:

| Platform | Detection | Display Format |
|----------|-----------|----------------|
| **Claude Native** | `rate_limits` has data | `5h:45% (1h30m) 7d:12%` |
| **MiniMax** | URL contains `minimaxi.com` | `5h:55% 7d:74% m:50% (26d)` |
| **Zhipu (GLM)** | URL contains `bigmodel.cn` | `5h:21% (1h54m) 7d:26% m:30% (26d) mcp:20/1000` |
| **Xiaomi (MiMo)** | URL contains `xiaomimimo` | `50M/100M m:45% (26d)` |
| **Alibaba (DashScope)** | URL contains `dashscope` | Platform detection only (no public usage API) |
| **Volcengine (Ark)** | URL contains `volces.com` | Platform detection only (no public usage API) |
| **DeepSeek** | URL contains `deepseek.com` | `¥123.45` (account balance) |
| **Kimi** | URL contains `moonshot.cn` | `¥42.50 (granted ¥10.00)` |
| **New API** | Other non-Anthropic URLs | `500k (used 123k 25%)` |

#### Usage Display Format Reference

| Tag | Meaning | Example |
|-----|---------|---------|
| `5h:` | 5-hour window usage | `5h:19% (1h54m)` — 19% used, resets in 1h54m |
| `7d:` | 7-day (weekly) usage | `7d:26% (5d7h)` — 26% used, resets in 5d7h |
| `m:` | Monthly usage | `m:30% (26d)` — 30% used, resets in 26 days (days only) |
| `mcp:` | MCP tool calls | `mcp:20/1000` — 20 calls used / 1000 limit |
| Fixed quota | TOKEN PLAN used/total | `50M/100M` — auto M/k unit for large numbers |

> 💡 **No extra configuration needed** — as long as `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` are set, the plugin automatically detects the platform and queries it.
>
> 🍪 **Xiaomi (MiMo)** requires an additional `XIAOMI_COOKIE` environment variable (extract Cookie from browser DevTools), as the Xiaomi usage API uses Cookie authentication instead of API Key.

**Positioning vs. `claude-hud`**

[`jarrodwatts/claude-hud`](https://github.com/jarrodwatts/claude-hud) is a full-featured statusline (10+ lines), primarily for Anthropic Claude native users. **This project** balances information density with simplicity, with two core goals:

1. **Matching claude-hud core features** — tool activity, agent tracking, task parsing — all present, but kept within 7 lines, lighter than claude-hud
2. **Deep multi-provider support** — built-in usage queries for Zhipu GLM, MiniMax, Xiaomi MiMo, Alibaba DashScope, Volcengine Ark, DeepSeek, Kimi and more Coding Plan / Token Plan platforms, so third-party proxy users can also see their quota in real time

---

## 📑 Table of Contents

- [Prerequisites](#prerequisites)
- [30-Second Quick Start](#30-second-quick-start)
- [Installation](#installation)
  - [Option 1: Marketplace (Recommended)](#option-1-marketplace-recommended)
  - [Option 2: Manual git clone](#option-2-manual-git-clone)
  - [Option 3: Windows PowerShell](#option-3-windows-powershell)
  - [Linux tmpfs Fix](#linux-tmpfs-fix)
- [Usage](#usage)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Display Fields](#display-fields)
- [Customization](#customization)
- [FAQ](#faq)
- [Development](#development)
- [Contributing](#contributing)
- [Related Projects](#related-projects)
- [License](#license)

---

## Prerequisites

Before installing this plugin, make sure you have:

| Dependency | Minimum Version | Check Command | Notes |
|------------|----------------|---------------|-------|
| **Claude Code CLI** | Latest | `claude --version` | [Installation docs](https://docs.claude.com/en/docs/claude-code/installation) |
| **Node.js** | ≥ 18.0.0 | `node --version` | For compiling TypeScript |
| **npm** | ≥ 9.0 | `npm --version` | For installing TypeScript |
| **TypeScript** | ≥ 5.4 | `npx tsc --version` | Auto-installed at compile time |

> 💡 **Zero runtime dependencies** — the compiled output is pure Node.js, no npm packages required.

---

## 30-Second Quick Start

The fastest way to see it in action (for those who want to "try it first"):

```bash
# 1. Clone locally
git clone https://github.com/zander-zyx/claude-mini-hud.git
cd claude-mini-hud

# 2. Compile
npm install
npm run build

# 3. Test the output
echo '{"model":{"display_name":"MiniMax-M3"},"context_window":{"current_usage":{"input_tokens":22000,"output_tokens":342,"cache_creation_input_tokens":768},"context_window_size":200000}}' | node dist/index.js
```

**Expected output** (with ANSI colors):

```
📊 上下文 ███░░░░░░░░░░░░░░░░░ 13%  22.0k / 200.0k  剩余 178k
🪙 Token 23.1k (in 22.0k · out 342 · cache 768)
```

See those two lines? Everything works. Next step: [Install into Claude Code](#installation).

---

## Installation

### Option 1: Marketplace (Recommended)

> Easiest. Claude Code automatically pulls the code, compiles, and configures.

```bash
# 1. Inside Claude Code, add the marketplace
/plugin marketplace add zander-zyx/claude-mini-hud

# 2. Install the plugin
/plugin install claude-mini-hud

# 3. Reload plugin cache
/reload-plugins

# 4. Run setup (prompts you to choose 1. Chinese / 2. English)
/claude-mini-hud:setup
```

✅ Done! Restart Claude Code and you should see the statusline below your input field.

**What setup does**:
1. Detects your OS and Claude config directory
2. Asks for language preference (Chinese / English)
3. Checks existing statusLine config; backs up if there's a conflict
4. Writes `node <path>/dist/index.js` into `~/.claude/settings.json`
5. Prompts you to restart + verify

### Option 2: Manual git clone

> For those who want to control the path, or make code changes that take effect immediately.

**Linux / macOS**:

```bash
# 1. Clone into the Claude plugins directory (version is part of the dir name, update it when upgrading)
git clone https://github.com/zander-zyx/claude-mini-hud.git \
  ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0

# 2. Enter the directory and compile
cd ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0
npm install
npm run build

# 3. Write statusLine to ~/.claude/settings.json
# Use jq / editor, key fields:
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0/dist/index.js"
  }
}

# 4. Restart Claude Code
```

> 💡 **Directory naming convention**: Claude Code expects a `{vendor}/{name}/{version}/` three-level structure. `local` is the vendor, `claude-mini-hud` is the name, `0.1.0` is the version. When modifying code, **don't change the version**, or Claude Code will treat it as a new plugin and re-run the cache logic.

### Option 3: Windows PowerShell

```powershell
# 1. Clone
git clone https://github.com/zander-zyx/claude-mini-hud.git $env:USERPROFILE\.claude\plugins\cache\local\claude-mini-hud\0.1.0

# 2. Compile
cd $env:USERPROFILE\.claude\plugins\cache\local\claude-mini-hud\0.1.0
npm install
npm run build

# 3. Set statusLine (PowerShell syntax)
$settings = Get-Content $env:USERPROFILE\.claude\settings.json -Raw | ConvertFrom-Json
$settings | Add-Member -Type NoteProperty -Name statusLine -Value @{
  type = "command"
  command = "node $env:USERPROFILE\.claude\plugins\cache\local\claude-mini-hud\0.1.0\dist\index.js"
}
$settings | ConvertTo-Json -Depth 10 | Set-Content $env:USERPROFILE\.claude\settings.json

# 4. Restart Claude Code
```

### Linux tmpfs Fix

If you see this error during installation:

```
EXDEV: cross-device link not permitted
```

This happens because `/tmp` and `~/.claude` are on **different filesystems** (tmpfs vs ext4) — Claude Code tries to use a hardlink, but cross-device links aren't allowed.

**Solution**:

```bash
mkdir -p ~/.cache/tmp
TMPDIR=~/.cache/tmp claude
# Run /plugin install in this session
```

This is a [Claude Code platform limitation](https://github.com/anthropics/claude-code/issues/14799), not a plugin issue.

---

## Usage

### What You'll See

**All features enabled** (Chinese + model + tool activity + agent tracking):
```
📊 上下文 ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
🪙 Token 4.8M (入 3.5M · 出 1.2M · 缓存 103k · ⚡ 45 tok/s)
▶️  当前任务 ▸ 正在写 skill  (1/4)
  ◐ 读取 index.ts
  ◐ 写入 utils.ts
  ✓ 搜索 ×3  ✓ 执行 ×1
  [Explore] ◐ 搜索相关代码 2m 15s
🤖 模型 deepseek-v4-pro  [deepseek]
```

**Compact mode** (tool activity and agent lines are automatically hidden when not present):
```
📊 上下文 ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
🪙 Token 4.8M (入 3.5M · 出 1.2M · 缓存 103k)
▶️  当前任务 ▸ 调研充电行业政策  (2/5)
```

### When It Updates

The statusline automatically refreshes at these moments:
- Every time Claude finishes a response
- Every time you send a new message
- Every time the todo list changes (starts / completes / switches in-progress)

**It does not affect** Claude Code performance: rendering is asynchronous, takes less than 10ms, and doesn't compete for the main process CPU.

---

## Configuration

### Environment Variables

| Variable | Default | Options | Description |
|----------|---------|---------|-------------|
| `CLAUDE_MINI_HUD_LANG` | `zh` | `zh` / `en` / `minimal` | UI language (minimal = English-Chinese hybrid + no emoji) |
| `CLAUDE_MINI_HUD_SHOW_MODEL` | (unset) | `1` | When set to `1`, shows the model line |
| `CLAUDE_MINI_HUD_TOKEN_MODE` | `session` | `session` / `context` / `both` | Token line mode: session=cumulative / context=snapshot / both=two lines |

**Set them in statusLine.command** (recommended):

```jsonc
// ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "CLAUDE_MINI_HUD_LANG=en CLAUDE_MINI_HUD_SHOW_MODEL=1 node ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0/dist/index.js"
  }
}
```

> 💡 **Why env vars instead of a config file?**
> An extension of the zero-dependency philosophy — no config files created, no pollution of user project directories, consistent with Claude Code's own env configuration style (`ANTHROPIC_BASE_URL`, etc.).

### Display Fields

| Line | Content | Trigger | Render Function |
|------|---------|---------|-----------------|
| **📊 Context** | Progress bar + % + `used / total` + remaining | ✅ Always shown | `renderContextLine` |
| **🪙 Token** | Cumulative in/out/cache + ⚡ speed | ✅ Always shown | `renderTokenLine` |
| **💰 Usage/Balance** | Multi-platform usage % / balance | When usage data exists | `renderUsageLine` |
| **▶️ Current Task** | In-progress todo + completion count | When todos exist | `renderTodoLine` |
| **🔧 Tools** | ◐ running / ✓ completed ×N | When tool activity exists | `renderToolActivityLines` |
| **🤖 Agent** | ◐ description + duration | When active agents exist | `renderAgentLines` |
| **🤖 Model** | Model name + provider label | `SHOW_MODEL=1` | `renderModelLine` |

#### Token Line Fields Explained

`🪙 Token 4.8M (in 3.5M · out 1.2M · cache 103k)` — what each part means:

| Field | Source | Purpose |
|-------|--------|---------|
| **in** | `total_input_tokens` (stdin) or transcript accumulation | Cumulative input tokens for this session |
| **out** | `total_output_tokens` (stdin) or transcript accumulation | Cumulative output tokens for this session |
| **cache** | `cache_creation_input_tokens` + `cache_read_input_tokens` | Prompt cache hits |
| **⚡ tok/s** | Delta of `output_tokens` between two StatusLine refreshes | Real-time decoding speed |

> 📌 **Token source priority**:
> 1. stdin `total_input_tokens` / `total_output_tokens` (session cumulative reported by Claude Code)
> 2. Transcript tail `message.usage` accumulation (fallback)
> 3. `current_usage` snapshot (last resort)

#### Progress Bar Color Thresholds

| Percentage | Color | Meaning |
|------------|-------|---------|
| < 60% | 🟢 Green | Healthy |
| 60-80% | 🟡 Yellow | Caution |
| > 80% | 🔴 Red | Approaching limit, consider `/clear` |

#### Provider Detection (when model line is enabled)

| Provider Label | Trigger |
|---------------|---------|
| `Bedrock` | `CLAUDE_CODE_USE_BEDROCK=1` |
| `Vertex` | `CLAUDE_CODE_USE_VERTEX=1` |
| `Enterprise` | Model ID is `opusplan` / `sonnetplan` / `haikuplan` |
| Custom (e.g. `minimaxi`) | `ANTHROPIC_BASE_URL` points to non-anthropic.com |

---

## Customization

### Change Display Text / Emoji

Edit the `STRINGS` table in `src/i18n.ts`:

```ts
const STRINGS = {
  zh: {
    context: '上下文',     // change to 'Ctx' if you like
    token: 'Token',
    in: '入',               // change to '↓'
    out: '出',              // change to '↑'
    cache: '缓存',          // change to '⚡'
    // ...
  },
  en: {
    context: 'Context',
    // ...
  },
};
```

After changes:

```bash
npm run build   # recompile
# restart Claude Code
```

### Change Progress Bar Color Thresholds

In the `progressBar` function:

```ts
function progressBar(percent: number, width: number = 20) {
  const color = percent > 80 ? c.red : percent > 60 ? c.yellow : c.green;
  // Change to your preferred values, e.g.:
  // const color = percent > 90 ? c.red : percent > 70 ? c.yellow : c.green;
```

### Change Progress Bar Width

```ts
function progressBar(percent: number, width: number = 30) {  // 30 for wider bar
```

### Change Token Line Format

In the `renderTokenLine` function:

```ts
const parts = [
  `${c.gray('↓')} ${inStr}`,     // use arrow instead of "in"
  `${c.gray('↑')} ${outStr}`,
];
if (breakdown.cache > 0) {
  parts.push(`${c.gray('⚡')} ${cacheStr}`);
}
```

### Add a Custom Line (e.g. current git branch)

Add a `renderGitBranchLine` in `src/index.ts`'s `main()` function:

```ts
async function renderGitBranchLine(): Promise<string | null> {
  try {
    const { execSync } = await import('node:child_process');
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    return `${c.gray('🌿')} ${branch}`;
  } catch {
    return null;
  }
}

// In main():
const branchLine = await renderGitBranchLine();
if (branchLine) lines.push(branchLine);
```

---

## FAQ

### Q: After installation, I only see a fallback line "claude-mini-hud — rendering failed"

**A**: The `statusLine.command` path is incorrect, or Node.js can't be found.

Troubleshooting:
```bash
# 1. Check if dist/index.js exists
ls -la ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0/dist/index.js

# 2. Test manually, check if stdout has content
echo '{"model":{"display_name":"test"}}' | node ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0/dist/index.js
# Should output: 📊 上下文 ... 🪙 Token ...

# 3. If manual run works but Claude Code doesn't show it, check settings.json
cat ~/.claude/settings.json | grep -A2 statusLine
```

### Q: Progress bar is always at 0%

**A**: You're using [Claude Code v2.1.5 or earlier](https://docs.claude.com/en/docs/claude-code/statusline), which doesn't pass the `used_percentage` field. This plugin falls back to calculating token percentage manually — if token data is also empty, it shows 0%.

v0.1.0+ includes a **Context percentage anti-flicker** mechanism: when Claude Code sends a frame where all token fields are zero/missing, the plugin automatically uses the last valid cached percentage (within 5 minutes) to prevent the progress bar from flashing to zero. After `/clear`, the cache expires automatically and won't leave stale values.

**If you still see frequent 0%**: Upgrade to the latest Claude Code:
```bash
npm update -g @anthropic-ai/claude-code
```

### Q: Token line's `out` always shows 0

**A**: Claude Code v2.x **omits** the `output_tokens` field in `current_usage`. This plugin automatically accumulates from `transcript.jsonl`, but if the `transcript_path` is incorrect, it can't read it.

**Fix**: Check that `~/.claude/settings.json`'s `transcriptPath` (inside claude config, not statusLine) is readable.

### Q: Chinese characters display as garbled text

**A**: Your terminal doesn't support UTF-8. Check `locale`:

```bash
locale   # should contain UTF-8
echo $LANG
```

If it's `POSIX` or `C`, change it to:
```bash
export LANG=en_US.UTF-8
# or zh_CN.UTF-8
```

### Q: Can I show only specific lines?

**A**: Edit the `main()` function directly and remove the lines you don't want:

```ts
async function main() {
  // ...
  lines.push(renderContextLine(stdin));
  // lines.push(renderTokenLine(...));  // comment out = hide Token line
  // ...
}
```

### Q: Can I use this alongside claude-hud?

**A**: **No**. Both use `statusLine.command`, and the later installation overwrites the earlier one. If you want to A/B test, just switch the `command` in `~/.claude/settings.json`.

### Q: How do I upgrade?

**A**:
```bash
cd ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0
git pull
npm install
npm run build
# restart Claude Code
```

### Q: `node` not found on Windows

**A**: Install [Node.js LTS](https://nodejs.org/) and make sure PATH includes the Node.js installation directory. Or use the absolute path in statusLine.command:

```jsonc
"command": "C:\\Program Files\\nodejs\\node.exe C:\\Users\\you\\.claude\\..."
```

### Q: Installation is slow / GitHub unreachable (Mainland China users)

**A**: By default, cloning from GitHub + npm install can be very slow or fail in China. Solutions:

```bash
# 1. Use npmmirror to speed up npm
npm config set registry https://registry.npmmirror.com

# 2. Use CNB mirror to clone (if GitHub is completely unreachable)
git clone https://cnb.cool/zdking/claude-mini-hud.git

# 3. Use SSH over port 443 (bypass GFW's throttling of port 22)
# ~/.ssh/config:
#   Host github.com
#     HostName ssh.github.com
#     Port 443
#     User git
```

This project's README / code uses only ASCII + common UTF-8 emoji, rendering correctly under any locale.

### Q: I want to contribute but don't know where to start

**A**: See the [Contributing](#contributing) section. Beginner-friendly issues are tagged with the `good first issue` label.

---

## Development

### Cross-Platform Compilation (Windows / macOS / Linux)

The project uses pure TypeScript + Node.js, with no binary or native module dependencies. Compilation only requires:

```bash
npm install        # install typescript + tsx + @types/node
npm run build      # tsc compile src/ → dist/
```

**Two tsconfig files**:
- `tsconfig.json`: Main config, **only compiles src/**, output goes to `dist/`
- `tsconfig.test.json`: Type-checks tests/, `noEmit: true` — no files written

> **Why two tsconfig files?**
> With a single tsconfig, `rootDir: "./src"` conflicts with `include: ["tests/**/*"]`
> (tests isn't under src, TypeScript reports "TS6059"). Splitting them keeps both clean.

### Running Tests

```bash
npm install
npm test            # build + typecheck + run 32 tests (using tsx to run ts tests directly)
npm run test:stdin  # manually test a single stdin input
npm run typecheck   # type-check only, no emit
```

### Development Mode

```bash
npm run dev   # tsc --watch, auto-recompile
# In another terminal:
echo '{"model":{"display_name":"dev"}}' | node dist/index.js
```

### Test Coverage (32 test cases)

| # | Case | Verification |
|---|------|-------------|
| 1 | CLI accepts stdin JSON and outputs required lines | context + token lines |
| 2 | Model line hidden by default | default hidden |
| 3 | `CLAUDE_MINI_HUD_SHOW_MODEL=1` shows model line | env takes effect |
| 4 | Empty stdin outputs fallback | error handling |
| 5 | Progress bar uses red when > 80% | color threshold |
| 6 | Progress bar uses green when < 60% | color threshold |
| 7 | Context line format used/total + remaining | `100k / 1M` format |
| 8 | Token line breaks down in/out/cache | exact value match |
| 9 | Read todos from transcript_path | in_progress + `1/3` |
| 10 | Provider detection (minimaxi) | output with SHOW_MODEL=1 |
| 11 | `CLAUDE_MINI_HUD_LANG=zh` defaults to Chinese | Chinese label |
| 12 | `CLAUDE_MINI_HUD_LANG=en` shows English | no Chinese markers |
| 13 | `CLAUDE_MINI_HUD_LANG=minimal` no emoji + hybrid | hybrid output verification |
| 14–22 | Multi-platform detection (claude/deepseek/minimax/null/kimi/zhipu/xiaomi/alibaba/volcengine) | URL matching |
| 23–32 | Cache read/write + E2E + MiniMax model matching | see `tests/usage.test.ts` |

### Project Structure

```
claude-mini-hud/
├── README.md           # Chinese README
├── README.en.md        # This file (English)
├── LICENSE             # MIT
├── package.json        # npm metadata + scripts
├── tsconfig.json       # TypeScript config (compiles src/ → dist/)
├── tsconfig.test.json  # TypeScript test config (type-check only)
├── CLAUDE.md           # Claude Code project guide
├── .gitignore
├── .claude-plugin/
│   └── plugin.json     # Claude Code plugin descriptor
├── commands/
│   └── setup.md        # /claude-mini-hud:setup entry
├── src/
│   ├── index.ts        # Entry point + stdin reader + main()
│   ├── types.ts        # Shared type definitions
│   ├── i18n.ts         # Internationalization (zh/en/minimal)
│   ├── colors.ts       # ANSI colors (zero-dependency)
│   ├── render.ts       # All render functions
│   ├── transcript.ts   # Transcript JSONL parser
│   └── usage.ts        # Multi-platform usage/balance queries
└── tests/
    ├── stdin.test.ts   # Statusline render tests (13 cases)
    └── usage.test.ts   # Multi-platform usage query tests (19 cases)
```

---

## Contributing

PRs are welcome! Here are the contribution guidelines:

### Filing Issues

**Bug reports** should include:
- Claude Code version (`claude --version`)
- Node.js version (`node --version`)
- OS (macOS 14 / Ubuntu 22.04 / Windows 11, etc.)
- Reproduction steps (especially the full statusLine.command content)
- Expected output vs actual output (ASCII screenshots preferred)

**Feature requests** should explain:
- What scenario does it solve?
- Why aren't the existing 7 lines enough?
- Can it be added to existing fields without changing the API?

### Submitting PRs

1. Fork this repository
2. Create a branch: `git checkout -b feat/your-feature`
3. Run tests: `npm test` (all must pass)
4. Commit: `git commit -m "feat: ..."`
5. Push: `git push origin feat/your-feature`
6. Open a PR describing what changed + screenshots

### Code Style

- TypeScript strict mode
- No third-party dependencies (unless there's a very strong reason — open an issue first)
- Preserve Chinese/English bilingual strings
- When adding new fields, update README + tests in sync

### Roadmap

Short-term (v0.2):
- [ ] Session cost display (requires Claude Code to expose `cost` field)
- [ ] Smoother refresh across multi-window switches
- [ ] Read color thresholds from environment variables

Medium-term (v0.3):
- [ ] Theme switching (light / dark / custom)
- [ ] Mouse hover tooltips (subject to Claude Code TUI limits)
- [ ] Clickable statusline links (jump to current transcript)

---

## Related Projects

| Project | Style | Best For |
|---------|-------|----------|
| [**claude-mini-hud**](https://github.com/zander-zyx/claude-mini-hud) (this project) | Lightweight, up to 7 lines | Prefer clean display with core metrics only |
| [**claude-hud**](https://github.com/jarrodwatts/claude-hud) | Full-featured, 10+ lines | Want git status / agents / tool statistics |
| [**tweakcc**](https://github.com/adamelliotfields/tweakcc) | Config / prompt level | Want to change Claude Code's own behavior |

---

## License

MIT © 2026 Zander Zhang — See [LICENSE](./LICENSE)

---

## Acknowledgments

- Inspired by [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud)
- Built using [Claude Code](https://docs.claude.com/en/docs/claude-code) itself (bootstrapped!)
- Thanks to all [contributors](../../graphs/contributors)

---

## Star History

If this project helps you, give it a ⭐ so more people can find it!

[![Star History Chart](https://api.star-history.com/svg?repos=zander-zyx/claude-mini-hud&type=Date)](https://star-history.com/#zander-zyx/claude-mini-hud)

---

## 简体中文

See [README.md](./README.md).
