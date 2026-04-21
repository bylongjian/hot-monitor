import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  Bell,
  Clock3,
  Orbit,
  Radar,
  RefreshCw,
  Settings,
  Tag,
  Zap,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { topicsApi } from "../api/client";
import { formatFullTime, formatProductTime } from "../lib/utils";
import { SparklesCore } from "./ui/sparkles";
import { MovingBorder } from "./ui/moving-border";

const navItems = [
  { to: "/", icon: Activity, label: "热点雷达" },
  { to: "/keywords", icon: Tag, label: "监控词" },
  { to: "/settings", icon: Settings, label: "设置" },
];

interface LayoutProps {
  children: ReactNode;
  status?: {
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
  };
}

export function Layout({ children, status }: LayoutProps) {
  const qc = useQueryClient();
  const [transientHint, setTransientHint] = useState<{
    type: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const clearHintTimeoutRef = useRef<number | null>(null);
  const previousScanRunningRef = useRef(false);
  const previousFinishedAtRef = useRef<string | null>(null);

  const emitTransientHint = (hint: {
    type: "info" | "success" | "error";
    message: string;
  }) => {
    window.setTimeout(() => {
      setTransientHint(hint);
    }, 0);
  };

  const scheduleHintClear = (delay = 6000) => {
    if (clearHintTimeoutRef.current) {
      window.clearTimeout(clearHintTimeoutRef.current);
    }
    clearHintTimeoutRef.current = window.setTimeout(() => {
      setTransientHint(null);
      clearHintTimeoutRef.current = null;
    }, delay);
  };

  useEffect(() => {
    return () => {
      if (clearHintTimeoutRef.current) {
        window.clearTimeout(clearHintTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!status) return;

    const previousRunning = previousScanRunningRef.current;
    const currentRunning = status.scan_running;
    const finishedAt = status.scan_finished_at;
    const finishedChanged =
      !!finishedAt && previousFinishedAtRef.current !== finishedAt;

    if (previousRunning && finishedChanged) {
      qc.invalidateQueries({ queryKey: ["topics"], exact: false });
      qc.invalidateQueries({ queryKey: ["keywords"], exact: false });
      qc.invalidateQueries({ queryKey: ["keyword-hits"], exact: false });
      qc.invalidateQueries({ queryKey: ["status"], exact: false });
      if (status.last_scan_error) {
        emitTransientHint({
          type: "error",
          message: "扫描已结束，但有部分任务失败",
        });
      } else {
        const durationText = status.last_scan_duration_seconds
          ? `，耗时 ${Math.round(status.last_scan_duration_seconds)} 秒`
          : "";
        emitTransientHint({
          type: "success",
          message: `扫描完成，结果已刷新${durationText}`,
        });
      }
      scheduleHintClear(8000);
    }

    previousScanRunningRef.current = currentRunning;
    previousFinishedAtRef.current = finishedAt;
  }, [qc, status]);

  const scanMutation = useMutation({
    mutationFn: topicsApi.scan,
    onMutate: () => {
      setTransientHint({ type: "info", message: "正在触发扫描，请稍候…" });
    },
    onSuccess: (data) => {
      setTransientHint({
        type: data.triggered ? "info" : "error",
        message: data.message || "扫描状态已更新",
      });
      qc.invalidateQueries({ queryKey: ["status"], exact: false });
      if (!data.triggered) {
        scheduleHintClear(8000);
      }
    },
    onError: () => {
      setTransientHint({
        type: "error",
        message: "扫描失败，请检查后端是否正常运行",
      });
      scheduleHintClear(8000);
    },
  });

  const notifCount = status ? status.total_keywords : 0;
  const isScanBusy = scanMutation.isPending || Boolean(status?.scan_running);
  const statusTimestamp = status?.scan_running
    ? status.scan_started_at
    : status?.last_scan_success_at || status?.scan_finished_at || null;
  const statusTimestampLabel = status?.scan_running
    ? "本轮开始"
    : status?.last_scan_success_at
      ? "上次成功"
      : status?.scan_finished_at
        ? "上次结束"
        : null;
  const statusCards = status
    ? [
        {
          label: "调度器",
          value: status.scheduler_running ? "运行中" : "已停止",
          active: status.scheduler_running,
          meta: status.next_run
            ? `下次 ${formatProductTime(status.next_run)}`
            : "等待配置",
        },
        {
          label: "扫描",
          value: status.scan_running ? "执行中" : "空闲",
          active: status.scan_running,
          meta: status.last_scan_duration_seconds
            ? `耗时 ${Math.round(status.last_scan_duration_seconds)} 秒`
            : "暂无耗时记录",
        },
        {
          label: "监控面",
          value: `${status.total_keywords} 词 / ${status.total_topics} 热点`,
          active: false,
          meta: "持续汇聚中",
        },
      ]
    : [];
  const scanHint =
    transientHint ??
    (status?.scan_running
      ? { type: "info" as const, message: "扫描执行中，完成后会自动刷新" }
      : null);

  return (
    <div className="min-h-screen bg-grid">
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(7, 17, 31, 0.84)",
          borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
          backdropFilter: "blur(20px) saturate(160%)",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 py-4">
          <div className="flex flex-col gap-4 md:gap-3">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="hp-kicker mb-2">AI content command desk</div>
                <div className="flex items-start gap-3">
                  <div className="relative mt-0.5 flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 shadow-[0_12px_32px_rgba(4,13,28,0.36)]">
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(145deg, rgba(17,34,56,0.98) 0%, rgba(18,78,98,0.92) 100%)",
                      }}
                    />
                    <SparklesCore
                      particleDensity={26}
                      particleColor="#dffaff"
                      minSize={0.25}
                      maxSize={0.5}
                      speed={0.16}
                      className="z-[1] opacity-80"
                    />
                    <Zap
                      size={17}
                      className="relative z-[2] text-white"
                      strokeWidth={2.4}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-lg font-semibold tracking-tight text-white">
                        HotPulse
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-medium text-cyan-100">
                        <Radar size={11} />
                        热点情报台
                      </span>
                    </div>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
                      为 AI
                      编程博主压缩判断路径，把扫描状态、热点密度和发布机会放在同一张桌面上。
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 lg:w-[440px]">
                {statusCards.map((card) => (
                  <div key={card.label} className="hp-panel px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        {card.label}
                      </span>
                      <span
                        className="hp-status-dot"
                        data-active={String(card.active)}
                      />
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-100">
                      {card.value}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {card.meta}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="hp-panel flex flex-col gap-3 px-3 py-3 md:flex-row md:items-center md:justify-between xl:flex-1">
                <nav className="flex flex-wrap items-center gap-1">
                  {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === "/"}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]"
                            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                        }`
                      }
                    >
                      <Icon size={15} />
                      {label}
                    </NavLink>
                  ))}
                </nav>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                    <span
                      className="hp-status-dot"
                      data-active={String(Boolean(status?.scheduler_running))}
                    />
                    <span>
                      {status?.scheduler_running ? "调度器在线" : "调度器暂停"}
                    </span>
                  </div>

                  {statusTimestamp && statusTimestampLabel && (
                    <div
                      className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5"
                      title={`${statusTimestampLabel}：${formatFullTime(statusTimestamp)}`}
                    >
                      <Clock3 size={12} />
                      <span>{statusTimestampLabel}</span>
                      <span className="font-medium text-slate-300">
                        {formatProductTime(statusTimestamp)}
                      </span>
                    </div>
                  )}

                  {status?.next_run && !status.scan_running && (
                    <div
                      className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5"
                      title={`下次扫描：${formatFullTime(status.next_run)}`}
                    >
                      <Orbit size={12} />
                      <span>下次</span>
                      <span className="font-medium text-slate-300">
                        {formatProductTime(status.next_run)}
                      </span>
                    </div>
                  )}

                  <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                    <Bell size={12} />
                    <span>监控 {notifCount}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row xl:items-center">
                {scanHint && (
                  <div
                    className="rounded-2xl border px-3 py-2 text-xs md:max-w-[280px]"
                    style={{
                      color:
                        scanHint.type === "error"
                          ? "#fecdd3"
                          : scanHint.type === "success"
                            ? "#cffafe"
                            : "#dbe7f5",
                      borderColor:
                        scanHint.type === "error"
                          ? "rgba(251,113,133,0.24)"
                          : scanHint.type === "success"
                            ? "rgba(34,211,238,0.22)"
                            : "rgba(148,163,184,0.2)",
                      background:
                        scanHint.type === "error"
                          ? "rgba(127,29,29,0.18)"
                          : scanHint.type === "success"
                            ? "rgba(12,74,110,0.22)"
                            : "rgba(8,15,27,0.8)",
                    }}
                  >
                    {scanHint.message}
                  </div>
                )}

                <MovingBorder
                  as="button"
                  duration={3000}
                  containerClassName="rounded-2xl"
                  className="bg-[#091322] px-4 py-2.5 text-sm font-semibold text-white"
                  borderClassName="h-20 w-20 opacity-[0.62]"
                  onClick={() => scanMutation.mutate()}
                  disabled={isScanBusy}
                >
                  <RefreshCw
                    size={14}
                    className={isScanBusy ? "animate-spin" : ""}
                  />
                  {isScanBusy
                    ? "扫描执行中"
                    : scanHint?.type === "success"
                      ? "扫描已触发"
                      : "刷新热点"}
                </MovingBorder>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6 pb-24 md:pb-8 md:pt-8">
        {children}
      </main>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        style={{
          background: "rgba(7, 17, 31, 0.94)",
          borderTop: "1px solid rgba(148, 163, 184, 0.12)",
          backdropFilter: "blur(18px)",
        }}
      >
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                isActive ? "text-cyan-300" : "text-slate-500"
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
