type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel =
  process.env.AGPA_DEBUG === 'true' ? 'debug' : 'info';

function log(level: LogLevel, ...args: unknown[]): void {
  if ((LOG_LEVELS[level] ?? 1) < (LOG_LEVELS[currentLevel] ?? 1)) return;
  const prefix = `[agpa:${level.toUpperCase()}]`;
  const fn = level === 'error' ? console.error
    : level === 'warn' ? console.warn
    : console.log;
  fn(prefix, ...args);
}

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
  setLevel: (level: LogLevel) => { currentLevel = level; },
};
