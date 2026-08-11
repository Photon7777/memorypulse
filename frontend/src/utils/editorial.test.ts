import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourceRoot = fileURLToPath(new URL('..', import.meta.url))

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

describe('editorial voice', () => {
  it('keeps long dashes and generic AI-style headings out of interface copy', () => {
    for (const path of sourceFiles(sourceRoot)) {
      const source = readFileSync(path, 'utf8')
      expect(source, path).not.toMatch(/[—–]/)
      expect(source.toLowerCase(), path).not.toContain('why it matters')
    }
  })
})
