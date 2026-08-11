import { DataBoundary } from '../components/DataBoundary'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { NewsData } from '../types/data'
import { formatDate } from '../utils/format'

const mechanism = [
  ['01', 'AI infrastructure demand', 'Accelerator deployments can increase demand for high-bandwidth and server memory.'],
  ['02', 'HBM and server prioritization', 'Higher-value products may influence how manufacturers prioritize production and investment.'],
  ['03', 'Manufacturing allocation', 'Shared capital, packaging, and process constraints can shape available capacity.'],
  ['04', 'Conventional DRAM supply', 'Allocation choices may coincide with tighter or looser DDR supply conditions.'],
  ['05', 'Consumer price implications', 'Retail outcomes also depend on inventory, competition, device demand, and channel margins.'],
]

export function ContextPage() {
  const state = useStaticData<NewsData>('news.json')
  const evidence = state.data?.events.filter((event) => event.event_tags.some((tag) => ['capacity allocation', 'HBM investment', 'supply expansion', 'production cut'].includes(tag))).slice(0, 4) ?? []
  return (
    <>
      <PageIntro kicker="AI demand pathway" title="How AI demand may affect consumer memory" description="This conceptual pathway connects accelerator demand, HBM allocation, conventional DRAM supply, and consumer pricing. Source records appear beside the interpretation." />
      <section className="mechanism" aria-label="Conceptual memory market mechanism">
        {mechanism.map(([number, title, detail], index) => (
          <article key={number}>
            <span>{number}</span><div><h2>{title}</h2><p>{detail}</p></div>{index < mechanism.length - 1 && <i aria-hidden="true">↓</i>}
          </article>
        ))}
      </section>
      <div className="concept-warning"><strong>Interpretation boundary</strong><p>The pathway describes a plausible market mechanism. Observed timing and association do not establish that AI demand caused any individual consumer price move.</p></div>
      <DataBoundary loading={state.loading} error={state.error}>
        <section className="section-block">
          <div className="section-heading"><div><p className="kicker">Supporting metadata</p><h2>Events relevant to the mechanism</h2></div><p>Links point to original publishers; MemoryPulse stores metadata and short excerpts only.</p></div>
          {evidence.length ? <div className="evidence-grid">{evidence.map((event) => (
            <article key={event.event_id}><p className="eyebrow">{formatDate(event.published_at)} · {event.source_domain}</p><h3><a href={event.article_url} target="_blank" rel="noreferrer">{event.title}</a></h3><p>{event.short_excerpt || 'No excerpt was supplied by the metadata source.'}</p><div className="tag-row">{event.event_tags.map((tag) => <span key={tag}>{tag}</span>)}</div></article>
          ))}</div> : <div className="empty-state"><strong>No supporting events collected yet</strong><p>The conceptual model remains available, but no article metadata is shown without a validated source response.</p></div>}
        </section>
      </DataBoundary>
    </>
  )
}
