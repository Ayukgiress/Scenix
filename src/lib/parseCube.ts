/**
 * Parses an Adobe .cube LUT file (1D and 3D).
 *
 * Spec reference: https://wwwimages2.adobe.com/content/dam/acom/en/products/speedgrade/cc/pdfs/cube-lut-specification-1.0.pdf
 *
 * Returns a LutData object whose `table` is a flat Float32Array of RGB triplets
 * in the order the .cube file defines them (R-fastest for 3D, sequential for 1D).
 */

export type LutKind = "1D" | "3D"

export interface LutData {
  kind: LutKind
  size: number          // LUT_1D_SIZE or LUT_3D_SIZE
  /** Flat RGB triplets: length = size^3 * 3 (3D) or size * 3 (1D) */
  table: Float32Array
  title: string
}

export class CubeParseError extends Error {}

export function parseCube(text: string): LutData {
  const lines = text.split(/\r?\n/)

  let kind: LutKind | null = null
  let size = 0
  let title = ""
  const entries: number[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue

    if (line.startsWith("TITLE")) {
      title = line.replace(/^TITLE\s+"?/, "").replace(/"$/, "").trim()
      continue
    }
    if (line.startsWith("LUT_1D_SIZE")) {
      kind = "1D"
      size = parseInt(line.split(/\s+/)[1], 10)
      continue
    }
    if (line.startsWith("LUT_3D_SIZE")) {
      kind = "3D"
      size = parseInt(line.split(/\s+/)[1], 10)
      continue
    }
    // Skip domain lines
    if (line.startsWith("DOMAIN_MIN") || line.startsWith("DOMAIN_MAX")) continue

    // Data line: three floats
    const parts = line.split(/\s+/)
    if (parts.length >= 3) {
      const r = parseFloat(parts[0])
      const g = parseFloat(parts[1])
      const b = parseFloat(parts[2])
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        entries.push(r, g, b)
      }
    }
  }

  if (!kind || size === 0) {
    throw new CubeParseError("Missing LUT_1D_SIZE or LUT_3D_SIZE directive")
  }

  const expected = kind === "3D" ? size * size * size * 3 : size * 3
  if (entries.length !== expected) {
    throw new CubeParseError(
      `Expected ${expected / 3} RGB entries for ${kind} size ${size}, got ${entries.length / 3}`,
    )
  }

  return { kind, size, table: new Float32Array(entries), title }
}
