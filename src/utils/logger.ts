/**
 * Logger utility for OmniBazaar Wallet
 * Provides structured logging with different log levels
 */

/** Log levels for the logger */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/** Log entry structure */
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
}

/**
 * Logger interface for type safety
 */
export interface Logger {
  /**
   * Log a debug message (only in development)
   * @param message - The message to log
   * @param data - Optional additional data to log
   */
  debug(message: string, data?: unknown): void;
  
  /**
   * Log an info message
   * @param message - The message to log
   * @param data - Optional additional data to log
   */
  info(message: string, data?: unknown): void;
  
  /**
   * Log a warning message
   * @param message - The message to log
   * @param data - Optional additional data to log
   */
  warn(message: string, data?: unknown): void;
  
  /**
   * Log an error message
   * @param message - The message to log
   * @param error - The error object or additional data
   */
  error(message: string, error?: unknown): void;
}

/**
 * Logger class for consistent logging across the application
 */
class LoggerImpl implements Logger {
  private readonly isDevelopment = process.env['NODE_ENV'] === 'development';
  private readonly prefix: string | undefined;

  /**
   * Create a new logger instance
   * @param prefix - Optional prefix for log messages
   */
  constructor(prefix?: string) {
    this.prefix = prefix;
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Optional additional data to log
   */
  debug(message: string, data?: unknown): void {
    if (this.isDevelopment) {
      this.log(LogLevel.DEBUG, message, data);
    }
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param data Optional additional data to log
   */
  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Optional additional data to log
   */
  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param error The error object or additional data
   */
  error(message: string, error?: unknown): void {
    this.log(LogLevel.ERROR, message, error);
  }

  /**
   * Internal logging method
   * @param level The log level
   * @param message The message to log
   * @param data Optional additional data
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    const fullMessage = this.prefix !== undefined && this.prefix !== '' 
      ? `[${this.prefix}] ${message}` 
      : message;
    
    const entry: LogEntry = {
      level,
      message: fullMessage,
      timestamp: new Date().toISOString(),
      ...(data !== undefined && { data })
    };

    // In development, use console methods
    if (this.isDevelopment) {
      const logData = data !== undefined ? [fullMessage, data] : [fullMessage];
      
      switch (level) {
        case LogLevel.DEBUG:
          // eslint-disable-next-line no-console
          console.debug(...logData);
          break;
        case LogLevel.INFO:
          // eslint-disable-next-line no-console
          console.info(...logData);
          break;
        case LogLevel.WARN:
          console.warn(...logData);
          break;
        case LogLevel.ERROR:
          console.error(...logData);
          break;
      }
    }

    // In production, we could send logs to a logging service
    // For now, we'll store in sessionStorage for debugging
    if (!this.isDevelopment) {
      try {
        const logs = JSON.parse(sessionStorage.getItem('omnibazaar_logs') ?? '[]') as LogEntry[];
        logs.push(entry);
        
        // Keep only last 100 logs
        if (logs.length > 100) {
          logs.splice(0, logs.length - 100);
        }
        
        sessionStorage.setItem('omnibazaar_logs', JSON.stringify(logs));
      } catch {
        // Ignore errors in logging
      }
    }
  }
}

// Export singleton instance
export const logger = new LoggerImpl();

/**
 * Create a logger instance with an optional prefix
 * @param prefix - Optional prefix for log messages
 * @returns Logger instance
 */
export function createLogger(prefix?: string): Logger {
  return new LoggerImpl(prefix);
}