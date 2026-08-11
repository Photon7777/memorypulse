export type SourceStatus = 'success' | 'degraded' | 'disabled' | 'not_run'

export interface Manifest {
  schema_version: string
  generated_at: string
  pipeline_run_id: string
  methodology_version: string
  files: string[]
  latest_observation: string | null
  production_data: boolean
  fixture_data: boolean
}

export interface IndexComponent {
  key: string
  score: number | null
  raw_inputs: Record<string, number | null>
  transformation: string
  coverage: number
}

export interface MarketIndex {
  observation_date: string
  calculated_at: string
  total_score: number
  status_label: string
  confidence_score: number
  methodology_version: string
}

export interface MarketSummary {
  latest_index: MarketIndex | null
  components: IndexComponent[]
  confidence: number
  latest_observation: string | null
  last_pipeline_run: string | null
  last_successful_update: string | null
  website_build: string
  key_changes: Record<string, number | null>
  insights: string[]
  disclaimer: string
}

export interface PricePoint {
  date: string
  value: number
  price_per_gb: number | null
  estimate: boolean
}

export interface PriceSeries {
  id: string
  label: string
  generation: string
  market_type: string
  currency: string
  basis: string
  source_id: string
  source_label: string
  source_url: string
  is_estimate: boolean
  points: PricePoint[]
}

export interface PricesData {
  series: PriceSeries[]
  units_note: string
}

export interface DecisionDriver {
  key: string
  label: string
  score: number
  effect: 'tightening' | 'easing' | 'neutral'
  contribution: number
  evidence: Record<string, number | null>
}

export interface DecisionBrief {
  brief_id: string
  generated_at: string
  regime: string
  direction: string
  confidence: string
  confidence_score: number
  pressure_score: number
  headline: string
  conclusion: string
  recommended_posture: {
    procurement: string
    inventory: string
    budget_risk: string
  }
  drivers: DecisionDriver[]
  risks: string[]
  changes: Array<{ label: string; value: number | null; unit: string }>
  ddr5: {
    latest_price_per_gb: number | null
    latest_observation: string | null
    recent_change_percent: number | null
    forecast_change_percent: number | null
    forecast: Forecast | null
    structural_change_percent: number | null
    structural_forecast: StructuralForecast | null
  }
  method: string
  disclaimer: string
  history: Array<{
    brief_id: string
    generated_at: string
    regime: string
    direction: string
    confidence: string
    confidence_score: number
    pressure_score: number
    procurement_posture: string
    inventory_posture: string
    budget_risk: string
    conclusion: string
  }>
}

export interface AnalyticsMacroSeries {
  series_id: string
  name: string
  unit: string
  source_id: string
  source_url: string
  latest: { date: string; value: number }
  change_percent: number | null
  observations: number
  points: Array<{ date: string; value: number }>
}

export interface ModelDiagnostic {
  series_id: string
  observations: number
  selected_model: string
  advanced_ml_ready: boolean
  selection_rule: string
  candidates: Array<{
    model: string
    mae: number
    mape: number | null
    smape: number | null
    mase: number | null
    direction_accuracy: number | null
    validation_points: number
    stability: number
    skill_vs_naive_percent: number | null
    selected: boolean
  }>
}

export interface AnalyticsData {
  components: Array<IndexComponent & { label: string; effective_weight: number; weighted_contribution: number | null }>
  pressure_history: Array<{
    date: string
    total_score: number
    confidence_score: number
    spot_momentum_score: number | null
    retail_momentum_score: number | null
    volatility_score: number | null
    news_pressure_score: number | null
    macro_pressure_score: number | null
    status_label: string
  }>
  momentum_matrix: Array<{
    series_id: string
    generation: string
    horizon_months: number
    change_percent: number
    latest_date: string
    observations: number
  }>
  macro_series: AnalyticsMacroSeries[]
  model_diagnostics: ModelDiagnostic[]
  event_pressure: { latest_30_days: number; prior_30_days: number; policy_events: number }
  model_readiness: {
    ddr5_monthly_points: number
    baseline_models_ready: boolean
    advanced_ml_ready: boolean
    points_until_advanced_ml: number
    explanation: string
  }
  evidence_readiness: EvidenceReadiness
}

export interface EvidenceReadiness {
  score: number
  status: 'scenario_only' | 'panel_building' | 'statistical_ready'
  label: string
  ddr5_months: number
  history_start: string | null
  history_end: string | null
  direct_series: number
  direct_sources: number
  retail_products: number
  retail_months: number
  driver_families: string[]
  driver_family_count: number
  short_term_ready: boolean
  panel_ready: boolean
  long_range_statistical_ready: boolean
  thresholds: {
    ddr5_months: number
    direct_sources: number
    retail_products: number
    driver_families: number
  }
  blockers: string[]
  explanation: string
}

export interface NewsEvent {
  event_id: string
  published_at: string
  title: string
  source_domain: string
  source_name: string
  article_url: string
  query_category: string
  companies: string[]
  memory_types: string[]
  event_tags: string[]
  short_excerpt: string
  relevance_score: number
}

export interface NewsData {
  events: NewsEvent[]
  daily_counts: Array<{ date: string; count: number }>
  filters: { companies: string[]; memory_types: string[]; event_tags: string[] }
  retention_days: number
}

export interface Forecast {
  forecast_created_at: string
  target_date: string
  series_id: string
  model_name: string
  model_version: string
  point_forecast: number
  lower_bound: number
  upper_bound: number
  training_start: string
  training_end: string
  backtest_mae: number
  backtest_mape: number | null
  observations_used: number
  data_frequency: string
}

export interface ForecastData {
  forecasts: Forecast[]
  structural_forecasts: StructuralForecast[]
  evidence_readiness: EvidenceReadiness
  historical_accuracy: Array<Record<string, string | number | null>>
  industry_outlooks: IndustryOutlook[]
  empty_message: string
  disclaimer: string
}

export interface StructuralForecast {
  forecast_created_at: string
  target_date: string
  series_id: string
  scenario: 'easing' | 'base' | 'tight_supply'
  model_name: string
  model_version: string
  point_forecast: number
  lower_bound: number
  upper_bound: number
  baseline_value: number
  change_from_baseline_percent: number
  direction: 'upward' | 'easing' | 'flat'
  confidence: 'low' | 'moderate' | 'high'
  driver_summary: string
  basis: string
  source_ids: string
}

export interface IndustryOutlook {
  outlook_id: string
  published_at: string
  collected_at: string
  horizon_end: string
  segment: string
  metric: string
  direction: 'upward' | 'easing' | 'mixed'
  central_estimate: number | null
  lower_estimate: number | null
  upper_estimate: number | null
  unit: string
  summary: string
  source_id: string
  source_url: string
  source_label: string
  notes: string
}

export interface SourceHealth {
  source_id: string
  source_kind: 'core' | 'optional' | 'permission_required'
  status: SourceStatus
  latest_retrieval: string | null
  latest_attempt: string | null
  latest_observation: string | null
  records_collected: number
  records_rejected: number
  reason: string
  optional_key_configured: boolean
}

export interface SourceHealthData { sources: SourceHealth[] }

export interface MethodologyData {
  version: string
  weights: Record<string, number>
  normalization: string
  missing_data: string
  unit_rule: string
  forecasting: string
  caveats: string[]
}

export interface RetailProduct {
  observation_id: string
  observation_date: string
  retailer: string
  sku: string
  brand: string
  product_name: string
  generation: string
  total_capacity_gb: number | null
  current_price: number
  regular_price: number | null
  price_per_gb: number | null
  availability: string
  product_url: string
  parsing_confidence: number
}

export interface RetailData {
  products: RetailProduct[]
  generation_summaries: Array<Record<string, string | number | null>>
}

export interface DatasetResource {
  id: string
  dataset: string
  title: string
  description: string
  format: 'csv' | 'ndjson' | 'parquet'
  path: string
  schema_path: string
  rows: number
  bytes: number
  sha256: string
  start_date: string | null
  end_date: string | null
  source_ids: string[]
}

export interface DatasetCatalog {
  dataset_version: string
  schema_version: string
  generated_at: string
  pipeline_run_id: string
  production_data: boolean
  name: string
  description: string
  publisher: string
  homepage: string
  repository: string
  license: string
  attribution_required: boolean
  bundle: { path: string; format: 'zip'; bytes: number; sha256: string }
  resources: DatasetResource[]
}

export interface ElectronicsMilestone {
  observation_id: string
  observation_date: string
  category: string
  manufacturer: string
  product_family: string
  model: string
  configuration: string
  price_type: 'launch_msrp' | 'official_msrp' | 'announced_msrp'
  price_usd: number
  memory_gb: number | null
  storage_gb: number | null
  comparability: 'like_for_like' | 'same_product_family' | 'starting_price_tier'
  source_id: string
  source_url: string
  source_label: string
  notes: string
  change_from_first_percent: number
}

export interface ElectronicsProductSeries {
  family: string
  category: string
  manufacturer: string
  comparability: ElectronicsMilestone['comparability']
  first_price: number
  latest_price: number
  change_percent: number
  first_date: string
  latest_date: string
  points: ElectronicsMilestone[]
}

export interface DeviceExposureScenario {
  exposure_id: string
  category: string
  display_name: string
  memory_storage_share_low: number
  memory_storage_share_central: number
  memory_storage_share_high: number
  pass_through_low: number
  pass_through_central: number
  pass_through_high: number
  basis: string
  source_label: string
  signal_percent: number
  modeled_product_effect_low: number
  modeled_product_effect_central: number
  modeled_product_effect_high: number
}

export interface ElectronicsStory {
  headline: string
  thesis: string
  memory_signal_percent: number
  product_series: ElectronicsProductSeries[]
  milestones: ElectronicsMilestone[]
  exposure_scenarios: DeviceExposureScenario[]
  evidence: Array<{
    kind: 'observed' | 'qualified'
    label: string
    value: number
    unit: string
    interpretation: string
  }>
  story: {
    proves: string[]
    suggests: string[]
    uncertain: string[]
    would_change_view: string[]
  }
  conclusion: string
  disclaimer: string
}
