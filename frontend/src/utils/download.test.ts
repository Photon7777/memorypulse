import { describe, expect, it } from 'vitest'
import type { PriceSeries } from '../types/data'
import { priceSeriesCsv } from './download'

describe('price export', () => {
  it('exports selected observations with safe CSV quoting', () => {
    const series: PriceSeries = {
      id: 'fixture', label: 'DDR5, test', generation: 'DDR5', market_type: 'research', currency: 'USD',
      basis: 'USD/GB', source_id: 'fixture', source_label: 'Fixture "source"', source_url: 'https://example.test',
      is_estimate: false, points: [{ date: '2026-01-01', value: 5, price_per_gb: 5, estimate: false }],
    }
    const csv = priceSeriesCsv([series])
    expect(csv).toContain('"DDR5, test"')
    expect(csv).toContain('"Fixture ""source"""')
  })
})
