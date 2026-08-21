import { useEffect, useMemo, useRef } from 'react'
import { BarChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption, EChartsType } from 'echarts/core'
import type { DeviceChangeEvent, DeviceMarketData } from '../types/data'

echarts.use([BarChart, ScatterChart, GridComponent, TooltipComponent, CanvasRenderer])

const LABELS: Record<string, string> = {
  price_and_spec_compression: 'Price up, specs down',
  specification_compression: 'Specs down',
  price_increase: 'Price increase',
  cost_absorption: 'Cost absorbed',
  mixed_or_no_material_change: 'Mixed / stable',
  new_entry_tier: 'New entry tier',
  insufficient_evidence: 'Needs history',
}

function useChart(option: EChartsCoreOption) {
  const element = useRef<HTMLDivElement>(null)
  const chart = useRef<EChartsType | null>(null)
  useEffect(() => {
    if (!element.current) return
    chart.current = echarts.init(element.current)
    const observer = new ResizeObserver(() => chart.current?.resize())
    observer.observe(element.current)
    return () => { observer.disconnect(); chart.current?.dispose(); chart.current = null }
  }, [])
  useEffect(() => { chart.current?.setOption(option, true) }, [option])
  return element
}

export function DeviceResponseChart({ counts }: { counts: DeviceMarketData['response_counts'] }) {
  const option = useMemo(() => ({
    animationDuration: 650,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'Manrope, ui-sans-serif, system-ui', color: '#9ba6c9' },
    grid: { top: 18, right: 24, bottom: 28, left: 138 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#11162a', borderColor: '#303b67', textStyle: { color: '#f5f7ff' } },
    xAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: 'rgba(155,166,201,.14)' } } },
    yAxis: { type: 'category', data: counts.map((item) => LABELS[item.response_type] ?? item.response_type), axisLabel: { color: '#b8c1e1', fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'bar', data: counts.map((item) => item.count), barWidth: 15, itemStyle: { color: '#6e7bff', borderRadius: [0, 3, 3, 0] } }],
  }), [counts])
  const element = useChart(option)
  return <div className="device-chart" ref={element} role="img" aria-label="Reviewed device transitions by response type" />
}

export function DeviceChangeScatter({ events }: { events: DeviceChangeEvent[] }) {
  const plotted = events.filter((item) => item.price_change_percent != null && item.ram_change_percent != null)
  const option = useMemo(() => ({
    animationDuration: 650,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'Manrope, ui-sans-serif, system-ui', color: '#9ba6c9' },
    grid: { top: 25, right: 28, bottom: 52, left: 58 },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#11162a', borderColor: '#303b67', textStyle: { color: '#f5f7ff' },
      formatter: (params: { data?: { value: number[]; family: string } }) => {
        const item = params.data
        return item ? `${item.family}<br/>RAM: ${item.value[0].toFixed(1)}%<br/>Price: ${item.value[1].toFixed(1)}%` : ''
      },
    },
    xAxis: { type: 'value', name: 'RAM change (%)', nameLocation: 'middle', nameGap: 32, splitLine: { lineStyle: { color: 'rgba(155,166,201,.14)' } } },
    yAxis: { type: 'value', name: 'Price change (%)', nameGap: 38, splitLine: { lineStyle: { color: 'rgba(155,166,201,.14)' } } },
    series: [{
      type: 'scatter', symbolSize: 14,
      itemStyle: { color: '#f7b955', borderColor: '#fff', borderWidth: 1 },
      data: plotted.map((item) => ({ value: [item.ram_change_percent, item.price_change_percent], family: item.product_family })),
    }],
  }), [plotted])
  const element = useChart(option)
  return <div className="device-chart" ref={element} role="img" aria-label="Device price change plotted against included RAM change" />
}
