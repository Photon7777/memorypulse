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
  historical_accuracy: Array<Record<string, string | number | null>>
  empty_message: string
  disclaimer: string
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
