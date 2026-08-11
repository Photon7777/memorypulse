import { useEffect, useMemo, useRef } from 'react'
import { LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, LegendComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsType } from 'echarts/core'
import type { ElectronicsProductSeries } from '../types/data'

echarts.use([LineChart, DataZoomComponent, GridComponent, LegendComponent, ToolboxComponent, TooltipComponent, CanvasRenderer])

export function ElectronicsStoryChart({ series }: { series: ElectronicsProductSeries[] }) {
  const element = useRef<HTMLDivElement>(null)
  const chart = useRef<EChartsType | null>(null)
  const option = useMemo(() => ({
    animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    animationDuration: 820,
    animationEasing: 'cubicOut' as const,
    backgroundColor: 'transparent',
    color: ['#6e7bff', '#f7b955', '#47c8ff', '#ff6b7a', '#9ba6c9'],
    textStyle: { fontFamily: 'Manrope, ui-sans-serif, system-ui', color: '#9ba6c9' },
    toolbox: { right: 8, feature: { saveAsImage: { name: 'memorypulse-electronics-price-milestones', title: 'Download chart' } } },
    grid: { top: 78, right: 28, bottom: 70, left: 68 },
    legend: { type: 'scroll', top: 10, left: 4, right: 94, textStyle: { color: '#9ba6c9' } },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#11162a',
      borderColor: '#303b67',
      textStyle: { color: '#f5f7ff' },
      valueFormatter: (value: unknown) => `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    },
    xAxis: { type: 'time', axisLine: { lineStyle: { color: '#52608e' } }, splitLine: { show: false } },
    yAxis: { type: 'value', name: 'Official U.S. starting price', axisLabel: { formatter: '${value}' }, splitLine: { lineStyle: { color: 'rgba(155,166,201,.16)' } } },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 17, bottom: 14 }],
    series: series.map((item) => ({
      name: item.family,
      type: 'line' as const,
      symbol: item.comparability === 'starting_price_tier' ? 'diamond' : 'circle',
      symbolSize: 9,
      showSymbol: true,
      connectNulls: false,
      lineStyle: { type: item.comparability === 'starting_price_tier' ? 'dashed' as const : 'solid' as const, width: 2.5 },
      data: item.points.map((point) => ({ value: [point.observation_date, point.price_usd], configuration: point.configuration, note: point.notes })),
    })),
  }), [series])

  useEffect(() => {
    if (!element.current) return
    chart.current = echarts.init(element.current)
    const observer = new ResizeObserver(() => chart.current?.resize())
    observer.observe(element.current)
    return () => {
      observer.disconnect()
      chart.current?.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    chart.current?.setOption(option, true)
  }, [option])

  return <div className="electronics-story-chart" ref={element} role="img" aria-label="Official U.S. price milestones for consoles and MacBook starting tiers" />
}
