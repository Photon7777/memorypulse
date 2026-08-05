import { useEffect, useRef } from 'react'
import { BarChart, HeatmapChart, LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import type { EChartsCoreOption, EChartsType } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import type { AnalyticsData, Forecast, NewsData, PriceSeries } from '../types/data'

echarts.use([
  BarChart,
  HeatmapChart,
  LineChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
])

const chartText = { fontFamily: 'Manrope, ui-sans-serif, system-ui', color: '#75817d' }
const tooltip = { trigger: 'axis', backgroundColor: '#102321', borderColor: '#28514b', textStyle: { color: '#f2f5ed' } }
const splitLine = { lineStyle: { color: 'rgba(117,129,125,.18)' } }

function toolbox(name: string) {
  return { right: 16, feature: { saveAsImage: { name, title: 'Download chart' } } }
}

function EChart({ option, label, className = 'analytics-chart' }: { option: EChartsCoreOption; label: string; className?: string }) {
  const element = useRef<HTMLDivElement>(null)
  const chart = useRef<EChartsType | null>(null)

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

  return <div className={className} ref={element} role="img" aria-label={label} />
}

export function PressureHistoryChart({ history }: { history: AnalyticsData['pressure_history'] }) {
  const option: EChartsCoreOption = {
    animation: false,
    textStyle: chartText,
    toolbox: toolbox('memorypulse-pressure-history'),
    grid: { top: 54, right: 30, bottom: 55, left: 52 },
    legend: { top: 8, left: 8, textStyle: { color: '#75817d' } },
    tooltip,
    xAxis: { type: 'time', splitLine: { show: false } },
    yAxis: { type: 'value', min: 0, max: 100, name: 'Score / coverage %', splitLine },
    dataZoom: [{ type: 'inside' }],
    series: [
      { name: 'Pressure score', type: 'line', symbolSize: 7, data: history.map((item) => [item.date, item.total_score]), lineStyle: { width: 3, color: '#2f8275' }, itemStyle: { color: '#2f8275' } },
      { name: 'Data coverage', type: 'line', symbolSize: 6, data: history.map((item) => [item.date, item.confidence_score * 100]), lineStyle: { width: 2, type: 'dashed', color: '#d99a3e' }, itemStyle: { color: '#d99a3e' } },
    ],
  }
  return <EChart option={option} label="Memory Pressure Index and data coverage across pipeline runs" />
}

export function ContributionChart({ components }: { components: AnalyticsData['components'] }) {
  const available = components.filter((item) => item.weighted_contribution != null)
  const option: EChartsCoreOption = {
    animation: false,
    textStyle: chartText,
    toolbox: toolbox('memorypulse-driver-contributions'),
    grid: { top: 36, right: 38, bottom: 35, left: 165 },
    tooltip: { ...tooltip, trigger: 'item', formatter: '{b}<br/>{c} index points' },
    xAxis: { type: 'value', name: 'Index points', splitLine },
    yAxis: { type: 'category', data: available.map((item) => item.label), axisLabel: { width: 145, overflow: 'truncate' } },
    series: [{
      type: 'bar',
      data: available.map((item) => ({ value: item.weighted_contribution, itemStyle: { color: (item.score ?? 50) >= 55 ? '#d99a3e' : (item.score ?? 50) <= 45 ? '#5bb9a8' : '#899793' } })),
      barMaxWidth: 30,
      label: { show: true, position: 'right', formatter: ({ value }: { value?: string | number }) => Number(value ?? 0).toFixed(1) },
    }],
  }
  return <EChart option={option} label="Latest weighted contribution from each available pressure component" />
}

export function MomentumMatrixChart({ cells }: { cells: AnalyticsData['momentum_matrix'] }) {
  const generations = [...new Set(cells.map((item) => item.generation))]
  const horizons = [1, 3, 6, 12].filter((horizon) => cells.some((item) => item.horizon_months === horizon))
  const maxAbsolute = Math.max(5, ...cells.map((item) => Math.abs(item.change_percent)))
  const option: EChartsCoreOption = {
    animation: false,
    textStyle: chartText,
    toolbox: toolbox('memorypulse-momentum-matrix'),
    grid: { top: 42, right: 90, bottom: 45, left: 70 },
    tooltip: {
      position: 'top',
      formatter: (params: { data?: { value?: [number, number, number]; series?: string } }) => {
        const value = params.data?.value
        if (!value) return ''
        const cell = cells.find((item) => item.generation === generations[value[1]] && item.horizon_months === horizons[value[0]])
        return `${cell?.generation} · ${cell?.horizon_months}M<br/><strong>${Number(value[2]).toFixed(2)}%</strong><br/>${cell?.series_id ?? ''}`
      },
    },
    xAxis: { type: 'category', data: horizons.map((item) => `${item}M`), splitArea: { show: true } },
    yAxis: { type: 'category', data: generations, splitArea: { show: true } },
    visualMap: { min: -maxAbsolute, max: maxAbsolute, calculable: false, orient: 'vertical', right: 10, top: 'center', inRange: { color: ['#287b70', '#edf0e8', '#d99a3e'] }, text: ['Rising', 'Falling'] },
    series: [{
      type: 'heatmap',
      data: cells.map((item) => ({ value: [horizons.indexOf(item.horizon_months), generations.indexOf(item.generation), Number(item.change_percent.toFixed(3))], series: item.series_id })),
      label: { show: true, formatter: ({ value }: { value?: Array<number> }) => `${Number(value?.[2] ?? 0) >= 0 ? '+' : ''}${Number(value?.[2] ?? 0).toFixed(1)}%` },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,.25)' } },
    }],
  }
  return <EChart option={option} label="Price momentum heatmap by memory generation and comparison horizon" className="analytics-chart analytics-chart--matrix" />
}

export function EventPriceChart({ price, news }: { price: PriceSeries | undefined; news: NewsData | null }) {
  const option: EChartsCoreOption = {
    animation: false,
    textStyle: chartText,
    toolbox: toolbox('memorypulse-events-and-ddr5'),
    grid: { top: 58, right: 62, bottom: 58, left: 62 },
    legend: { top: 8, left: 8, textStyle: { color: '#75817d' } },
    tooltip,
    xAxis: { type: 'time', splitLine: { show: false } },
    yAxis: [
      { type: 'value', name: 'USD / GB', splitLine },
      { type: 'value', name: 'Events / day', splitLine: { show: false }, minInterval: 1 },
    ],
    dataZoom: [{ type: 'inside' }],
    series: [
      { name: 'DDR5 price / GB', type: 'line', yAxisIndex: 0, symbolSize: 6, data: price?.points.map((item) => [item.date, item.price_per_gb]) ?? [], lineStyle: { width: 3, color: '#2f8275' }, itemStyle: { color: '#2f8275' } },
      { name: 'Relevant events', type: 'bar', yAxisIndex: 1, barMaxWidth: 10, data: news?.daily_counts.map((item) => [item.date, item.count]) ?? [], itemStyle: { color: 'rgba(217,154,62,.6)' } },
    ],
  }
  return <EChart option={option} label="DDR5 public price observations compared with relevant event volume" />
}

export function ForecastFanChart({ history, forecasts }: { history: PriceSeries | undefined; forecasts: Forecast[] }) {
  const latestVintage = forecasts.reduce((latest, item) => item.forecast_created_at > latest ? item.forecast_created_at : latest, '')
  const current = forecasts.filter((item) => item.forecast_created_at === latestVintage).sort((a, b) => a.target_date.localeCompare(b.target_date))
  const latestObserved = history?.points.at(-1)
  const lower = [
    ...(latestObserved ? [[latestObserved.date, latestObserved.price_per_gb ?? latestObserved.value]] : []),
    ...current.map((item) => [item.target_date, item.lower_bound]),
  ]
  const band = [
    ...(latestObserved ? [[latestObserved.date, 0]] : []),
    ...current.map((item) => [item.target_date, item.upper_bound - item.lower_bound]),
  ]
  const point = [
    ...(latestObserved ? [[latestObserved.date, latestObserved.price_per_gb ?? latestObserved.value]] : []),
    ...current.map((item) => [item.target_date, item.point_forecast]),
  ]
  const option: EChartsCoreOption = {
    animation: false,
    textStyle: chartText,
    toolbox: toolbox('memorypulse-ddr5-forecast'),
    grid: { top: 58, right: 30, bottom: 60, left: 62 },
    legend: { top: 8, left: 8, textStyle: { color: '#75817d' }, data: ['Observed', 'Forecast', '95% interval'] },
    tooltip,
    xAxis: { type: 'time', splitLine: { show: false } },
    yAxis: { type: 'value', name: history?.basis ?? 'Source value', scale: true, splitLine },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 12 }],
    series: [
      { name: 'Observed', type: 'line', symbolSize: 6, data: history?.points.map((item) => [item.date, item.price_per_gb ?? item.value]) ?? [], lineStyle: { width: 3, color: '#2f8275' }, itemStyle: { color: '#2f8275' } },
      { name: 'Interval floor', type: 'line', stack: 'interval', symbol: 'none', lineStyle: { opacity: 0 }, data: lower },
      { name: '95% interval', type: 'line', stack: 'interval', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: 'rgba(217,154,62,.25)' }, data: band },
      { name: 'Forecast', type: 'line', symbol: 'diamond', symbolSize: 9, data: point, lineStyle: { width: 2, type: 'dashed', color: '#d99a3e' }, itemStyle: { color: '#d99a3e' } },
    ],
  }
  return <EChart option={option} label="Observed DDR5 price history with latest forecast points and 95 percent uncertainty interval" />
}
