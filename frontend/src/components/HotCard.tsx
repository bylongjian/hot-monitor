import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Topic } from "../api/client";
import {
  formatAbsoluteTime,
  formatCompactNumber,
  formatFullTime,
  formatProductTime,
} from "../lib/utils";
import {
  ExternalLink,
  Flame,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  BellRing,
  MessageCircle,
  Repeat2,
  Star,
  Heart,
  Bookmark,
  Info,
} from "lucide-react";

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
      className={`hp-card p-4 group relative ${isCritical ? "border-red-500/15" : ""}`}
      style={isCritical ? { boxShadow: "0 0 40px rgba(248,113,113,0.04)" } : {}}
    >
      {/* Critical indicator line */}
      {isCritical && (
        <div
          className="absolute top-0 left-4 right-4 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(248,113,113,0.4), transparent)",
          }}
        />
      )}

      {/* ── Badge Row ── */}
      <div className="flex items-center gap-2 flex-wrap mb-2.5">
        <span className={`badge ${heat.cls}`}>
          <Flame size={10} />
          {heat.label}
        </span>

        <span className="badge bg-white/[0.04] text-slate-300 border border-white/[0.08]">
          {topic.source_type}
        </span>

        {/* Source */}
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span
            className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center text-white"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
            }}
          >
            {topic.source_name.charAt(0).toUpperCase()}
          </span>
          {topic.source_name}
        </span>

        {/* Tags */}
        {topic.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="badge badge-tag">
            {tag}
          </span>
        ))}

        {/* 可信 badge */}
        {topic.keyword_id && (
          <span className="badge badge-trust">
            <CheckCircle size={9} />
            可信
          </span>
        )}

        {topic.is_notified && (
          <span className="badge bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">
            <BellRing size={9} />
            已推送
          </span>
        )}

        {/* Heat score */}
        <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-orange-400 font-mono">
          <Flame size={11} />
          {topic.heat_score * 10}
        </span>
      </div>

      {/* ── Title ── */}
      <a
        href={topic.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-sm font-semibold leading-snug mb-2 text-slate-200 hover:text-white transition-colors"
      >
        {topic.title}
        <ExternalLink
          size={11}
          className="inline ml-1.5 opacity-0 group-hover:opacity-30 transition-opacity"
        />
      </a>

      {/* ── AI Summary ── */}
      {topic.summary && (
        <p className="text-xs leading-relaxed mb-3 text-slate-500">
          <span className="font-semibold mr-1.5 text-slate-600">AI摘要</span>
          {topic.summary}
        </p>
      )}

      {(quickMetrics.length > 0 || topic.relevance_score !== null) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {quickMetrics.map((metric) => (
            <span
              key={metric.key}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-slate-400"
            >
              <metric.icon size={11} />
              <span>{metric.label}</span>
              <span className="font-mono text-slate-300">
                {formatCompactNumber(metric.value)}
              </span>
            </span>
          ))}
          {topic.relevance_score !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/15 bg-cyan-500/8 px-2 py-1 text-[11px] text-cyan-200">
              <Info size={11} />
              相关性 {topic.relevance_score}/10
            </span>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div
        className="flex items-center gap-3 text-xs pt-2.5 text-slate-600"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div
          className="min-w-0"
          title={`${primaryTime.label}：${formatFullTime(primaryTime.value)}`}
        >
          <div className="flex items-center gap-1.5">
            <Clock size={11} />
            <span>{formatProductTime(primaryTime.value)}</span>
          </div>
          <div className="pl-[17px] text-[11px] text-slate-700">
            {primaryTime.secondary}
          </div>
        </div>

        {topic.tags.length > 2 && (
          <span className="text-slate-700">+{topic.tags.length - 2} 标签</span>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setExpanded(!isExpanded)}
          className="flex items-center gap-1 text-slate-600 hover:text-slate-400 transition-colors"
        >
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          详情
        </button>
      </div>

      {/* ── Expanded ── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="mt-3 pt-3 space-y-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
            >
              {topic.raw_content && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">原始描述</p>
                  <p className="text-xs leading-relaxed text-slate-400 whitespace-pre-wrap">
                    {topic.raw_content}
                  </p>
                </div>
              )}

              {(topic.relevance_reason || topic.relevance_score !== null) && (
                <div className="space-y-1.5 rounded-lg border border-cyan-400/10 bg-cyan-500/[0.03] p-3">
                  <p className="text-xs font-medium text-cyan-200">
                    AI 相关性判断
                  </p>
                  {topic.relevance_score !== null && (
                    <p className="text-[11px] text-cyan-100/80">
                      相关性评分 {topic.relevance_score}/10
                    </p>
                  )}
                  {topic.relevance_reason && (
                    <p className="text-xs leading-relaxed text-slate-300">
                      {topic.relevance_reason}
                    </p>
                  )}
                </div>
              )}

              {Object.keys(topic.source_metrics ?? {}).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">来源指标</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(topic.source_metrics).map(
                      ([key, value]) => (
                        <span
                          key={key}
                          className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-slate-400"
                        >
                          {key}: {formatCompactNumber(value)}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs font-medium text-slate-600">原始链接</p>
              <a
                href={topic.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs break-all text-blue-400 hover:text-blue-300 transition-colors"
              >
                {topic.source_url}
              </a>
              <p className="text-[11px] text-slate-600">
                抓取时间：{formatFullTime(topic.discovered_at)}
              </p>
              {topic.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {topic.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-[11px] bg-white/[0.03] text-slate-500"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
