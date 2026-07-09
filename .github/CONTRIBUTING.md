# 贡献指南

感谢你愿意为 **claude-mini-hud** 出力！项目欢迎 Issue、PR、新平台适配、主题、文档改进。

## 🎯 项目原则（务必先读）

这三条是硬约束，PR 不符合会被要求调整：

1. **零运行时依赖** — 只用 Node.js 内置模块（`node:fs`、`node:https`、`node:crypto` …），**不引入任何 npm 运行时包**。`devDependencies`（`tsx`、`typescript`、`@types/node`）只用于编译/测试，不算。
2. **永不崩溃 Claude Code** — 所有外部调用（HTTP、文件、git）必须包 try-catch，失败时**静默跳过**或降级，绝不抛到 stderr 让宿主崩。状态栏插件崩了 = 用户 Claude Code 卡住。
3. **轻量** — `dist/` 编译产物保持小，单进程启动快（目标 10ms 级）。不为小功能引大模块。

其他原则：稳定 > 正确 > 可验证 > 最小改动。优先复用现有代码，不破坏现有逻辑。

## 🚀 快速开始

```bash
git clone https://github.com/zander-zyx/claude-mini-hud.git
cd claude-mini-hud
npm install          # 装 dev 依赖
npm run build        # 编译 TS → dist/
npm test             # build + typecheck + 48 测试
```

本地试用：

```bash
npm run test:stdin   # 喂一份示例 stdin，看输出
```

或在 `~/.claude/settings.json` 里把 `statusLine.command` 指向你本地 `dist/index.js`，在真实 Claude Code 里看效果。

## 🐛 提 Bug

直接用 [Bug 报告模板](/.github/ISSUE_TEMPLATE/bug_report.md)。

**最关键的一步**：开 `CLAUDE_MINI_HUD_DEBUG=1` 复现一次，把 stderr 日志贴出来（**记得删 token**）。

## 💡 提功能 / 适配新平台

用 [功能建议模板](/.github/ISSUE_TEMPLATE/feature_request.md)。

适配新平台的话，模板里有需要你填的字段（API 文档、返回 JSON、鉴权方式），填得越全，接入越快。

## 🔧 提 PR

1. 从 `main` 拉分支：`git checkout -b feat/xxx` 或 `fix/xxx`
2. 改代码，跑 `npm test` 确保全绿
3. 如果改了显示，至少手动跑一次 `npm run test:stdin` 看输出
4. 提 PR，描述按模板填，关联 Issue
5. 等 review

### 代码风格

- TypeScript，目标 ES2022
- 不配 linter，但请保持和周边代码风格一致（缩进、命名、注释密度）
- 中文注释 OK，英文注释也 OK，**和所在文件保持一致就行**

### 加进度条主题

主题系统在 `src/themes.ts`。每个主题是一个 `ThemeConfig`，主要填：

- `filled` / `empty` — 进度条填充和空白字符
- `runningMark` / `completedMark` — 工具/Agent 图标

加完主题记得：

1. 在类型联合 `ThemeName` 里加上新名字
2. 在 README / README.en.md 的主题预览里补一行
3. 加测试（如果渲染逻辑有变化）

### 加平台用量查询

平台查询都在 `src/usage.ts`，按 `queryXxx` 命名。参考现有的 `queryDeepSeek` / `queryZhipu` 即可。要点：

1. 检测：在 `detectPlatform` 里按 `ANTHROPIC_BASE_URL` 域名匹配
2. 查询：所有 HTTP 调用 try-catch，失败返回 `null`
3. 缓存：用 `sessionCachePath` + `atomicWrite`，别自己 `writeFileSync`
4. 文档：在 README 的"支持平台"表里补一行

## 📝 改文档

README 改了的话，**README.en.md 同步改**（中英两份是手动维护的）。测试数、版本号、主题数变化时尤其要同步。

## 🤝 行为准则

- 友善、尊重、对事不对人
- 一句话能说清的别写三段
- 拒绝任何形式的歧视、骚扰、人身攻击

## 📄 License

提交即表示你同意以 [MIT License](../LICENSE) 发布你的贡献。
