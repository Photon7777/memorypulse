from __future__ import annotations

from pathlib import Path

import duckdb

from memorypulse.transformations.storage import ensure_history_files

DDL = """
CREATE TABLE spot_prices (
 observation_id VARCHAR PRIMARY KEY, observation_date DATE, collected_at TIMESTAMPTZ,
 source_id VARCHAR, market_type VARCHAR, memory_generation VARCHAR, product_type VARCHAR,
 capacity_value DOUBLE, capacity_unit VARCHAR, speed_mts INTEGER, price_value DOUBLE,
 currency VARCHAR, price_basis VARCHAR, price_per_gb DOUBLE, daily_high DOUBLE, daily_low DOUBLE,
 session_average DOUBLE, source_url VARCHAR, source_label VARCHAR, source_reliability VARCHAR,
 raw_description VARCHAR, is_estimate BOOLEAN
);
CREATE TABLE memory_prices AS SELECT * FROM spot_prices WHERE false;
CREATE TABLE retail_products (
 observation_id VARCHAR PRIMARY KEY, observation_date DATE, collected_at TIMESTAMPTZ,
 source_id VARCHAR, retailer VARCHAR, sku VARCHAR, brand VARCHAR, product_name VARCHAR,
 generation VARCHAR, total_capacity_gb DOUBLE, module_count INTEGER, speed_mts INTEGER,
 current_price DOUBLE, regular_price DOUBLE, price_per_gb DOUBLE, availability VARCHAR,
 product_url VARCHAR, parsing_confidence DOUBLE
);
CREATE TABLE electronics_prices (
 observation_id VARCHAR PRIMARY KEY, observation_date DATE, collected_at TIMESTAMPTZ,
 category VARCHAR, manufacturer VARCHAR, product_family VARCHAR, model VARCHAR,
 configuration VARCHAR, price_type VARCHAR, price_usd DOUBLE, memory_gb DOUBLE,
 storage_gb DOUBLE, comparability VARCHAR, source_id VARCHAR, source_url VARCHAR,
 source_label VARCHAR, notes VARCHAR
);
CREATE TABLE device_exposure (
 exposure_id VARCHAR PRIMARY KEY, category VARCHAR, display_name VARCHAR,
 memory_storage_share_low DOUBLE, memory_storage_share_central DOUBLE,
 memory_storage_share_high DOUBLE, pass_through_low DOUBLE,
 pass_through_central DOUBLE, pass_through_high DOUBLE, basis VARCHAR, source_label VARCHAR
);
CREATE TABLE industry_outlooks (
 outlook_id VARCHAR PRIMARY KEY, published_at DATE, collected_at TIMESTAMPTZ,
 horizon_end DATE, segment VARCHAR, metric VARCHAR, direction VARCHAR,
 central_estimate DOUBLE, lower_estimate DOUBLE, upper_estimate DOUBLE, unit VARCHAR,
 summary VARCHAR, source_id VARCHAR, source_url VARCHAR, source_label VARCHAR, notes VARCHAR
);
CREATE TABLE macro_indicators (
 observation_id VARCHAR PRIMARY KEY, observation_date DATE, collected_at TIMESTAMPTZ,
 source_id VARCHAR, series_id VARCHAR, series_name VARCHAR, value DOUBLE, unit VARCHAR,
 source_url VARCHAR
);
CREATE TABLE forecasts (
 forecast_created_at TIMESTAMPTZ, target_date DATE, series_id VARCHAR, model_name VARCHAR,
 model_version VARCHAR, point_forecast DOUBLE, lower_bound DOUBLE, upper_bound DOUBLE,
 training_start DATE, training_end DATE, backtest_mae DOUBLE, backtest_mape DOUBLE,
 observations_used INTEGER, data_frequency VARCHAR
);
CREATE TABLE structural_forecasts (
 forecast_created_at TIMESTAMPTZ, target_date DATE, series_id VARCHAR, scenario VARCHAR,
 model_name VARCHAR, model_version VARCHAR, point_forecast DOUBLE, lower_bound DOUBLE,
 upper_bound DOUBLE, baseline_value DOUBLE, change_from_baseline_percent DOUBLE,
 direction VARCHAR, confidence VARCHAR, driver_summary VARCHAR, basis VARCHAR, source_ids VARCHAR
);
CREATE TABLE market_index (
 observation_date DATE, calculated_at TIMESTAMPTZ, total_score DOUBLE, status_label VARCHAR,
 confidence_score DOUBLE, spot_momentum_score DOUBLE, retail_momentum_score DOUBLE,
 volatility_score DOUBLE, news_pressure_score DOUBLE, macro_pressure_score DOUBLE,
 methodology_version VARCHAR
);
CREATE TABLE source_runs (
 run_id VARCHAR PRIMARY KEY, source_id VARCHAR, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
 status VARCHAR, records_received INTEGER, records_written INTEGER, records_rejected INTEGER,
 response_status INTEGER, failure_reason VARCHAR, data_freshness_at TIMESTAMPTZ,
 duration_seconds DOUBLE, optional_key_configured BOOLEAN
);
CREATE TABLE news_events (
 event_id VARCHAR PRIMARY KEY, published_at TIMESTAMPTZ, collected_at TIMESTAMPTZ, title VARCHAR,
 source_domain VARCHAR, source_name VARCHAR, article_url VARCHAR, query_category VARCHAR,
 companies VARCHAR[], memory_types VARCHAR[], event_tags VARCHAR[], short_excerpt VARCHAR,
 relevance_score DOUBLE, duplicate_group_id VARCHAR, manually_important BOOLEAN
);
CREATE TABLE decision_briefs (
 brief_id VARCHAR PRIMARY KEY, generated_at TIMESTAMPTZ, regime VARCHAR, direction VARCHAR,
 confidence VARCHAR, confidence_score DOUBLE, pressure_score DOUBLE, procurement_posture VARCHAR,
 inventory_posture VARCHAR, budget_risk VARCHAR, conclusion VARCHAR, methodology_version VARCHAR
);
"""


VIEW_DDL = """
CREATE VIEW daily_spot_prices AS
 SELECT observation_date, product_type, memory_generation, source_id,
        avg(coalesce(session_average, price_value)) AS average_price,
        avg(price_per_gb) AS average_price_per_gb, count(*) AS observations
 FROM spot_prices GROUP BY ALL;
CREATE VIEW monthly_memory_prices AS
 SELECT monthly.*,
        100 * (average_price_per_gb / nullif(lag(average_price_per_gb) OVER
          (PARTITION BY source_id, product_type ORDER BY month), 0) - 1) AS monthly_change_percent
 FROM (SELECT date_trunc('month', observation_date)::DATE AS month, memory_generation, product_type,
        source_id, avg(price_value) AS average_price, avg(price_per_gb) AS average_price_per_gb,
        count(*) AS observations FROM memory_prices GROUP BY ALL) monthly;
CREATE VIEW retail_generation_summary AS
 SELECT observation_date, generation, median(price_per_gb) AS median_price_per_gb,
        median(current_price) AS median_price, count(*) AS products,
        count(*) FILTER (availability ILIKE '%available%' OR availability ILIKE '%stock%') AS available,
        avg(100 * (regular_price - current_price) / nullif(regular_price, 0)) AS average_discount_percent
 FROM retail_products WHERE parsing_confidence >= 0.7 GROUP BY ALL;
CREATE VIEW price_momentum AS
 SELECT observation_date, memory_generation, product_type, price_value,
        100 * (price_value / nullif(lag(price_value, 7) OVER w, 0) - 1) AS change_7,
        100 * (price_value / nullif(lag(price_value, 30) OVER w, 0) - 1) AS change_30,
        100 * (price_value / nullif(lag(price_value, 90) OVER w, 0) - 1) AS change_90
 FROM spot_prices WINDOW w AS (PARTITION BY product_type ORDER BY observation_date);
CREATE VIEW price_volatility AS
 SELECT observation_date, product_type,
        avg(price_value) OVER (PARTITION BY product_type ORDER BY observation_date
          ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rolling_7_average,
        stddev_samp(price_value) OVER (PARTITION BY product_type ORDER BY observation_date
          ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS rolling_30_volatility
 FROM spot_prices;
CREATE VIEW generation_price_spread AS
 SELECT d4.month AS observation_date, d4.average_price_per_gb AS ddr4_price_per_gb,
        d5.average_price_per_gb AS ddr5_price_per_gb,
        d5.average_price_per_gb - d4.average_price_per_gb AS ddr5_minus_ddr4
 FROM monthly_memory_prices d4 JOIN monthly_memory_prices d5
   ON d4.month = d5.month AND d4.source_id = d5.source_id
 WHERE d4.memory_generation = 'DDR4' AND d5.memory_generation = 'DDR5';
CREATE VIEW news_daily_counts AS
 SELECT published_at::DATE AS observation_date, tag AS event_tag, count(*) AS event_count
 FROM news_events, UNNEST(event_tags) AS event_tag_rows(tag) GROUP BY 1, 2;
CREATE VIEW company_event_counts AS
 SELECT company, count(*) AS event_count
 FROM news_events, UNNEST(companies) AS company_rows(company) GROUP BY 1;
CREATE VIEW macro_indicator_changes AS
 SELECT observation_date, series_id, value,
        100 * (value / nullif(lag(value) OVER (PARTITION BY series_id ORDER BY observation_date), 0) - 1)
          AS period_change FROM macro_indicators;
CREATE VIEW source_freshness AS
 SELECT source_id, max(completed_at) AS latest_run,
        max(data_freshness_at) AS latest_observation,
        arg_max(status, completed_at) AS latest_status FROM source_runs GROUP BY source_id;
CREATE VIEW forecast_accuracy AS
 SELECT f.forecast_created_at, f.target_date, f.series_id, f.point_forecast,
        m.price_value AS actual_value, abs(f.point_forecast - m.price_value) AS absolute_error
 FROM forecasts f LEFT JOIN memory_prices m
   ON f.target_date = m.observation_date AND f.series_id = m.product_type;
CREATE VIEW electronics_price_changes AS
 SELECT *, 100 * (price_usd / nullif(first_value(price_usd) OVER (
   PARTITION BY product_family ORDER BY observation_date), 0) - 1) AS change_from_first_percent
 FROM electronics_prices;
CREATE VIEW market_pressure_components AS
 SELECT observation_date, total_score, confidence_score, component, score
 FROM market_index UNPIVOT(score FOR component IN (
   spot_momentum_score, retail_momentum_score, volatility_score,
   news_pressure_score, macro_pressure_score));
"""


FILE_TO_TABLE = {
    "spot_prices.csv": "spot_prices",
    "memory_prices.csv": "memory_prices",
    "retail_products.csv": "retail_products",
    "electronics_prices.csv": "electronics_prices",
    "device_exposure.csv": "device_exposure",
    "industry_outlooks.csv": "industry_outlooks",
    "macro_indicators.csv": "macro_indicators",
    "forecasts.csv": "forecasts",
    "structural_forecasts.csv": "structural_forecasts",
    "market_index.csv": "market_index",
    "source_runs.csv": "source_runs",
    "decision_briefs.csv": "decision_briefs",
}


def _has_rows(path: Path) -> bool:
    with path.open(encoding="utf-8") as handle:
        next(handle, None)
        return next(handle, None) is not None


def create_database(history_dir: Path, database_path: Path) -> duckdb.DuckDBPyConnection:
    """Rebuild the analytical database from canonical text files."""
    ensure_history_files(history_dir)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    database_path.unlink(missing_ok=True)
    connection = duckdb.connect(str(database_path))
    connection.execute(DDL)
    for filename, table in FILE_TO_TABLE.items():
        path = history_dir / filename
        if _has_rows(path):
            connection.execute(
                f"INSERT INTO {table} BY NAME SELECT * FROM read_csv_auto(?, header=true, nullstr='', sample_size=-1)",
                [str(path)],
            )
    news_path = history_dir / "news_events.ndjson"
    if news_path.stat().st_size:
        connection.execute(
            "INSERT INTO news_events BY NAME SELECT * FROM read_json_auto(?, format='newline_delimited')",
            [str(news_path)],
        )
    connection.execute(VIEW_DDL)
    return connection
