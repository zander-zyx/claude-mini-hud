/**
 * claude-mini-hud — 共享类型定义
 */

// ─── stdin 契约 (Claude Code StatusLine JSON) ────────────────────────────

export interface StdinData {
  model?: { display_name?: string; id?: string };
  context_window?: {
    current_usage?: {
      input_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      output_tokens?: number;
    };
    context_window_size?: number;
    used_percentage?: number;
    // Claude Code 上报的 session 累计 token (比 current_usage 更可靠)
    total_input_tokens?: number | null;
    total_output_tokens?: number | null;
  };
  transcript_path?: string;
  rate_limits?: {
    five_hour?: { used_percentage?: number; resets_at?: number };
    seven_day?: { used_percentage?: number; resets_at?: number };
  };
  cost?: {
    total_cost_usd?: number;
    total_duration_ms?: number;
  };
  workspace?: { current_dir?: string; project_dir?: string };
}

// ─── Todo ─────────────────────────────────────────────────────────────────

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}

// ─── Transcript ───────────────────────────────────────────────────────────

export interface TranscriptEntry {
  type: 'user' | 'assistant' | 'system';
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string; name?: string; id?: string; input?: Record<string, unknown>; tool_use_id?: string }>;
  };
  timestamp?: string;
}

// 从 transcript 一次读取提取的聚合数据 (避免多次读大文件)
export interface TranscriptData {
  todos: TodoItem[] | null;
  recentTools: ToolActivity[];
  activeAgents: AgentActivity[];
  sessionTokens: { input: number; output: number; cache: number } | null;
}

export interface ToolActivity {
  tool: string;
  label: string;
  status: 'running' | 'completed' | 'error';
  id: string;
}

export interface AgentActivity {
  description: string;
  subagentType?: string;
  startTime: number;  // Date.now() 时间戳, 用于计算耗时
}

// ─── Token ────────────────────────────────────────────────────────────────

export interface TokenBreakdown {
  input: number;
  output: number;
  cache: number;
  total: number;
}
