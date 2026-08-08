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
      textStyle: { fontFamily: 'Inter, ui-sans-serif, system-ui', color: '#75817d' },
      toolbox: { right: 16, feature: { saveAsImage: { name: 'memorypulse-price-chart', title: 'Download chart' } } },
      grid: { top: 72, right: 28, bottom: 74, left: 66, containLabel: false },
      legend: { type: 'scroll', top: 8, textStyle: { color: '#75817d' } },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#102321',
        borderColor: '#28514b',
        textStyle: { color: '#f2f5ed' },
      },
      xAxis: { type: 'time', axisLine: { lineStyle: { color: '#52635f' } }, splitLine: { show: false } },
      yAxis: {
        type: 'value',
        name: normalized ? 'Index (first = 100)' : 'Source value',
        nameTextStyle: { color: '#75817d' },
        splitLine: { lineStyle: { color: 'rgba(117,129,125,.18)' } },
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
