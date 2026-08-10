import { DataBoundary } from '../components/DataBoundary'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { MethodologyData } from '../types/data'

const sourceNotes = [
  ['Official device price milestones', 'Official U.S. manufacturer announcements for PlayStation, Xbox, Nintendo, and MacBook, with configuration and comparability labels preserved.'],
  ['Stanford memory-price data', 'Research-dataset reliability · checked daily for historical and monthly context with original attribution; estimated HBM points stay labeled.'],
  ['DRAMeXchange public homepage', 'Public-homepage reliability · optional daily spot and module tables only; disabled by default pending terms and robots review.'],
  ['FRED PCU3344133441', 'Official-statistics reliability · monthly broad semiconductor producer-price context, never described as a direct RAM price.'],
  ['GDELT DOC API', 'Aggregated-metadata reliability · daily article metadata, short excerpts, and explainable keyword tags; no full article bodies.'],
  ['Best Buy Products API', 'Optional official-API reliability · daily retail observations when an owner supplies a key; core operation never depends on it.'],
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
        <section className="method-grid"><article><p className="eyebrow">Forecast selection</p><h2>Complexity must outperform the baseline</h2><p>{state.data?.forecasting}</p><p>MAE, sMAPE, MASE, directional accuracy, and selection stability are recorded across rolling-origin windows. Empirical residuals produce horizon-aware intervals, and insufficient history produces no forecast.</p></article><article><p className="eyebrow">Known limitations</p><h2>Definitions before conclusions</h2><ul className="plain-list">{state.data?.caveats.map((item) => <li key={item}>{item}</li>)}</ul></article></section>
      </DataBoundary>
    </>
  )
}
