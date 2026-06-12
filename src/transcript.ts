/**
 * claude-mini-hud — Transcript 解析
 *
 * @author  Zander
 * @since   2025-06
 * @see     https://github.com/zander-zyx/claude-mini-hud
 *
 * 读取 transcript JSONL 文件，提取 todos / 工具活动 / Agent / session token
 */

import { open as fsOpen } from 'node:fs/promises';
import type { TodoItem, TranscriptEntry, TranscriptData, ToolActivity, AgentActivity } from './types.js';

const TAIL_BYTES = 512 * 1024;  // 只读尾部 512KB (性能优化)

/** 规范化 task status 字符串 → TodoItem.status */
function normalizeTaskStatus(status: unknown): TodoItem['status'] | null {
  if (typeof status !== 'string') return null;
  switch (status) {
    case 'pending': case 'not_started': return 'pending';
    case 'in_progress': case 'running': return 'in_progress';
    case 'completed': case 'complete': case 'done': return 'completed';
    default: return null;
  }
}

/** 通过 taskId 或索引号在 todos 数组中定位 */
function resolveTaskIndex(
  taskId: string,
  taskIdToIndex: Map<string, number>,
  todos: TodoItem[],
): number | null {
  const mapped = taskIdToIndex.get(taskId);
  if (typeof mapped === 'number') return mapped;
  if (/^\d+$/.test(taskId)) {
    const idx = parseInt(taskId, 10) - 1;
    if (idx >= 0 && idx < todos.length) return idx;
  }
  return null;
}

function truncate(s: string | undefined, max: number): string {
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max - 3) + '...';
}

/** 从 tool_use content block 提取简短显示标签 (文件名 / 搜索词 / URL) */
function shortToolLabel(block: { name?: string; input?: Record<string, unknown> }): string {
  const input = block.input ?? {};
  const name = block.name ?? '';

  // 提取最相关的标识字段
  const fp = typeof input.file_path === 'string' ? input.file_path : '';
  if (fp) {
    const base = fp.replace(/\\/g, '/').split('/').pop() ?? fp;
    return base;
  }

  if (name === 'Grep' || name === 'Glob') {
    const pattern = typeof input.pattern === 'string' ? input.pattern : '';
    return pattern ? `"${truncate(pattern, 30)}"` : '';
  }

  if (name === 'Bash') {
    const cmd = typeof input.command === 'string' ? input.command.replace(/\s+/g, ' ').trim() : '';
    return truncate(cmd, 40);
  }

  if (name === 'WebFetch' || name === 'WebSearch') {
    const url = typeof input.url === 'string' ? input.url : '';
    if (url) {
      try { return new URL(url).hostname; } catch { /* fall through */ }
    }
    const query = typeof input.query === 'string' ? input.query : '';
    if (query) return `"${truncate(query, 30)}"`;
  }

  // fallback: 用 tool name
  return name;
}

/**
 * 读取 transcript 文件并提取聚合数据
 *
 * 策略: 先读尾部 512KB → 如文件更大则补读头部 512KB (找回早期 TaskCreate 映射)
 */
export async function readTranscriptData(transcriptPath: string): Promise<TranscriptData | null> {
  try {
    let todos: TodoItem[] | null = null;
    let hasToolTodos = false;
    const taskIdToIndex = new Map<string, number>();
    let taskCreateCount = 0;
    const seenTaskCreateIds = new Set<string>();

    const toolMap = new Map<string, ToolActivity>();
    const agentSpawns = new Map<string, AgentActivity>();
    const agentResults = new Set<string>();

    const sessionTokens = { input: 0, output: 0, cache: 0 };

    // 检测文件大小, 决定是否只读尾部
    let fileSize = 0;
    try {
      const statFh = await fsOpen(transcriptPath, 'r');
      try { fileSize = (await statFh.stat()).size; } finally { await statFh.close(); }
    } catch { /* 无法打开 */ }

    // 读取内容 (尾部 TAIL_BYTES, 或整个文件)
    let content: string;
    const fh = await fsOpen(transcriptPath, 'r');
    try {
      if (fileSize > TAIL_BYTES) {
        const buf = Buffer.alloc(TAIL_BYTES);
        await fh.read(buf, 0, TAIL_BYTES, fileSize - TAIL_BYTES);
        content = buf.toString('utf8');
        // 丢弃第一行 (可能不完整)
        const firstNl = content.indexOf('\n');
        if (firstNl >= 0) content = content.slice(firstNl + 1);
      } else {
        const buf = Buffer.alloc(fileSize);
        await fh.read(buf, 0, fileSize, 0);
        content = buf.toString('utf8');
      }
    } finally {
      await fh.close();
    }

    const lines = content.split('\n').filter(Boolean);

    let lastUsage: { i: number; o: number; c: number } | null = null;

    // 正向遍历 (保持 TaskCreate / TaskUpdate / tool_use → tool_result 的时间顺序)
    for (let i = 0; i < lines.length; i++) {
      let entry: Record<string, unknown> | null = null;
      try { entry = JSON.parse(lines[i]); } catch { continue; }
      if (!entry) continue;

      const ts = typeof entry.timestamp === 'string' ? new Date(entry.timestamp).getTime() : 0;
      const validTs = !Number.isNaN(ts) && ts > 0 ? ts : Date.now();

      // --- todos: entry.todos 仅在 tool-use 未修改时作种子数据 ---
      if (!hasToolTodos) {
        const td = (entry as { todos?: TodoItem[] }).todos;
        if (Array.isArray(td) && td.length > 0) {
          todos = td;
          taskIdToIndex.clear();
        }
      }

      // --- tool_result: 在 user entry 里 (Claude Code 把工具结果写成 user 消息) ---
      if (entry.type === 'user') {
        const msg = (entry as unknown as TranscriptEntry).message;
        const blocks = Array.isArray(msg?.content) ? msg!.content! : [];
        for (const block of blocks) {
          if (block.type === 'tool_result' && block.tool_use_id) {
            agentResults.add(block.tool_use_id);
            const tool = toolMap.get(block.tool_use_id);
            if (tool) {
              tool.status = (block as { is_error?: boolean }).is_error ? 'error' : 'completed';
            }
          }
        }
      }

      // --- assistant entry: 累加 usage + 解析 tool_use 块 ---
      if (entry.type === 'assistant') {
        // 累加 session token: output 是每轮增量需要累加, input 是累计上下文取最后一轮
        const usage = (entry as { message?: { usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number } } }).message?.usage;
        if (usage) {
          const i = usage.input_tokens ?? 0;
          const o = usage.output_tokens ?? 0;
          const cache = (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
          // 跳过完全相同的连续 usage (Claude Code 可能重复写入)
          // 修复: 用条件包裹代替 continue, 避免跳过同一 entry 中的 tool_use 块
          const isDup = lastUsage && i === lastUsage.i && o === lastUsage.o && cache === lastUsage.c;
          if (!isDup) {
            sessionTokens.input += i;           // input 累加 (兼容 Claude 原生递增 + 第三方每轮增量)
            sessionTokens.output += o;          // output 是每轮增量, 累加
            sessionTokens.cache += cache;       // cache 累加 (智谱等每轮都有 cache_read)
            lastUsage = { i, o, c: cache };
          }
        }
        const msg = (entry as unknown as TranscriptEntry).message;
        const blocks = Array.isArray(msg?.content) ? msg!.content! : [];
        for (const block of blocks) {
          if (block.type === 'tool_use' && block.name && block.id) {
            // TaskCreate: 添加新 todo
            if (block.name === 'TaskCreate') {
              hasToolTodos = true;
              // 用 tool_use_id 去重: head scan 处理过的同一 TaskCreate (fileSize 在 1x~2x TAIL_BYTES 时 head/tail 会重叠)
              if (seenTaskCreateIds.has(block.id)) continue;
              seenTaskCreateIds.add(block.id);

              const input = block.input ?? {};
              const subject = typeof input.subject === 'string' ? input.subject : '';
              const desc = typeof input.description === 'string' ? input.description : '';
              const content = subject || desc || 'Untitled';
              const status = normalizeTaskStatus(input.status) ?? 'pending';

              // 建立 taskId 映射: 优先用 input.taskId, 否则用顺序序号 (1-based, 共享 head scan 后的计数)
              taskCreateCount++;
              const rawId = input.taskId;
              const tid = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : String(taskCreateCount);

              if (!todos) todos = [];
              todos.push({ content, status, activeForm: typeof input.activeForm === 'string' ? input.activeForm : undefined });
              taskIdToIndex.set(tid, todos.length - 1);
              continue;
            }

            // TaskUpdate: 更新已有 todo
            if (block.name === 'TaskUpdate') {
              hasToolTodos = true;
              if (todos) {
                const input = block.input ?? {};
                const idx = resolveTaskIndex(String(input.taskId ?? ''), taskIdToIndex, todos);
                if (idx !== null) {
                  const newStatus = normalizeTaskStatus(input.status);
                  if (newStatus) todos[idx].status = newStatus;
                  const subject = typeof input.subject === 'string' ? input.subject : '';
                  if (subject) todos[idx].content = subject;
                  // activeForm 也需要更新 (TaskUpdate 可能包含新的 activeForm)
                  if (typeof input.activeForm === 'string' && input.activeForm) {
                    todos[idx].activeForm = input.activeForm;
                  }
                }
              }
              continue;
            }

            // TodoWrite: 全量替换 todos
            if (block.name === 'TodoWrite') {
              hasToolTodos = true;
              const input = block.input ?? {};
              const rawTodos = input.todos;
              if (Array.isArray(rawTodos)) {
                todos = rawTodos.map((td: any) => ({
                  content: String(td.content ?? td.subject ?? ''),
                  status: normalizeTaskStatus(td.status) ?? 'pending',
                  activeForm: typeof td.activeForm === 'string' ? td.activeForm : undefined,
                }));
                taskIdToIndex.clear();
              }
              continue;
            }

            // Agent 相关: Agent → 记录 spawn, AgentResult → 记录完成
            if (block.name === 'Agent') {
              const input = block.input ?? {};
              agentSpawns.set(block.id, {
                description: String(input.description ?? input.prompt ?? 'agent').slice(0, 80),
                subagentType: typeof input.subagent_type === 'string' ? input.subagent_type : undefined,
                startTime: validTs,
              });
            }

            // 记录所有 tool_use (含状态追踪)
            toolMap.set(block.id, {
              tool: block.name,
              label: shortToolLabel(block),
              status: 'running',
              id: block.id,
            });
          }

          // tool_result: 更新工具状态
          if (block.type === 'tool_result' && block.tool_use_id) {
            agentResults.add(block.tool_use_id);
            const tool = toolMap.get(block.tool_use_id);
            if (tool) {
              tool.status = (block as { is_error?: boolean }).is_error ? 'error' : 'completed';
            }
          }
        }
      }
    }

    // 活跃 agent = spawned 但未完成
    const activeAgents: AgentActivity[] = [];
    for (const [id, info] of agentSpawns) {
      if (!agentResults.has(id)) {
        activeAgents.push(info);
      }
    }

    // 取最近 20 个工具 (含状态)
    const recentTools = Array.from(toolMap.values()).slice(-20);

    // 文件 > TAIL_BYTES 时, 总是先扫头部, 找回早期的 TaskCreate 建立 taskId → index 映射
    // (否则 tail 里 TaskUpdate 的 taskId 会因 tMap 缺失而解析失败)
    // 同时去重: 只添加 tail 中尚未存在的 task (避免重复导致计数虚高)
    const tailTaskContents = new Set((todos ?? []).map(td => td.content));
    if (fileSize > TAIL_BYTES) {
      const headSize = TAIL_BYTES;
      try {
        const hh = await fsOpen(transcriptPath, 'r');
        try {
          const buf = Buffer.alloc(headSize);
          await hh.read(buf, 0, headSize, 0);
          const headContent = buf.toString('utf8');
          const headLines = headContent.split('\n').filter(Boolean);
          for (const line of headLines) {
            let he: Record<string, unknown> | null = null;
            try { he = JSON.parse(line); } catch { continue; }
            if (!he || he.type !== 'assistant') continue;
            const hBlocks = Array.isArray((he as { message?: { content?: unknown[] } }).message?.content)
              ? ((he as { message: { content: unknown[] } }).message.content as unknown[]) : [];
            for (const hb of hBlocks) {
              const b = hb as { type?: string; name?: string; id?: string; input?: Record<string, unknown> };
              if (b.type === 'tool_use' && b.name && b.id) {
                if (b.name === 'TaskCreate') {
                  // 用 tool_use_id 去重 (理论上 head 不会重复, 但保持对称)
                  if (seenTaskCreateIds.has(b.id)) continue;
                  seenTaskCreateIds.add(b.id);

                  const inp = b.input ?? {};
                  const subj = typeof inp.subject === 'string' ? inp.subject : '';
                  const desc = typeof inp.description === 'string' ? inp.description : '';
                  const taskContent = subj || desc || 'Untitled';
                  taskCreateCount++;
                  const rawId = inp.taskId;
                  const tid = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : String(taskCreateCount);
                  // 只添加 tail 中尚未存在的 task (避免重复导致总数虚高)
                  if (!todos) todos = [];
                  if (!tailTaskContents.has(taskContent)) {
                    todos.push({ content: taskContent, status: 'pending', activeForm: typeof inp.activeForm === 'string' ? inp.activeForm : undefined });
                    taskIdToIndex.set(tid, todos.length - 1);
                  } else {
                    // 已存在: 仅建立 taskIdToIndex 映射 (让 tail 的 TaskUpdate 能找到)
                    const existingIdx = todos.findIndex(td => td.content === taskContent);
                    if (existingIdx >= 0) taskIdToIndex.set(tid, existingIdx);
                  }
                }
                // 注意: head scan 不处理 TaskUpdate!
                // 原因: head scan 在 tail scan 之后运行, 如果在重叠区域处理 TaskUpdate,
                // 会用旧值 (head) 覆盖新值 (tail), 导致 todo 计数不更新/状态回退
                // head scan 的职责: 仅补齐早期 TaskCreate, 建立 taskIdToIndex 映射,
                // 让 tail scan 里的 TaskUpdate 能正确找到对应 todo
              }
            }
          }
        } finally {
          await hh.close();
        }
      } catch { /* 静默 */ }
    }

    return { todos, recentTools, activeAgents, sessionTokens };
  } catch {
    return null;
  }
}

export { truncate };
