import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Activity, Tag, Settings, Bell, Zap, RefreshCw } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { topicsApi } from '../api/client'

const navItems = [
  { to: '/', icon: Activity, label: '热点雷达' },
  { to: '/keywords', icon: Tag, label: '监控词' },
  { to: '/settings', icon: Settings, label: '设置' },
]

interface LayoutProps {
  children: ReactNode
  status?: { scheduler_running: boolean; total_topics: number; total_keywords: number }
}

export function Layout({ children, status }: LayoutProps) {
  const qc = useQueryClient()
  const scanMutation = useMutation({
    mutationFn: topicsApi.scan,
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['topics'] })
        qc.invalidateQueries({ queryKey: ['status'] })
      }, 2000)
    },
  })

  const notifCount = status ? status.total_keywords : 0

  return (
    <div className="min-h-screen" style={{ background: '#0b0f1a' }}>
      {/* ── Top Header ── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: 'rgba(11,15,26,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mr-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                boxShadow: '0 0 14px rgba(59,130,246,0.4)',
              }}
            >
              <Zap size={15} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="leading-none select-none">
              <p className="text-sm font-bold text-white">HotPulse</p>
              <p className="text-[11px]" style={{ color: 'rgba(148,163,184,0.6)' }}>AI 热点雷达</p>
            </div>
          </div>

          {/* Nav tabs */}
          <nav className="flex items-center gap-0.5">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`
                }
                style={({ isActive }) => isActive ? { background: 'rgba(255,255,255,0.09)' } : {}}
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Scheduler status dot */}
          {status && (
            <div className="hidden md:flex items-center gap-1.5 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: status.scheduler_running ? '#22c55e' : '#6b7280',
                  boxShadow: status.scheduler_running ? '0 0 5px #22c55e' : 'none',
                }}
              />
              {status.scheduler_running ? '运行中' : '已停止'}
            </div>
          )}

          {/* Scan button */}
          <button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="hp-btn hp-btn-primary"
          >
            <RefreshCw size={13} className={scanMutation.isPending ? 'animate-spin' : ''} />
            立即扫描
          </button>

          {/* Bell with badge */}
          <div className="relative">
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ color: 'rgba(148,163,184,0.7)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              aria-label="通知"
            >
              <Bell size={15} />
            </button>
            {notifCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1"
                style={{ background: '#3b82f6' }}
              >
                {notifCount > 9 ? '9+' : notifCount}
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
          background: 'rgba(11,15,26,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                isActive ? 'text-blue-400' : 'text-slate-600'
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
