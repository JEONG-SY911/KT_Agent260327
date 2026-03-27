// ──────────────────────────────────────────────────────────────────────
// Domain types mirroring the Python Pydantic schemas
// ──────────────────────────────────────────────────────────────────────

// Phase 1: Market Scan — lightweight metadata, 5+ entries
export interface Phase1CompetitorItem {
  name: string;
  type: "direct" | "indirect" | "adjacent";
  description: string;
  website: string;
  market_share_estimate: string;
  funding_info: string;
  founded_year: string;
  relevance_score: number; // 1-10
}

// Phase 2: Deep profiles — 2-3 selected companies
export interface CompetitorProfile {
  name: string;
  type: "direct" | "indirect";
  description: string;
  website: string;
  key_products: string[];
  strengths: string[];
  weaknesses: string[];
  estimated_market_position: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  keyword?: string;
}

export interface GraphNode {
  id: string;
  type: "company" | "product" | "trend" | "threat";
  label: string;
  description: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type MarketMaturity = "도입기" | "성장기" | "성숙기" | "쇠퇴기";

export interface FinalReport {
  executive_summary: string;
  positioning_summary: string;
  competitive_analysis_summary: string;
  market_opportunities: string[];
  threat_factors: string[];
  strategic_recommendations: string[];
  // 시장 규모 (TAM / SAM / SOM)
  market_size_tam: string;
  market_size_sam: string;
  market_size_som: string;
  market_maturity: MarketMaturity;
  // 진입 장벽 / 차별화
  entry_barriers: string[];
  differentiation_points: string[];
  // Go-to-Market
  gtm_channels: string[];
  first_customer_hint: string;
  entry_route: string;
  // 리스크
  risk_scenarios: string[];
}

// ──────────────────────────────────────────────────────────────────────
// Intelligence Agent types (Step 7)
// ──────────────────────────────────────────────────────────────────────

export interface PricingEntry {
  competitor_name: string;
  explicit_price: string;
  price_vs_market_avg: string;
  pricing_model: string;
  active_promotions: string;
  price_tier: "low" | "medium" | "high" | "premium";
}

export interface PricingIntelligence {
  entries: PricingEntry[];
  market_avg_estimate: string;
  our_price_positioning: string;
}

export interface CompetitorSpecValue {
  competitor_name: string;
  value: string;
}

export interface SpecRow {
  spec_name: string;
  our_value: string;
  competitor_values: CompetitorSpecValue[];
  advantage_holder: string;
}

export interface SpecComparison {
  rows: SpecRow[];
  our_product_label: string;
}

export interface AnalysisResult {
  product_description: string;
  market_overview: string;
  phase1_competitors: Phase1CompetitorItem[];
  market_positioning: string;
  competitors: CompetitorProfile[];       // Phase 2 deep profiles
  search_keywords: string[];
  raw_research: SearchResult[];
  knowledge_graph: KnowledgeGraph;
  graph_insights: string[];
  final_report: FinalReport;
  // Intelligence Agent output (Step 7)
  strategic_action_summary: string;
  pricing_intelligence: PricingIntelligence;
  spec_comparison: SpecComparison;
  absolute_strengths: string[];
  critical_weaknesses: string[];
}

// ──────────────────────────────────────────────────────────────────────
// UI / workflow state types
// ──────────────────────────────────────────────────────────────────────

export type AppState = "idle" | "analyzing" | "complete" | "fallback" | "error";

export interface AgentStep {
  step: number;
  node: string;
  label: string;
  description: string;
  status: "pending" | "active" | "complete" | "error";
  message: string;
}

// ──────────────────────────────────────────────────────────────────────
// SSE event payload types
// ──────────────────────────────────────────────────────────────────────

export interface ProgressPayload {
  type:
    | "stage_start"
    | "stage_complete"
    | "searching"
    | "fallback"
    | "error"
    | "complete";
  node?: string;
  step?: number;
  message: string;
}

export interface TerminalPayload {
  type: "invalid_input" | "error";
  fallback_message?: string;
  error?: string;
}

// ──────────────────────────────────────────────────────────────────────
// Deep-Dive types (mirrors backend deep-dive schemas)
// ──────────────────────────────────────────────────────────────────────

export interface SWOTItem {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface SingleDeepDiveReport {
  company_name: string;
  business_model_detail: string;
  core_technology: string;
  key_products: string[];
  swot: SWOTItem;
  recent_highlights: string[];
  customer_pain_points: string[];
}

export interface ComparisonEntry {
  company_name: string;
  core_service: string;
  target_customer: string;
  pricing_model: string;
  market_position: string;
  top_strength: string;
  top_weakness: string;
}

export interface ComparisonReport {
  entries: ComparisonEntry[];
  summary: string;
}

export interface DeepDiveApiResult {
  mode: "single" | "comparison";
  single_report: SingleDeepDiveReport | null;
  comparison_report: ComparisonReport | null;
  raw_research: SearchResult[];
}

// ──────────────────────────────────────────────────────────────────────
// One-Page Report types
// ──────────────────────────────────────────────────────────────────────

export type ReportType =
  | "market_entry"
  | "competitive_bid"
  | "investment_decision";

export interface OnepageSection {
  title: string;
  content: string;
}

export interface SummaryCard {
  label: string;
  value: string;
}

export interface OnepageReport {
  report_type: ReportType;
  title: string;
  subtitle: string;
  sections: OnepageSection[];
  summary_cards: SummaryCard[];
}
