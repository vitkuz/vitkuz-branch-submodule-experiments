export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

export interface Logger {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
}

export const createLogger = (serviceName: string): Logger => {
  const log = (level: LogLevel) => (message: string, context?: Record<string, unknown>): void => {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message: `[${serviceName}] ${message}`,
      context,
    };

    console.log(JSON.stringify(entry));
  };

  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
  };
};
