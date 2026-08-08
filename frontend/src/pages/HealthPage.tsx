import { DataBoundary } from '../components/DataBoundary'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { SourceHealthData } from '../types/data'
import { formatDate, formatNumber, freshnessLabel } from '../utils/format'

const SOURCE_LABELS: Record<string, string> = {
  bestbuy_memory_products: 'Best Buy memory products',
  bls_semiconductor_employment: 'BLS semiconductor employment',
  dramexchange_homepage: 'DRAMeXchange homepage',
  federal_register_semiconductor: 'Federal Register semiconductor policy',
  fred_semiconductor: 'FRED semiconductor',
  gdelt_memory_news: 'GDELT memory news',
  stanford_memory_prices: 'Stanford memory prices',
  world_bank_high_tech_exports: 'World Bank high-technology exports',
}

export function HealthPage() {
  const state = useStaticData<SourceHealthData>('source-health.json')
  const activeSources = state.data?.sources.filter((source) => source.source_kind === 'core') ?? []
  const heldSources = state.data?.sources.filter((source) => source.source_kind !== 'core') ?? []
  const successful = activeSources.filter((source) => source.status === 'success').length
  const degraded = activeSources.filter((source) => source.status === 'degraded').length

  return (
    <>
      <PageIntro kicker="Data health" title="Know what is current—and what is not" description="See the latest state of every automatic source. Optional and permission-gated integrations stay separate from system health." />
      <DataBoundary loading={state.loading} error={state.error}>
        {state.data?.sources.length ? (
          <>
            <section className="health-summary" aria-label="Core source summary">
              <article><span>Automatic feeds</span><strong>{activeSources.length}</strong><p>Checked on each scheduled run.</p></article>
              <article><span>Healthy now</span><strong>{successful}</strong><p>Latest collection completed.</p></article>
              <article><span>Needs attention</span><strong>{degraded}</strong><p>Earlier validated data is preserved.</p></article>
            </section>

            <div className="section-heading health-heading"><div><p className="kicker">Automatic collection</p><h2>Current source status</h2></div><p>A temporary source problem never removes previously validated observations.</p></div>
            <section className="source-health-grid">{activeSources.map((source) => <article key={source.source_id}>
              <header><span className={`health-status health-status--${source.status}`}><i />{source.status === 'success' ? 'Healthy' : 'Attention'}</span><small>{freshnessLabel(source.latest_retrieval)}</small></header>
              <h3>{SOURCE_LABELS[source.source_id] ?? source.source_id.replaceAll('_', ' ')}</h3>
              <p>{source.status === 'success' ? `Latest available observation: ${formatDate(source.latest_observation)}.` : `${source.reason || 'The latest collection attempt did not complete.'} Previous data remains live.`}</p>
            </article>)}</section>

            <details className="health-diagnostics disclosure-card"><summary><span>Open detailed source diagnostics</span><small>Attempts, observations, and rejected records</small></summary><div className="health-table-wrap"><table className="health-table"><thead><tr><th>Source</th><th>Status</th><th>Last successful retrieval</th><th>Latest observation</th><th>Written / rejected</th><th>Current reason</th></tr></thead><tbody>
              {activeSources.map((source) => <tr key={source.source_id}>
                <td><strong>{SOURCE_LABELS[source.source_id] ?? source.source_id.replaceAll('_', ' ')}</strong></td>
                <td><span className={`health-status health-status--${source.status}`}><i />{source.status}</span></td>
                <td>{formatDate(source.latest_retrieval, true)}<small>{freshnessLabel(source.latest_retrieval)} · Last attempt {formatDate(source.latest_attempt, true)}</small></td>
                <td>{formatDate(source.latest_observation)}</td>
                <td>{formatNumber(source.records_collected, 0)} / {formatNumber(source.records_rejected, 0)}</td>
                <td>{source.reason || 'No current degradation reason'}</td>
              </tr>)}
            </tbody></table></div></details>

            <details className="held-sources disclosure-card"><summary><span>Optional and permission-gated sources</span><small>{heldSources.length} integrations · not counted as system failures</small></summary><section className="held-source-grid">
              {heldSources.map((source) => <article key={source.source_id}>
                <span className="held-source-kind">{source.source_kind === 'optional' ? 'Optional integration' : 'Written permission required'}</span>
                <h3>{SOURCE_LABELS[source.source_id] ?? source.source_id.replaceAll('_', ' ')}</h3>
                <p>{source.source_id === 'bestbuy_memory_products'
                  ? source.optional_key_configured ? 'The API key is configured; the next scheduled run can collect this feed.' : 'No API key is configured. Add BESTBUY_API_KEY as a GitHub Actions secret to enable official retail coverage.'
                  : source.reason}</p>
                {source.source_id === 'bestbuy_memory_products'
                  ? <a href="https://bestbuyapis.github.io/api-documentation/" target="_blank" rel="noreferrer">Best Buy API setup</a>
                  : <a href="https://www.dramexchange.com/About/TermsOfUse" target="_blank" rel="noreferrer">Review current Terms of Use</a>}
              </article>)}
            </section></details>
          </>
        ) : <div className="empty-state empty-state--large"><strong>No source runs recorded yet</strong><p>Run a production update to populate live health, or the offline update to validate the complete fixture path.</p></div>}
        <div className="concept-warning"><strong>Built-in safety</strong><p>New files publish only after validation. If collection or quality checks fail, the previous successful site and dataset remain available.</p></div>
      </DataBoundary>
    </>
  )
}
