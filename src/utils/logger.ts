export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: "info", msg, ...meta, timestamp: Date.now() }));
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: "warn", msg, ...meta, timestamp: Date.now() }));
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: "error", msg, ...meta, timestamp: Date.now() }));
  },
  debug: (msg: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: "debug", msg, ...meta, timestamp: Date.now() }));
  },
};