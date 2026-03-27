"use client";

import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  BookOpen,
  Building2,
  ChevronRight,
  ExternalLink,
  Globe,
  Lightbulb,
  Network,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { AnalysisResult, GraphNode, PersonaSection, Phase1CompetitorItem, SwotAnalysis, SwotQuadrant } from "@/types/analysis";

interface ReportViewProps {
  result: AnalysisResult;
}

// ──────────────────────────────────────────────────────────────────────
// Small helper components
// ──────────────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="text-slate-500">{icon}</div>
      <h2 className="section-title">{title}</h2>
    </div>
  );
}

function BulletList({
  items,
  variant = "default",
}: {
  items: string[];
  variant?: "default" | "opportunity" | "threat" | "recommendation";
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          {variant === "recommendation" ? (
            <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 mt-0.5 rounded-full bg-brand-600 text-white text-xs font-bold">
              {i + 1}
            </span>
          ) : (
            <span
              className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2 ${
                variant === "opportunity"
                  ? "bg-emerald-500"
                  : variant === "threat"
                  ? "bg-red-500"
                  : "bg-slate-400"
              }`}
            />
          )}
          <span className="text-sm text-slate-700 leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NodeTypeBadge({ type }: { type: GraphNode["type"] }) {
  const classes: Record<GraphNode["type"], string> = {
    company: "badge-company",
    product: "badge-product",
    trend:   "badge-trend",
    threat:  "badge-threat",
  };
  const labels: Record<GraphNode["type"], string> = {
    company: "기업",
    product: "제품",
    trend:   "트렌드",
    threat:  "위협",
  };
  return <span className={classes[type]}>{labels[type]}</span>;
}

// Threat level bar: maps 1-10 score to 5 filled segments
function ThreatBar({ score }: { score: number }) {
  const filled  = Math.round(score / 2);   // 0-5
  const color   =
    score >= 8 ? "bg-red-500"
    : score >= 5 ? "bg-amber-500"
    : "bg-slate-400";
  const textColor =
    score >= 8 ? "text-red-600"
    : score >= 5 ? "text-amber-600"
    : "text-slate-500";

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-3.5 rounded-sm ${i < filled ? color : "bg-slate-200"}`}
          />
        ))}
      </div>
      <span className={`text-xs font-medium tabular-nums ${textColor}`}>{score}/10</span>
    </div>
  );
}

function CompetitorTypeBadge({ type }: { type: Phase1CompetitorItem["type"] }) {
  const map: Record<Phase1CompetitorItem["type"], { label: string; className: string }> = {
    direct:   { label: "직접 경쟁",   className: "bg-blue-50 text-blue-700 border-blue-200" },
    indirect: { label: "간접/대체재", className: "bg-slate-100 text-slate-600 border-slate-200" },
    adjacent: { label: "인접 시장",   className: "bg-violet-50 text-violet-700 border-violet-200" },
  };
  const { label, className } = map[type] ?? map.indirect;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────
// SWOT component
// ──────────────────────────────────────────────────────────────────────

const SWOT_CONFIG = {
  strengths:    { label: "강점", abbr: "S", bg: "bg-emerald-50", border: "border-emerald-300", keyword: "text-emerald-700", abbr_bg: "bg-emerald-600", dot: "bg-emerald-500" },
  weaknesses:   { label: "약점", abbr: "W", bg: "bg-red-50",     border: "border-red-300",     keyword: "text-red-700",     abbr_bg: "bg-red-600",     dot: "bg-red-500" },
  opportunities:{ label: "기회", abbr: "O", bg: "bg-blue-50",    border: "border-blue-300",    keyword: "text-blue-700",    abbr_bg: "bg-blue-600",    dot: "bg-blue-500" },
  threats:      { label: "위협", abbr: "T", bg: "bg-amber-50",   border: "border-amber-300",   keyword: "text-amber-700",   abbr_bg: "bg-amber-600",   dot: "bg-amber-500" },
} as const;

function SwotCell({ quadrant, data }: { quadrant: keyof typeof SWOT_CONFIG; data: SwotQuadrant }) {
  const cfg = SWOT_CONFIG[quadrant];
  return (
    <div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} p-4 flex flex-col`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`flex-shrink-0 w-6 h-6 rounded-full ${cfg.abbr_bg} text-white text-xs font-bold flex items-center justify-center`}>
          {cfg.abbr}
        </span>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{cfg.label}</span>
      </div>
      {/* Keyword */}
      <p className={`text-lg font-extrabold ${cfg.keyword} mb-3 leading-tight`}>
        {data.keyword}
      </p>
      {/* Points */}
      <ul className="space-y-1.5 flex-1">
        {data.points.map((point, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${cfg.dot}`} />
            <span className="text-xs text-slate-700 leading-relaxed">{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SwotSection({ swot }: { swot: SwotAnalysis }) {
  return (
    <div className="card p-6">
      <SectionHeader icon={<BarChart2 className="h-4 w-4" />} title="SWOT 분석" />
      <p className="text-xs text-slate-400 mb-4">KT GPU IaaS 관점의 내부 역량과 외부 환경 분석</p>
      <div className="grid grid-cols-2 gap-3">
        <SwotCell quadrant="strengths"     data={swot.strengths} />
        <SwotCell quadrant="weaknesses"    data={swot.weaknesses} />
        <SwotCell quadrant="opportunities" data={swot.opportunities} />
        <SwotCell quadrant="threats"       data={swot.threats} />
      </div>
      {/* Axis labels */}
      <div className="flex justify-between mt-2 px-1">
        <span className="text-xs text-slate-400">← 내부 요인</span>
        <span className="text-xs text-slate-400">외부 요인 →</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Persona config
// ──────────────────────────────────────────────────────────────────────

const PERSONA_CONFIG: Record<string, { horizon: string; color: string; bg: string; border: string; badge: string }> = {
  "직원":    { horizon: "즉시~3개월",  color: "text-slate-700",   bg: "bg-slate-50",    border: "border-slate-200", badge: "bg-slate-100 text-slate-600" },
  "팀장":    { horizon: "1~6개월",    color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200",  badge: "bg-blue-100 text-blue-700" },
  "담당상무": { horizon: "3~12개월",   color: "text-violet-700",  bg: "bg-violet-50",   border: "border-violet-200",badge: "bg-violet-100 text-violet-700" },
  "본부장":  { horizon: "6개월~2년",  color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200", badge: "bg-amber-100 text-amber-700" },
  "부문장":  { horizon: "1~3년",      color: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200",badge: "bg-orange-100 text-orange-700" },
  "대표이사": { horizon: "3~5년",      color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200",   badge: "bg-red-100 text-red-700" },
};

function PersonaInsightsSection({ sections }: { sections: PersonaSection[] }) {
  const [active, setActive] = useState(sections[0]?.persona ?? "직원");
  const current = sections.find((s) => s.persona === active) ?? sections[0];
  if (!current) return null;
  const cfg = PERSONA_CONFIG[current.persona] ?? PERSONA_CONFIG["직원"];

  return (
    <div className="card overflow-hidden">
      <div className="p-6 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-slate-500" />
          <h2 className="section-title">직급별 맞춤 인사이트</h2>
        </div>
        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-0 border-b border-slate-200">
          {sections.map((s) => {
            const c = PERSONA_CONFIG[s.persona] ?? PERSONA_CONFIG["직원"];
            const isActive = s.persona === active;
            return (
              <button
                key={s.persona}
                onClick={() => setActive(s.persona)}
                className={`flex-shrink-0 px-4 py-2 text-xs font-semibold rounded-t transition-colors border-b-2 -mb-px ${
                  isActive
                    ? `${c.color} border-current bg-white`
                    : "text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300"
                }`}
              >
                {s.persona}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className={`p-6 ${cfg.bg}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className={`text-base font-bold ${cfg.color}`}>{current.persona}</p>
            <p className="text-xs text-slate-500 mt-0.5">{current.focus}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.badge}`}>
            시간 지평 {cfg.horizon}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Key Insights */}
          <div className={`rounded-lg border p-4 bg-white ${cfg.border}`}>
            <div className="flex items-center gap-1.5 mb-3">
              <Lightbulb className={`h-3.5 w-3.5 ${cfg.color}`} />
              <p className={`text-xs font-semibold ${cfg.color}`}>핵심 인사이트</p>
            </div>
            <ul className="space-y-2.5">
              {current.key_insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={`flex-shrink-0 flex items-center justify-center w-4 h-4 mt-0.5 rounded-full text-white text-xs font-bold ${cfg.color.replace("text-", "bg-")}`}>
                    {i + 1}
                  </span>
                  <span className="text-xs text-slate-700 leading-relaxed">{insight}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Items */}
          <div className={`rounded-lg border p-4 bg-white ${cfg.border}`}>
            <div className="flex items-center gap-1.5 mb-3">
              <ChevronRight className={`h-3.5 w-3.5 ${cfg.color}`} />
              <p className={`text-xs font-semibold ${cfg.color}`}>액션 아이템</p>
            </div>
            <ul className="space-y-2.5">
              {current.action_items.map((action, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={`flex-shrink-0 text-xs font-bold mt-0.5 ${cfg.color}`}>→</span>
                  <span className="text-xs text-slate-700 leading-relaxed">{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Main report component
// ──────────────────────────────────────────────────────────────────────

export function ReportView({ result }: ReportViewProps) {
  const {
    final_report,
    phase1_competitors,
    competitors,
    knowledge_graph,
    graph_insights,
    raw_research,
    market_overview,
  } = result;

  const directCompetitors   = competitors.filter((c) => c.type === "direct");
  const indirectCompetitors = competitors.filter((c) => c.type === "indirect");

  const references = Array.from(
    new Map(raw_research.map((r) => [r.url, r])).values()
  ).slice(0, 12);

  const nodesByType = knowledge_graph.nodes?.reduce<
    Record<string, typeof knowledge_graph.nodes>
  >((acc, node) => {
    acc[node.type] = acc[node.type] || [];
    acc[node.type].push(node);
    return acc;
  }, {}) ?? {};

  return (
    <div className="space-y-6">
      {/* ── 1. Executive Summary ──────────────────────────────────── */}
      <div className="card p-6 border-l-4 border-brand-600">
        <SectionHeader icon={<BarChart2 className="h-4 w-4" />} title="Executive Summary" />
        <p className="text-sm text-slate-700 leading-relaxed">
          {final_report.executive_summary}
        </p>
        {final_report.competitive_analysis_summary && (
          <p className="mt-3 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
            {final_report.competitive_analysis_summary}
          </p>
        )}
      </div>

      {/* ── 2. Market Overview + Positioning ─────────────────────── */}
      <div className="card p-6">
        <SectionHeader icon={<Globe className="h-4 w-4" />} title="시장 포지셔닝 분석" />
        {market_overview && (
          <p className="text-sm text-slate-500 leading-relaxed mb-3 pb-3 border-b border-slate-100">
            {market_overview}
          </p>
        )}
        <p className="text-sm text-slate-700 leading-relaxed">
          {final_report.positioning_summary || result.market_positioning}
        </p>
      </div>

      {/* ── 3. Phase 1: Market Scan Table ────────────────────────── */}
      {phase1_competitors.length > 0 && (
        <div className="card p-6">
          <SectionHeader
            icon={<Building2 className="h-4 w-4" />}
            title={`전체 시장 경쟁사 스캔 — Phase 1 (${phase1_competitors.length}개)`}
          />
          <p className="text-xs text-slate-400 mb-4">
            시장 내 잠재적 경쟁사를 광범위하게 나열한 목록입니다. 위협도(relevance_score) 기준 내림차순 정렬.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2 pr-3 font-semibold text-slate-500 w-6">#</th>
                  <th className="py-2 pr-3 font-semibold text-slate-500">기업명</th>
                  <th className="py-2 pr-3 font-semibold text-slate-500">유형</th>
                  <th className="py-2 pr-3 font-semibold text-slate-500 min-w-[180px]">설명</th>
                  <th className="py-2 pr-3 font-semibold text-slate-500">예상 점유율</th>
                  <th className="py-2 pr-3 font-semibold text-slate-500">투자/설립</th>
                  <th className="py-2 font-semibold text-slate-500">위협도</th>
                </tr>
              </thead>
              <tbody>
                {phase1_competitors.map((c, i) => (
                  <tr
                    key={c.name}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2.5 pr-3 text-slate-400 font-mono">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      {c.website && (
                        <a
                          href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-brand-600 hover:text-brand-700 mt-0.5"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          <span className="text-xs">웹사이트</span>
                        </a>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <CompetitorTypeBadge type={c.type} />
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600 leading-relaxed max-w-xs">
                      {c.description}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {c.market_share_estimate || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap">
                      <div>{c.funding_info || <span className="text-slate-400">—</span>}</div>
                      {c.founded_year && (
                        <div className="text-slate-400">{c.founded_year}년 설립</div>
                      )}
                    </td>
                    <td className="py-2.5">
                      <ThreatBar score={c.relevance_score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. Phase 2: Deep Competitor Profiles ─────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-4 w-4 text-slate-500" />
          <h2 className="section-title">
            경쟁사 심층 분석 — Phase 2
          </h2>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
            주요 경쟁사 (GPU IaaS 보유) {directCompetitors.length}곳
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
            잠재적 경쟁사 (향후 진입 가능) {indirectCompetitors.length}곳
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {directCompetitors.map((c) => (
            <div key={c.name} className="card p-5">
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-900">{c.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium flex-shrink-0 ml-2">
                  직접 경쟁
                </span>
              </div>
              {c.estimated_market_position && (
                <p className="text-xs text-slate-500 mb-2 italic">{c.estimated_market_position}</p>
              )}
              <p className="text-xs text-slate-600 leading-relaxed mb-3">{c.description}</p>
              {c.key_products.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-500 mb-1.5">핵심 제품/서비스</p>
                  <div className="flex flex-wrap gap-1">
                    {c.key_products.map((p) => (
                      <span key={p} className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {c.strengths.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-emerald-700 mb-1">강점</p>
                  <ul className="space-y-0.5">
                    {c.strengths.map((s) => (
                      <li key={s} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 mt-1 flex-shrink-0">+</span>
                        <span className="text-xs text-slate-600">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {c.weaknesses.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 mb-1">약점 (차별화 기회)</p>
                  <ul className="space-y-0.5">
                    {c.weaknesses.map((w) => (
                      <li key={w} className="flex items-start gap-1.5">
                        <span className="text-red-400 mt-1 flex-shrink-0">-</span>
                        <span className="text-xs text-slate-600">{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {c.website && (
                <a
                  href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-xs text-brand-600 hover:text-brand-700"
                >
                  <ExternalLink className="h-3 w-3" />
                  {c.website}
                </a>
              )}
            </div>
          ))}

          {indirectCompetitors.map((c) => (
            <div key={c.name} className="card p-5 border-dashed">
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-900">{c.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium flex-shrink-0 ml-2">
                  간접/대체재
                </span>
              </div>
              {c.estimated_market_position && (
                <p className="text-xs text-slate-500 mb-2 italic">{c.estimated_market_position}</p>
              )}
              <p className="text-xs text-slate-600 leading-relaxed mb-3">{c.description}</p>
              {c.strengths.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-emerald-700 mb-1">강점</p>
                  <ul className="space-y-0.5">
                    {c.strengths.map((s) => (
                      <li key={s} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 mt-1 flex-shrink-0">+</span>
                        <span className="text-xs text-slate-600">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. Opportunities & Threats ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <SectionHeader
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            title="시장 기회 요소"
          />
          <BulletList items={final_report.market_opportunities} variant="opportunity" />
        </div>
        <div className="card p-5">
          <SectionHeader
            icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
            title="위협 요소 및 리스크"
          />
          <BulletList items={final_report.threat_factors} variant="threat" />
        </div>
      </div>

      {/* ── 6. SWOT Analysis ─────────────────────────────────────── */}
      {final_report.swot_analysis && (
        <SwotSection swot={final_report.swot_analysis} />
      )}

      {/* ── 7. Graph RAG Insights ─────────────────────────────────── */}
      <div className="card p-6">
        <SectionHeader icon={<Network className="h-4 w-4" />} title="Graph RAG 기반 인사이트" />

        {graph_insights.length > 0 && (
          <div className="mb-5 space-y-2">
            {graph_insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <ArrowRight className="h-4 w-4 text-brand-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        )}

        {knowledge_graph.nodes?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider">
              지식 그래프 노드
            </p>
            <div className="space-y-2">
              {(["company", "product", "trend", "threat"] as const).map((nodeType) => {
                const nodes = nodesByType[nodeType];
                if (!nodes?.length) return null;
                return (
                  <div key={nodeType} className="flex flex-wrap gap-2 items-center">
                    {nodes.map((node) => (
                      <div key={node.id} className="flex items-center gap-1.5" title={node.description}>
                        <NodeTypeBadge type={node.type} />
                        <span className="text-xs text-slate-700 font-medium">{node.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {knowledge_graph.edges?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
              주요 관계 (Edges)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-4 font-medium text-slate-500">Source</th>
                    <th className="text-left py-2 px-4 font-medium text-slate-500">Relation</th>
                    <th className="text-left py-2 pl-4 font-medium text-slate-500">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {knowledge_graph.edges.slice(0, 10).map((edge, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-4 text-slate-700">{edge.source}</td>
                      <td className="py-1.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                          {edge.relation}
                        </span>
                      </td>
                      <td className="py-1.5 pl-4 text-slate-700">{edge.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 7. Strategic Recommendations ─────────────────────────── */}
      <div className="card p-6">
        <SectionHeader icon={<Shield className="h-4 w-4" />} title="전략적 권고사항" />
        <BulletList items={final_report.strategic_recommendations} variant="recommendation" />
      </div>

      {/* ── 8. Persona Insights ───────────────────────────────────── */}
      {final_report.persona_sections?.length > 0 && (
        <PersonaInsightsSection sections={final_report.persona_sections} />
      )}

      {/* ── 9. References ─────────────────────────────────────────── */}
      {references.length > 0 && (
        <div className="card p-6">
          <SectionHeader
            icon={<BookOpen className="h-4 w-4" />}
            title="Reference — 참고 문헌 및 출처"
          />
          <div className="space-y-0">
            {references.map((ref, i) => (
              <div key={i} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
                <span className="flex-shrink-0 text-xs font-medium text-slate-400 w-5 pt-0.5">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-slate-800 truncate">{ref.title}</p>
                    <span className="flex-shrink-0 text-xs text-slate-400 font-mono">{ref.source}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{ref.snippet}</p>
                  {ref.url && (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-xs text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {ref.url.length > 60 ? ref.url.slice(0, 60) + "..." : ref.url}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400 italic">
            위 자료는 AI 에이전트가 수집한 정보를 포함하며, 내용의 정확성은 원문 출처를 통해 직접 확인하시기 바랍니다.
          </p>
        </div>
      )}
    </div>
  );
}
