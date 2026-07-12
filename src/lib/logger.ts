/**
 * Minimal structured logger. In later phases `error()` also forwards to Sentry
 * (wired via the monitoring service, not here). Feature/UI code should log
 * through this module instead of calling `console` directly.
 */
type LogContext = Record<string, unknown>;

function emit(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  context?: LogContext,
): void {
  const line = `[${level}] ${message}`;
  switch (level) {
    case 'debug':
      if (__DEV__) console.log(line, context ?? '');
      break;
    case 'info':
      console.log(line, context ?? '');
      break;
    case 'warn':
      console.warn(line, context ?? '');
      break;
    case 'error':
      console.error(line, context ?? '');
      // TODO(phase 4): forward to Sentry via monitoring service.
      break;
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
};
