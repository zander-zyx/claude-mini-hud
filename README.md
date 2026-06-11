# 📊 claude-mini-hud

> Claude Code 状态栏 — 上下文 / Token / 任务 / 工具活动 / Agent 追踪 + 国产大模型用量查询 (对标 claude-hud 的轻量版)
> Claude Code statusline — context / token / todos / tools / agents + multi-provider usage (lightweight claude-hud alternative)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-blue)
![Language: TS](https://img.shields.io/badge/TypeScript-ES2022-blue)
![StatusLine](https://img.shields.io/badge/Claude_Code-StatusLine-blueviolet)

[简体中文](#) · [English](./README.en.md) · [安装](#安装) · [FAQ](#faq) · [贡献](#贡献)

---

## 这是什么?

**claude-mini-hud** 是一个 [Claude Code](https://docs.claude.com/en/docs/claude-code) StatusLine 插件,在你的输入框下方持续显示会话的关键指标。**最多 7 行**,信息密度高,对标 [claude-hud](https://github.com/jarrodwatts/claude-hud) 但更轻量。

### 显示效果

**中文 (zh, 默认)** — 完整中文 + emoji:
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

**Minimal (minimal)** — 英中混搭 + 无 emoji:
```
 Context ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
 Token 4.8M (in 3.5M · out 1.2M · cache 103k · ⚡ 45 tok/s)
 当前任务 ▸ 正在写 skill  (1/4)
  ◐ reading index.ts
  ◐ writing utils.ts
  ✓ searching ×3  ✓ running ×1
  [Explore] ◐ Searching code 2m 15s
```

切换: `CLAUDE_MINI_HUD_LANG=zh|en|minimal` (见 [配置](#配置))

**核心特性**:
- ⚡ **零依赖**: TypeScript 多模块架构,编译产物轻量
- 🌍 **三种语言**: 中文 / English / Minimal (英中混搭)
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
| **MiniMax** | URL 含 `minimaxi.com` | `5h:55% 7d:74% m:50% (26d)` |
| **智谱 (GLM)** | URL 含 `bigmodel.cn` | `5h:21% (1h54m) 7d:26% m:30% (26d) mcp:20/1000` |
| **小米 (MiMo)** | URL 含 `xiaomimimo` | `50M/100M m:45% (26d)` |
| **阿里 (DashScope)** | URL 含 `dashscope` | 平台识别 (暂无公开用量 API) |
| **火山引擎 (Ark)** | URL 含 `volces.com` | 平台识别 (暂无公开用量 API) |
| **DeepSeek** | URL 含 `deepseek.com` | `¥123.45` (账户余额) |
| **Kimi** | URL 含 `moonshot.cn` | `¥42.50 (赠送 ¥10.00)` |
| **New API** | 其他非 Anthropic URL | `500k (已用 123k 25%)` |

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
2. **深度适配国产大模型** — 内置智谱 GLM、MiniMax、小米 MiMo、阿里 DashScope、火山引擎 Ark、DeepSeek、Kimi 等平台的 Coding Plan / Token Plan 用量查询，使用第三方代理的用户也能在状态栏实时看到额度消耗

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
🪙 Token 23.1k (in 22.0k · out 342 · cache 768)
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

# 4. 跑 setup (会弹出菜单选 1.中文 / 2.English)
/claude-mini-hud:setup
```

✅ 完成!重启 Claude Code,输入框下方应看到状态栏。

**setup 流程会**:
1. 检测你的操作系统和 Claude 配置目录
2. 询问语言 (中文 / English)
3. 检查现有 statusLine 配置,如有冲突会备份
4. 把 `node <path>/dist/index.js` 写入 `~/.claude/settings.json`
5. 提示重启 + 验证步骤

### 方式 2: 手动 git clone

> 适合想自己控制路径,或调试时改代码立即生效的人。

**Linux / macOS**:

```bash
# 1. 克隆到 Claude 插件目录 (version 是目录名一部分,改版本时同步改)
git clone https://github.com/zander-zyx/claude-mini-hud.git \
  ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0

# 2. 进入目录编译
cd ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0
npm install
npm run build

# 3. 把 statusLine 写入 ~/.claude/settings.json
# 用 jq / 编辑器都行,关键字段:
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0/dist/index.js"
  }
}

# 4. 重启 Claude Code
```

> 💡 **目录命名规范**:Claude Code 期望 `{vendor}/{name}/{version}/` 三级结构。`local` 是 vendor,`claude-mini-hud` 是 name,`0.1.0` 是 version。改代码时**不要改 version**,否则 Claude Code 认为是新插件,会重新跑一次缓存逻辑。

### 方式 3: Windows PowerShell

```powershell
# 1. 克隆
git clone https://github.com/zander-zyx/claude-mini-hud.git $env:USERPROFILE\.claude\plugins\cache\local\claude-mini-hud\0.1.0

# 2. 编译
cd $env:USERPROFILE\.claude\plugins\cache\local\claude-mini-hud\0.1.0
npm install
npm run build

# 3. 设置 statusLine (PowerShell 写法)
$settings = Get-Content $env:USERPROFILE\.claude\settings.json -Raw | ConvertFrom-Json
$settings | Add-Member -Type NoteProperty -Name statusLine -Value @{
  type = "command"
  command = "node $env:USERPROFILE\.claude\plugins\cache\local\claude-mini-hud\0.1.0\dist\index.js"
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
🪙 Token 4.8M (入 3.5M · 出 1.2M · 缓存 103k · ⚡ 45 tok/s)
▶️  当前任务 ▸ 正在写 skill  (1/4)
  ◐ 读取 index.ts
  ◐ 写入 utils.ts
  ✓ 搜索 ×3  ✓ 执行 ×1
  [Explore] ◐ 搜索相关代码 2m 15s
🤖 模型 deepseek-v4-pro  [deepseek]
```

**简洁模式** (没有工具活动和 Agent 时, 自动隐藏对应行):
```
📊 上下文 ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
🪙 Token 4.8M (入 3.5M · 出 1.2M · 缓存 103k)
▶️  当前任务 ▸ 调研充电行业政策  (2/5)
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
| `CLAUDE_MINI_HUD_LANG` | `zh` | `zh` / `en` / `minimal` | 界面语言 (minimal = 英中混搭 + 无 emoji) |
| `CLAUDE_MINI_HUD_SHOW_MODEL` | (未设) | `1` | 设置为 `1` 时显示模型行 |
| `CLAUDE_MINI_HUD_TOKEN_MODE` | `session` | `session` / `context` / `both` | Token 行模式: session=累计 / context=快照 / both=两行 |

**在 statusLine.command 里设置** (推荐):

```jsonc
// ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "CLAUDE_MINI_HUD_LANG=en CLAUDE_MINI_HUD_SHOW_MODEL=1 node ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0/dist/index.js"
  }
}
```

> 💡 **为什么用 env 而非配置文件?**
> 零依赖哲学的延伸 — 不创建任何配置文件,不污染用户项目目录,跟 Claude Code 自身的 env 配置 (`ANTHROPIC_BASE_URL` 等)风格一致。

### 显示字段说明

| 行 | 内容 | 触发条件 | 渲染函数 |
|----|------|---------|---------|
| **📊 上下文** | 进度条 + % + `used / total` + 剩余 | ✅ 必显 | `renderContextLine` |
| **🪙 Token** | 累计 in/out/cache + ⚡速率 | ✅ 必显 | `renderTokenLine` |
| **▶️ 当前任务** | in-progress todo + 完成度 | 有 todo 时 | `renderTodoLine` |
| **🔧 工具** | ◐ 运行中 / ✓ 已完成×N | 有工具活动时 | `renderToolActivityLines` |
| **🤖 Agent** | ◐ 描述 + 耗时 | 有活跃 Agent 时 | `renderAgentLines` |
| **🤖 模型** | 模型名 + provider 标签 | `SHOW_MODEL=1` | `renderModelLine` |

#### Token 行字段详解

`🪙 Token 4.8M (入 3.5M · 出 1.2M · 缓存 103k)` 各部分含义:

| 字段 | 来源 | 用途 |
|------|------|------|
| **入 / in** | `total_input_tokens` (stdin) 或 transcript 累加 | 本次会话累计输入 token |
| **出 / out** | `total_output_tokens` (stdin) 或 transcript 累加 | 本次会话累计输出 token |
| **缓存 / cache** | `cache_creation_input_tokens` + `cache_read_input_tokens` | prompt cache 命中 |
| **⚡ tok/s** | 两次 StatusLine 刷新的 `output_tokens` 差值 | 实时解码速度 |

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

直接改 `src/index.ts` 顶部的 `STRINGS` 表:

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

### 改进度条颜色阈值

`progressBar` 函数:

```ts
function progressBar(percent: number, width: number = 20) {
  const color = percent > 80 ? c.red : percent > 60 ? c.yellow : c.green;
  // 改成你想要的值,例如:
  // const color = percent > 90 ? c.red : percent > 70 ? c.yellow : c.green;
```

### 改进度条宽度

```ts
function progressBar(percent: number, width: number = 30) {  // 30 格更宽
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
ls -la ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0/dist/index.js

# 2. 手动测试,看 stdout 有没有内容
echo '{"model":{"display_name":"test"}}' | node ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0/dist/index.js
# 应该输出: 📊 上下文 ... 🪙 Token ...

# 3. 如果手动跑 OK 但 Claude Code 里没显示,检查 settings.json
cat ~/.claude/settings.json | grep -A2 statusLine
```

### Q: 进度条一直是 0%

**A**: 你用的是 [Claude Code v2.1.5 及以下](https://docs.claude.com/en/docs/claude-code/statusline),它不传 `used_percentage` 字段。本插件会回退到手算 token 百分比,如果 token 数据也空就显示 0%。

**解决**: 升级到最新版 Claude Code:
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
cd ~/.claude/plugins/cache/local/claude-mini-hud/0.1.0
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
npm run build      # tsc 编译 src/index.ts → dist/index.js
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
npm test            # build + typecheck + 跑 32 个测试 (用 tsx 直接跑 ts 测试)
npm run test:stdin  # 手测单个 stdin 输入
npm run typecheck   # 只做类型检查, 不 emit
```

### 开发模式

```bash
npm run dev   # tsc --watch, 自动重新编译
# 另开一个终端:
echo '{"model":{"display_name":"dev"}}' | node dist/index.js
```

### 测试覆盖 (32 个用例)

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
| 14–22 | 多平台检测 (claude/deepseek/minimax/null/kimi/zhipu/xiaomi/alibaba/volcengine) | URL 匹配 |
| 23–32 | 缓存读写 + 端到端 + MiniMax 模型匹配 | 见 `tests/usage.test.ts` |

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
│   ├── render.ts       # 所有渲染函数
│   ├── transcript.ts   # Transcript JSONL 解析
│   └── usage.ts        # 多平台用量/余额查询
└── tests/
    ├── stdin.test.ts   # 状态栏渲染测试 (13 用例)
    └── usage.test.ts   # 多平台用量查询测试 (16 用例)
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
- 为什么现有 6 行还不够?
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

Short-term (v0.2):
- [ ] Session cost display (requires Claude Code to expose `cost` field)
- [ ] Smoother refresh across multi-window switches
- [ ] Read color thresholds from environment variables

Medium-term (v0.3):
- [ ] Theme switching (light / dark / custom)
- [ ] Mouse hover tooltips (subject to Claude Code TUI limits)
- [ ] Clickable statusLine links (jump to current transcript)

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
