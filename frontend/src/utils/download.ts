import type { NewsEvent, PriceSeries } from '../types/data'

function escapeCsv(value: string | number | boolean | null): string {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function priceSeriesCsv(series: PriceSeries[]): string {
  const header = ['series', 'generation', 'date', 'value', 'price_per_gb', 'basis', 'source', 'estimate']
  const rows = series.flatMap((item) => item.points.map((point) => [
    item.label,
    item.generation,
    point.date,
    point.value,
    point.price_per_gb,
    item.basis,
    item.source_label,
    point.estimate,
  ]))
  return [header, ...rows].map((row) => row.map((value) => escapeCsv(value)).join(',')).join('\n') + '\n'
}

export function newsEventsCsv(events: NewsEvent[]): string {
  const header = ['published_at', 'title', 'source', 'companies', 'memory_types', 'event_tags', 'relevance', 'url']
  const rows = events.map((event) => [
    event.published_at,
    event.title,
    event.source_name,
    event.companies.join('|'),
    event.memory_types.join('|'),
    event.event_tags.join('|'),
    event.relevance_score,
    event.article_url,
  ])
  return [header, ...rows].map((row) => row.map((value) => escapeCsv(value)).join(',')).join('\n') + '\n'
}

export function downloadText(filename: string, content: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
