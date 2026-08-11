import { DataBoundary } from '../components/DataBoundary'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { MethodologyData } from '../types/data'

const sourceNotes = [
  ['Official device price milestones', 'Official U.S. manufacturer announcements for PlayStation, Xbox, Nintendo, and MacBook, with configuration and comparability labels preserved.'],
  ['Attributed industry outlooks', 'Public TrendForce and Gartner research announcements, stored separately from statistical forecasts with their original segment, metric, horizon, and source link.'],
  ['Stanford memory-price data', 'Research-dataset reliability · checked daily for historical and monthly context with original attribution; estimated HBM points stay labeled.'],
  ['DRAMeXchange public homepage', 'Public-homepage reliability · optional daily spot and module tables only; disabled by default pending terms and robots review.'],
  ['FRED semiconductor drivers', 'Official-statistics reliability · producer prices, import prices, production, and capacity utilization. They improve supply-side context but remain broader than DDR5.'],
  ['Census HS 854232 trade', 'Official-statistics reliability · monthly U.S. imports and exports of memory integrated circuits when a free API key is configured; this is a product class, not DDR5 alone.'],
  ['SEC Company Facts', 'Official-filings reliability · quarterly Micron inventory, capital expenditure, and revenue from EDGAR once a compliant contact identity is configured.'],
  ['Licensed Keepa DDR5 panel', 'Product-level monthly USD/GB observations across a curated ASIN basket only when subscription and public-export rights are explicitly confirmed.'],
  ['GDELT DOC API', 'Aggregated-metadata reliability · daily article metadata, short excerpts, and explainable keyword tags; no full article bodies.'],
  ['Best Buy Products API', 'Not used for public price history under the current 72-hour caching restriction; a key alone does not authorize archival redistribution.'],
]

export function MethodologyPage() {
  const state = useStaticData<MethodologyData>('methodology.json')
  return (
    <>
      <PageIntro kicker="Methodology · reproducible by design" title="Every score has a trail back to stored public facts" description="MemoryPulse favors plain statistical baselines, preserved source definitions, visible missingness, and language that separates association from causation." />
      <DataBoundary loading={state.loading} error={state.error}>
        <section className="method-grid">
          <article className="method-feature"><p className="eyebrow">Memory Pressure Index · v{state.data?.version}</p><h2>Five signals, one confidence-aware score</h2><p>{state.data?.normalization}</p><div className="weight-list">{Object.entries(state.data?.weights ?? {}).map(([key, weight]) => <div key={key}><span>{key.replaceAll('_', ' ')}</span><i><b style={{ width: `${weight * 100}%` }} /></i><strong>{Math.round(weight * 100)}%</strong></div>)}</div><p className="caveat">{state.data?.missing_data}</p></article>
          <article><p className="eyebrow">Units matter</p><h2>Gb is not GB</h2><p>{state.data?.unit_rule}</p><div className="unit-comparison"><span><strong>16Gb</strong>chip density in gigabits</span><em>≠</em><span><strong>16GB</strong>module capacity in gigabytes</span></div><p>Price per GB is calculated only when capacity is explicit in GB, or when a source explicitly provides a USD/GB metric. Raw descriptions remain preserved.</p></article>
        </section>
        <section className="section-block"><div className="section-heading"><div><p className="kicker">Public source map</p><h2>What enters the pipeline</h2></div><p>Every adapter can degrade independently; previous validated data remains available.</p></div><div className="source-method-list">{sourceNotes.map(([name, note], index) => <article key={name}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{name}</h3><p>{note}</p></div></article>)}</div></section>
        <section className="method-grid"><article><p className="eyebrow">Two-horizon forecasting</p><h2>Complexity must outperform the baseline</h2><p>{state.data?.forecasting}</p><p>MAE, sMAPE, MASE, directional accuracy, and stability are recorded at the forecast horizon for short-term models. Long-range scenarios disclose their weights, driver values, confidence, and easing/base/tight-supply assumptions instead of claiming backtested certainty that the available DDR5 history cannot support.</p></article><article><p className="eyebrow">Known limitations</p><h2>Definitions before conclusions</h2><ul className="plain-list">{state.data?.caveats.map((item) => <li key={item}>{item}</li>)}</ul></article></section>
      </DataBoundary>
    </>
  )
}
