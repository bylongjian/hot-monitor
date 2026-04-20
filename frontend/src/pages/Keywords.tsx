import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keywordsApi, type Keyword } from "../api/client";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  Clock,
} from "lucide-react";
import { HotCard } from "../components/HotCard";

export function Keywords() {
  const qc = useQueryClient();
  const [newKw, setNewKw] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hitsCache, setHitsCache] = useState<Record<number, any[]>>({});

  const { data: keywords = [], isLoading } = useQuery({
    queryKey: ["keywords"],
    queryFn: keywordsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (kw: string) => keywordsApi.create(kw),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["keywords"] });
      setNewKw("");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      keywordsApi.update(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keywords"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => keywordsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keywords"] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newKw.trim();
    if (trimmed) createMutation.mutate(trimmed);
  };

  const toggleExpand = async (kw: Keyword) => {
    if (expandedId === kw.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(kw.id);
    if (!hitsCache[kw.id]) {
      const hits = await keywordsApi.hits(kw.id);
      setHitsCache((prev) => ({ ...prev, [kw.id]: hits }));
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-white mb-0.5">监控词</h1>
        <p className="text-xs" style={{ color: "rgba(100,116,139,0.7)" }}>
          添加关键词，系统将自动追踪相关热点并推送通知
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-5">
        <input
          type="text"
          value={newKw}
          onChange={(e) => setNewKw(e.target.value)}
          placeholder="输入关键词，如：GPT-5、Claude 4..."
          maxLength={200}
          className="hp-input flex-1"
        />
        <button
          type="submit"
          disabled={!newKw.trim() || createMutation.isPending}
          className="hp-btn hp-btn-primary"
        >
          <Plus size={13} />
          添加
        </button>
      </form>

      {/* Keywords list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl animate-pulse"
              style={{ background: "rgba(255,255,255,0.03)" }}
            />
          ))}
        </div>
      ) : keywords.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p className="text-sm" style={{ color: "rgba(100,116,139,0.6)" }}>
            暂无监控词，请添加你想追踪的热点关键词
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
                  className="flex-shrink-0 transition-colors"
                  title={kw.enabled ? "点击停用" : "点击启用"}
                >
                  {kw.enabled ? (
                    <ToggleRight size={21} className="text-green-400" />
                  ) : (
                    <ToggleLeft
                      size={21}
                      style={{ color: "rgba(100,116,139,0.5)" }}
                    />
                  )}
                </button>

                {/* Keyword */}
                <span
                  className="flex-1 text-sm"
                  style={{
                    color: kw.enabled ? "#e2e8f0" : "rgba(100,116,139,0.5)",
                    textDecoration: kw.enabled ? "none" : "line-through",
                  }}
                >
                  {kw.keyword}
                </span>

                {/* Enabled badge */}
                {kw.enabled && (
                  <span className="badge badge-trust text-[11px]">监控中</span>
                )}

                {/* Last checked */}
                {kw.last_checked_at && (
                  <span
                    className="hidden md:flex items-center gap-1 text-xs"
                    style={{ color: "rgba(100,116,139,0.55)" }}
                  >
                    <Clock size={10} />
                    {new Date(kw.last_checked_at).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}

                {/* Expand */}
                <button
                  onClick={() => toggleExpand(kw)}
                  className="p-1 transition-colors"
                  style={{ color: "rgba(100,116,139,0.6)" }}
                >
                  {expandedId === kw.id ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteMutation.mutate(kw.id)}
                  className="hp-btn hp-btn-danger px-2 py-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Hits expand */}
              {expandedId === kw.id && (
                <div
                  className="p-3"
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(0,0,0,0.15)",
                  }}
                >
                  <p
                    className="text-xs font-medium mb-2 px-1"
                    style={{ color: "rgba(100,116,139,0.6)" }}
                  >
                    命中记录
                  </p>
                  {hitsCache[kw.id] === undefined ? (
                    <p
                      className="text-xs px-1"
                      style={{ color: "rgba(100,116,139,0.5)" }}
                    >
                      加载中...
                    </p>
                  ) : hitsCache[kw.id].length === 0 ? (
                    <p
                      className="text-xs px-1"
                      style={{ color: "rgba(100,116,139,0.5)" }}
                    >
                      暂无命中记录，等待下次扫描
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {hitsCache[kw.id].slice(0, 5).map((t: any) => (
                        <HotCard key={t.id} topic={t} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {createMutation.isError && (
        <p className="mt-3 text-xs" style={{ color: "#f87171" }}>
          {(createMutation.error as any)?.response?.data?.detail ||
            "添加失败，关键词可能已存在"}
        </p>
      )}
    </div>
  );
}
