import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Topic } from "../api/client";
import {
  ExternalLink,
  Flame,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
} from "lucide-react";

interface HotCardProps {
  topic: Topic;
  animate?: boolean;
}

function getHeatLevel(score: number) {
  if (score >= 9) return { label: "CRITICAL", cls: "badge-critical" };
  if (score >= 7) return { label: "HIGH", cls: "badge-high" };
  if (score >= 5) return { label: "MED", cls: "badge-med" };
  return { label: "LOW", cls: "badge-low" };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

export function HotCard({ topic, animate = false }: HotCardProps) {
  const [expanded, setExpanded] = useState(false);
  const heat = getHeatLevel(topic.heat_score);
  const isCritical = topic.heat_score >= 9;

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

      {/* ── Footer ── */}
      <div
        className="flex items-center gap-3 text-xs pt-2.5 text-slate-600"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <Clock size={11} />
        <span>抓取 {timeAgo(topic.discovered_at)}</span>

        {topic.tags.length > 2 && (
          <span className="text-slate-700">+{topic.tags.length - 2} 标签</span>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-slate-600 hover:text-slate-400 transition-colors"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          原始内容
        </button>
      </div>

      {/* ── Expanded ── */}
      <AnimatePresence>
        {expanded && (
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
              <p className="text-xs font-medium text-slate-600">原始链接</p>
              <a
                href={topic.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs break-all text-blue-400 hover:text-blue-300 transition-colors"
              >
                {topic.source_url}
              </a>
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
