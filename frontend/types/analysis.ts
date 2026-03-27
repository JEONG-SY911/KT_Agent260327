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
  // 시장 규모
  market_size_tam: string;
  market_size_sam: string;
  market_size_som: string;
  market_maturity: MarketMaturity;
  // 진입 장벽
  entry_barriers: string[];
  // 차별화
  differentiation_points: string[];
  // Go-to-Market
  gtm_channels: string[];
  first_customer_hint: string;
  entry_route: string;
  // 리스크
  risk_scenarios: string[];
  // 액션 플랜
  strategic_recommendations: string[];
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
