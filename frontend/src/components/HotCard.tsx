import { useState } from 'react'
import { type Topic } from '../api/client'
import { ExternalLink, Flame, ChevronDown, ChevronUp, CheckCircle, Clock } from 'lucide-react'

interface HotCardProps {
  topic: Topic
  animate?: boolean
}

function getHeatLevel(score: number) {
  if (score >= 9) return { label: 'CRITICAL', cls: 'badge-critical' }
  if (score >= 7) return { label: 'HIGH', cls: 'badge-high' }
  if (score >= 5) return { label: 'MED', cls: 'badge-med' }
  return { label: 'LOW', cls: 'badge-low' }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

export function HotCard({ topic, animate = false }: HotCardProps) {
  const [expanded, setExpanded] = useState(false)
  const heat = getHeatLevel(topic.heat_score)

  return (
    <div
      className={`hp-card p-4 group ${animate ? 'animate-slide-in' : ''}`}
    >
      {/* ── Badge Row ── */}
      <div className="flex items-center gap-2 flex-wrap mb-2.5">
        {/* Heat level badge */}
        <span className={`badge ${heat.cls}`}>
          <Flame size={10} />
          {heat.label}
        </span>

        {/* Source */}
        <span
          className="flex items-center gap-1.5 text-xs font-medium"
          style={{ color: 'rgba(148,163,184,0.7)' }}
        >
          <span
            className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center text-white"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            {topic.source_name.charAt(0).toUpperCase()}
          </span>
          {topic.source_name}
        </span>

        {/* Tags (max 2) */}
        {topic.tags.slice(0, 2).map(tag => (
          <span key={tag} className="badge badge-tag">{tag}</span>
        ))}

        {/* Keyword tracked → 可信 */}
        {topic.keyword_id && (
          <span className="badge badge-trust">
            <CheckCircle size={9} />
            可信
          </span>
        )}

        {/* Heat score as social count */}
        <span className="ml-auto flex items-center gap-1 text-xs font-semibold" style={{ color: '#fb923c' }}>
          <Flame size={11} />
          热 {topic.heat_score * 10}
        </span>
      </div>

      {/* ── Title ── */}
      <a
        href={topic.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block font-semibold leading-snug mb-2 transition-colors"
        style={{ fontSize: '14px', color: 'rgba(226,232,240,0.92)' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(226,232,240,0.92)')}
      >
        {topic.title}
        <ExternalLink
          size={11}
          className="inline ml-1 opacity-0 group-hover:opacity-40 transition-opacity"
        />
      </a>

      {/* ── AI Summary ── */}
      {topic.summary && (
        <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(148,163,184,0.75)' }}>
          <span className="font-semibold mr-1.5" style={{ color: 'rgba(148,163,184,0.55)' }}>AI 摘要</span>
          {topic.summary}
        </p>
      )}

      {/* ── Footer ── */}
      <div
        className="flex items-center gap-3 text-xs pt-2.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.055)', color: 'rgba(100,116,139,0.8)' }}
      >
        <Clock size={11} />
        <span>抓取 {timeAgo(topic.discovered_at)}</span>

        {topic.tags.length > 2 && (
          <span style={{ color: 'rgba(100,116,139,0.6)' }}>
            +{topic.tags.length - 2} 标签
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 transition-colors"
          style={{ color: 'rgba(100,116,139,0.8)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(226,232,240,0.7)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(100,116,139,0.8)')}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          原始内容
        </button>
      </div>

      {/* ── Expanded ── */}
      {expanded && (
        <div
          className="mt-3 pt-3 space-y-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.055)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.5)' }}>原始链接</p>
          <a
            href={topic.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs break-all transition-colors"
            style={{ color: '#60a5fa' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
            onMouseLeave={e => (e.currentTarget.style.color = '#60a5fa')}
          >
            {topic.source_url}
          </a>
          {topic.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {topic.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded text-[11px]"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(100,116,139,0.8)' }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
