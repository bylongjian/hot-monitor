import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { settingsApi, type Settings } from "../api/client";
import {
  Save,
  Mail,
  Bot,
  Clock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Gauge,
  Radar,
  ShieldCheck,
} from "lucide-react";

const AI_MODELS = [
  { value: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2 (默认)" },
  { value: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
  { value: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "anthropic/claude-3-haiku", label: "Claude 3 Haiku" },
];

const SMTP_PRESETS = [
  { name: "Gmail", host: "smtp.gmail.com", port: 587 },
  { name: "QQ邮箱", host: "smtp.qq.com", port: 587 },
  { name: "163邮箱", host: "smtp.163.com", port: 465 },
  { name: "Outlook", host: "smtp.office365.com", port: 587 },
];

export function SettingsPage() {
  const [form, setForm] = useState<
    Partial<Settings & { smtp_password: string; openrouter_api_key: string }>
  >({});
  const [showPwd, setShowPwd] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
  });

  useEffect(() => {
    if (!data) return;
    const timer = window.setTimeout(() => setForm(data), 0);
    return () => window.clearTimeout(timer);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: typeof form) => settingsApi.update(payload),
    onSuccess: () => showToast("success", "设置已保存"),
    onError: () => showToast("error", "保存失败，请重试"),
  });

  const testEmailMutation = useMutation({
    mutationFn: settingsApi.testEmail,
    onSuccess: (r) => showToast("success", r.message),
    onError: () => showToast("error", "邮件发送失败，请检查 SMTP 配置"),
  });

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const set = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  if (isLoading) {
    return (
      <div className="max-w-xl space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="hp-card h-24 animate-pulse"
            style={{ background: "rgba(255,255,255,0.02)" }}
          />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="max-w-xl rounded-xl px-5 py-10 text-center"
        style={{
          background: "rgba(127,29,29,0.12)",
          border: "1px solid rgba(248,113,113,0.15)",
        }}
      >
        <AlertCircle size={28} className="mx-auto mb-3 text-red-300" />
        <p className="text-sm text-red-200">设置加载失败，请刷新后重试</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <section className="hp-card mb-6 overflow-hidden p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.9fr)] lg:items-start">
          <div>
            <div className="hp-kicker mb-3">System control room</div>
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-[30px]">
              系统设置
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              管理 AI
              分析、扫描频率与通知通道。这里保留最少但关键的配置项，避免你在紧急发现热点时被设置本身拖慢。
            </p>
          </div>

          <div className="rounded-[20px] border border-white/[0.08] bg-[#091322]/84 p-4">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <Radar size={13} />
                  扫描间隔
                </span>
                <span>{form.scan_interval ?? 60} 分钟</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <Gauge size={13} />
                  通知阈值
                </span>
                <span>≥ {form.notify_heat_threshold ?? 8}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <ShieldCheck size={13} />
                  入库阈值
                </span>
                <span>≥ {form.min_heat_score ?? 7}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Config */}
      <Section title="AI 配置" icon={<Bot size={13} />}>
        <Field label="OpenRouter API Key">
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={form.openrouter_api_key || ""}
              onChange={(e) => set("openrouter_api_key", e.target.value)}
              placeholder="sk-or-..."
              className="hp-input pr-9 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
            >
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <p className="text-xs mt-1.5 text-slate-600">
            从{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              openrouter.ai/keys
            </a>{" "}
            获取
          </p>
        </Field>

        <Field label="AI 模型">
          <select
            value={form.ai_model || "deepseek/deepseek-v3.2"}
            onChange={(e) => set("ai_model", e.target.value)}
            className="hp-input"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            {AI_MODELS.map((m) => (
              <option
                key={m.value}
                value={m.value}
                style={{ background: "#070b14" }}
              >
                {m.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* Scan config */}
      <Section title="扫描设置" icon={<Clock size={13} />}>
        <Field label={`扫描间隔：${form.scan_interval ?? 60} 分钟`}>
          <input
            type="range"
            min={10}
            max={360}
            step={10}
            value={form.scan_interval ?? 60}
            onChange={(e) => set("scan_interval", Number(e.target.value))}
            className="w-full h-1.5 accent-blue-500 rounded-full"
          />
          <div className="flex justify-between text-xs mt-1 text-slate-600">
            <span>10m</span>
            <span>1h</span>
            <span>2h</span>
            <span>6h</span>
          </div>
        </Field>

        <Field label={`通知热度阈值：≥ ${form.notify_heat_threshold ?? 8} 分`}>
          <input
            type="range"
            min={1}
            max={10}
            value={form.notify_heat_threshold ?? 8}
            onChange={(e) =>
              set("notify_heat_threshold", Number(e.target.value))
            }
            className="w-full h-1.5 accent-orange-500 rounded-full"
          />
          <div className="flex justify-between text-xs mt-1 text-slate-600">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </Field>

        <Field label={`最低入库热度：≥ ${form.min_heat_score ?? 7} 分`}>
          <input
            type="range"
            min={1}
            max={10}
            value={form.min_heat_score ?? 7}
            onChange={(e) => set("min_heat_score", Number(e.target.value))}
            className="w-full h-1.5 accent-cyan-500 rounded-full"
          />
          <div className="flex justify-between text-xs mt-1 text-slate-600">
            <span>1（全部入库）</span>
            <span>7（推荐）</span>
            <span>10</span>
          </div>
          <p className="text-xs mt-1 text-slate-600">
            AI 评分低于此值的内容不会写入数据库
          </p>
        </Field>
      </Section>

      {/* Email config */}
      <Section title="邮件通知" icon={<Mail size={13} />}>
        <Field label="SMTP 快速选择">
          <div className="flex gap-2 flex-wrap">
            {SMTP_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  set("smtp_host", p.host);
                  set("smtp_port", p.port);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  form.smtp_host === p.host
                    ? "bg-blue-500/10 border-blue-500/25 text-blue-300"
                    : "bg-white/[0.02] border-white/[0.07] text-slate-500 hover:text-slate-400 hover:bg-white/[0.04]"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Field label="SMTP 主机">
              <input
                type="text"
                value={form.smtp_host || ""}
                onChange={(e) => set("smtp_host", e.target.value)}
                className="hp-input"
                placeholder="smtp.gmail.com"
              />
            </Field>
          </div>
          <div>
            <Field label="端口">
              <input
                type="number"
                value={form.smtp_port || 587}
                onChange={(e) => set("smtp_port", Number(e.target.value))}
                className="hp-input"
              />
            </Field>
          </div>
        </div>

        <Field label="发件邮箱">
          <input
            type="email"
            value={form.smtp_user || ""}
            onChange={(e) => set("smtp_user", e.target.value)}
            placeholder="your@example.com"
            className="hp-input"
          />
        </Field>

        <Field label="授权码 / App Password">
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              value={form.smtp_password || ""}
              onChange={(e) => set("smtp_password", e.target.value)}
              placeholder="••••••••••••"
              className="hp-input pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
            >
              {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </Field>

        <Field label="接收通知的邮箱">
          <input
            type="email"
            value={form.notify_email || ""}
            onChange={(e) => set("notify_email", e.target.value)}
            placeholder="notify@example.com"
            className="hp-input"
          />
        </Field>

        <button
          type="button"
          onClick={() => testEmailMutation.mutate()}
          disabled={testEmailMutation.isPending}
          className="hp-btn hp-btn-ghost w-full justify-center mt-1"
        >
          {testEmailMutation.isPending ? "发送中..." : "发送测试邮件"}
        </button>
      </Section>

      {/* Save button */}
      <button
        onClick={() => saveMutation.mutate(form)}
        disabled={saveMutation.isPending}
        className="hp-btn hp-btn-primary w-full justify-center py-2.5 mt-1 text-sm font-semibold"
      >
        <Save size={14} />
        {saveMutation.isPending ? "保存中..." : "保存设置"}
      </button>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm shadow-xl z-50"
            style={{
              background:
                toast.type === "success"
                  ? "rgba(20,83,45,0.92)"
                  : "rgba(127,29,29,0.92)",
              borderColor:
                toast.type === "success"
                  ? "rgba(34,197,94,0.25)"
                  : "rgba(239,68,68,0.25)",
              color: toast.type === "success" ? "#86efac" : "#fca5a5",
              backdropFilter: "blur(12px)",
            }}
          >
            {toast.type === "success" ? (
              <CheckCircle size={13} />
            ) : (
              <AlertCircle size={13} />
            )}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="hp-card p-4 mb-3">
      <h2
        className="flex items-center gap-2 text-xs font-medium mb-4 pb-2 text-slate-500"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        {icon}
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs mb-1.5 text-slate-500">{label}</label>
      {children}
    </div>
  );
}
