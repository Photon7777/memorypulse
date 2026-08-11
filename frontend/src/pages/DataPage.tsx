import { useMemo, useState } from 'react'
import { DataBoundary } from '../components/DataBoundary'
import { PageIntro } from '../components/PageIntro'
import { usePublicData } from '../hooks/usePublicData'
import { publicAssetUrl } from '../services/data'
import type { DatasetCatalog, DatasetResource } from '../types/data'
import { formatBytes, formatDate, formatNumber } from '../utils/format'

type ResourceFormat = 'all' | 'csv' | 'ndjson' | 'parquet'
const RESOURCE_ORDER = ['electronics_prices', 'memory_prices', 'market_index', 'forecasts', 'structural_forecasts', 'industry_outlooks', 'device_exposure', 'news_events', 'macro_indicators', 'decision_briefs', 'source_runs', 'retail_products', 'spot_prices']
const FEATURED_DATASETS = ['electronics_prices', 'memory_prices', 'structural_forecasts', 'industry_outlooks']

function ResourceActions({ resource }: { resource: DatasetResource }) {
  return <div className="resource-actions"><a href={publicAssetUrl(`datasets/latest/${resource.path}`)} download>Download</a><a href={publicAssetUrl(`datasets/latest/${resource.schema_path}`)}>Schema</a></div>
}

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
  const featuredResources = latestResources.filter((item) => FEATURED_DATASETS.includes(item.dataset) && item.rows > 0).sort((left, right) => FEATURED_DATASETS.indexOf(left.dataset) - FEATURED_DATASETS.indexOf(right.dataset))
  const totalRows = latestResources.reduce((total, item) => total + item.rows, 0)
  const dated = latestResources.filter((item) => ['memory_prices', 'spot_prices', 'retail_products', 'macro_indicators', 'news_events'].includes(item.dataset) && item.start_date && item.end_date)
  const startDate = dated.map((item) => item.start_date as string).sort()[0]
  const endDate = dated.map((item) => item.end_date as string).sort().at(-1)
  const citation = `MemoryPulse Public Memory-Market Dataset, version ${catalog.data?.dataset_version ?? '1.4.0'}, ${catalog.data?.homepage ?? 'https://photon7777.github.io/memorypulse/#/data'}`

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
      <PageIntro kicker="Open data" title="Use the evidence behind MemoryPulse" description="Download memory history, official supply and trade drivers, short-term forecasts, 12–24 month scenarios, sourced industry outlooks, and market events—free, traceable, and ready for analysis." />
      <DataBoundary loading={catalog.loading} error={catalog.error}>
        <section className="dataset-hero">
          <div><span className="dataset-version">Dataset v{catalog.data?.dataset_version}</span><h2>One download. Every analysis-ready table.</h2><p>Canonical history, official product-price milestones, sourced expert outlooks, scenario assumptions, analytical outputs, schemas, and checksums in a single versioned release.</p><div className="hero-actions"><a className="button button--primary" href={publicAssetUrl(`datasets/latest/${catalog.data?.bundle.path ?? ''}`)} download>Download everything · {formatBytes(catalog.data?.bundle.bytes)}</a><a className="button button--quiet" href={publicAssetUrl('datasets/latest/catalog.json')}>Open machine catalog</a></div></div>
          <dl><div><dt>Updated</dt><dd>{formatDate(catalog.data?.generated_at, true)}</dd></div><div><dt>Tables</dt><dd>{latestResources.length}</dd></div><div><dt>Rows</dt><dd>{formatNumber(totalRows, 0)}</dd></div><div><dt>Coverage</dt><dd>{formatDate(startDate)}–{formatDate(endDate)}</dd></div></dl>
        </section>

        <section className="dataset-trust-strip" aria-label="Dataset guarantees"><span><strong>Versioned</strong>Stable releases</span><span><strong>Traceable</strong>Sources and dates retained</span><span><strong>Verifiable</strong>SHA-256 checksums</span><span><strong>Open access</strong>No account or API key</span></section>

        <section className="section-block featured-datasets">
          <div className="section-heading"><div><p className="kicker">Start here</p><h2>Four tables that reproduce the story</h2></div><p>Official device milestones, component history, structural scenarios, and attributed expert outlooks—packaged as analysis-ready Parquet.</p></div>
          <div className="featured-resource-grid">{featuredResources.map((resource) => <article key={resource.id}>
            <div className="resource-card-head"><span>{resource.format}</span><b>{formatNumber(resource.rows, 0)} rows</b></div>
            <h3>{resource.title}</h3><p>{resource.description}</p><small>{formatBytes(resource.bytes)} · {resource.start_date ? `${formatDate(resource.start_date)}–${formatDate(resource.end_date)}` : 'Awaiting observations'}</small>
            <ResourceActions resource={resource} />
          </article>)}</div>
        </section>

        <details className="full-catalog disclosure-card">
          <summary><span>Browse the complete resource catalog</span><small>All tables, formats, and schemas</small></summary>
          <div className="full-catalog__body"><div className="dataset-format-tabs" aria-label="Dataset format filter">{(['all', 'csv', 'ndjson', 'parquet'] as ResourceFormat[]).map((item) => <button type="button" key={item} className={format === item ? 'active' : ''} aria-pressed={format === item} onClick={() => setFormat(item)}>{item === 'all' ? 'All formats' : item.toUpperCase()}</button>)}</div>
          <div className="dataset-resource-list">{resources.map((resource) => <article key={resource.id} className={resource.rows === 0 ? 'resource-empty' : ''}>
            <div className="resource-format">{resource.format}</div>
            <div><h3>{resource.title}</h3><p>{resource.description}</p><small>{formatNumber(resource.rows, 0)} rows · {formatBytes(resource.bytes)} · {resource.start_date ? `${formatDate(resource.start_date)} to ${formatDate(resource.end_date)}` : 'Optional feed awaiting observations'}</small></div>
            <ResourceActions resource={resource} />
          </article>)}</div></div>
        </details>

        <section className="data-pipeline-section">
          <div><p className="kicker">Built for trust</p><h2>Every release earns its way onto the site</h2><p>A failed feed cannot erase a working dataset. Collection, validation, analysis, and release remain separate steps.</p></div>
          <ol className="pipeline-steps"><li><span>01</span><strong>Collect</strong><p>Public, bounded sources</p></li><li><span>02</span><strong>Validate</strong><p>Dates, units, and quality</p></li><li><span>03</span><strong>Analyze</strong><p>Index and forecasts</p></li><li><span>04</span><strong>Release</strong><p>Files and checksums</p></li></ol>
        </section>

        <section className="dataset-use-grid">
          <article><p className="kicker">Citation</p><h2>Reuse it with context</h2><code>{citation}</code><button type="button" className="button button--quiet" onClick={() => void copyCitation()}>{copied ? 'Citation copied' : 'Copy citation'}</button></article>
          <article><p className="kicker">Reuse terms</p><h2>Attribution stays attached</h2><p>MemoryPulse code is MIT-licensed; upstream source rights still apply. Distributed records retain their source and measurement basis.</p><a href={publicAssetUrl('datasets/latest/DATA_LICENSE.md')}>Read data reuse terms</a></article>
        </section>
        <details className="machine-access disclosure-card"><summary><span>Machine access and verification</span><small>Metadata, catalog, and checksums</small></summary><div><a href={publicAssetUrl('datasets/latest/catalog.json')}>Catalog JSON</a><a href={publicAssetUrl('datasets/latest/dataset.json')}>Schema.org metadata</a><a href={publicAssetUrl('datasets/latest/checksums.sha256')}>SHA-256 checksums</a></div></details>
      </DataBoundary>
    </>
  )
}
