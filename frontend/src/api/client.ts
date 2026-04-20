import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Keyword {
  id: number
  keyword: string
  enabled: boolean
  last_checked_at: string | null
  created_at: string
}

export interface Topic {
  id: number
  title: string
  summary: string | null
  source_url: string
  source_name: string
  heat_score: number
  tags: string[]
  is_notified: boolean
  keyword_id: number | null
  discovered_at: string
}

export interface Settings {
  scan_interval: number
  notify_email: string
  smtp_host: string
  smtp_port: number
  smtp_user: string
  ai_model: string
  notify_heat_threshold: number
}

export interface StatusOut {
  scheduler_running: boolean
  next_run: string | null
  total_topics: number
  total_keywords: number
}

// ─── Keywords API ─────────────────────────────────────────────────────────────

export const keywordsApi = {
  list: () => api.get<Keyword[]>('/keywords').then(r => r.data),
  create: (keyword: string, enabled = true) =>
    api.post<Keyword>('/keywords', { keyword, enabled }).then(r => r.data),
  update: (id: number, data: Partial<{ keyword: string; enabled: boolean }>) =>
    api.patch<Keyword>(`/keywords/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/keywords/${id}`),
  hits: (id: number) => api.get<Topic[]>(`/keywords/${id}/hits`).then(r => r.data),
}

// ─── Topics API ───────────────────────────────────────────────────────────────

export const topicsApi = {
  list: (params?: { limit?: number; offset?: number; min_heat?: number }) =>
    api.get<Topic[]>('/topics', { params }).then(r => r.data),
  get: (id: number) => api.get<Topic>(`/topics/${id}`).then(r => r.data),
  scan: () => api.post<{ message: string; triggered: boolean }>('/topics/scan').then(r => r.data),
}

// ─── Settings API ─────────────────────────────────────────────────────────────

export const settingsApi = {
  get: () => api.get<Settings>('/settings').then(r => r.data),
  update: (data: Partial<Settings & { smtp_password?: string; openrouter_api_key?: string }>) =>
    api.put<Settings>('/settings', data).then(r => r.data),
  testEmail: () => api.post<{ message: string }>('/settings/test-email').then(r => r.data),
  status: () => api.get<StatusOut>('/settings/status').then(r => r.data),
}
