// dashboard/src/shared/logging/logger.ts

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface LogContext {
  traceId?: string;
  correlationId?: string;
  accountId?: string;
  module?: string;
  [key: string]: any;
}

export class Logger {
  private static formatLog(level: LogLevel, message: string, context: LogContext = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    });
  }

  static debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog('DEBUG', message, context));
    }
  }

  static info(message: string, context?: LogContext) {
    console.log(this.formatLog('INFO', message, context));
  }

  static warn(message: string, context?: LogContext) {
    console.warn(this.formatLog('WARN', message, context));
  }

  static error(message: string, context?: LogContext) {
    console.error(this.formatLog('ERROR', message, context));
  }

  static critical(message: string, context?: LogContext) {
    console.error(this.formatLog('CRITICAL', message, context));
  }
}
