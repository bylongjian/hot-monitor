import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  keywordsApi,
  settingsApi,
  topicsApi,
  type TopicsListParams,
} from "../api/client";
import { HotCard } from "../components/HotCard";
import { Spotlight } from "../components/ui/spotlight";
import { BackgroundGradient } from "../components/ui/background-gradient";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Tag,
  Flame,
  SlidersHorizontal,
  RotateCcw,
  Search,
  BellOff,
  Radar,
  Sparkles,
  Gauge,
  Filter,
  Orbit,
} from "lucide-react";

type SortKey = "newest" | "heat" | "matched" | "unnotified";
type TimeRange = "all" | "6h" | "24h" | "48h" | "7d";
type KeywordMode = "all" | "matched" | "unmatched";

interface DashboardFilters {
  sort: SortKey;
  minHeat: number | null;
  sourceNames: string[];
  keywordMode: KeywordMode;
  timeRange: TimeRange;
  tag: string;
  q: string;
}

const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {
  sort: "newest",
  minHeat: null,
  sourceNames: [],
  keywordMode: "all",
  timeRange: "all",
  tag: "",
  q: "",
};

function parseDashboardFilters(
  searchParams: URLSearchParams,
): DashboardFilters {
  const sort = searchParams.get("sort");
  const keywordMode = searchParams.get("keywordMode");
  const timeRange = searchParams.get("timeRange");
  const minHeatParam = searchParams.get("minHeat");

  return {
    sort:
      sort === "heat" || sort === "matched" || sort === "unnotified"
        ? sort
        : "newest",
    minHeat: minHeatParam ? Number(minHeatParam) || null : null,
    sourceNames: (searchParams.get("sources") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    keywordMode:
      keywordMode === "matched" || keywordMode === "unmatched"
        ? keywordMode
        : "all",
    timeRange:
      timeRange === "6h" ||
      timeRange === "24h" ||
      timeRange === "48h" ||
      timeRange === "7d"
        ? timeRange
        : "all",
    tag: searchParams.get("tag") || "",
    q: searchParams.get("q") || "",
  };
}

function buildDashboardSearchParams(
  filters: DashboardFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.sort !== DEFAULT_DASHBOARD_FILTERS.sort) {
    params.set("sort", filters.sort);
  }
  if (filters.minHeat !== null) {
    params.set("minHeat", String(filters.minHeat));
  }
  if (filters.sourceNames.length > 0) {
    params.set("sources", filters.sourceNames.join(","));
  }
  if (filters.keywordMode !== DEFAULT_DASHBOARD_FILTERS.keywordMode) {
    params.set("keywordMode", filters.keywordMode);
  }
  if (filters.timeRange !== DEFAULT_DASHBOARD_FILTERS.timeRange) {
    params.set("timeRange", filters.timeRange);
  }
  if (filters.tag) {
    params.set("tag", filters.tag);
  }
  if (filters.q.trim()) {
    params.set("q", filters.q.trim());
  }
  return params;
}

interface StatCardProps {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value: number;
  valueColor: string;
  note: string;
  accent?: boolean;
}

function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  valueColor,
  note,
  accent,
}: StatCardProps) {
  const inner = (
    <div
      className="h-full rounded-[18px] p-4"
      style={{
        background:
          accent && value > 0
            ? "linear-gradient(180deg, rgba(127,29,29,0.18), rgba(17,24,39,0.78))"
            : "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(8,15,27,0.92))",
      }}
    >
      <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.04]">
          <Icon size={13} className={iconColor} />
        </span>
        {label}
      </div>
      <div
        className={`font-mono text-3xl font-bold tracking-tight ${valueColor}`}
      >
        {value}
      </div>
      <div className="mt-2 text-xs text-slate-500">{note}</div>
    </div>
  );

  if (accent && value > 0) {
    return (
      <BackgroundGradient containerClassName="rounded-xl" animate={false}>
        {inner}
      </BackgroundGradient>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      {inner}
    </div>
  );
}

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<DashboardFilters>(() =>
    parseDashboardFilters(searchParams),
  );
  const [showAllSources, setShowAllSources] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const [expandedTopicIds, setExpandedTopicIds] = useState<number[]>([]);
  const deferredSearch = useDeferredValue(filters.q.trim());

  useEffect(() => {
    const next = buildDashboardSearchParams(filters).toString();
    const current = searchParams.toString();
    if (next !== current) {
      setSearchParams(
        next ? buildDashboardSearchParams(filters) : new URLSearchParams(),
        {
          replace: true,
        },
      );
    }
  }, [filters, searchParams, setSearchParams]);

  const { data: allTopics = [] } = useQuery({
    queryKey: ["topics", "stats"],
    queryFn: () => topicsApi.list({ limit: 100 }),
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  const { data: status } = useQuery({
    queryKey: ["status", "dashboard"],
    queryFn: settingsApi.status,
    staleTime: 10000,
  });

  const listParams = useMemo<TopicsListParams>(
    () => ({
      limit: 100,
      sort: filters.sort,
      min_heat: filters.minHeat ?? undefined,
      source_names: filters.sourceNames.length
        ? filters.sourceNames
        : undefined,
      keyword_mode: filters.keywordMode,
      time_range: filters.timeRange,
      tag: filters.tag || undefined,
      q: deferredSearch || undefined,
    }),
    [deferredSearch, filters],
  );

  const {
    data: topics = [],
    isLoading,
    isError: isTopicsError,
  } = useQuery({
    queryKey: ["topics", "list", listParams],
    queryFn: () => topicsApi.list(listParams),
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  const { data: keywords = [] } = useQuery({
    queryKey: ["keywords", "stats"],
    queryFn: () => keywordsApi.list(),
  });

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return allTopics.filter(
      (t) => new Date(t.discovered_at).toDateString() === today,
    ).length;
  }, [allTopics]);

  const urgentCount = allTopics.filter((t) => t.heat_score >= 9).length;
  const activeKeywords = keywords.filter((k) => k.enabled).length;

  const sortTabs: { key: SortKey; label: string; icon?: React.ElementType }[] =
    [
      { key: "newest", label: "最新发现", icon: Clock },
      { key: "heat", label: "热度最高", icon: Flame },
      { key: "matched", label: "命中优先", icon: CheckCircle2 },
      { key: "unnotified", label: "未通知优先", icon: BellOff },
    ];

  const heatFilters: { label: string; value: number | null; dot?: string }[] = [
    { label: "全部", value: null },
    { label: "中热", value: 5, dot: "#fbbf24" },
    { label: "高", value: 7, dot: "#fb923c" },
    { label: "极热", value: 9, dot: "#f87171" },
  ];

  const keywordFilters: { key: KeywordMode; label: string }[] = [
    { key: "all", label: "全部来源" },
    { key: "matched", label: "仅监控词命中" },
    { key: "unmatched", label: "仅自动发现" },
  ];

  const timeFilters: { key: TimeRange; label: string }[] = [
    { key: "all", label: "全部时间" },
    { key: "6h", label: "6 小时" },
    { key: "24h", label: "24 小时" },
    { key: "48h", label: "48 小时" },
    { key: "7d", label: "7 天" },
  ];

  const sourceOptions = useMemo(
    () => [...new Set(allTopics.map((topic) => topic.source_name))].sort(),
    [allTopics],
  );

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const topic of allTopics) {
      for (const topicTag of topic.tags) {
        counts.set(topicTag, (counts.get(topicTag) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tagName]) => tagName)
      .slice(0, 10);
  }, [allTopics]);

  const visibleSourceOptions = showAllSources
    ? sourceOptions
    : sourceOptions.slice(0, 8);
  const visibleTagOptions = showAllTags ? tagOptions : tagOptions.slice(0, 6);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisibleCount(30);
      setExpandedTopicIds([]);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [listParams]);

  const filterCount = [
    filters.minHeat !== null,
    filters.sourceNames.length > 0,
    filters.keywordMode !== "all",
    filters.timeRange !== "all",
    filters.tag !== "",
    deferredSearch !== "",
  ].filter(Boolean).length;
  const visibleTopics = topics.slice(0, visibleCount);
  const hasMoreTopics = topics.length > visibleCount;
  const allVisibleExpanded =
    visibleTopics.length > 0 &&
    visibleTopics.every((topic) => expandedTopicIds.includes(topic.id));

  const resetFilters = () => {
    setFilters(DEFAULT_DASHBOARD_FILTERS);
  };

  const toggleSource = (sourceName: string) => {
    setFilters((current) => ({
      ...current,
      sourceNames: current.sourceNames.includes(sourceName)
        ? current.sourceNames.filter((item) => item !== sourceName)
        : [...current.sourceNames, sourceName],
    }));
  };

  const toggleAllExpanded = () => {
    if (allVisibleExpanded) {
      setExpandedTopicIds([]);
      return;
    }
    setExpandedTopicIds(visibleTopics.map((topic) => topic.id));
  };

  const handleTopicExpandedChange = (
    topicId: number,
    nextExpanded: boolean,
  ) => {
    setExpandedTopicIds((current) => {
      if (nextExpanded) {
        return current.includes(topicId) ? current : [...current, topicId];
      }
      return current.filter((id) => id !== topicId);
    });
  };

  return (
    <div className="relative">
      <Spotlight
        className="pointer-events-none hidden md:block -top-44 opacity-80"
        gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(189, 96%, 72%, .10) 0, hsla(189, 96%, 50%, .04) 48%, hsla(189, 96%, 45%, 0) 80%)"
        gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(35, 100%, 72%, .08) 0, hsla(35, 100%, 55%, .03) 70%, transparent 100%)"
        gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(210, 100%, 85%, .05) 0, hsla(210, 100%, 45%, .02) 78%, transparent 100%)"
        duration={9}
        xOffset={44}
        translateY={-310}
      />

      <section className="hp-card relative z-10 mb-6 overflow-hidden p-5 md:p-6">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(103,232,249,0.12),transparent_48%)]" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.9fr)] lg:items-end">
          <div>
            <div className="hp-kicker mb-3">Live publishing radar</div>
            <h1 className="max-w-3xl text-2xl font-semibold tracking-tight text-white md:text-[32px] md:leading-[1.15]">
              今天最值得抢先判断与发布的 AI 热点
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 md:text-[15px]">
              这里不是泛列表，而是给内容创作者的快反工作台。你可以直接在卡片里完成价值判断，减少无效跳转，把注意力留给真正值得抢发的话题。
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
                <Gauge size={13} className="text-cyan-300" />
                总热点 {status?.total_topics ?? allTopics.length}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
                <Sparkles size={13} className="text-orange-300" />
                今日新增 {todayCount}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
                <Orbit size={13} className="text-emerald-300" />
                {status?.scan_running ? "扫描执行中" : "扫描结束后自动刷新"}
              </span>
            </div>
          </div>

          <div className="rounded-[20px] border border-white/[0.08] bg-[#091322]/84 p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <Radar size={12} className="text-cyan-300" />
              当前视图策略
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  排序
                </p>
                <p className="mt-1 text-sm font-medium text-slate-100">
                  {sortTabs.find((tab) => tab.key === filters.sort)?.label}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  筛选强度
                </p>
                <p className="mt-1 text-sm font-medium text-slate-100">
                  {filterCount > 0
                    ? `${filterCount} 个条件激活`
                    : "未施加额外限制"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  热点流
                </p>
                <p className="mt-1 text-sm font-medium text-slate-100">
                  当前展示 {visibleTopics.length} / {topics.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Activity}
          iconColor="text-blue-400"
          label="总热点"
          value={status?.total_topics ?? allTopics.length}
          valueColor="text-blue-300"
          note="当前数据库热点规模"
        />
        <StatCard
          icon={Clock}
          iconColor="text-cyan-400"
          label="今日新增"
          value={todayCount}
          valueColor="text-cyan-300"
          note="按发现时间统计"
        />
        <StatCard
          icon={AlertTriangle}
          iconColor="text-red-400"
          label="紧急热点"
          value={urgentCount}
          valueColor="text-red-400"
          note="热度 9 分及以上"
          accent
        />
        <StatCard
          icon={Tag}
          iconColor="text-emerald-400"
          label="监控词"
          value={activeKeywords}
          valueColor="text-emerald-400"
          note="当前启用的监控范围"
        />
      </div>

      <div className="relative z-10 mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="hp-kicker mb-2">Realtime intelligence flow</div>
          <h2 className="flex items-center gap-2 text-[18px] font-semibold text-white">
            <Flame size={16} className="text-orange-400" />
            热点流
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            先判断价值，再决定是否跳转原站点。展开区保留完整线索与原始描述。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAllExpanded}
            className="rounded-full border border-white/[0.08] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:text-white"
          >
            {allVisibleExpanded ? "收起全部详情" : "展开全部详情"}
          </button>
          <span className="text-xs text-slate-500">扫描完成后自动刷新</span>
        </div>
      </div>

      <section className="hp-card relative z-10 mb-5 p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <Filter size={12} className="text-cyan-300" />
              视图控制台
            </div>
            <p className="text-sm text-slate-400">
              来源与标签基于最近 100
              条热点聚合，用于快速收窄视野，不代表全库精确统计。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
              <SlidersHorizontal size={12} />
              筛选{filterCount > 0 ? ` ${filterCount}` : " 0"}
            </span>
            {filterCount > 0 && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:text-white"
              >
                <RotateCcw size={11} />
                重置
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {sortTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() =>
                setFilters((current) => ({ ...current, sort: tab.key }))
              }
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all"
              style={{
                background:
                  filters.sort === tab.key
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.02)",
                color:
                  filters.sort === tab.key
                    ? "#e5edf7"
                    : "rgba(148,163,184,0.82)",
                border:
                  filters.sort === tab.key
                    ? "1px solid rgba(148,163,184,0.16)"
                    : "1px solid rgba(255,255,255,0.04)",
              }}
            >
              {tab.icon && <tab.icon size={12} />}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {heatFilters.map((filter) => (
            <button
              key={String(filter.value)}
              onClick={() =>
                setFilters((current) => ({ ...current, minHeat: filter.value }))
              }
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background:
                  filters.minHeat === filter.value
                    ? "rgba(251,191,36,0.12)"
                    : "rgba(255,255,255,0.02)",
                color:
                  filters.minHeat === filter.value
                    ? "#fcd34d"
                    : "rgba(148,163,184,0.82)",
                border:
                  filters.minHeat === filter.value
                    ? "1px solid rgba(251,191,36,0.2)"
                    : "1px solid rgba(255,255,255,0.04)",
              }}
            >
              {filter.dot && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: filter.dot }}
                />
              )}
              {filter.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px_180px] gap-3">
            <label className="relative block">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                value={filters.q}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    q: event.target.value,
                  }))
                }
                placeholder="搜索标题或 AI 摘要..."
                aria-label="搜索热点"
                className="hp-input pl-9"
              />
            </label>

            <select
              value={filters.keywordMode}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  keywordMode: event.target.value as KeywordMode,
                }))
              }
              aria-label="关键词命中筛选"
              className="hp-input"
            >
              {keywordFilters.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={filters.timeRange}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  timeRange: event.target.value as TimeRange,
                }))
              }
              aria-label="时间范围筛选"
              className="hp-input"
            >
              {timeFilters.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {sourceOptions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                来源
              </p>
              <div className="flex flex-wrap gap-2">
                {visibleSourceOptions.map((sourceName) => {
                  const active = filters.sourceNames.includes(sourceName);
                  return (
                    <button
                      key={sourceName}
                      onClick={() => toggleSource(sourceName)}
                      className="px-2.5 py-1 rounded-md text-xs transition-all border"
                      style={{
                        background: active
                          ? "rgba(34,211,238,0.12)"
                          : "rgba(255,255,255,0.02)",
                        borderColor: active
                          ? "rgba(34,211,238,0.28)"
                          : "rgba(255,255,255,0.06)",
                        color: active ? "#67e8f9" : "rgba(148,163,184,0.78)",
                      }}
                    >
                      {sourceName}
                    </button>
                  );
                })}
              </div>
              {sourceOptions.length > visibleSourceOptions.length && (
                <button
                  onClick={() => setShowAllSources(true)}
                  className="text-xs transition-colors"
                  style={{ color: "rgba(103,232,249,0.88)" }}
                >
                  更多来源 +{sourceOptions.length - visibleSourceOptions.length}
                </button>
              )}
              {showAllSources && sourceOptions.length > 8 && (
                <button
                  onClick={() => setShowAllSources(false)}
                  className="text-xs transition-colors"
                  style={{ color: "rgba(148,163,184,0.85)" }}
                >
                  收起来源
                </button>
              )}
            </div>
          )}

          {tagOptions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                标签
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    setFilters((current) => ({ ...current, tag: "" }))
                  }
                  className="px-2.5 py-1 rounded-md text-xs transition-all border"
                  style={{
                    background:
                      filters.tag === ""
                        ? "rgba(59,130,246,0.12)"
                        : "rgba(255,255,255,0.02)",
                    borderColor:
                      filters.tag === ""
                        ? "rgba(59,130,246,0.28)"
                        : "rgba(255,255,255,0.06)",
                    color:
                      filters.tag === "" ? "#93c5fd" : "rgba(148,163,184,0.78)",
                  }}
                >
                  全部标签
                </button>
                {visibleTagOptions.map((tagName) => {
                  const active = filters.tag === tagName;
                  return (
                    <button
                      key={tagName}
                      onClick={() =>
                        setFilters((current) => ({
                          ...current,
                          tag: current.tag === tagName ? "" : tagName,
                        }))
                      }
                      className="px-2.5 py-1 rounded-md text-xs transition-all border"
                      style={{
                        background: active
                          ? "rgba(16,185,129,0.12)"
                          : "rgba(255,255,255,0.02)",
                        borderColor: active
                          ? "rgba(16,185,129,0.28)"
                          : "rgba(255,255,255,0.06)",
                        color: active ? "#6ee7b7" : "rgba(148,163,184,0.78)",
                      }}
                    >
                      {tagName}
                    </button>
                  );
                })}
              </div>
              {tagOptions.length > visibleTagOptions.length && (
                <button
                  onClick={() => setShowAllTags(true)}
                  className="text-xs transition-colors"
                  style={{ color: "rgba(110,231,183,0.9)" }}
                >
                  更多标签 +{tagOptions.length - visibleTagOptions.length}
                </button>
              )}
              {showAllTags && tagOptions.length > 6 && (
                <button
                  onClick={() => setShowAllTags(false)}
                  className="text-xs transition-colors"
                  style={{ color: "rgba(148,163,184,0.85)" }}
                >
                  收起标签
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Topic List ── */}
      {isLoading ? (
        <div className="space-y-2 relative z-10">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl animate-pulse"
              style={{ background: "rgba(255,255,255,0.02)" }}
            />
          ))}
        </div>
      ) : isTopicsError ? (
        <div
          className="text-center py-20 rounded-xl relative z-10"
          style={{
            background: "rgba(127,29,29,0.12)",
            border: "1px solid rgba(248,113,113,0.15)",
          }}
        >
          <AlertTriangle size={32} className="mx-auto mb-3 text-red-400/70" />
          <p className="text-sm text-red-200">热点加载失败，请稍后重试</p>
        </div>
      ) : topics.length === 0 ? (
        <div
          className="text-center py-20 rounded-xl relative z-10"
          style={{
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <Flame size={32} className="mx-auto mb-3 text-orange-500/20" />
          <p className="text-sm text-slate-600">
            {filterCount > 0 || filters.sort !== "newest"
              ? "当前筛选下暂无匹配热点，试试重置条件"
              : "暂无热点数据，点击顶部「立即扫描」开始追踪"}
          </p>
        </div>
      ) : (
        <div className="space-y-2 relative z-10">
          {visibleTopics.map((topic, i) => (
            <HotCard
              key={topic.id}
              topic={topic}
              animate={i < 5}
              expanded={expandedTopicIds.includes(topic.id)}
              onExpandedChange={(nextExpanded) =>
                handleTopicExpandedChange(topic.id, nextExpanded)
              }
            />
          ))}
          {hasMoreTopics && (
            <button
              onClick={() => setVisibleCount((count) => count + 20)}
              className="hp-btn hp-btn-ghost w-full justify-center"
            >
              继续加载更多热点
            </button>
          )}
        </div>
      )}
    </div>
  );
}
