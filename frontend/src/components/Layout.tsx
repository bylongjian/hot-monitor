import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Activity, Tag, Settings, Bell, Zap, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { topicsApi } from "../api/client";
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
  };
}

export function Layout({ children, status }: LayoutProps) {
  const qc = useQueryClient();
  const scanMutation = useMutation({
    mutationFn: topicsApi.scan,
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["topics"] });
        qc.invalidateQueries({ queryKey: ["status"] });
      }, 2000);
    },
  });

  const notifCount = status ? status.total_keywords : 0;

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
                particleDensity={100}
                particleColor="#ffffff"
                minSize={0.3}
                maxSize={0.8}
                speed={0.4}
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
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: status.scheduler_running ? "#22c55e" : "#6b7280",
                  boxShadow: status.scheduler_running
                    ? "0 0 6px #22c55e"
                    : "none",
                }}
              />
              {status.scheduler_running ? "运行中" : "已停止"}
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
            disabled={scanMutation.isPending}
          >
            <RefreshCw
              size={13}
              className={scanMutation.isPending ? "animate-spin" : ""}
            />
            立即扫描
          </MovingBorder>

          {/* Bell with badge */}
          <div className="relative">
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all text-slate-600 hover:text-slate-400 hover:bg-white/[0.05]"
              aria-label="通知"
            >
              <Bell size={15} />
            </button>
            {notifCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1"
                style={{
                  background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                  boxShadow: "0 0 8px rgba(59,130,246,0.4)",
                }}
              >
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </div>
        </div>
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
