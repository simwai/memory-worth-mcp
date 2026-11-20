type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function shouldLog(level: LogLevel): boolean {
  const current = (process.env.LOG_LEVEL as LogLevel) ?? 'info'
  return LEVEL_ORDER[level] >= LEVEL_ORDER[current]
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    if (!shouldLog('info')) return
    console.error(safeStringify({ level: 'info', msg, ...meta, timestamp: Date.now() }))
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    if (!shouldLog('warn')) return
    console.error(safeStringify({ level: 'warn', msg, ...meta, timestamp: Date.now() }))
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    if (!shouldLog('error')) return
    console.error(safeStringify({ level: 'error', msg, ...meta, timestamp: Date.now() }))
  },
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (!shouldLog('debug')) return
    console.error(safeStringify({ level: 'debug', msg, ...meta, timestamp: Date.now() }))
  },
}
