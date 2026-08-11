import { useEffect, useMemo, useRef } from 'react'
import { LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsType } from 'echarts/core'
import type { PriceSeries } from '../types/data'

echarts.use([
  LineChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  CanvasRenderer,
])

interface Props {
  series: PriceSeries[]
  normalized: boolean
}

export function PriceChart({ series, normalized }: Props) {
  const element = useRef<HTMLDivElement>(null)
  const chart = useRef<EChartsType | null>(null)
  const option = useMemo(() => {
    const chartSeries = series.map((item) => {
      const first = item.points.find((point) => (normalized ? point.price_per_gb : point.value) != null)
      const baseline = normalized ? first?.price_per_gb : first?.value
      return {
        name: `${item.generation} · ${item.label}${item.is_estimate ? ' (estimate)' : ''}`,
        type: 'line' as const,
        showSymbol: item.points.length < 24,
        symbolSize: 6,
        smooth: false,
        connectNulls: false,
        data: item.points.map((point) => {
          const raw = normalized ? point.price_per_gb : point.value
          const value = normalized && raw != null && baseline ? (raw / baseline) * 100 : raw
          return { value: [point.date, value], source: item.source_label, basis: item.basis, estimate: point.estimate }
        }),
      }
    })
    return {
      animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      animationDuration: 760,
      animationEasing: 'cubicOut' as const,
      backgroundColor: 'transparent',
      color: ['#6e7bff', '#f7b955', '#47c8ff', '#ff6b7a', '#9ba6c9'],
      textStyle: { fontFamily: 'Inter, ui-sans-serif, system-ui', color: '#9ba6c9' },
      toolbox: { right: 16, feature: { saveAsImage: { name: 'memorypulse-price-chart', title: 'Download chart' } } },
      grid: { top: 72, right: 28, bottom: 74, left: 66, containLabel: false },
      legend: { type: 'scroll', top: 8, textStyle: { color: '#9ba6c9' } },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#11162a',
        borderColor: '#303b67',
        textStyle: { color: '#f5f7ff' },
      },
      xAxis: { type: 'time', axisLine: { lineStyle: { color: '#52608e' } }, splitLine: { show: false } },
      yAxis: {
        type: 'value',
        name: normalized ? 'Index (first = 100)' : 'Source value',
        nameTextStyle: { color: '#9ba6c9' },
        splitLine: { lineStyle: { color: 'rgba(155,166,201,.18)' } },
      },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 18 }],
      series: chartSeries,
    }
  }, [normalized, series])

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

  return <div className="price-chart" ref={element} role="img" aria-label={`Line chart of ${series.length} selected price series`} />
}
