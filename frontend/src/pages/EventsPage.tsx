import { useMemo, useState } from 'react'
import { DataBoundary } from '../components/DataBoundary'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { NewsData } from '../types/data'
import { downloadText, newsEventsCsv } from '../utils/download'
import { formatDate } from '../utils/format'

export function EventsPage() {
  const state = useStaticData<NewsData>('news.json')
  const [company, setCompany] = useState('all')
  const [eventType, setEventType] = useState('all')
  const [memory, setMemory] = useState('all')
  const [range, setRange] = useState('365')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date')
  const latestEventTime = Math.max(...(state.data?.events.map((event) => new Date(event.published_at).getTime()) ?? [0]))
  const events = useMemo(() => (state.data?.events.filter((event) =>
    (company === 'all' || event.companies.includes(company))
    && (eventType === 'all' || event.event_tags.includes(eventType))
    && (memory === 'all' || event.memory_types.includes(memory))
    && (range === 'all' || new Date(event.published_at).getTime() >= latestEventTime - Number(range) * 86_400_000)
    && (!search.trim() || `${event.title} ${event.short_excerpt} ${event.source_name}`.toLowerCase().includes(search.trim().toLowerCase()))) ?? [])
    .sort((left, right) => sort === 'relevance' ? right.relevance_score - left.relevance_score : new Date(right.published_at).getTime() - new Date(left.published_at).getTime()), [company, eventType, latestEventTime, memory, range, search, sort, state.data])

  return (
    <>
      <PageIntro kicker="Event timeline" title="The announcements behind the signal" description="Filter public article metadata across investments, capacity decisions, production, pricing, inventory, and earnings guidance." />
      <DataBoundary loading={state.loading} error={state.error}>
        <section className="filter-bar" aria-label="Timeline filters">
          <label>Search<input type="search" value={search} placeholder="Policy, company, memory…" onChange={(event) => setSearch(event.target.value)} /></label>
          <label>Company<select value={company} onChange={(event) => setCompany(event.target.value)}><option value="all">All companies</option>{state.data?.filters.companies.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Event type<select value={eventType} onChange={(event) => setEventType(event.target.value)}><option value="all">All event types</option>{state.data?.filters.event_tags.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Memory type<select value={memory} onChange={(event) => setMemory(event.target.value)}><option value="all">All memory types</option>{state.data?.filters.memory_types.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Date range<select value={range} onChange={(event) => setRange(event.target.value)}><option value="30">Latest 30 days</option><option value="90">Latest 90 days</option><option value="365">Latest 365 days</option><option value="all">All retained events</option></select></label>
          <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="date">Newest first</option><option value="relevance">Highest relevance</option></select></label>
          <button type="button" className="button button--quiet chart-action" onClick={() => downloadText('memorypulse-events.csv', newsEventsCsv(events))} disabled={!events.length}>Download CSV</button>
          <p>{events.length} matching events</p>
        </section>
        {events.length ? <ol className="timeline">{events.map((event) => (
          <li key={event.event_id}>
            <time dateTime={event.published_at}>{formatDate(event.published_at)}</time>
            <div><div className="tag-row">{event.event_tags.map((tag) => <span key={tag}>{tag}</span>)}</div><h2><a href={event.article_url} target="_blank" rel="noreferrer">{event.title}</a></h2><p>{event.short_excerpt || 'Metadata source supplied no excerpt.'}</p><p className="source-line">{event.source_name} · relevance {Math.round(event.relevance_score * 100)}%</p></div>
          </li>
        ))}</ol> : <div className="empty-state"><strong>No events match this view</strong><p>Adjust the filters or wait for the next validated metadata refresh.</p></div>}
      </DataBoundary>
    </>
  )
}
