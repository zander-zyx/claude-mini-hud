# 📊 claude-mini-hud

> Claude Code 状态栏 — 上下文 / Token / 任务 / 工具活动 / Agent 追踪 + 深度适配国产大模型用量查询
> 
> 21 种进度条主题 · 4 种显示模式 · 零依赖 · 10ms 启动

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-blue)
![Language: TS](https://img.shields.io/badge/TypeScript-ES2022-blue)
![StatusLine](https://img.shields.io/badge/Claude_Code-StatusLine-blueviolet)

[简体中文](#) · [English](./README.en.md) · [安装](#安装) · [主题预览](#进度条主题预览) · [FAQ](#faq) · [贡献](#贡献)

---

## 这是什么?

**claude-mini-hud** 是一个 [Claude Code](https://docs.claude.com/en/docs/claude-code) StatusLine 插件,在你的输入框下方持续显示会话的关键指标。**最多 7 行**,信息密度高。对标 [claude-hud](https://github.com/jarrodwatts/claude-hud) 的核心功能,同时深度适配国产大模型 Coding Plan / Token Plan 用量查询。

### 显示效果

**Ultra-Minimal (ultra-minimal)** — 只保留 Context + Token 两行,极致精简:
```
 Context ██████████░░░░░░░░░░ 52%  104k / 200k  剩余 96k
 Token 118k (in 89k · out 4k · cache 25k ) 12 tok/s
```

**中文 (zh, 默认)** — 完整中文 + emoji:
```
📊 上下文 ██████████░░░░░░░░░░ 52%  104k / 200k  剩余 96k
🪙 Token 118k (入 89k · 出 4k · 缓存 25k ) 12 tok/s
💳 智谱 [pro] 5h:21% (1h54m) 7d:26% (5d7h) mcp:20/1000
▶ 当前任务 正在写 skill  (1/4)
  ◐ 读取 index.ts
  ◐ 写入 utils.ts
  ✓ 搜索 ×3  ✓ 执行 ×1
  [Explore] ◐ 搜索相关代码 2m 15s
🧠 模型 deepseek-v4-pro  [deepseek]
```

*不支持 emoji 的终端会降级为 ASCII 符号 (`# $ >`)*:

**English (en)**:
```
📊 Context ██████████░░░░░░░░░░ 52%  104k / 200k  left 96k
🪙 Token 118k (in 89k · out 4k · cache 25k ) 12 tok/s
💳 Zhipu [pro] 5h:21% (1h54m) 7d:26% (5d7h) mcp:20/1000
▶ Todos Writing skill  (1/4)
  ◐ reading index.ts
  ◐ writing utils.ts
  ✓ searching ×3  ✓ running ×1
  [Explore] ◐ Searching code 2m 15s
🧠 Model deepseek-v4-pro  [deepseek]
```

**Minimal (minimal)** — 英中混搭 + 无 emoji:
```
 Context ██████████░░░░░░░░░░ 52%  104k / 200k  剩余 96k
 Token 118k (in 89k · out 4k · cache 25k ) 12 tok/s
 [B] 智谱 [pro] 5h:21% (1h54m) 7d:26% (5d7h) mcp:20/1000
 当前任务 ▸ 正在写 skill  (1/4)
  ◐ reading index.ts
  ◐ writing utils.ts
  ✓ searching ×3  ✓ running ×1
  [Explore] ◐ Searching code 2m 15s
```

切换: `CLAUDE_MINI_HUD_LANG=zh|en|minimal|ultra-minimal` (见 [配置](#配置))

**核心特性**:
- ⚡ **零依赖**: TypeScript 多模块架构,编译产物轻量
- 🌍 **四种显示模式**: 中文 / English / Minimal (英中混搭) / Ultra-Minimal (只显示两行)
- 🔧 **工具活动**: 实时显示文件读写、搜索、命令执行 (◐ 运行中 / ✓ 已完成×N)
- 🤖 **Agent 追踪**: 显示活跃子 Agent 及其耗时
- 🔥 **Token 速率**: 实时解码速度 (tok/s)
- 📊 **Token 模式**: session 累计 / 上下文快照 / both 三种可切换
- 🚀 **~10ms 启动**: 不拖慢 Claude Code
- 🔌 **即插即用**: `/claude-mini-hud:setup` 一条命令

### 多平台用量/余额查询

根据你的 `ANTHROPIC_BASE_URL` 自动检测平台，实时显示用量/余额：

| 平台 | 检测条件 | 显示格式 |
|------|---------|---------|
| **Claude 原生** | `rate_limits` 有数据 | `5h:45% (1h30m) 7d:12%` |
| **MiniMax** | URL 含 `minimaxi.com` (国内) / `minimax.io` (国际) | `5h:55% 7d:74% m:50% (26d)` |
| **智谱 (GLM)** | URL 含 `bigmodel.cn` / `z.ai` | `5h:21% (1h54m) 7d:26% m:30% (26d) mcp:20/1000` |
| **小米 (MiMo)** | URL 含 `xiaomimimo` | `50M/100M m:45% (26d)` |
| **阿里 (DashScope)** | URL 含 `dashscope` | 平台识别 (暂无公开用量 API) |
| **火山引擎 (Ark)** | URL 含 `volces.com` | 平台识别 (暂无公开用量 API) |
| **DeepSeek** | URL 含 `deepseek.com` | `¥123.45` (账户余额) |
| **Kimi** | URL 含 `moonshot.cn` / `moonshot.ai` | `¥42.50 (赠送 ¥10.00)` |
| **Kimi For Coding** | URL 含 `api.kimi.com/coding` | `5h:42% (1h23m) 7d:15%` |

#### 用量显示格式说明

| 标签 | 含义 | 示例 |
|------|------|------|
| `5h:` | 5小时窗口用量 | `5h:19% (1h54m)` — 已用 19%, 1小时54分后重置 |
| `7d:` | 7天 (周) 用量 | `7d:26% (5d7h)` — 已用 26%, 5天7小时后重置 |
| `m:` | 月度用量 | `m:30% (26d)` — 已用 30%, 26天后重置 (只显示天数) |
| `mcp:` | MCP 工具调用次数 | `mcp:20/1000` — 已调用 20 次 / 总限额 1000 次 |
| 固定额度 | TOKEN PLAN 已用/总额 | `50M/100M` — 大数自动用 M/k 单位 |

> 💡 **无需额外配置** — 只要设了 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_AUTH_TOKEN`，插件自动识别平台并查询。
>
> 🍪 **小米 (MiMo)** 需要额外设置 `XIAOMI_COOKIE` 环境变量 (从浏览器 DevTools 获取 Cookie)，因为小米用量 API 使用 Cookie 认证而非 API Key。

**与 `claude-hud` 的定位**

[`jarrodwatts/claude-hud`](https://github.com/jarrodwatts/claude-hud) 是全功能状态栏 (10+ 行)，主要面向 Anthropic Claude 原生用户。**本项目**在信息密度和简洁之间取得平衡，核心思路有两点：

1. **对标 claude-hud 核心功能** — 工具活动、Agent 追踪、Task 解析等能力一个不少，但控制在 7 行以内，比 claude-hud 更轻量
2. **深度适配国产大模型** — 内置智谱 GLM、MiniMax、小米 MiMo、阿里 DashScope、火山引擎 Ark、DeepSeek、Kimi、Kimi For Coding 等平台的 Coding Plan / Token Plan 用量查询，使用第三方代理的用户也能在状态栏实时看到额度消耗

---

## 📑 目录

- [前置条件](#前置条件)
- [30 秒快速体验](#30-秒快速体验)
- [安装](#安装)
  - [方式 1: Marketplace (推荐)](#方式-1-marketplace-推荐)
  - [方式 2: 手动 git clone](#方式-2-手动-git-clone)
  - [方式 3: Windows PowerShell](#方式-3-windows-powershell)
  - [Linux tmpfs 修复](#linux-tmpfs-修复)
- [使用](#使用)
- [配置](#配置)
  - [环境变量详解](#环境变量详解)
  - [显示字段说明](#显示字段说明)
- [自定义](#自定义)
- [FAQ](#faq)
- [开发](#开发)
- [贡献](#贡献)
- [相关项目](#相关项目)
- [License](#license)

---

## 前置条件

在安装本插件之前,请确认:

| 依赖 | 最低版本 | 检查命令 | 说明 |
|------|---------|---------|------|
| **Claude Code CLI** | 最新版 | `claude --version` | [安装文档](https://docs.claude.com/en/docs/claude-code/installation) |
| **Node.js** | ≥ 18.0.0 | `node --version` | 用于编译 TypeScript |
| **npm** | ≥ 9.0 | `npm --version` | 装 TypeScript |
| **TypeScript** | ≥ 5.4 | `npx tsc --version` | 编译时自动装 |

> 💡 **零运行时依赖** — 编译产物是纯 Node.js,不依赖任何 npm 包。

---

## 30 秒快速体验

最快看到效果的方法 (适合想"先看看"的人):

```bash
# 1. 克隆到本地
git clone https://github.com/zander-zyx/claude-mini-hud.git
cd claude-mini-hud

# 2. 编译
npm install
npm run build

# 3. 测试一下输出
echo '{"model":{"display_name":"MiniMax-M3"},"context_window":{"current_usage":{"input_tokens":22000,"output_tokens":342,"cache_creation_input_tokens":768},"context_window_size":200000}}' | node dist/index.js
```

**预期输出** (含 ANSI 颜色):

```
📊 上下文 ███░░░░░░░░░░░░░░░░░ 13%  22.0k / 200.0k  剩余 178k
🪙 Token 23.1k (入 22.0k · 出 342 · 缓存 768 )
```

看到这两行?说明一切正常。下一步:[安装到 Claude Code](#安装)。

---

## 安装

### 方式 1: Marketplace (推荐)

> 最简单。Claude Code 会自动拉代码 + 编译 + 配置。

```bash
# 1. 在 Claude Code 内,添加 marketplace
/plugin marketplace add zander-zyx/claude-mini-hud

# 2. 安装插件
/plugin install claude-mini-hud

# 3. 重载插件缓存
/reload-plugins

# 4. 跑 setup (依次弹出菜单: 语言 / 进度条主题 / 工具标记)
/claude-mini-hud:setup
```

✅ 完成!重启 Claude Code,输入框下方应看到状态栏。

**setup 流程会**:
1. 检测你的操作系统和 Claude 配置目录
2. 选择语言 (中文 / English / 简约 Minimal / 极简 Ultra-Minimal)
3. 选择进度条主题 + 工具标记风格 (可选, 21 种主题自由组合, 默认经典)
4. 检查现有 statusLine 配置,如有冲突会备份
5. 把 `node <path>/dist/index.js` + 环境变量写入 `~/.claude/settings.json`
6. 提示重启 + 验证步骤

### 方式 2: 手动 git clone

> 适合想自己控制路径,或调试时改代码立即生效的人。

**Linux / macOS**:

```bash
# 1. 克隆到 Claude 插件目录 (version 是目录名一部分,改版本时同步改)
git clone https://github.com/zander-zyx/claude-mini-hud.git \
  ~/.claude/plugins/cache/local/claude-mini-hud/1.0.0

# 2. 进入目录编译
cd ~/.claude/plugins/cache/local/claude-mini-hud/1.0.0
npm install
npm run build

# 3. 把 statusLine 写入 ~/.claude/settings.json
# 用 jq / 编辑器都行,关键字段:
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/plugins/cache/local/claude-mini-hud/1.0.0/dist/index.js"
  }
}

# 4. 重启 Claude Code
```

> 💡 **目录命名规范**:Claude Code 期望 `{vendor}/{name}/{version}/` 三级结构。`local` 是 vendor,`claude-mini-hud` 是 name,`1.0.0` 是 version。改代码时**不要改 version**,否则 Claude Code 认为是新插件,会重新跑一次缓存逻辑。

### 方式 3: Windows PowerShell

```powershell
# 1. 克隆
git clone https://github.com/zander-zyx/claude-mini-hud.git $env:USERPROFILE\.claude\plugins\cache\local\claude-mini-hud\1.0.0

# 2. 编译
cd $env:USERPROFILE\.claude\plugins\cache\local\claude-mini-hud\1.0.0
npm install
npm run build

# 3. 设置 statusLine (PowerShell 写法)
$settings = Get-Content $env:USERPROFILE\.claude\settings.json -Raw | ConvertFrom-Json
$settings | Add-Member -Type NoteProperty -Name statusLine -Value @{
  type = "command"
  command = "node $env:USERPROFILE\.claude\plugins\cache\local\claude-mini-hud\1.0.0\dist\index.js"
}
$settings | ConvertTo-Json -Depth 10 | Set-Content $env:USERPROFILE\.claude\settings.json

# 4. 重启 Claude Code
```

### Linux tmpfs 修复

如果安装时报:

```
EXDEV: cross-device link not permitted
```

这是因为 `/tmp` 和 `~/.claude` 在**不同的文件系统** (tmpfs vs ext4) — Claude Code 想用 hardlink 但跨设备不允许。

**解决方案**:

```bash
mkdir -p ~/.cache/tmp
TMPDIR=~/.cache/tmp claude
# 在这个 session 里跑 /plugin install
```

这是 [Claude Code 平台限制](https://github.com/anthropics/claude-code/issues/14799),非本插件问题。

---

## 使用

### 看到的输出

**全部启用** (中文 + 模型 + 工具活动 + Agent 追踪):
```
📊 上下文 ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
🪙 Token 4.8M (入 3.5M · 出 1.2M · 缓存 103k ) 45 tok/s
▶ 当前任务 正在写 skill  (1/4)
  ◐ 读取 index.ts
  ◐ 写入 utils.ts
  ✓ 搜索 ×3  ✓ 执行 ×1
  [Explore] ◐ 搜索相关代码 2m 15s
🧠 模型 deepseek-v4-pro  [deepseek]
```

**无工具/Agent 时** (自动隐藏对应行, 仅 3 行):
```
📊 上下文 ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
🪙 Token 4.8M (入 3.5M · 出 1.2M · 缓存 103k )
▶ 当前任务 调研充电行业政策  (2/5)
```

### 显示时机

状态栏在以下时刻自动刷新:
- 每次 Claude 响应结束
- 每次你发新消息
- 每次 todo list 变化 (开始 / 完成 / 切换 in-progress)

**它不影响** Claude Code 性能:渲染是异步的,不到 10ms,不抢主进程 CPU。

---

## 配置

### 环境变量详解

| 变量 | 默认 | 可选值 | 说明 |
|------|------|--------|------|
| `CLAUDE_MINI_HUD_LANG` | `zh` | `zh` / `en` / `minimal` / `ultra-minimal` | 界面语言 (minimal = 英中混搭 + 无 emoji, ultra-minimal = 只显示 Context + Token 两行) |
| `CLAUDE_MINI_HUD_THEME` | `default` | `default` / `neon` / `braille` / `hardcore` / `minimal` / `pixel` / `diamond` / `arrow` / `wave` / `tide` / `dot` / `target` / `gradient` / `shades` / `retro` / `ascii` / `rail` / `star` / `spark` / `heart` / `love` | 进度条风格 (见下方主题预览) |
| `CLAUDE_MINI_HUD_MARKS` | `default` | `default` / `neon` / `braille` / `hardcore` / `minimal` / `pixel` / `diamond` / `arrow` / `wave` / `tide` / `dot` / `target` / `gradient` / `shades` / `retro` / `ascii` / `rail` / `star` / `spark` / `heart` / `love` | 工具/Agent 标记图标 (独立于进度条, 可自由组合) |
| `CLAUDE_MINI_HUD_SHOW_MODEL` | (未设) | `1` | 设置为 `1` 时显示模型行 |
| `CLAUDE_MINI_HUD_TOKEN_MODE` | `session` | `session` / `context` / `both` | Token 行模式: session=累计 / context=快照 / both=两行 |
| `CLAUDE_MINI_HUD_NO_EMOJI` | (未设) | `1` | 设置为 `1` 时强制禁用 emoji, 使用 ASCII 符号 (# $ > 等) |

**在 statusLine.command 里设置** (推荐):

**Linux / macOS**:
```jsonc
// ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "CLAUDE_MINI_HUD_LANG=en CLAUDE_MINI_HUD_THEME=arrow node ~/.claude/plugins/cache/local/claude-mini-hud/1.0.0/dist/index.js"
  }
}
```

**Windows (需要 PowerShell 包装)**:
```jsonc
// %USERPROFILE%\.claude\settings.json
{
  "statusLine": {
    "type": "command",
    "command": "powershell -NoProfile -Command \"$env:CLAUDE_MINI_HUD_LANG='en'; $env:CLAUDE_MINI_HUD_THEME='arrow'; node '%USERPROFILE%\\.claude\\plugins\\cache\\local\\claude-mini-hud\\1.0.0\\dist\\index.js'\""
  }
}
```

#### 进度条主题预览 (72% 时)

| 主题 | 环境变量值 | 进度条效果 | 工具标记 |
|------|-----------|-----------|---------|
| 经典 | `default` | `# Context ██████████████░░░░░░ 72%` | `◐ 运行中` `✓ 已完成` |
| 霓虹矩阵 | `neon` | `⟦ CTX: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ 72% ⟧` | `◈ 运行中` `✦ 已完成` |
| Braille 点阵 | `braille` | `# Context ⣿⣷⣯⣟⡿⣯⣟⣿⣷⣯⣟⡿⣯⣟░░░░░░ 72%` | `⣷ 运行中` `⣿ 已完成` |
| 硬核 | `hardcore` | `[■■■■■■■■■■■■■■□□□□□□] 72% CTX │` | `● 运行中` `■ 已完成` |
| 超简约 | `minimal` | `◈ 72% ┃ 125k / 200k  left 75k` | `· 运行中` `· 已完成` |
| 像素 | `pixel` | `# Context ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣀⣀⣀⣀⣀⣀ 72%` | `▣ 运行中` `■ 已完成` |
| 钻石 | `diamond` | `# Context ◆◆◆◆◆◆◆◆◆◆◆◆◆◆◇◇◇◇◇◇ 72%` | `◈ 运行中` `◆ 已完成` |
| 箭头 | `arrow` | `# Context ▸▸▸▸▸▸▸▸▸▸▸▸▸▸▹▹▹▹▹▹ 72%` | `▸ 运行中` `✓ 已完成` |
| 波浪 | `wave` | `# Context ≋≋≋≋≋≋≋≋≋≋≋≋≋≋∿∿∿∿∿∿ 72%` | `≋ 运行中` `≈ 已完成` |
| 潮汐 | `tide` | `# Context ∿∿∿∿∿∿∿∿∿∿∿∿∿∿╌╌╌╌╌╌ 72%` | `∿ 运行中` `≈ 已完成` |
| 圆点 | `dot` | `# Context ●●●●●●●●●●●●●●○○○○○○ 72%` | `◉ 运行中` `● 已完成` |
| 靶心 | `target` | `# Context ◎◎◎◎◎◎◎◎◎◎◎◎◎◎⊙⊙⊙⊙⊙⊙ 72%` | `◎ 运行中` `⊙ 已完成` |
| 渐变 | `gradient` | `# Context ▓▓▓▓▓▓▓▓▓▓▓▓▒▒······ 72%` | `▒ 运行中` `▓ 已完成` |
| 阴影 | `shades` | `# Context █▓▒░█▓▒░█▓▒░█▓······ 72%` | `▒ 运行中` `█ 已完成` |
| 复古终端 | `retro` | `# Context ═════════════▸────── 72%` | `► 运行中` `■ 已完成` |
| 纯 ASCII | `ascii` | `# Context ##############...... 72%` | `@ 运行中` `# 已完成` |
| 铁轨 | `rail` | `# Context ══════════════╌╌╌╌╌╌ 72%` | `╌ 运行中` `═ 已完成` |
| 星光 | `star` | `# Context ★★★★★★★★★★★★★★☆☆☆☆☆☆ 72%` | `☆ 运行中` `★ 已完成` |
| 火花 | `spark` | `# Context ✦✦✦✦✦✦✦✦✦✦✦✦✦✦✧✧✧✧✧✧ 72%` | `✦ 运行中` `✧ 已完成` |
| 心形 | `heart` | `# Context 🖤🖤🖤🖤🖤🖤🖤🤍🤍🤍 72%` | `💗 运行中` `🖤 已完成` |
| 爱心 | `love` | `# Context ❤️❤️❤️❤️❤️❤️❤️🤍🤍🤍 72%` | `💗 运行中` `❤️ 已完成` |

> 💡 **自由组合**: `CLAUDE_MINI_HUD_THEME` 控制进度条, `CLAUDE_MINI_HUD_MARKS` 控制工具/Agent 标记, 两者独立可混搭。例如 `THEME=hardcore MARKS=diamond`。

> 💡 **为什么用 env 而非配置文件?**
> 零依赖哲学的延伸 — 不创建任何配置文件,不污染用户项目目录,跟 Claude Code 自身的 env 配置 (`ANTHROPIC_BASE_URL` 等)风格一致。

### 显示字段说明

| 行 | 内容 | 触发条件 | 渲染函数 |
|----|------|---------|---------|
| **# 上下文** | 进度条 + % + `used / total` + 剩余 | ✅ 必显 | `renderContextLine` |
| **$ Token** | 累计 in/out/cache + ⚡速率 | ✅ 必显 | `renderTokenLine` |
| **[B] 用量/余额** | 多平台用量百分比 / 余额 | 有用量数据时 | `renderUsageLine` |
| **> 当前任务** | in-progress todo + 完成度 | 有 todo 时 | `renderTodoLine` |
| **[*] 工具** | ◐ 运行中 / ✓ 已完成×N | 有工具活动时 | `renderToolActivityLines` |
| **& Agent** | ◐ 描述 + 耗时 | 有活跃 Agent 时 | `renderAgentLines` |
| **> 模型** | 模型名 + provider 标签 | `SHOW_MODEL=1` | `renderModelLine` |

#### Token 行字段详解

`$ Token 4.8M (入 3.5M · 出 1.2M · 缓存 103k )` 各部分含义:

| 字段 | 来源 | 用途 |
|------|------|------|
| **入 / in** | `total_input_tokens` (stdin) 或 transcript 累加 | 本次会话累计输入 token |
| **出 / out** | `total_output_tokens` (stdin) 或 transcript 累加 | 本次会话累计输出 token |
| **缓存 / cache** | `cache_creation_input_tokens` + `cache_read_input_tokens` | prompt cache 命中 |
| **tok/s** | 两次 StatusLine 刷新的 `output_tokens` 差值 | 实时解码速度 |

> 📌 **Token 来源优先级**:
> 1. stdin `total_input_tokens` / `total_output_tokens` (Claude Code 上报的 session 累计)
> 2. transcript 尾部 `message.usage` 累加 (fallback)
> 3. `current_usage` 快照 (最后的兜底)

#### 进度条颜色阈值

| 百分比 | 颜色 | 含义 |
|--------|------|------|
| < 60% | 🟢 绿 | 健康 |
| 60-80% | 🟡 黄 | 注意 |
| > 80% | 🔴 红 | 接近上限,考虑 `/clear` |

#### Provider 检测 (模型行启用时)

| Provider 标签 | 触发条件 |
|---------------|---------|
| `Bedrock` | `CLAUDE_CODE_USE_BEDROCK=1` |
| `Vertex` | `CLAUDE_CODE_USE_VERTEX=1` |
| `Enterprise` | 模型 id 是 `opusplan` / `sonnetplan` / `haikuplan` |
| 自定义 (如 `minimaxi`) | `ANTHROPIC_BASE_URL` 指向非 anthropic.com |

---

## 自定义

### 改显示文字 / emoji

直接改 `src/i18n.ts` 里的 `STRINGS` 表:

```ts
const STRINGS = {
  zh: {
    context: '上下文',     // 改成 'Ctx' 也行
    token: 'Token',
    in: '入',               // 改成 '↓' 也行
    out: '出',              // 改成 '↑'
    cache: '缓存',          // 改成 '⚡'
    // ...
  },
  en: {
    context: 'Context',
    // ...
  },
};
```

改完:

```bash
npm run build   # 重新编译
# 重启 Claude Code
```

### 改进度条风格

通过环境变量切换 (无需改代码):

```bash
CLAUDE_MINI_HUD_THEME=arrow  # 可选: default/neon/braille/hardcore/minimal/pixel/diamond/arrow/wave/tide/dot/target/gradient/shades/retro/ascii/rail/star/spark/heart
```

或自定义主题,修改 `src/themes.ts` 中的 `ThemeConfig`:

```ts
export interface ThemeConfig {
  filled: string[];    // 填充字符 (如 ['█'], ['◆'], ['▸'])
  empty: string;       // 空白字符 (如 '░', '◇', '▹')
  leftBorder: string;  // 左边框 (如 '[', '⟦', '')
  rightBorder: string; // 右边框 (如 ']', '⟧', '')
  width: number;       // 进度条宽度 (默认 20)
  // ...
}
```

### 改进度条颜色阈值

`progressBar` 函数:

```ts
function progressBar(percent: number, width: number = 20) {
  const color = percent > 80 ? c.red : percent > 60 ? c.yellow : c.green;
  // 改成你想要的值,例如:
  // const color = percent > 90 ? c.red : percent > 70 ? c.yellow : c.green;
```

### 改 Token 行格式

`renderTokenLine` 函数:

```ts
const parts = [
  `${c.gray('↓')} ${inStr}`,     // 用箭头代替 "in"
  `${c.gray('↑')} ${outStr}`,
];
if (breakdown.cache > 0) {
  parts.push(`${c.gray('⚡')} ${cacheStr}`);
}
```

### 添加自定义行 (例如:当前 git 分支)

在 `src/index.ts` 的 `main()` 函数中加一个 `renderGitBranchLine`:

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

// main() 里:
const branchLine = await renderGitBranchLine();
if (branchLine) lines.push(branchLine);
```

---

## FAQ

### Q: 安装后只看到一行 fallback "claude-mini-hud — 渲染失败"

**A**: `statusLine.command` 路径不对,或 Node.js 找不到。

排查:
```bash
# 1. 检查 dist/index.js 是否存在
ls -la ~/.claude/plugins/cache/local/claude-mini-hud/1.0.0/dist/index.js

# 2. 手动测试,看 stdout 有没有内容
echo '{"model":{"display_name":"test"}}' | node ~/.claude/plugins/cache/local/claude-mini-hud/1.0.0/dist/index.js
# 应该输出: 📊 上下文 ... 🪙 Token ...

# 3. 如果手动跑 OK 但 Claude Code 里没显示,检查 settings.json
cat ~/.claude/settings.json | grep -A2 statusLine
```

### Q: 进度条一直是 0%

**A**: 你用的是 [Claude Code v2.1.5 及以下](https://docs.claude.com/en/docs/claude-code/statusline),它不传 `used_percentage` 字段。本插件会回退到手算 token 百分比,如果 token 数据也空就显示 0%。

v1.0.0+ 已加入 **Context 百分比防闪烁**机制:当 Claude Code 发送的某帧数据所有 token 字段为零/缺失时,自动使用 5 分钟内的上次有效百分比缓存,避免进度条闪烁归零。`/clear` 后缓存自动过期,不会残留旧值。

**如果仍然频繁出现 0%**: 升级到最新版 Claude Code:
```bash
npm update -g @anthropic-ai/claude-code
```

### Q: Token 行的 `out` 一直显示 0

**A**: Claude Code v2.x 在 `current_usage` 里**省略** `output_tokens` 字段。本插件会自动从 `transcript.jsonl` 累加,如果 `transcript_path` 路径不对就读不到。

**解决**: 检查 `~/.claude/settings.json` 里 `transcriptPath` (在 claude config 内部,不是 statusLine) 是否可读。

### Q: 中文显示乱码

**A**: 你的终端不支持 UTF-8。检查 `locale`:

```bash
locale   # 应含 UTF-8
echo $LANG
```

如果是 `POSIX` 或 `C`,改成:
```bash
export LANG=en_US.UTF-8
# 或 zh_CN.UTF-8
```

### Q: 可以只显示某一行吗?

**A**: 直接改 `main()` 函数,删掉不想渲染的行:

```ts
async function main() {
  // ...
  lines.push(renderContextLine(stdin));
  // lines.push(renderTokenLine(...));  // 注释掉 = 不显示 Token
  // ...
}
```

### Q: 跟 claude-hud 能同时装吗?

**A**: **不行**。两者都用 `statusLine.command`,后装的覆盖先装的。如果你想 A/B 测试,在 `~/.claude/settings.json` 切换 `command` 即可。

### Q: 升级版本怎么操作?

**A**:
```bash
cd ~/.claude/plugins/cache/local/claude-mini-hud/1.0.0
git pull
npm install
npm run build
# 重启 Claude Code
```

### Q: Windows 上 `node` 找不到

**A**: 安装 [Node.js LTS](https://nodejs.org/),确保 PATH 含 Node.js 安装目录。或者在 statusLine.command 里用绝对路径:

```jsonc
"command": "C:\\Program Files\\nodejs\\node.exe C:\\Users\\you\\.claude\\..."
```

### Q: 安装慢 / GitHub 不可达 (中国大陆用户)

**A**: 默认情况下,从 GitHub clone + npm install 在国内可能很慢或失败。解决方案:

```bash
# 1. 用 npmmirror 加速 npm
npm config set registry https://registry.npmmirror.com

# 2. 用 CNB 镜像 clone (如果 GitHub 直接不通)
git clone https://cnb.cool/zdking/claude-mini-hud.git

# 3. 用 SSH over port 443 (绕过 GFW 对 22 端口的限速)
# ~/.ssh/config:
#   Host github.com
#     HostName ssh.github.com
#     Port 443
#     User git
```

本项目 README / 代码全部用 ASCII + 通用 UTF-8 emoji,在任何 locale 下渲染都没问题。

### Q: 想贡献但不知道从哪开始

**A**: 看 [贡献章节](#贡献)。新手友好的 issues 标了 `good first issue` 标签。

---

## 开发

### 跨平台编译 (Windows / macOS / Linux)

项目用纯 TypeScript + Node.js, 不依赖任何二进制或原生模块. 编译只需:

```bash
npm install        # 装 typescript + tsx + @types/node
npm run build      # tsc 编译 src/ → dist/
```

**两个 tsconfig 文件**:
- `tsconfig.json`: 主配置, **只编译 src/**, 产物输出到 `dist/`
- `tsconfig.test.json`: 类型检查 tests/, `noEmit: true` 不写文件

> **为什么两个 tsconfig?**
> 单 tsconfig 的话, `rootDir: "./src"` 跟 `include: ["tests/**/*"]` 会冲突
> (tests 不在 src 下, TypeScript 报 "TS6059"). 拆分后两边都干净.

### 跑测试

```bash
npm install
npm test            # build + typecheck + 跑 36 个测试 (用 tsx 直接跑 ts 测试)
npm run test:stdin  # 手测单个 stdin 输入
npm run typecheck   # 只做类型检查, 不 emit
```

### 开发模式

```bash
npm run dev   # tsc --watch, 自动重新编译
# 另开一个终端:
echo '{"model":{"display_name":"dev"}}' | node dist/index.js
```

### 测试覆盖 (35 个用例)

| # | 用例 | 验证 |
|---|------|------|
| 1 | cli 接受 stdin JSON 并输出必显行 | context + token 行 |
| 2 | 默认不显示模型行 | 默认隐藏 |
| 3 | `CLAUDE_MINI_HUD_SHOW_MODEL=1` 显示模型行 | env 生效 |
| 4 | 空 stdin 输出 fallback | 错误处理 |
| 5 | 进度条在 > 80% 时使用红色 | 颜色阈值 |
| 6 | 进度条在 < 60% 时使用绿色 | 颜色阈值 |
| 7 | 上下文行格式 used/total + 剩余 | `100k / 1M` 格式 |
| 8 | Token 行细分 in/out/cache | 数值精确匹配 |
| 9 | 从 transcript_path 读取 todos | in_progress + `1/3` |
| 10 | provider 检测 (minimaxi) | SHOW_MODEL=1 时输出 |
| 11 | `CLAUDE_MINI_HUD_LANG=zh` 默认中文 | 中文 label |
| 12 | `CLAUDE_MINI_HUD_LANG=en` 显示英文 | 无中文 marker |
| 13 | `CLAUDE_MINI_HUD_LANG=minimal` 无 emoji + 英中混搭 | 混合输出验证 |
| 14–26 | 多平台检测 (claude/deepseek/minimax/minimax.io/kimi-coding/null/kimi/moonshot.ai/zhipu/z.ai/xiaomi/alibaba/volcengine) | URL 匹配 (含国际站) |
| 26–36 | 缓存读写 + 端到端 + MiniMax 模型匹配 | 见 `tests/usage.test.ts` (23 用例) |

### 项目结构

```
claude-mini-hud/
├── README.md           # 本文件 (中文)
├── README.en.md        # 英文 README
├── LICENSE             # MIT
├── package.json        # npm 元数据 + scripts
├── tsconfig.json       # TypeScript 配置 (编译 src/ → dist/)
├── tsconfig.test.json  # TypeScript 测试配置 (仅类型检查)
├── CLAUDE.md           # Claude Code 项目指引
├── .gitignore
├── .claude-plugin/
│   └── plugin.json     # Claude Code 插件描述
├── commands/
│   └── setup.md        # /claude-mini-hud:setup 入口
├── src/
│   ├── index.ts        # 入口 + stdin 读取 + main()
│   ├── types.ts        # 共享类型定义
│   ├── i18n.ts         # 国际化 (zh/en/minimal)
│   ├── colors.ts       # ANSI 颜色 (零依赖)
│   ├── themes.ts       # 进度条主题系统 (21 种可选)
│   ├── render.ts       # 所有渲染函数
│   ├── transcript.ts   # Transcript JSONL 解析
│   └── usage.ts        # 多平台用量/余额查询
└── tests/
    ├── stdin.test.ts   # 状态栏渲染测试 (13 用例)
    └── usage.test.ts   # 多平台用量查询测试 (23 用例)
```

---

## 贡献

欢迎 PR!以下是贡献指南:

### 提 Issue

**Bug 报告**请包含:
- Claude Code 版本 (`claude --version`)
- Node.js 版本 (`node --version`)
- 操作系统 (macOS 14 / Ubuntu 22.04 / Windows 11 等)
- 复现步骤 (尤其是 statusLine.command 完整内容)
- 期望输出 vs 实际输出 (ASCII 截图最好)

**功能请求**请说明:
- 解决什么场景?
- 为什么现有 7 行还不够?
- 能否在不改 API 的情况下加进现有字段?

### 提 PR

1. Fork 这个仓库
2. 创建分支: `git checkout -b feat/your-feature`
3. 跑测试: `npm test` (必须全过)
4. 提交: `git commit -m "feat: ..."`
5. 推送: `git push origin feat/your-feature`
6. 开 PR,描述改了啥 + 截图

### 代码风格

- TypeScript strict mode
- 不用第三方依赖 (除非有极强理由,先开 issue 讨论)
- 保留中文/英文双语字符串
- 加新字段时同步更新 README + 测试

### Roadmap

近期 (v1.1):
- [x] 进度条主题系统 (21 种风格: 经典/霓虹/点阵/硬核/简约/像素/钻石/箭头/波浪/潮汐/圆点/靶心/渐变/阴影/复古/ASCII/铁轨/星光/火花/心形/爱心)
- [ ] Session 费用显示 (需要 Claude Code 暴露 `cost` 字段)
- [ ] 多窗口切换时更平滑的刷新
- [ ] 从环境变量读取颜色阈值

中期 (v1.2):
- [ ] 亮色/暗色主题适配
- [ ] 鼠标悬停提示 (受 Claude Code TUI 限制)
- [ ] 可点击的状态栏链接 (跳转到当前 transcript)

---

## 相关项目

| 项目 | 风格 | 适合谁 |
|------|------|--------|
| [**claude-mini-hud**](https://github.com/zander-zyx/claude-mini-hud) (本项目) | 轻量, 最多 7 行 | 喜欢清爽, 只要核心指标 |
| [**claude-hud**](https://github.com/jarrodwatts/claude-hud) | 全功能,10+ 行 | 想要 git 状态 / agents / 工具统计 |
| [**tweakcc**](https://github.com/adamelliotfields/tweakcc) | 配置 / prompt 级 | 想改 Claude Code 本身行为 |

---

## License

MIT © 2026 Zander Zhang — 详见 [LICENSE](./LICENSE)

---

## 致谢

- 灵感来自 [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud)
- 用 [Claude Code](https://docs.claude.com/en/docs/claude-code) 本身写这个项目(自举!)
- 感谢所有 [contributors](../../graphs/contributors)

---

## Star History

如果这个项目帮到你,给个 ⭐ 让更多人看到!

<a href="https://www.star-history.com/?repos=zander-zyx%2Fclaude-mini-hud">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=zander-zyx/claude-mini-hud&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=zander-zyx/claude-mini-hud&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=zander-zyx/claude-mini-hud&type=date&legend=top-left" />
 </picture>
</a>

---

## English

See [README.en.md](./README.en.md).
