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
    animation: false,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'Manrope, ui-sans-serif, system-ui', color: '#75817d' },
    toolbox: { right: 16, feature: { saveAsImage: { name: 'memorypulse-business-signals', title: 'Download chart' } } },
    grid: { top: 68, right: 28, bottom: 72, left: 62 },
    legend: { type: 'scroll', top: 8, textStyle: { color: '#75817d' } },
    tooltip: { trigger: 'axis', backgroundColor: '#102321', borderColor: '#28514b', textStyle: { color: '#f2f5ed' } },
    xAxis: { type: 'time', axisLine: { lineStyle: { color: '#52635f' } }, splitLine: { show: false } },
    yAxis: { type: 'value', name: 'Index (first = 100)', splitLine: { lineStyle: { color: 'rgba(117,129,125,.18)' } } },
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
