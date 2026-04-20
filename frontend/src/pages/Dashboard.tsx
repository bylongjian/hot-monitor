import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { topicsApi, keywordsApi } from '../api/client'
import { HotCard } from '../components/HotCard'
import { Activity, Clock, AlertTriangle, Tag, Flame, SlidersHorizontal, RotateCcw } from 'lucide-react'

type SortKey = 'newest' | 'heat' | 'source'

interface StatCardProps {
  icon: React.ElementType
  iconColor: string
  iconBg: string
  label: string
  value: number
  valueColor: string
  accent?: boolean
}

function StatCard({ icon: Icon, iconColor, iconBg, label, value, valueColor, accent }: StatCardProps) {
  return (
    <div
      className="rounded-xl p-4 border transition-all"
      style={{
        background: accent && value > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.028)',
        borderColor: accent && value > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.072)',
      }}
    >
      <div className="flex items-center gap-2 mb-3" style={{ color: 'rgba(148,163,184,0.65)', fontSize: '12px' }}>
        <span
          className={`w-6 h-6 rounded-md flex items-center justify-center ${iconBg}`}
        >
          <Icon size={13} className={iconColor} />
        </span>
        {label}
      </div>
      <div className={`text-3xl font-bold ${valueColor}`}>{value}</div>
    </div>
  )
}

export function Dashboard() {
  const [sort, setSort] = useState<SortKey>('newest')
  const [minHeat, setMinHeat] = useState<number | null>(null)

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['topics'],
    queryFn: () => topicsApi.list({ limit: 100 }),
    refetchInterval: 30000,
  })

  const { data: keywords = [] } = useQuery({
    queryKey: ['keywords'],
    queryFn: keywordsApi.list,
  })

  const todayCount = useMemo(() => {
    const today = new Date().toDateString()
    return topics.filter(t => new Date(t.discovered_at).toDateString() === today).length
  }, [topics])

  const urgentCount = topics.filter(t => t.heat_score >= 9).length
  const activeKeywords = keywords.filter(k => k.enabled).length

  const sortTabs: { key: SortKey; label: string; icon?: React.ElementType }[] = [
    { key: 'newest', label: '最新发现', icon: Clock },
    { key: 'heat',   label: '热度综合', icon: Flame },
    { key: 'source', label: '按来源' },
  ]

  const heatFilters: { label: string; value: number | null; dot?: string }[] = [
    { label: '全部', value: null },
    { label: '高', value: 7, dot: '#fb923c' },
    { label: '极热', value: 9, dot: '#f87171' },
  ]

  const filteredTopics = useMemo(() => {
    let result = [...topics]
    if (minHeat !== null) result = result.filter(t => t.heat_score >= minHeat)
    switch (sort) {
      case 'heat':   result.sort((a, b) => b.heat_score - a.heat_score); break
      case 'source': result.sort((a, b) => a.source_name.localeCompare(b.source_name)); break
      default:       result.sort((a, b) => new Date(b.discovered_at).getTime() - new Date(a.discovered_at).getTime())
    }
    return result
  }, [topics, sort, minHeat])

  const hasFilter = minHeat !== null
  const filterCount = hasFilter ? 1 : 0

  const resetFilters = () => {
    setMinHeat(null)
  }

  return (
    <div>
      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={Activity} iconColor="text-blue-400" iconBg="bg-blue-500/10"
          label="总热点" value={topics.length} valueColor="text-blue-300"
        />
        <StatCard
          icon={Clock} iconColor="text-cyan-400" iconBg="bg-cyan-500/10"
          label="今日新增" value={todayCount} valueColor="text-cyan-300"
        />
        <StatCard
          icon={AlertTriangle} iconColor="text-red-400" iconBg="bg-red-500/10"
          label="紧急热点" value={urgentCount} valueColor="text-red-400" accent
        />
        <StatCard
          icon={Tag} iconColor="text-green-400" iconBg="bg-green-500/10"
          label="监控词" value={activeKeywords} valueColor="text-green-400"
        />
      </div>

      {/* ── Section Header ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 font-semibold text-white" style={{ fontSize: '15px' }}>
          <Flame size={15} className="text-orange-400" />
          实时热点流
        </h2>
        <span style={{ fontSize: '12px', color: 'rgba(100,116,139,0.7)' }}>每 30 分钟自动更新</span>
      </div>

      {/* ── Sort + Filter Bar ── */}
      <div
        className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 rounded-xl px-3 py-2"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.065)' }}
      >
        {/* Sort tabs */}
        {sortTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSort(tab.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
            style={{
              background: sort === tab.key ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: sort === tab.key ? '#e2e8f0' : 'rgba(100,116,139,0.8)',
            }}
          >
            {tab.icon && <tab.icon size={12} />}
            {tab.label}
          </button>
        ))}

        <div
          className="w-px h-4 mx-1"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        />

        {/* Filter chips */}
        <div className="flex items-center gap-1 flex-1">
          {heatFilters.map(f => (
            <button
              key={String(f.value)}
              onClick={() => setMinHeat(f.value)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all whitespace-nowrap"
              style={{
                background: minHeat === f.value ? 'rgba(251,146,60,0.12)' : 'transparent',
                color: minHeat === f.value ? '#fb923c' : 'rgba(100,116,139,0.8)',
                border: minHeat === f.value ? '1px solid rgba(251,146,60,0.25)' : '1px solid transparent',
              }}
            >
              {f.dot && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: f.dot }}
                />
              )}
              {f.label}
            </button>
          ))}
        </div>

        {/* Filter count + Reset */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all"
            style={{
              background: filterCount > 0 ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
              color: filterCount > 0 ? '#93c5fd' : 'rgba(100,116,139,0.7)',
              border: filterCount > 0 ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <SlidersHorizontal size={12} />
            筛选{filterCount > 0 && ` ${filterCount}`}
          </button>
          {filterCount > 0 && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all"
              style={{ color: 'rgba(100,116,139,0.7)' }}
            >
              <RotateCcw size={11} />
              重置
            </button>
          )}
        </div>
      </div>

      {/* ── Topic List ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl animate-pulse"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            />
          ))}
        </div>
      ) : filteredTopics.length === 0 ? (
        <div
          className="text-center py-20 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Flame size={32} className="mx-auto mb-3 text-orange-500/30" />
          <p className="text-sm" style={{ color: 'rgba(100,116,139,0.7)' }}>
            暂无热点数据，请在顶部点击「立即扫描」
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTopics.map((topic, i) => (
            <HotCard key={topic.id} topic={topic} animate={i < 5} />
          ))}
        </div>
      )}
    </div>
  )
}
