import { DataBoundary } from '../components/DataBoundary'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { SourceHealthData } from '../types/data'
import { formatDate, formatNumber, freshnessLabel } from '../utils/format'

export function HealthPage() {
  const state = useStaticData<SourceHealthData>('source-health.json')
  return (
    <>
      <PageIntro kicker="Data health" title="Freshness, failure, and missingness in full view" description="Each source reports its latest status independently. A degraded optional feed never silently becomes a healthy one—and never erases the working site." />
      <DataBoundary loading={state.loading} error={state.error}>
        {state.data?.sources.length ? <div className="health-table-wrap"><table className="health-table"><thead><tr><th>Source</th><th>Status</th><th>Latest retrieval</th><th>Latest observation</th><th>Records</th><th>Configuration / reason</th></tr></thead><tbody>{state.data.sources.map((source) => <tr key={source.source_id}><td><strong>{source.source_id.replaceAll('_', ' ')}</strong></td><td><span className={`health-status health-status--${source.status}`}><i />{source.status}</span></td><td>{formatDate(source.latest_retrieval, true)}<small>{freshnessLabel(source.latest_retrieval)}</small></td><td>{formatDate(source.latest_observation)}</td><td>{formatNumber(source.records_collected, 0)}</td><td>{source.source_id === 'bestbuy_memory_products' ? `Optional key ${source.optional_key_configured ? 'configured' : 'not configured'}` : source.reason || 'No current degradation reason'}</td></tr>)}</tbody></table></div> : <div className="empty-state empty-state--large"><strong>No source runs recorded yet</strong><p>Run a production update to populate live health, or the offline update to validate the complete fixture path.</p></div>}
        <div className="concept-warning"><strong>Failure behavior</strong><p>Scheduled updates validate all generated files before committing. If collection or quality checks fail, GitHub Pages continues serving the previous successful build.</p></div>
      </DataBoundary>
    </>
  )
}
