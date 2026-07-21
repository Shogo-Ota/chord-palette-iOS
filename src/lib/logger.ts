import { captureError } from '@/services/monitoring';

/**
 * Minimal structured logger. `error()` forwards to the monitoring service (Sentry),
 * which is a no-op in dev/tests and when unconfigured. Feature/UI code should log
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
      captureError(message, context);
      break;
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
};
