import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Activity, Tag, Settings, Bell, Zap, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { topicsApi } from "../api/client";
import {
  formatAbsoluteTime,
  formatFullTime,
  formatProductTime,
} from "../lib/utils";
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
  const [scanHint, setScanHint] = useState<{
    type: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const clearHintTimeoutRef = useRef<number | null>(null);
  const previousScanRunningRef = useRef(false);
  const previousFinishedAtRef = useRef<string | null>(null);

  const scheduleHintClear = (delay = 6000) => {
    if (clearHintTimeoutRef.current) {
      window.clearTimeout(clearHintTimeoutRef.current);
    }
    clearHintTimeoutRef.current = window.setTimeout(() => {
      setScanHint(null);
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

    if (currentRunning) {
      setScanHint({ type: "info", message: "扫描执行中，完成后会自动刷新" });
    } else if (previousRunning && finishedChanged) {
      qc.invalidateQueries({ queryKey: ["topics"], exact: false });
      qc.invalidateQueries({ queryKey: ["keywords"], exact: false });
      qc.invalidateQueries({ queryKey: ["keyword-hits"], exact: false });
      qc.invalidateQueries({ queryKey: ["status"], exact: false });
      if (status.last_scan_error) {
        setScanHint({
          type: "error",
          message: "扫描已结束，但有部分任务失败",
        });
      } else {
        const durationText = status.last_scan_duration_seconds
          ? `，耗时 ${Math.round(status.last_scan_duration_seconds)} 秒`
          : "";
        setScanHint({
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
      setScanHint({ type: "info", message: "正在触发扫描，请稍候…" });
    },
    onSuccess: (data) => {
      setScanHint({
        type: data.triggered ? "info" : "error",
        message: data.message || "扫描状态已更新",
      });
      qc.invalidateQueries({ queryKey: ["status"], exact: false });
      if (!data.triggered) {
        scheduleHintClear(8000);
      }
    },
    onError: () => {
      setScanHint({
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

  return (
    <div className="min-h-screen bg-grid" style={{ background: "#030712" }}>
      {/* ── Top Header ── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(3,7,18,0.88)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(16px) saturate(180%)",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mr-2">
            <div className="relative w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
                }}
              />
              <SparklesCore
                particleDensity={36}
                particleColor="#ffffff"
                minSize={0.3}
                maxSize={0.6}
                speed={0.2}
                className="z-[1]"
              />
              <Zap
                size={14}
                className="text-white relative z-[2]"
                strokeWidth={2.5}
              />
            </div>
            <div className="leading-none select-none">
              <p className="text-sm font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
                HotPulse
              </p>
              <p className="text-[10px] text-slate-500">AI 热点雷达</p>
            </div>
          </div>

          {/* Nav tabs */}
          <nav className="flex items-center gap-0.5">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-white bg-white/[0.08]"
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
                  }`
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Scheduler status */}
          {status && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: status.scheduler_running
                      ? "#22c55e"
                      : "#6b7280",
                    boxShadow: status.scheduler_running
                      ? "0 0 6px #22c55e"
                      : "none",
                  }}
                />
                {status.scheduler_running ? "运行中" : "已停止"}
              </div>
              {statusTimestamp && statusTimestampLabel && (
                <div
                  className="hidden xl:flex items-center gap-1.5 rounded-lg border px-2 py-1"
                  style={{
                    borderColor: "rgba(148,163,184,0.14)",
                    background: "rgba(15,23,42,0.24)",
                  }}
                  title={`${statusTimestampLabel}：${formatFullTime(statusTimestamp)}`}
                >
                  <span className="text-slate-500">{statusTimestampLabel}</span>
                  <span className="text-slate-300">
                    {formatProductTime(statusTimestamp)}
                  </span>
                  <span className="text-slate-700">
                    {formatAbsoluteTime(statusTimestamp)}
                  </span>
                </div>
              )}
              {scanHint && (
                <span
                  className="px-2 py-1 rounded-lg border"
                  style={{
                    color:
                      scanHint.type === "error"
                        ? "#fca5a5"
                        : scanHint.type === "success"
                          ? "#67e8f9"
                          : "#cbd5e1",
                    borderColor:
                      scanHint.type === "error"
                        ? "rgba(248,113,113,0.25)"
                        : scanHint.type === "success"
                          ? "rgba(34,211,238,0.25)"
                          : "rgba(148,163,184,0.2)",
                    background:
                      scanHint.type === "error"
                        ? "rgba(127,29,29,0.12)"
                        : scanHint.type === "success"
                          ? "rgba(8,145,178,0.12)"
                          : "rgba(15,23,42,0.35)",
                  }}
                >
                  {scanHint.message}
                </span>
              )}
            </div>
          )}

          {/* Scan button with MovingBorder */}
          <MovingBorder
            as="button"
            duration={3000}
            containerClassName="rounded-xl"
            className="bg-[#060d1f] px-3.5 py-1.5 text-sm font-medium text-white"
            borderClassName="h-16 w-16 opacity-[0.7]"
            onClick={() => scanMutation.mutate()}
            disabled={isScanBusy}
          >
            <RefreshCw size={13} className={isScanBusy ? "animate-spin" : ""} />
            {isScanBusy
              ? "扫描中..."
              : scanHint?.type === "success"
                ? "已触发"
                : "立即扫描"}
          </MovingBorder>

          {/* Monitor status chip */}
          <div
            className="hidden sm:flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-400"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
            aria-label="监控词数量"
          >
            <Bell size={13} />
            <span>监控 {notifCount}</span>
          </div>
        </div>

        {scanHint && (
          <div className="max-w-6xl mx-auto px-5 pb-3 md:hidden">
            <div
              className="text-xs px-3 py-2 rounded-xl border"
              style={{
                color:
                  scanHint.type === "error"
                    ? "#fca5a5"
                    : scanHint.type === "success"
                      ? "#67e8f9"
                      : "#cbd5e1",
                borderColor:
                  scanHint.type === "error"
                    ? "rgba(248,113,113,0.25)"
                    : scanHint.type === "success"
                      ? "rgba(34,211,238,0.25)"
                      : "rgba(148,163,184,0.2)",
                background:
                  scanHint.type === "error"
                    ? "rgba(127,29,29,0.12)"
                    : scanHint.type === "success"
                      ? "rgba(8,145,178,0.12)"
                      : "rgba(15,23,42,0.35)",
              }}
            >
              {scanHint.message}
            </div>
          </div>
        )}
      </header>

      {/* ── Page Content ── */}
      <main className="max-w-6xl mx-auto px-5 py-6 pb-24 md:pb-8">
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        style={{
          background: "rgba(3,7,18,0.95)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(16px)",
        }}
      >
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                isActive ? "text-cyan-400" : "text-slate-600"
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
