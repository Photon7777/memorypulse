export function formatNumber(value: number | null | undefined, digits = 1): string {
  return value == null || !Number.isFinite(value)
    ? 'Not available'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value)
}

export function formatCurrency(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? 'Not available'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function formatCompactNumber(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? 'Not available'
    : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short', timeZone: 'UTC' } : { timeZone: 'UTC' }),
  }).format(date)
}

export function freshnessLabel(value: string | null | undefined, now = new Date()): string {
  if (!value) return 'No successful retrieval yet'
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return 'Freshness unavailable'
  const days = Math.max(0, Math.floor((now.getTime() - timestamp.getTime()) / 86_400_000))
  if (days === 0) return 'Updated today'
  if (days === 1) return 'Updated 1 day ago'
  return `Updated ${days} days ago`
}

export function scoreStatus(score: number): string {
  if (score < 25) return 'Normal'
  if (score < 50) return 'Moderate Pressure'
  if (score < 75) return 'Elevated Pressure'
  return 'Severe Pressure'
}

export function missingDataMessage(label: string): string {
  return `${label} is not available yet. MemoryPulse will show it after a validated source update.`
}
