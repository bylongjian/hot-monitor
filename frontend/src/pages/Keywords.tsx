import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AxiosError } from "axios";
import {
  keywordsApi,
  type Keyword,
  type KeywordsListParams,
} from "../api/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  Clock,
  Search,
  User,
  Hash,
  Radar,
  Sparkles,
  SlidersHorizontal,
  CalendarClock,
} from "lucide-react";
import { HotCard } from "../components/HotCard";
import {
  formatAbsoluteTime,
  formatFullTime,
  formatProductTime,
} from "../lib/utils";

const PLATFORMS = [
  { value: "bilibili", label: "B站", placeholder: "UP主 UID（纯数字）" },
  { value: "zhihu", label: "知乎", placeholder: "用户 URL ID" },
  { value: "weibo", label: "微博", placeholder: "用户 UID（纯数字）" },
  { value: "twitter", label: "X/Twitter", placeholder: "用户名（不含@）" },
  { value: "github", label: "GitHub", placeholder: "用户名或组织名" },
];

const DEFAULT_KEYWORD_LIST_FILTERS: KeywordsListParams = {
  enabled: "all",
  type: "all",
  platform: "",
  search: "",
  sort: "created_desc",
};

function parseKeywordListFilters(
  searchParams: URLSearchParams,
): KeywordsListParams {
  const enabled = searchParams.get("enabled");
  const type = searchParams.get("type");
  const sort = searchParams.get("sort");

  return {
    enabled: enabled === "enabled" || enabled === "disabled" ? enabled : "all",
    type: type === "keyword" || type === "account" ? type : "all",
    platform: searchParams.get("platform") || "",
    search: searchParams.get("search") || "",
    sort: sort === "created_asc" ? "created_asc" : "created_desc",
  };
}

function buildKeywordListSearchParams(
  filters: KeywordsListParams,
): URLSearchParams {
  const params = new URLSearchParams();
  if (
    filters.enabled &&
    filters.enabled !== DEFAULT_KEYWORD_LIST_FILTERS.enabled
  ) {
    params.set("enabled", filters.enabled);
  }
  if (filters.type && filters.type !== DEFAULT_KEYWORD_LIST_FILTERS.type) {
    params.set("type", filters.type);
  }
  if (filters.platform) {
    params.set("platform", filters.platform);
  }
  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }
  if (filters.sort && filters.sort !== DEFAULT_KEYWORD_LIST_FILTERS.sort) {
    params.set("sort", filters.sort);
  }
  return params;
}

export function Keywords() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [newKw, setNewKw] = useState("");
  const [kwType, setKwType] = useState<"keyword" | "account">("keyword");
  const [platform, setPlatform] = useState("bilibili");
  const [accountId, setAccountId] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [listFilters, setListFilters] = useState<KeywordsListParams>(() =>
    parseKeywordListFilters(searchParams),
  );
  const deferredSearch = useDeferredValue((listFilters.search || "").trim());

  useEffect(() => {
    const next = buildKeywordListSearchParams(listFilters).toString();
    const current = searchParams.toString();
    if (next !== current) {
      setSearchParams(
        next
          ? buildKeywordListSearchParams(listFilters)
          : new URLSearchParams(),
        { replace: true },
      );
    }
  }, [listFilters, searchParams, setSearchParams]);

  const queryParams = useMemo<KeywordsListParams>(
    () => ({
      enabled: listFilters.enabled,
      type: listFilters.type,
      platform:
        listFilters.type === "account" && listFilters.platform
          ? listFilters.platform
          : undefined,
      search: deferredSearch || undefined,
      sort: listFilters.sort,
    }),
    [deferredSearch, listFilters],
  );

  const { data: keywords = [], isLoading } = useQuery({
    queryKey: ["keywords", "list", queryParams],
    queryFn: () => keywordsApi.list(queryParams),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof keywordsApi.create>[0]) =>
      keywordsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["keywords"] });
      setNewKw("");
      setAccountId("");
      setActionError(null);
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      setActionError(
        error.response?.data?.detail || "添加失败，关键词可能已存在",
      );
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      keywordsApi.update(id, { enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["keywords"] });
      setActionError(null);
    },
    onError: () => setActionError("更新监控状态失败，请稍后重试"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => keywordsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["keywords"] });
      if (expandedId !== null) {
        setExpandedId((current) => current);
      }
      setActionError(null);
    },
    onError: () => setActionError("删除失败，请稍后重试"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newKw.trim();
    if (!trimmed) return;
    if (kwType === "account") {
      const aid = accountId.trim();
      if (!aid) return;
      createMutation.mutate({
        keyword: trimmed,
        type: "account",
        platform,
        account_id: aid,
      });
    } else {
      createMutation.mutate({ keyword: trimmed, type: "keyword" });
    }
  };

  const toggleExpand = async (kw: Keyword) => {
    if (expandedId === kw.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(kw.id);
  };

  const currentPlatform = PLATFORMS.find((p) => p.value === platform);
  const filterCount = [
    listFilters.enabled !== "all",
    listFilters.type !== "all",
    !!listFilters.platform,
    !!deferredSearch,
    listFilters.sort !== "created_desc",
  ].filter(Boolean).length;

  const resetListFilters = () => {
    setListFilters(DEFAULT_KEYWORD_LIST_FILTERS);
  };

  const activeCount = keywords.filter((item) => item.enabled).length;
  const accountCount = keywords.filter(
    (item) => item.type === "account",
  ).length;

  return (
    <div>
      <section className="hp-card mb-6 overflow-hidden p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.9fr)] lg:items-start">
          <div>
            <div className="hp-kicker mb-3">Monitoring orchestration</div>
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-[30px]">
              监控词编排台
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              把关键词、账号和命中记录压到一个操作面里。你可以在这里调整监控范围、追踪活跃度，并直接查看命中热点详情。
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
                <Radar size={13} className="text-cyan-300" />
                监控中 {activeCount}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
                <User size={13} className="text-violet-300" />
                账号追踪 {accountCount}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
                <Sparkles size={13} className="text-orange-300" />
                命中记录复用热点详情卡
              </span>
            </div>
          </div>

          <div className="rounded-[20px] border border-white/[0.08] bg-[#091322]/84 p-4">
            <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
              当前录入策略
            </p>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">新增模式</span>
                <span>{kwType === "account" ? "账号监控" : "关键词监控"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">列表筛选</span>
                <span>
                  {filterCount > 0 ? `${filterCount} 项已激活` : "未筛选"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">检索目标</span>
                <span>{keywords.length} 条当前可见</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="hp-card mb-6 p-4 md:p-5">
        <div
          className="mb-4 flex gap-1 rounded-2xl p-1 w-fit"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <button
            onClick={() => setKwType("keyword")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
              kwType === "keyword"
                ? "bg-cyan-500/20 text-cyan-300"
                : "text-slate-500 hover:text-slate-300"
            }`}
            type="button"
          >
            <Hash size={12} />
            关键词
          </button>
          <button
            onClick={() => setKwType("account")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
              kwType === "account"
                ? "bg-cyan-500/20 text-cyan-300"
                : "text-slate-500 hover:text-slate-300"
            }`}
            type="button"
          >
            <User size={12} />
            账号
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {kwType === "account" && (
            <div className="flex gap-2">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="hp-input w-28 text-xs"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder={currentPlatform?.placeholder || "账号 ID"}
                className="hp-input flex-1"
              />
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                type="text"
                value={newKw}
                onChange={(e) => setNewKw(e.target.value)}
                placeholder={
                  kwType === "account"
                    ? "显示名称，如：XX 官方..."
                    : "输入关键词，如：GPT-5、Claude 4..."
                }
                maxLength={200}
                className="hp-input pl-9"
              />
            </div>
            <button
              type="submit"
              disabled={
                !newKw.trim() ||
                createMutation.isPending ||
                (kwType === "account" && !accountId.trim())
              }
              className="hp-btn hp-btn-primary"
            >
              <Plus size={13} />
              添加
            </button>
          </div>
        </form>
      </section>

      <div
        className="hp-card mb-5 space-y-3 px-4 py-4"
        style={{
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <SlidersHorizontal size={12} />
            列表筛选
            {filterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/20">
                {filterCount}
              </span>
            )}
          </div>
          {filterCount > 0 && (
            <button
              onClick={resetListFilters}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              type="button"
            >
              <ChevronUp size={12} className="rotate-45" />
              重置
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
          <select
            value={listFilters.enabled}
            onChange={(event) =>
              setListFilters((current) => ({
                ...current,
                enabled: event.target.value as KeywordsListParams["enabled"],
              }))
            }
            className="hp-input"
            aria-label="监控状态筛选"
          >
            <option value="all">全部状态</option>
            <option value="enabled">仅监控中</option>
            <option value="disabled">仅已停用</option>
          </select>

          <select
            value={listFilters.type}
            onChange={(event) =>
              setListFilters((current) => {
                const nextType = event.target
                  .value as KeywordsListParams["type"];
                return {
                  ...current,
                  type: nextType,
                  platform: nextType === "account" ? current.platform : "",
                };
              })
            }
            className="hp-input"
            aria-label="监控类型筛选"
          >
            <option value="all">全部类型</option>
            <option value="keyword">仅关键词</option>
            <option value="account">仅账号</option>
          </select>

          <select
            value={listFilters.platform}
            onChange={(event) =>
              setListFilters((current) => ({
                ...current,
                platform: event.target.value,
              }))
            }
            className="hp-input"
            aria-label="平台筛选"
            disabled={listFilters.type !== "account"}
          >
            <option value="">全部平台</option>
            {PLATFORMS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            value={listFilters.sort}
            onChange={(event) =>
              setListFilters((current) => ({
                ...current,
                sort: event.target.value as KeywordsListParams["sort"],
              }))
            }
            className="hp-input"
            aria-label="创建时间排序"
          >
            <option value="created_desc">最新创建</option>
            <option value="created_asc">最早创建</option>
          </select>

          <label className="relative block">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
            />
            <input
              value={listFilters.search}
              onChange={(event) =>
                setListFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="搜索名称或账号 ID..."
              className="hp-input pl-9"
              aria-label="搜索监控项"
            />
          </label>
        </div>
      </div>

      {/* Keywords list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl animate-pulse"
              style={{ background: "rgba(255,255,255,0.02)" }}
            />
          ))}
        </div>
      ) : keywords.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <Search size={28} className="mx-auto mb-3 text-slate-700" />
          <p className="text-sm text-slate-600">
            {filterCount > 0
              ? "当前筛选下暂无监控项，试试调整条件"
              : "暂无监控词，请添加你想追踪的热点关键词"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keywords.map((kw) => (
            <div key={kw.id} className="hp-card overflow-hidden">
              <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:gap-4">
                {/* Toggle */}
                <button
                  onClick={() =>
                    toggleMutation.mutate({ id: kw.id, enabled: !kw.enabled })
                  }
                  disabled={toggleMutation.isPending}
                  className="flex-shrink-0 transition-colors"
                  title={kw.enabled ? "点击停用" : "点击启用"}
                >
                  {kw.enabled ? (
                    <ToggleRight size={21} className="text-emerald-400" />
                  ) : (
                    <ToggleLeft size={21} className="text-slate-600" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        kw.enabled
                          ? "text-slate-100"
                          : "text-slate-600 line-through"
                      }`}
                    >
                      {kw.keyword}
                    </span>
                    <span className="badge border border-white/[0.08] bg-white/[0.04] text-slate-300">
                      {kw.type === "account" ? "账号" : "关键词"}
                    </span>
                    {kw.type === "account" && kw.platform && (
                      <span className="rounded-full border border-violet-500/20 bg-violet-500/12 px-2 py-1 text-[11px] text-violet-300">
                        {PLATFORMS.find((p) => p.value === kw.platform)
                          ?.label || kw.platform}
                      </span>
                    )}
                    {kw.enabled && (
                      <span className="badge badge-trust text-[11px]">
                        监控中
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-slate-500">
                    {kw.account_id && <span>ID: {kw.account_id}</span>}
                    <span
                      title={`创建于：${formatFullTime(kw.created_at)}`}
                      className="inline-flex items-center gap-1"
                    >
                      <CalendarClock size={12} />
                      创建 {formatProductTime(kw.created_at)}
                    </span>
                    {kw.last_checked_at && (
                      <span
                        title={`上次检查：${formatFullTime(kw.last_checked_at)}`}
                        className="inline-flex items-center gap-1"
                      >
                        <Clock size={12} />
                        最近检查 {formatProductTime(kw.last_checked_at)}
                      </span>
                    )}
                    {kw.last_checked_at && (
                      <span className="text-slate-600">
                        {formatAbsoluteTime(kw.last_checked_at)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 md:ml-auto">
                  <button
                    onClick={() => toggleExpand(kw)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:text-white"
                    type="button"
                  >
                    {expandedId === kw.id ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                    {expandedId === kw.id ? "收起命中" : "查看命中"}
                  </button>

                  <button
                    onClick={() => {
                      if (
                        window.confirm(`确认删除监控项「${kw.keyword}」吗？`)
                      ) {
                        deleteMutation.mutate(kw.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="hp-btn hp-btn-danger px-2 py-1"
                    type="button"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Hits expand */}
              <AnimatePresence>
                {expandedId === kw.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="p-3"
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                        background: "rgba(0,0,0,0.2)",
                      }}
                    >
                      <p className="text-xs font-medium mb-2 px-1 text-slate-600">
                        命中记录
                      </p>
                      <KeywordHits
                        keywordId={kw.id}
                        active={expandedId === kw.id}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {actionError && (
        <p className="mt-3 text-xs text-red-400">{actionError}</p>
      )}
    </div>
  );
}

function KeywordHits({
  keywordId,
  active,
}: {
  keywordId: number;
  active: boolean;
}) {
  const [expandedTopicIds, setExpandedTopicIds] = useState<number[]>([]);
  const {
    data: hits = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["keyword-hits", keywordId],
    queryFn: () => keywordsApi.hits(keywordId),
    enabled: active,
    staleTime: 60000,
  });

  const visibleHits = hits.slice(0, 5);
  const allExpanded =
    visibleHits.length > 0 &&
    visibleHits.every((topic) => expandedTopicIds.includes(topic.id));

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setExpandedTopicIds([]);
      return;
    }
    setExpandedTopicIds(visibleHits.map((topic) => topic.id));
  };

  const handleExpandedChange = (topicId: number, nextExpanded: boolean) => {
    setExpandedTopicIds((current) => {
      if (nextExpanded) {
        return current.includes(topicId) ? current : [...current, topicId];
      }
      return current.filter((id) => id !== topicId);
    });
  };

  if (isLoading) {
    return <p className="text-xs px-1 text-slate-600">加载中...</p>;
  }

  if (isError) {
    return (
      <p className="text-xs px-1 text-red-400">命中记录加载失败，请稍后重试</p>
    );
  }

  if (hits.length === 0) {
    return (
      <p className="text-xs px-1 text-slate-600">暂无命中记录，等待下次扫描</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <button
          onClick={toggleAllExpanded}
          className="text-[11px] rounded-lg border border-white/[0.06] px-2.5 py-1 text-slate-500 transition-colors hover:text-slate-300"
        >
          {allExpanded ? "收起全部详情" : "展开全部详情"}
        </button>
      </div>
      {visibleHits.map((topic) => (
        <HotCard
          key={topic.id}
          topic={topic}
          expanded={expandedTopicIds.includes(topic.id)}
          onExpandedChange={(nextExpanded) =>
            handleExpandedChange(topic.id, nextExpanded)
          }
        />
      ))}
    </div>
  );
}
