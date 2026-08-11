import { useEffect, useMemo, useRef } from 'react'
import { LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, LegendComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsType } from 'echarts/core'
import type { AnalyticsMacroSeries } from '../types/data'

echarts.use([LineChart, DataZoomComponent, GridComponent, LegendComponent, ToolboxComponent, TooltipComponent, CanvasRenderer])

export function BusinessSignalChart({ series }: { series: AnalyticsMacroSeries[] }) {
  const element = useRef<HTMLDivElement>(null)
  const chart = useRef<EChartsType | null>(null)
  const option = useMemo(() => ({
    animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    animationDuration: 760,
    animationEasing: 'cubicOut' as const,
    backgroundColor: 'transparent',
    color: ['#6e7bff', '#f7b955', '#47c8ff', '#ff6b7a', '#9ba6c9'],
    textStyle: { fontFamily: 'Manrope, ui-sans-serif, system-ui', color: '#9ba6c9' },
    toolbox: { right: 16, feature: { saveAsImage: { name: 'memorypulse-business-signals', title: 'Download chart' } } },
    grid: { top: 68, right: 28, bottom: 72, left: 62 },
    legend: { type: 'scroll', top: 8, textStyle: { color: '#9ba6c9' } },
    tooltip: { trigger: 'axis', backgroundColor: '#11162a', borderColor: '#303b67', textStyle: { color: '#f5f7ff' } },
    xAxis: { type: 'time', axisLine: { lineStyle: { color: '#52608e' } }, splitLine: { show: false } },
    yAxis: { type: 'value', name: 'Index (first = 100)', splitLine: { lineStyle: { color: 'rgba(155,166,201,.18)' } } },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 16 }],
    series: series.map((item) => {
      const baseline = item.points[0]?.value
      return {
        name: item.name,
        type: 'line' as const,
        showSymbol: item.points.length < 18,
        symbolSize: 6,
        connectNulls: false,
        data: item.points.map((point) => [point.date, baseline ? point.value / baseline * 100 : null]),
      }
    }),
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

  return <div className="business-signal-chart" ref={element} role="img" aria-label={`Normalized comparison of ${series.length} business signal series`} />
}
