import type { DecisionBrief } from '../types/data'

export function buildLinkedInCopy(brief: DecisionBrief, url: string): string {
  const ddr5 = brief.ddr5.recent_change_percent
  const movement = ddr5 == null ? 'DDR5 movement is not yet comparable.' : `Latest comparable DDR5 move: ${ddr5 >= 0 ? '+' : ''}${ddr5.toFixed(1)}%.`
  return [
    `MemoryPulse market read — ${brief.regime} conditions`,
    '',
    `${brief.conclusion}`,
    '',
    `Pressure score: ${brief.pressure_score.toFixed(1)}/100 · ${brief.confidence.toLowerCase()} confidence. ${movement}`,
    '',
    `Explore the interactive evidence, transparent forecasts, and free open dataset: ${url}`,
    '',
    '#DataAnalytics #Semiconductors #DDR5 #Forecasting #OpenData',
  ].join('\n')
}

function wrappedLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (context.measureText(candidate).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else current = candidate
  }
  if (current) lines.push(current)
  return lines
}

export function downloadInsightCard(brief: DecisionBrief): void {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const context = canvas.getContext('2d')
  if (!context) return

  const gradient = context.createLinearGradient(0, 0, 1200, 630)
  gradient.addColorStop(0, '#071413')
  gradient.addColorStop(1, '#15312d')
  context.fillStyle = gradient
  context.fillRect(0, 0, 1200, 630)
  context.strokeStyle = 'rgba(100,184,169,.16)'
  for (let x = 0; x <= 1200; x += 60) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 630); context.stroke()
  }
  for (let y = 0; y <= 630; y += 60) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(1200, y); context.stroke()
  }

  context.fillStyle = '#d7a353'
  context.font = '600 24px ui-monospace, monospace'
  context.fillText('MEMORYPULSE · LATEST DECISION BRIEF', 68, 70)
  context.fillStyle = '#f2f3ea'
  context.font = '700 66px Georgia, serif'
  context.fillText(`${brief.regime} · ${brief.direction}`, 68, 165)
  context.fillStyle = '#a9bbb5'
  context.font = '400 30px system-ui, sans-serif'
  wrappedLines(context, brief.conclusion, 780).slice(0, 4).forEach((line, index) => context.fillText(line, 68, 235 + index * 44))

  context.fillStyle = 'rgba(4,12,11,.52)'
  context.fillRect(870, 72, 260, 260)
  context.fillStyle = '#64b8a9'
  context.font = '700 94px system-ui, sans-serif'
  context.textAlign = 'center'
  context.fillText(brief.pressure_score.toFixed(1), 1000, 205)
  context.fillStyle = '#a9bbb5'
  context.font = '500 20px ui-monospace, monospace'
  context.fillText('PRESSURE / 100', 1000, 250)
  context.fillText(`${brief.confidence.toUpperCase()} CONFIDENCE`, 1000, 292)

  context.textAlign = 'left'
  context.fillStyle = '#f2f3ea'
  context.font = '600 22px system-ui, sans-serif'
  context.fillText(`Procurement: ${brief.recommended_posture.procurement}`, 68, 505)
  context.fillStyle = '#a9bbb5'
  context.font = '400 19px system-ui, sans-serif'
  context.fillText('Public evidence · transparent baselines · downloadable dataset', 68, 552)
  context.fillStyle = '#64b8a9'
  context.fillText('photon7777.github.io/memorypulse', 68, 588)

  const anchor = document.createElement('a')
  anchor.download = 'memorypulse-latest-insight.png'
  anchor.href = canvas.toDataURL('image/png')
  anchor.click()
}
