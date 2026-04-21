import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  timeout: 30000,
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Keyword {
  id: number;
  keyword: string;
  enabled: boolean;
  type: "keyword" | "account";
  platform: string | null;
  account_id: string | null;
  last_checked_at: string | null;
  created_at: string;
}

export interface Topic {
  id: number;
  title: string;
  summary: string | null;
  source_url: string;
  source_name: string;
  heat_score: number;
  tags: string[];
  is_notified: boolean;
  keyword_id: number | null;
  discovered_at: string;
}

export interface Settings {
  scan_interval: number;
  notify_email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  ai_model: string;
  notify_heat_threshold: number;
  min_heat_score: number;
}

export interface StatusOut {
  scheduler_running: boolean;
  next_run: string | null;
  total_topics: number;
  total_keywords: number;
  scan_running: boolean;
  scan_started_at: string | null;
  scan_finished_at: string | null;
  last_scan_success_at: string | null;
  last_scan_duration_seconds: number | null;
  last_scan_error: string | null;
}

export interface TopicsListParams {
  limit?: number;
  offset?: number;
  min_heat?: number;
  sort?: "newest" | "heat" | "matched" | "unnotified";
  source_names?: string[];
  keyword_mode?: "all" | "matched" | "unmatched";
  time_range?: "all" | "6h" | "24h" | "48h" | "7d";
  tag?: string;
  q?: string;
}

export interface KeywordsListParams {
  enabled?: "all" | "enabled" | "disabled";
  type?: "all" | "keyword" | "account";
  platform?: string;
  search?: string;
  sort?: "created_desc" | "created_asc";
}

// ─── Keywords API ─────────────────────────────────────────────────────────────

export const keywordsApi = {
  list: (params?: KeywordsListParams) =>
    api.get<Keyword[]>("/keywords", { params }).then((r) => r.data),
  create: (data: {
    keyword: string;
    enabled?: boolean;
    type?: "keyword" | "account";
    platform?: string;
    account_id?: string;
  }) => api.post<Keyword>("/keywords", data).then((r) => r.data),
  update: (
    id: number,
    data: Partial<{
      keyword: string;
      enabled: boolean;
      type: "keyword" | "account";
      platform: string;
      account_id: string;
    }>,
  ) => api.patch<Keyword>(`/keywords/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/keywords/${id}`),
  hits: (id: number) =>
    api.get<Topic[]>(`/keywords/${id}/hits`).then((r) => r.data),
};

// ─── Topics API ───────────────────────────────────────────────────────────────

export const topicsApi = {
  list: (params?: TopicsListParams) => {
    const normalizedParams = {
      ...params,
      source_names: params?.source_names?.length
        ? params.source_names.join(",")
        : undefined,
    };
    return api
      .get<Topic[]>("/topics", { params: normalizedParams })
      .then((r) => r.data);
  },
  get: (id: number) => api.get<Topic>(`/topics/${id}`).then((r) => r.data),
  scan: () =>
    api
      .post<{ message: string; triggered: boolean }>("/topics/scan")
      .then((r) => r.data),
};

// ─── Settings API ─────────────────────────────────────────────────────────────

export const settingsApi = {
  get: () => api.get<Settings>("/settings").then((r) => r.data),
  update: (
    data: Partial<
      Settings & { smtp_password?: string; openrouter_api_key?: string }
    >,
  ) => api.put<Settings>("/settings", data).then((r) => r.data),
  testEmail: () =>
    api.post<{ message: string }>("/settings/test-email").then((r) => r.data),
  status: () => api.get<StatusOut>("/settings/status").then((r) => r.data),
};
