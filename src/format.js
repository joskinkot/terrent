const COLORS_ENABLED = !process.env.NO_COLOR && process.env.TERM !== 'dumb' && !!process.stdout.isTTY

const wrap = code => value => (COLORS_ENABLED ? `\x1b[${code}m${value}\x1b[0m` : String(value))

export const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  green: wrap('32'),
  cyan: wrap('36'),
  yellow: wrap('33'),
  red: wrap('31')
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

export function fmtBytes (bytes) {
  let value = Number(bytes) || 0
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1
  return `${value.toFixed(digits)} ${UNITS[unit]}`
}

export function fmtSpeed (bytesPerSecond) {
  return `${fmtBytes(bytesPerSecond)}/s`
}

export function fmtEta (ms) {
  if (!ms || !Number.isFinite(ms) || ms < 0) return '—'
  let seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} с`
  const minutes = Math.floor(seconds / 60)
  seconds %= 60
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  return `${hours} ч ${minutes % 60} мин`
}

export function bar (progress, width = 22) {
  const clamped = Math.min(1, Math.max(0, Number(progress) || 0))
  const filled = Math.round(clamped * width)
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`
}

export function truncate (value, max) {
  const text = String(value ?? '')
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1))}…`
}

/** Простой glob: `*`, `?`, регистр не важен. */
export function globToRegExp (pattern) {
  const escaped = String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '.*')
    .replaceAll('?', '.')
  return new RegExp(`^${escaped}$`, 'i')
}
