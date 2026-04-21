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
  accent?: boolean;
}

function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  valueColor,
  accent,
}: StatCardProps) {
  const inner = (
    <div
      className="rounded-xl p-4 h-full"
      style={{
        background:
          accent && value > 0 ? "rgba(239,68,68,0.05)" : "rgba(3,7,18,0.8)",
      }}
    >
      <div className="flex items-center gap-2 mb-3 text-slate-500 text-xs">
        <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/[0.04]">
          <Icon size={13} className={iconColor} />
        </span>
        {label}
      </div>
      <div
        className={`text-3xl font-bold tracking-tight font-mono ${valueColor}`}
      >
        {value}
      </div>
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
    setVisibleCount(30);
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

  return (
    <div className="relative">
      {/* Spotlight background effect */}
      <Spotlight className="hidden md:block -top-40" />

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 relative z-10">
        <StatCard
          icon={Activity}
          iconColor="text-blue-400"
          label="总热点"
          value={status?.total_topics ?? allTopics.length}
          valueColor="text-blue-300"
        />
        <StatCard
          icon={Clock}
          iconColor="text-cyan-400"
          label="今日新增"
          value={todayCount}
          valueColor="text-cyan-300"
        />
        <StatCard
          icon={AlertTriangle}
          iconColor="text-red-400"
          label="紧急热点"
          value={urgentCount}
          valueColor="text-red-400"
          accent
        />
        <StatCard
          icon={Tag}
          iconColor="text-emerald-400"
          label="监控词"
          value={activeKeywords}
          valueColor="text-emerald-400"
        />
      </div>

      {/* ── Section Header ── */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <h2 className="flex items-center gap-2 font-semibold text-white text-[15px]">
          <Flame size={15} className="text-orange-400" />
          实时热点流
        </h2>
        <span className="text-xs text-slate-600">扫描完成后自动刷新</span>
      </div>

      {/* ── Sort + Filter Bar ── */}
      <div
        className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 rounded-xl px-3 py-2 relative z-10"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Sort tabs */}
        {sortTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() =>
              setFilters((current) => ({ ...current, sort: tab.key }))
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
            style={{
              background:
                filters.sort === tab.key
                  ? "rgba(255,255,255,0.1)"
                  : "transparent",
              color:
                filters.sort === tab.key ? "#e2e8f0" : "rgba(100,116,139,0.8)",
            }}
          >
            {tab.icon && <tab.icon size={12} />}
            {tab.label}
          </button>
        ))}

        <div
          className="w-px h-4 mx-1"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        {/* Filter chips */}
        <div className="flex items-center gap-1 flex-1">
          {heatFilters.map((f) => (
            <button
              key={String(f.value)}
              onClick={() =>
                setFilters((current) => ({ ...current, minHeat: f.value }))
              }
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all whitespace-nowrap"
              style={{
                background:
                  filters.minHeat === f.value
                    ? "rgba(251,146,60,0.12)"
                    : "transparent",
                color:
                  filters.minHeat === f.value
                    ? "#fb923c"
                    : "rgba(100,116,139,0.8)",
                border:
                  filters.minHeat === f.value
                    ? "1px solid rgba(251,146,60,0.25)"
                    : "1px solid transparent",
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
              background:
                filterCount > 0
                  ? "rgba(59,130,246,0.12)"
                  : "rgba(255,255,255,0.04)",
              color: filterCount > 0 ? "#93c5fd" : "rgba(100,116,139,0.7)",
              border:
                filterCount > 0
                  ? "1px solid rgba(59,130,246,0.2)"
                  : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <SlidersHorizontal size={12} />
            筛选{filterCount > 0 && ` ${filterCount}`}
          </button>
          {filterCount > 0 && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all"
              style={{ color: "rgba(100,116,139,0.7)" }}
            >
              <RotateCcw size={11} />
              重置
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 mb-5 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px_180px] gap-3">
          <label className="relative block">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
            />
            <input
              value={filters.q}
              onChange={(event) =>
                setFilters((current) => ({ ...current, q: event.target.value }))
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
            <HotCard key={topic.id} topic={topic} animate={i < 5} />
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
