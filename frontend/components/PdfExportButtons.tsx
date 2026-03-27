"use client";

import {
  BarChart2,
  Briefcase,
  FileText,
  Handshake,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { useRef, useState } from "react";

import type { AnalysisResult, MarketMaturity } from "@/types/analysis";

interface Props {
  result: AnalysisResult;
}

// ──────────────────────────────────────────────────────────────────────
// PDF 용도 정의
// ──────────────────────────────────────────────────────────────────────

const PDF_TYPES = [
  { id: 1, label: "시장 진입 브리핑",   icon: <FileText  className="h-3.5 w-3.5" />, desc: "내부 경영진 보고용" },
  { id: 2, label: "경쟁 전략 요약",     icon: <Briefcase className="h-3.5 w-3.5" />, desc: "제안/입찰용" },
  { id: 3, label: "투자자용 시장 요약", icon: <BarChart2  className="h-3.5 w-3.5" />, desc: "VC·투자자용" },
  { id: 4, label: "파트너십 제안서",    icon: <Handshake className="h-3.5 w-3.5" />, desc: "파트너사 첨부용" },
  { id: 5, label: "신사업 검토 보고",   icon: <Lightbulb className="h-3.5 w-3.5" />, desc: "전략기획·임원 보고" },
] as const;

// ──────────────────────────────────────────────────────────────────────
// 공통 스타일 토큰
// ──────────────────────────────────────────────────────────────────────

const S = {
  wrap:    "font-sans text-[11px] leading-relaxed text-gray-800 bg-white w-[794px] min-h-[1123px] p-10 box-border",
  header:  "border-b-2 border-gray-800 pb-2 mb-4",
  title:   "text-lg font-bold text-gray-900",
  sub:     "text-xs text-gray-500 mt-0.5",
  section: "mb-4",
  sTitle:  "text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 border-b border-gray-200 pb-0.5",
  body:    "text-[11px] text-gray-700 leading-relaxed",
  chip:    "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border mr-1 mb-1",
  row2:    "grid grid-cols-2 gap-4",
  row3:    "grid grid-cols-3 gap-3",
  box:     "rounded border border-gray-200 p-2.5",
  bullet:  "flex items-start gap-1.5 mb-1",
  footer:  "absolute bottom-8 left-10 right-10 flex justify-between text-[9px] text-gray-400 border-t border-gray-200 pt-2",
} as const;

const MATURITY_COLOR: Record<MarketMaturity, string> = {
  도입기: "bg-violet-100 text-violet-700 border-violet-300",
  성장기: "bg-emerald-100 text-emerald-700 border-emerald-300",
  성숙기: "bg-amber-100 text-amber-700 border-amber-300",
  쇠퇴기: "bg-red-100 text-red-700 border-red-300",
};

// ──────────────────────────────────────────────────────────────────────
// 공통 서브컴포넌트
// ──────────────────────────────────────────────────────────────────────

function PdfHeader({ title, sub, product }: { title: string; sub: string; product: string }) {
  return (
    <div className={S.header}>
      <div className="flex items-end justify-between">
        <div>
          <p className={S.title}>{title}</p>
          <p className={S.sub}>{sub}</p>
        </div>
        <p className="text-[10px] text-gray-400">{new Date().toLocaleDateString("ko-KR")}</p>
      </div>
      <p className="mt-1.5 text-[10px] text-gray-500 truncate">대상 제품/서비스: {product}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={S.section}>
      <p className={S.sTitle}>{title}</p>
      {children}
    </div>
  );
}

function BulletItems({ items, dotColor = "bg-gray-500" }: { items: string[]; dotColor?: string }) {
  return (
    <ul>
      {items.slice(0, 5).map((item, i) => (
        <li key={i} className={S.bullet}>
          <span className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
          <span className={S.body}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NumberedItems({ items }: { items: string[] }) {
  return (
    <ol>
      {items.slice(0, 5).map((item, i) => (
        <li key={i} className={S.bullet}>
          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-gray-800 text-white text-[9px] flex items-center justify-center font-bold">
            {i + 1}
          </span>
          <span className={S.body}>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function PdfFooter({ label }: { label: string }) {
  return (
    <div className={S.footer}>
      <span>{label}</span>
      <span>Market Intelligence Agent · AI Generated Report</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 1. 시장 진입 브리핑
// ──────────────────────────────────────────────────────────────────────

function Pdf1({ r }: { r: AnalysisResult }) {
  const f = r.final_report;
  return (
    <div className={`relative ${S.wrap}`}>
      <PdfHeader title="시장 진입 브리핑" sub="Market Entry Briefing" product={r.product_description} />

      <Section title="핵심 요약">
        <p className={S.body}>{f.executive_summary}</p>
      </Section>

      <Section title="시장 규모">
        <div className={S.row3}>
          {[
            { label: "TAM 전체 시장", value: f.market_size_tam },
            { label: "SAM 유효 시장", value: f.market_size_sam },
            { label: "SOM 획득 목표", value: f.market_size_som },
          ].map(({ label, value }) => (
            <div key={label} className={S.box}>
              <p className="text-[9px] font-semibold text-gray-500 mb-1">{label}</p>
              <p className={S.body}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-gray-500">시장 성숙도:</span>
          {f.market_maturity && (
            <span className={`${S.chip} ${MATURITY_COLOR[f.market_maturity]}`}>{f.market_maturity}</span>
          )}
        </div>
      </Section>

      <div className={S.row2}>
        <Section title="진입 장벽">
          <BulletItems items={f.entry_barriers ?? []} dotColor="bg-amber-500" />
        </Section>
        <Section title="차별화 포인트">
          <BulletItems items={f.differentiation_points ?? []} dotColor="bg-emerald-500" />
        </Section>
      </div>

      <Section title="액션 플랜">
        <NumberedItems items={f.strategic_recommendations} />
      </Section>

      <PdfFooter label="시장 진입 브리핑" />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 2. 경쟁 전략 요약 (제안/입찰)
// ──────────────────────────────────────────────────────────────────────

function Pdf2({ r }: { r: AnalysisResult }) {
  const f = r.final_report;
  const top3 = r.phase1_competitors.slice(0, 3);
  return (
    <div className={`relative ${S.wrap}`}>
      <PdfHeader title="경쟁 전략 요약" sub="Competitive Strategy — Proposal & Bidding" product={r.product_description} />

      <Section title="시장 포지셔닝">
        <p className={S.body}>{r.market_positioning || r.market_overview}</p>
      </Section>

      <Section title="주요 경쟁사">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left p-1.5 border border-gray-200 font-semibold">기업명</th>
              <th className="text-left p-1.5 border border-gray-200 font-semibold">유형</th>
              <th className="text-left p-1.5 border border-gray-200 font-semibold">강점</th>
              <th className="text-left p-1.5 border border-gray-200 font-semibold">약점(기회)</th>
              <th className="text-center p-1.5 border border-gray-200 font-semibold">위협도</th>
            </tr>
          </thead>
          <tbody>
            {r.competitors.slice(0, 3).map((c) => (
              <tr key={c.name} className="border-b border-gray-200">
                <td className="p-1.5 border border-gray-200 font-medium">{c.name}</td>
                <td className="p-1.5 border border-gray-200 text-gray-500">{c.type === "direct" ? "직접" : "간접"}</td>
                <td className="p-1.5 border border-gray-200">{c.strengths?.[0] ?? "—"}</td>
                <td className="p-1.5 border border-gray-200">{c.weaknesses?.[0] ?? "—"}</td>
                <td className="p-1.5 border border-gray-200 text-center">
                  {top3.find((p) => p.name === c.name)?.relevance_score ?? "—"}/10
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div className={S.row2}>
        <Section title="우리의 차별화 포인트">
          <BulletItems items={f.differentiation_points ?? []} dotColor="bg-emerald-500" />
        </Section>
        <Section title="GTM 채널">
          <BulletItems items={f.gtm_channels ?? []} />
          {f.first_customer_hint && (
            <p className="mt-2 text-[10px] text-gray-500 italic">{f.first_customer_hint}</p>
          )}
        </Section>
      </div>

      <Section title="전략적 권고사항">
        <NumberedItems items={f.strategic_recommendations} />
      </Section>

      <PdfFooter label="경쟁 전략 요약" />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 3. 투자자용 시장 요약
// ──────────────────────────────────────────────────────────────────────

function Pdf3({ r }: { r: AnalysisResult }) {
  const f = r.final_report;
  return (
    <div className={`relative ${S.wrap}`}>
      <PdfHeader title="투자자용 시장 요약" sub="Market Summary for Investors" product={r.product_description} />

      <Section title="Executive Summary">
        <p className={S.body}>{f.executive_summary}</p>
      </Section>

      <Section title="시장 규모 및 성숙도">
        <div className={S.row3}>
          {[
            { label: "TAM", value: f.market_size_tam },
            { label: "SAM", value: f.market_size_sam },
            { label: "SOM (목표)", value: f.market_size_som },
          ].map(({ label, value }) => (
            <div key={label} className="rounded border-2 border-gray-300 p-2.5 text-center">
              <p className="text-[10px] font-bold text-gray-500 mb-1">{label}</p>
              <p className={`${S.body} font-semibold`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-gray-500">현재 시장 단계:</span>
          {f.market_maturity && (
            <span className={`${S.chip} ${MATURITY_COLOR[f.market_maturity]}`}>{f.market_maturity}</span>
          )}
          <span className="text-[10px] text-gray-500">경쟁사 수: {r.phase1_competitors.length}개 확인</span>
        </div>
      </Section>

      <div className={S.row2}>
        <Section title="시장 기회">
          <BulletItems items={f.differentiation_points ?? []} dotColor="bg-emerald-500" />
        </Section>
        <Section title="리스크">
          <BulletItems items={f.risk_scenarios ?? []} dotColor="bg-red-500" />
        </Section>
      </div>

      <Section title="진입 전략">
        <p className={S.body}>{f.entry_route}</p>
      </Section>

      <Section title="투자 관점 권고사항">
        <NumberedItems items={f.strategic_recommendations} />
      </Section>

      <PdfFooter label="투자자용 시장 요약" />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 4. 파트너십 제안서
// ──────────────────────────────────────────────────────────────────────

function Pdf4({ r }: { r: AnalysisResult }) {
  const f = r.final_report;
  const indirect  = r.competitors.filter((c) => c.type === "indirect");
  const adjacent  = r.phase1_competitors.filter((c) => c.type === "adjacent").slice(0, 3);
  return (
    <div className={`relative ${S.wrap}`}>
      <PdfHeader title="파트너십 제안서" sub="Partnership Proposal — Market Collaboration" product={r.product_description} />

      <Section title="시장 개요">
        <p className={S.body}>{r.market_overview}</p>
        <div className="mt-2 flex items-center gap-3">
          {f.market_maturity && (
            <span className={`${S.chip} ${MATURITY_COLOR[f.market_maturity]}`}>{f.market_maturity}</span>
          )}
          <span className="text-[10px] text-gray-500">TAM {f.market_size_tam}</span>
          <span className="text-[10px] text-gray-500">SAM {f.market_size_sam}</span>
        </div>
      </Section>

      <Section title="협력 가능 기업">
        {indirect.length > 0 || adjacent.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {[...indirect, ...adjacent.map((a) => ({ name: a.name, description: a.description }))].slice(0, 5).map((c) => (
              <div key={c.name} className={`${S.box} flex-1 min-w-[140px]`}>
                <p className="font-semibold text-[10px] mb-0.5">{c.name}</p>
                <p className="text-[10px] text-gray-500 line-clamp-2">{c.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className={S.body}>간접/인접 경쟁사 데이터를 기반으로 협력 대상을 검토하세요.</p>
        )}
      </Section>

      <div className={S.row2}>
        <Section title="우리가 제공할 수 있는 가치">
          <BulletItems items={f.differentiation_points ?? []} dotColor="bg-emerald-500" />
        </Section>
        <Section title="협력을 통한 시너지 (GTM 채널)">
          <BulletItems items={f.gtm_channels ?? []} />
        </Section>
      </div>

      <Section title="권장 진입 경로">
        <p className={S.body}>{f.entry_route}</p>
      </Section>

      <Section title="파트너십 전략 제언">
        <NumberedItems items={f.strategic_recommendations.slice(0, 3)} />
      </Section>

      <PdfFooter label="파트너십 제안서" />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 5. 신사업 검토 보고
// ──────────────────────────────────────────────────────────────────────

function Pdf5({ r }: { r: AnalysisResult }) {
  const f = r.final_report;
  return (
    <div className={`relative ${S.wrap}`}>
      <PdfHeader title="신사업 검토 보고" sub="New Business Review Report" product={r.product_description} />

      <Section title="핵심 요약">
        <p className={S.body}>{f.executive_summary}</p>
      </Section>

      <Section title="시장 규모">
        <div className={S.row3}>
          {[
            { label: "TAM 전체 시장", value: f.market_size_tam },
            { label: "SAM 유효 시장", value: f.market_size_sam },
            { label: "SOM 초기 목표", value: f.market_size_som },
          ].map(({ label, value }) => (
            <div key={label} className={S.box}>
              <p className="text-[9px] font-semibold text-gray-500 mb-1">{label}</p>
              <p className={S.body}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-gray-500">시장 성숙도:</span>
          {f.market_maturity && (
            <span className={`${S.chip} ${MATURITY_COLOR[f.market_maturity]}`}>{f.market_maturity}</span>
          )}
        </div>
      </Section>

      <div className={S.row2}>
        <Section title="진입 장벽">
          <BulletItems items={f.entry_barriers ?? []} dotColor="bg-amber-500" />
        </Section>
        <Section title="리스크 시나리오">
          <BulletItems items={f.risk_scenarios ?? []} dotColor="bg-red-500" />
        </Section>
      </div>

      <Section title="차별화 포인트 (진입 근거)">
        <BulletItems items={f.differentiation_points ?? []} dotColor="bg-emerald-500" />
      </Section>

      <Section title="권고사항 (의사결정 기준)">
        <NumberedItems items={f.strategic_recommendations} />
      </Section>

      <PdfFooter label="신사업 검토 보고" />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// PDF 렌더 맵
// ──────────────────────────────────────────────────────────────────────

const PDF_RENDERS: Record<number, (r: AnalysisResult) => React.ReactNode> = {
  1: (r) => <Pdf1 r={r} />,
  2: (r) => <Pdf2 r={r} />,
  3: (r) => <Pdf3 r={r} />,
  4: (r) => <Pdf4 r={r} />,
  5: (r) => <Pdf5 r={r} />,
};

// ──────────────────────────────────────────────────────────────────────
// Main Export Component
// ──────────────────────────────────────────────────────────────────────

export function PdfExportButtons({ result }: Props) {
  const refs    = useRef<Record<number, HTMLDivElement | null>>({});
  const [loading, setLoading] = useState<number | null>(null);

  const handleExport = async (id: number, label: string) => {
    const el = refs.current[id];
    if (!el) return;
    setLoading(id);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const pdf    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW  = pdf.internal.pageSize.getWidth();
      const pageH  = pdf.internal.pageSize.getHeight();
      const imgData = canvas.toDataURL("image/png");
      const ratio  = canvas.height / canvas.width;
      const imgH   = pageW * ratio;

      if (imgH <= pageH) {
        pdf.addImage(imgData, "PNG", 0, 0, pageW, imgH);
      } else {
        pdf.addImage(imgData, "PNG", 0, 0, pageW, pageH);
      }

      const filename = `MI_${label.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      {/* Button group */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          PDF 내보내기
        </p>
        <div className="flex flex-wrap gap-2">
          {PDF_TYPES.map(({ id, label, icon, desc }) => (
            <button
              key={id}
              onClick={() => handleExport(id, label)}
              disabled={loading !== null}
              title={desc}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300
                         text-xs font-medium text-slate-700 bg-white hover:border-brand-400
                         hover:text-brand-700 hover:bg-brand-50/30
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                icon
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Hidden PDF render area */}
      <div className="absolute left-[-9999px] top-0 pointer-events-none" aria-hidden="true">
        {PDF_TYPES.map(({ id }) => (
          <div key={id} ref={(el) => { refs.current[id] = el; }}>
            {PDF_RENDERS[id](result)}
          </div>
        ))}
      </div>
    </div>
  );
}
