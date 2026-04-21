import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
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

  useEffect(() => {
    if (listFilters.type !== "account" && listFilters.platform) {
      setListFilters((current) => ({ ...current, platform: "" }));
    }
  }, [listFilters.platform, listFilters.type]);

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
    onError: (error: any) => {
      setActionError(
        error?.response?.data?.detail || "添加失败，关键词可能已存在",
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

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white mb-1">监控词</h1>
        <p className="text-xs text-slate-600">
          添加关键词或账号，系统将自动追踪相关热点并推送通知
        </p>
      </div>

      {/* Type switcher */}
      <div
        className="flex gap-1 mb-3 p-0.5 rounded-lg w-fit"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        <button
          onClick={() => setKwType("keyword")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            kwType === "keyword"
              ? "bg-cyan-500/20 text-cyan-400"
              : "text-slate-500 hover:text-slate-400"
          }`}
        >
          <Hash size={12} />
          关键词
        </button>
        <button
          onClick={() => setKwType("account")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            kwType === "account"
              ? "bg-cyan-500/20 text-cyan-400"
              : "text-slate-500 hover:text-slate-400"
          }`}
        >
          <User size={12} />
          账号
        </button>
      </div>

      {/* Add form */}
      <form onSubmit={handleSubmit} className="mb-6 space-y-2">
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

      <div
        className="mb-5 rounded-xl px-3 py-3 border space-y-3"
        style={{
          background: "rgba(255,255,255,0.02)",
          borderColor: "rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Search size={12} />
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
              setListFilters((current) => ({
                ...current,
                type: event.target.value as KeywordsListParams["type"],
              }))
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
              <div className="flex items-center gap-3 px-4 py-3">
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

                {/* Keyword */}
                <span
                  className={`flex-1 text-sm ${
                    kw.enabled
                      ? "text-slate-200"
                      : "text-slate-600 line-through"
                  }`}
                >
                  {kw.keyword}
                </span>

                {/* Type badge */}
                {kw.type === "account" && kw.platform && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/15 text-violet-400 border border-violet-500/20">
                    {PLATFORMS.find((p) => p.value === kw.platform)?.label ||
                      kw.platform}
                  </span>
                )}

                {/* Enabled badge */}
                {kw.enabled && (
                  <span className="badge badge-trust text-[11px]">监控中</span>
                )}

                {/* Last checked */}
                {kw.last_checked_at && (
                  <div
                    className="hidden md:flex flex-col items-end leading-tight"
                    title={`上次检查：${formatFullTime(kw.last_checked_at)}`}
                  >
                    <span className="flex items-center gap-1 text-xs text-slate-600">
                      <Clock size={10} />
                      {formatProductTime(kw.last_checked_at)}
                    </span>
                    <span className="text-[11px] text-slate-700">
                      {formatAbsoluteTime(kw.last_checked_at)}
                    </span>
                  </div>
                )}

                {/* Expand */}
                <button
                  onClick={() => toggleExpand(kw)}
                  className="p-1 text-slate-600 hover:text-slate-400 transition-colors"
                >
                  {expandedId === kw.id ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </button>

                {/* Delete */}
                <button
                  onClick={() => {
                    if (window.confirm(`确认删除监控项「${kw.keyword}」吗？`)) {
                      deleteMutation.mutate(kw.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="hp-btn hp-btn-danger px-2 py-1"
                >
                  <Trash2 size={13} />
                </button>
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
      {hits.slice(0, 5).map((topic) => (
        <HotCard key={topic.id} topic={topic} />
      ))}
    </div>
  );
}
