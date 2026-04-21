import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BellRing,
  Bookmark,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Flame,
  Heart,
  MessageCircle,
  Repeat2,
  Star,
} from "lucide-react";
import { type Topic } from "../api/client";
import {
  formatAbsoluteTime,
  formatCompactNumber,
  formatFullTime,
  formatProductTime,
} from "../lib/utils";

interface HotCardProps {
  topic: Topic;
  animate?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

const ENGAGEMENT_META = [
  { key: "likes", label: "点赞", icon: Heart },
  { key: "comments", label: "评论", icon: MessageCircle },
  { key: "reposts", label: "转发", icon: Repeat2 },
  { key: "bookmarks", label: "收藏", icon: Bookmark },
  { key: "stars", label: "星标", icon: Star },
] as const;

function getHeatLevel(score: number) {
  if (score >= 9) return { label: "CRITICAL", cls: "badge-critical" };
  if (score >= 7) return { label: "HIGH", cls: "badge-high" };
  if (score >= 5) return { label: "MED", cls: "badge-med" };
  return { label: "LOW", cls: "badge-low" };
}

function getQuickMetrics(topic: Topic) {
  return ENGAGEMENT_META.map((item) => {
    const value = topic.engagement?.[item.key];
    if (value === null || value === undefined || value === "") {
      return null;
    }

    return {
      ...item,
      value,
    };
  }).filter(Boolean) as Array<{
    key: string;
    label: string;
    icon: typeof MessageCircle;
    value: number | string;
  }>;
}

function getPrimaryTime(topic: Topic) {
  if (topic.published_at) {
    return {
      label: "发布时间",
      value: topic.published_at,
      secondary: `抓取于 ${formatAbsoluteTime(topic.discovered_at)}`,
    };
  }

  return {
    label: "抓取时间",
    value: topic.discovered_at,
    secondary: "未获取真实发布时间",
  };
}

export function HotCard({
  topic,
  animate = false,
  expanded,
  onExpandedChange,
}: HotCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const heat = getHeatLevel(topic.heat_score);
  const isCritical = topic.heat_score >= 9;
  const isControlled = expanded !== undefined;
  const isExpanded = isControlled ? expanded : internalExpanded;
  const quickMetrics = getQuickMetrics(topic).slice(0, 3);
  const primaryTime = getPrimaryTime(topic);

  const setExpanded = (nextExpanded: boolean) => {
    if (!isControlled) {
      setInternalExpanded(nextExpanded);
    }

    onExpandedChange?.(nextExpanded);
  };

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`hp-card group relative overflow-hidden p-4 md:p-5 ${
        isCritical ? "border-red-500/20" : ""
      }`}
      style={
        isCritical
          ? { boxShadow: "0 18px 52px rgba(127, 29, 29, 0.22)" }
          : undefined
      }
    >
      {isCritical && (
        <div
          className="absolute left-4 right-4 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(251,113,133,0.45), transparent)",
          }}
        />
      )}

      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-cyan-300/6 blur-3xl" />
        {isCritical && (
          <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-rose-400/10 blur-3xl" />
        )}
      </div>

      <div className="relative z-[1] flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className={`badge ${heat.cls}`}>
                <Flame size={10} />
                {heat.label}
              </span>

              <span className="badge border border-white/[0.08] bg-white/[0.04] text-slate-300">
                {topic.source_type}
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-slate-300">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(34,211,238,0.18))",
                  }}
                >
                  {topic.source_name.charAt(0).toUpperCase()}
                </span>
                {topic.source_name}
              </span>

              {topic.keyword_id && (
                <span className="badge badge-trust">
                  <CheckCircle size={9} />
                  监控命中
                </span>
              )}

              {topic.is_notified && (
                <span className="badge border border-emerald-400/22 bg-emerald-500/10 text-emerald-200">
                  <BellRing size={9} />
                  已推送
                </span>
              )}
            </div>

            <a
              href={topic.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[15px] font-semibold leading-7 text-slate-50 transition-colors hover:text-white md:text-base"
            >
              {topic.title}
              <ExternalLink
                size={12}
                className="ml-1.5 inline opacity-0 transition-opacity group-hover:opacity-50"
              />
            </a>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 md:min-w-[132px] md:flex-col md:items-end md:gap-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
              Heat score
            </span>
            <div className="flex items-center gap-1 font-mono text-lg font-semibold text-orange-300 md:text-2xl">
              <Flame size={14} className="text-orange-400" />
              {topic.heat_score}
            </div>
            <span className="text-[11px] text-slate-500">
              优先级 {topic.heat_score * 10}
            </span>
          </div>
        </div>

        {topic.summary && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3.5 py-3">
            <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
              AI 摘要
            </p>
            <p className="text-sm leading-6 text-slate-200">{topic.summary}</p>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.9fr)]">
          <div className="space-y-3">
            {quickMetrics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {quickMetrics.map((metric) => (
                  <span
                    key={metric.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-slate-300"
                  >
                    <metric.icon size={11} className="text-slate-400" />
                    <span className="text-slate-400">{metric.label}</span>
                    <span className="font-mono text-slate-100">
                      {formatCompactNumber(metric.value)}
                    </span>
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {topic.tags
                .slice(0, isExpanded ? topic.tags.length : 4)
                .map((tag) => (
                  <span key={tag} className="badge badge-tag">
                    {tag}
                  </span>
                ))}
              {!isExpanded && topic.tags.length > 4 && (
                <span className="badge badge-low">
                  +{topic.tags.length - 4} 标签
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#091322]/90 p-3.5">
            <div
              className="flex items-start justify-between gap-3"
              title={`${primaryTime.label}：${formatFullTime(primaryTime.value)}`}
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  {primaryTime.label}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-100">
                  <Clock size={13} className="text-slate-400" />
                  {formatProductTime(primaryTime.value)}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {primaryTime.secondary}
                </p>
              </div>

              {topic.relevance_score !== null && (
                <div className="rounded-xl border border-cyan-400/16 bg-cyan-400/8 px-2.5 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/70">
                    Relevance
                  </p>
                  <p className="mt-1 font-mono text-base font-semibold text-cyan-100">
                    {topic.relevance_score}/10
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-white/[0.06] pt-3 text-xs text-slate-500">
          <div className="min-w-0 flex-1 truncate">
            {topic.relevance_reason
              ? `AI 线索：${topic.relevance_reason}`
              : "展开查看原始描述、来源指标和完整判断理由"}
          </div>

          <button
            onClick={() => setExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-slate-300 transition-colors hover:text-white"
          >
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {isExpanded ? "收起详情" : "展开详情"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="relative z-[1] mt-4 grid gap-3 border-t border-white/[0.06] pt-4 md:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.85fr)]">
              <div className="space-y-3">
                {topic.raw_content && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      原始描述
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                      {topic.raw_content}
                    </p>
                  </div>
                )}

                {(topic.relevance_reason || topic.relevance_score !== null) && (
                  <div className="rounded-2xl border border-cyan-400/12 bg-cyan-400/[0.05] p-3.5">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-cyan-100/70">
                      AI 相关性判断
                    </p>
                    {topic.relevance_score !== null && (
                      <p className="text-[12px] text-cyan-100/80">
                        相关性评分 {topic.relevance_score}/10
                      </p>
                    )}
                    {topic.relevance_reason && (
                      <p className="mt-2 text-sm leading-6 text-slate-200">
                        {topic.relevance_reason}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {Object.keys(topic.source_metrics ?? {}).length > 0 && (
                  <div className="rounded-2xl border border-white/[0.08] bg-[#091322]/88 p-3.5">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      来源指标
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(topic.source_metrics).map(
                        ([key, value]) => (
                          <span
                            key={key}
                            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300"
                          >
                            {key}: {formatCompactNumber(value)}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    原始链接与时间
                  </p>
                  <a
                    href={topic.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all text-sm leading-6 text-cyan-300 transition-colors hover:text-cyan-200"
                  >
                    {topic.source_url}
                  </a>
                  <p className="mt-2 text-[12px] text-slate-500">
                    抓取时间：{formatFullTime(topic.discovered_at)}
                  </p>
                  {topic.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {topic.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
