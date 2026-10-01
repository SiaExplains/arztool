import { screen } from 'electron'
import { z } from 'zod'
import { readJson, writeJson } from '../json-store'

/** Size and position only — never URLs or anything about what was viewed. */
const BoundsSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().min(200),
  height: z.number().int().min(200),
  maximized: z.boolean(),
})
export type SavedBounds = z.infer<typeof BoundsSchema>

/** Default: 85 % of the primary work area, centred. */
function defaultBounds(): SavedBounds {
  const area = screen.getPrimaryDisplay().workArea
  const width = Math.round(area.width * 0.85)
  const height = Math.round(area.height * 0.85)
  return {
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    width,
    height,
    maximized: false,
  }
}

/** Keep a saved window on a display that still exists (monitor unplugged, resolution changed). */
function clampToDisplay(bounds: SavedBounds): SavedBounds {
  const area = screen.getDisplayMatching(bounds).workArea
  const width = Math.min(bounds.width, area.width)
  const height = Math.min(bounds.height, area.height)
  const x = Math.min(Math.max(bounds.x, area.x), area.x + area.width - width)
  const y = Math.min(Math.max(bounds.y, area.y), area.y + area.height - height)
  return { ...bounds, x, y, width, height }
}

export function loadBounds(name: string): SavedBounds {
  const parsed = BoundsSchema.safeParse(readJson(`${name}-window`))
  return parsed.success ? clampToDisplay(parsed.data) : defaultBounds()
}

export async function saveBounds(name: string, bounds: SavedBounds): Promise<void> {
  try {
    await writeJson(`${name}-window`, BoundsSchema.parse(bounds))
  } catch {
    // Losing the window position is not worth surfacing to the user.
  }
}
