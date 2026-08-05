import { useMemo, useState } from 'react'
import { DataBoundary } from '../components/DataBoundary'
import { PageIntro } from '../components/PageIntro'
import { usePublicData } from '../hooks/usePublicData'
import { publicAssetUrl } from '../services/data'
import type { DatasetCatalog } from '../types/data'
import { formatBytes, formatDate, formatNumber } from '../utils/format'

type ResourceFormat = 'all' | 'csv' | 'ndjson' | 'parquet'
const RESOURCE_ORDER = ['memory_prices', 'market_index', 'forecasts', 'news_events', 'macro_indicators', 'decision_briefs', 'source_runs', 'retail_products', 'spot_prices']

export function DataPage() {
  const catalog = usePublicData<DatasetCatalog>('datasets/latest/catalog.json')
  const [format, setFormat] = useState<ResourceFormat>('parquet')
  const [copied, setCopied] = useState(false)
  const resources = useMemo(
    () => (catalog.data?.resources.filter((item) => format === 'all' || item.format === format) ?? [])
      .sort((left, right) => RESOURCE_ORDER.indexOf(left.dataset) - RESOURCE_ORDER.indexOf(right.dataset)),
    [catalog.data, format],
  )
  const latestResources = catalog.data?.resources.filter((item) => item.format === 'parquet') ?? []
  const totalRows = latestResources.reduce((total, item) => total + item.rows, 0)
  const dated = latestResources.filter((item) => ['memory_prices', 'spot_prices', 'retail_products', 'macro_indicators', 'news_events'].includes(item.dataset) && item.start_date && item.end_date)
  const startDate = dated.map((item) => item.start_date as string).sort()[0]
  const endDate = dated.map((item) => item.end_date as string).sort().at(-1)
  const citation = `MemoryPulse Public Memory-Market Dataset, version ${catalog.data?.dataset_version ?? '1.0.0'}, ${catalog.data?.homepage ?? 'https://photon7777.github.io/memorypulse/#/data'}`

  async function copyCitation() {
    try {
      await navigator.clipboard.writeText(citation)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <PageIntro kicker="Open data" title="A reusable memory-market dataset, not a locked dashboard" description="Download canonical tables, analytics-ready Parquet, schemas, checksums, and provenance. Every resource retains its source, date, basis, and reuse caveats." />
      <DataBoundary loading={catalog.loading} error={catalog.error}>
        <section className="dataset-hero">
          <div><span className="dataset-version">Dataset v{catalog.data?.dataset_version}</span><h2>{catalog.data?.name}</h2><p>{catalog.data?.description}</p><div className="hero-actions"><a className="button button--primary" href={publicAssetUrl(`datasets/latest/${catalog.data?.bundle.path ?? ''}`)} download>Download complete ZIP · {formatBytes(catalog.data?.bundle.bytes)}</a><a className="button button--quiet" href={publicAssetUrl('datasets/latest/catalog.json')}>View catalog JSON</a></div></div>
          <dl><div><dt>Updated</dt><dd>{formatDate(catalog.data?.generated_at, true)}</dd></div><div><dt>Tables</dt><dd>{latestResources.length}</dd></div><div><dt>Rows</dt><dd>{formatNumber(totalRows, 0)}</dd></div><div><dt>Coverage</dt><dd>{formatDate(startDate)}–{formatDate(endDate)}</dd></div></dl>
        </section>

        <section className="dataset-trust-strip" aria-label="Dataset guarantees"><span><strong>Versioned</strong>Semantic dataset and schema versions</span><span><strong>Traceable</strong>Source IDs, URLs, and collection dates</span><span><strong>Verifiable</strong>SHA-256 checksum for every artifact</span><span><strong>Accessible</strong>No account, key, or paywall required</span></section>

        <section className="section-block dataset-resources">
          <div className="section-heading"><div><p className="kicker">Resource catalog</p><h2>Choose the format that fits your work</h2></div><p>CSV and NDJSON preserve canonical history. Parquet is compact and ready for Python, R, DuckDB, and BI tools.</p></div>
          <div className="dataset-format-tabs" aria-label="Dataset format filter">{(['all', 'csv', 'ndjson', 'parquet'] as ResourceFormat[]).map((item) => <button type="button" key={item} className={format === item ? 'active' : ''} aria-pressed={format === item} onClick={() => setFormat(item)}>{item === 'all' ? 'All formats' : item.toUpperCase()}</button>)}</div>
          <div className="dataset-resource-list">{resources.map((resource) => <article key={resource.id}>
            <div className="resource-format">{resource.format}</div>
            <div><h3>{resource.title}</h3><p>{resource.description}</p><small>{formatNumber(resource.rows, 0)} rows · {formatBytes(resource.bytes)} · {resource.start_date ? `${formatDate(resource.start_date)} to ${formatDate(resource.end_date)}` : 'Awaiting observations'}</small></div>
            <div className="resource-actions"><a href={publicAssetUrl(`datasets/latest/${resource.path}`)} download>Download</a><a href={publicAssetUrl(`datasets/latest/${resource.schema_path}`)}>Schema</a></div>
          </article>)}</div>
        </section>

        <section className="data-pipeline-section">
          <div><p className="kicker">Collection layer</p><h2>From public evidence to a stable release</h2><p>Every daily run isolates source failures, validates records, preserves canonical history, rebuilds analytics, and publishes the dataset only after contract checks pass.</p></div>
          <ol className="pipeline-steps"><li><span>01</span><strong>Collect</strong><p>Bounded public adapters with source-specific rules</p></li><li><span>02</span><strong>Validate</strong><p>Dates, units, identifiers, freshness, and row limits</p></li><li><span>03</span><strong>Analyze</strong><p>Index, forecasts, drivers, and decision brief</p></li><li><span>04</span><strong>Release</strong><p>CSV, NDJSON, Parquet, schemas, ZIP, and checksums</p></li></ol>
        </section>

        <section className="dataset-use-grid">
          <article><p className="kicker">Citation</p><h2>Reuse with context</h2><code>{citation}</code><button type="button" className="button button--quiet" onClick={() => void copyCitation()}>{copied ? 'Citation copied' : 'Copy citation'}</button></article>
          <article><p className="kicker">Machine access</p><h2>Stable public endpoints</h2><a href={publicAssetUrl('datasets/latest/catalog.json')}>catalog.json</a><a href={publicAssetUrl('datasets/latest/dataset.json')}>Schema.org dataset metadata</a><a href={publicAssetUrl('datasets/latest/checksums.sha256')}>checksums.sha256</a></article>
          <article><p className="kicker">License and limits</p><h2>Source terms still matter</h2><p>MemoryPulse separates its MIT-licensed code from third-party source rights. DRAMeXchange is excluded without permission, and every distributed record retains attribution.</p><a href={publicAssetUrl('datasets/latest/DATA_LICENSE.md')}>Read data reuse terms</a></article>
        </section>
      </DataBoundary>
    </>
  )
}
