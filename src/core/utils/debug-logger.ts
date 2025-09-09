/**
 * Tiny, configurable debug logging utility
 */

/**
 * Format timestamp as YYYY:MM:DD HH:mm:ss.SSS
 * @param timestamp Date to format
 * @returns Formatted timestamp string
 */
function ymdhms(timestamp: Date): string {
  return (
    timestamp.getFullYear().toString().padStart(4, "0") +
    ":" +
    (timestamp.getMonth() + 1).toString().padStart(2, "0") +
    ":" +
    timestamp.getDate().toString().padStart(2, "0") +
    " " +
    timestamp.getHours().toString().padStart(2, "0") +
    ":" +
    timestamp.getMinutes().toString().padStart(2, "0") +
    ":" +
    timestamp.getSeconds().toString().padStart(2, "0") +
    "." +
    timestamp.getMilliseconds().toString().padStart(3, "0")
  );
}

/** Log level constants */
const LogLevel = {
  DISABLED: -1,
  SILENT: 0,
  TRACE: 1,
  DEBUG: 2,
  INFO: 3,
  WARN: 4,
  ERROR: 5,
} as const;

/**
 * Convert log level string to number
 * @param level Log level as string or number
 * @returns Numeric log level
 */
function levelToNumber(level: string | number): number {
  if (typeof level === "number") return level;
  switch (level?.toLowerCase()) {
    case "trace":
      return LogLevel.TRACE;
    case "debug":
      return LogLevel.DEBUG;
    case "info":
      return LogLevel.INFO;
    case "warn":
      return LogLevel.WARN;
    case "error":
      return LogLevel.ERROR;
  }
  return LogLevel.INFO;
}

/** Configuration for wildcard search */
type WildcardSearchConfig = {
  prefix: string;
  forceAllow: boolean;
  forceDisallow: boolean;
  level?: number;
};

type ExactSearchConfig = {
  forceAllow: boolean;
  forceDisallow: boolean;
  level?: number;
};

type ParsedConfig = {
  defaultLevel: number;
  defaultAllow: boolean;
  wildcards: WildcardSearchConfig[];
  exacts: Map<string, ExactSearchConfig>;
};

/**
 * Parse a compact debug configuration string into a structured config.
 * Avoids undefined option values to satisfy exactOptionalPropertyTypes.
 * @param string - Configuration string to parse
 * @returns Parsed configuration object
 */
function parseConfig(string: string): ParsedConfig {
  const wildcards = new Map<string, WildcardSearchConfig>();
  const exacts = new Map<string, ExactSearchConfig>();

  let defaultAllow = false;
  let defaultLevel = "info";
  const lines = string
    // Use split/join for broad runtime compatibility
    .split("\n").join("")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const lineCount = lines.length;

  for (let linei = 0; linei < lineCount; linei++) {
    const raw = lines[linei] ?? '';
    const line = raw.trim();
    if (line === "*") {
      defaultAllow = true;
    } else if (/^\([a-zA-Z]\)$/i.test(line)) {
      const parsedLevel = line.slice(1, -1).trim().toLowerCase();
      defaultLevel = parsedLevel !== '' ? parsedLevel : defaultLevel;
    } else {
      let lineWithoutLevel: string;
      const levelmatch = line.match(/\([a-zA-Z]+\)/i);
      let level: string | undefined;
      if (levelmatch !== null) {
        const levelRaw = levelmatch[0];
        const leveli = line.indexOf(levelRaw);
        lineWithoutLevel = (
          line.slice(0, leveli) + line.slice(leveli + levelRaw.length)
        ).trim();
        const trimmedLevel = levelRaw.slice(1, -1).trim().toLowerCase();
        level = trimmedLevel !== '' ? trimmedLevel : undefined;
      } else {
        lineWithoutLevel = line;
      }

      let prefixi = 0;
      let forceDisallow = false;
      let forceAllow = false;
      if (lineWithoutLevel.startsWith("-")) {
        forceDisallow = true;
        prefixi = 1;
      }
      if (lineWithoutLevel.startsWith("+")) {
        forceAllow = true;
        prefixi = 1;
      }

      const lineWithoutPrefix = lineWithoutLevel.slice(prefixi).trim();

      const wildcardi = lineWithoutPrefix.indexOf("*");
      let lineWithoutWildcard: string;
      if (wildcardi === -1) {
        lineWithoutWildcard = lineWithoutPrefix;
      } else {
        lineWithoutWildcard = lineWithoutPrefix.slice(0, wildcardi);
      }

      if (wildcardi === -1) {
        const exact: ExactSearchConfig = {
          forceAllow,
          forceDisallow,
          ...(level !== undefined ? { level: levelToNumber(level) } : {}),
        };
        exacts.set(lineWithoutWildcard, exact);
      } else {
        const wc: WildcardSearchConfig = {
          prefix: lineWithoutWildcard,
          forceAllow,
          forceDisallow,
          ...(level !== undefined ? { level: levelToNumber(level) } : {}),
        };
        wildcards.set(lineWithoutWildcard, wc);
      }
    }
  }

  return {
    defaultAllow: defaultAllow,
    wildcards: Array.from(wildcards.values()),
    exacts,
    defaultLevel: levelToNumber(defaultLevel),
  };
}

const defaultParsedConfig: ParsedConfig = {
  defaultLevel: LogLevel.INFO,
  defaultAllow: false,
  wildcards: [],
  exacts: new Map(),
};

/**
 * Get debug configuration string from global context
 * @returns Debug configuration string or undefined
 */
function getDebugConfigString(): undefined | string {
  // Load from global
  if (typeof globalThis !== "undefined") {
    interface GlobalWithDebugConfig {
      __ENKRYPT_DEBUG_LOG_CONF__?: unknown;
    }
    const confString = (globalThis as unknown as GlobalWithDebugConfig).__ENKRYPT_DEBUG_LOG_CONF__;
    if (typeof confString === "string") return confString;
  }
  return undefined;
}

class DebugLogEnabler {
  _cache: Map<string, number>;
  _config: Readonly<ParsedConfig>;

  constructor() {
    this._cache = new Map();
    this._config = parseConfig(getDebugConfigString() ?? "");
  }

  clear(): void {
    this._cache.clear();
    this._cache = new Map();
    this._config = defaultParsedConfig;
  }

  refresh(): void {
    this._cache.clear();
    this._config = parseConfig(getDebugConfigString() ?? "");
  }

  level(name: string): number {
    const cached = this._cache.get(name);
    if (cached !== undefined) return cached;
    const exact = this._config.exacts.get(name);
    if (exact !== undefined) {
      let level: number;
      if (exact.forceAllow) level = exact.level ?? this._config.defaultLevel;
      else if (exact.forceDisallow) level = LogLevel.DISABLED;
      else level = this._config.defaultLevel;
      this._cache.set(name, level);
      return level;
    }
    for (const wildcard of this._config.wildcards) {
      if (name.startsWith(wildcard.prefix)) {
        let level: number;
        if (wildcard.forceAllow)
          level = wildcard.level ?? this._config.defaultLevel;
        else if (wildcard.forceDisallow) level = LogLevel.DISABLED;
        else level = this._config.defaultLevel;
        this._cache.set(name, level);
        return level;
      }
    }
    let level: number;
    if (this._config.defaultAllow) level = this._config.defaultLevel;
    else level = LogLevel.DISABLED;
    this._cache.set(name, level);
    return level;
  }
}

// Define global interface for debug configuration
interface GlobalDebugConfig {
  __ENKRYPT_DEBUG_LOG_CONF__?: unknown;
  __ENKRYPT_DEBUG_LOG_ENABLER__?: DebugLogEnabler;
}

// Initialise this before creating a DebugLogEnabler instance
const globalDebug = globalThis as unknown as GlobalDebugConfig;
let currentConfString = globalDebug.__ENKRYPT_DEBUG_LOG_CONF__;

Object.defineProperty(globalDebug, "__ENKRYPT_DEBUG_LOG_CONF__", {
  get() {
    return currentConfString;
  },
  set(value: unknown) {
    currentConfString = value;
    const enabler = globalDebug.__ENKRYPT_DEBUG_LOG_ENABLER__;
    if (enabler !== undefined) {
      enabler.refresh();
    }
  },
});

// Parses the debug logger configuration string, provides
// log levels and caches results
globalDebug.__ENKRYPT_DEBUG_LOG_ENABLER__ = new DebugLogEnabler();
globalDebug.__ENKRYPT_DEBUG_LOG_ENABLER__.refresh();

/**
 * Get the global debug log enabler instance
 * @returns DebugLogEnabler instance
 */
function getEnabler(): DebugLogEnabler {
  const enabler = globalDebug.__ENKRYPT_DEBUG_LOG_ENABLER__;
  if (enabler === undefined) {
    throw new Error('Debug log enabler not initialized');
  }
  return enabler;
}

/**
 * Configurable debug logging
 *
 * ## Usage
 *
 * Envfile:
 * ```.env
 * VITE_DEBUG_LOG= # Log nothing
 * VITE_DEBUG_LOG='*'                                 # Log everything
 * VITE_DEBUG_LOG='swap:jupiter'                      # Log only contexts name "swap:jupiter"
 * VITE_DEBUG_LOG='swap:*'                            # Log contexts starting with "swap:*"
 * VITE_DEBUG_LOG='(warn)'                            # Set the log level to trace
 * VITE_DEBUG_LOG='(warn),swap:jupiter(trace)'        # Set the log level to warn but jupiter contexts to trace
 * VITE_DEBUG_LOG='(warn),swap:jupiter(trace),swap:*'
 * VITE_DEBUG_LOG='-swap:jupiter,swap:*'              # Log swap: context's except jupiter
 * ```
 *
 * TypeScript files:
 * ```ts
 * // jupiter/index.ts
 * import { DebugLogger } from '@enkryptcom/utils'
 * cosnt logger = new DebugLogger('swap:jupiter')
 *
 * // Logging at different levels
 * logger.silent('Hello!') // (Always dropped)
 * logger.trace('Hello!')  // 2024-11-25T04:22:16Z [swap:jupiter] TRACE: Hello!
 * logger.trace('Hello!')  // 2024-11-25T04:22:16Z [swap:jupiter] DEBUG: Hello!
 * logger.info('Hello!')   // 2024-11-25T04:22:16Z [swap:jupiter] INFO: Hello!
 * logger.warn('Hello!')   // 2024-11-25T04:22:16Z [swap:jupiter] WARN: Hello!
 * logger.error('Hello!')  // 2024-11-25T04:22:16Z [swap:jupiter] ERROR: Hello!
 *
 * // Execute heavy conditional logic only when logging is enabled
 * if (logger.enabled()) {
 *   logger.info('Hi!', heavyCalculation())
 * }
 * ```
 *
 * Browser developer console:
 * ```
 * // Configure logging
 * __ENKRYPT_DEBUG_LOG_CONF__ = 'swap:jupiter'
 * __ENKRYPT_DEBUG_LOG_CONF__ = 'swap:*'
 * // ...etc. Same as envfiles
 * ```
 */
export class DebugLogger {
  _name: string;
  _color: boolean;
  _level?: number;

  /**
   * Create a new DebugLogger instance
   * @param name - Logger name/namespace
   * @param opts - Options object
   * @param opts.level - Minimum log level as string or number
   */
  constructor(name: string, opts?: { level?: string | number }) {
    this._name = name;
    this._color = true;
    this._level =
      typeof opts?.level === "string" ? levelToNumber(opts.level) : (opts?.level ?? 0);
  }

  /**
   * Check if logging is enabled for this logger
   * @returns True if logging is enabled
   */
  enabled(): boolean {
    return this.level() > LogLevel.DISABLED;
  }

  /**
   * Get the current log level for this logger
   * @returns Numeric log level
   */
  level(): number {
    if (this._level !== undefined) return this._level;
    return getEnabler().level(this._name);
  }

  /**
   * Format the log message header with timestamp and level
   * @param levelNumber - Numeric log level
   * @returns Formatted header string
   */
  _formatHeader(levelNumber: number): string {
    const timestamp = new Date();
    let timestampStr = ymdhms(timestamp);
    if (this._color) timestampStr = `\x1b[90m${timestampStr}\x1b[0m`;

    let levelStr: string;
    switch (levelNumber) {
      case LogLevel.DISABLED:
        levelStr = "DISABLED";
        if (this._color) levelStr = `\x1b[90m${levelStr}\x1b[0m`;
        break;
      case LogLevel.SILENT:
        levelStr = "SILENT";
        if (this._color) levelStr = `\x1b[90m${levelStr}\x1b[0m`;
        break;
      case LogLevel.TRACE:
        levelStr = "TRACE";
        if (this._color) levelStr = `\x1b[90m${levelStr}\x1b[0m`;
        break;
      case LogLevel.DEBUG:
        levelStr = "DEBUG";
        if (this._color) levelStr = `\x1b[36m${levelStr}\x1b[0m`;
        break;
      case LogLevel.INFO:
        levelStr = "INFO";
        if (this._color) levelStr = `\x1b[32m${levelStr}\x1b[0m`;
        break;
      case LogLevel.WARN:
        levelStr = "WARN";
        if (this._color) levelStr = `\x1b[33m${levelStr}\x1b[0m`;
        break;
      case LogLevel.ERROR:
        levelStr = "ERROR";
        if (this._color) levelStr = `\x1b[31m${levelStr}\x1b[0m`;
        break;
      default:
        levelStr = "UNKNOWN";
        if (this._color) levelStr = `\x1b[35m${levelStr}\x1b[0m`;
    }

    let msgHeader = `${timestampStr}`;

    let contextStr = "";
    if (this._name !== '') {
      let nameStr = this._name;
      if (this._color && nameStr !== '') nameStr = `\x1b[90m${nameStr}\x1b[0m`;
      contextStr += nameStr;
    }
    if (contextStr !== '') {
      msgHeader += ` [${contextStr}]`;
    }

    msgHeader += ` ${levelStr}:`;

    return msgHeader;
  }

  /**
   * Silent log level - drops all messages
   * @param _args - Arguments to log (ignored)
   */
  silent(..._args: unknown[]): void {
    // Drop
  }

  /**
   * Log at trace level
   * @param args - Arguments to log
   */
  trace(...args: unknown[]): void {
    const level = this.level();
    if (level < LogLevel.TRACE) return;
    console.warn(this._formatHeader(LogLevel.TRACE), ...args);
  }

  /**
   * Log at debug level
   * @param args - Arguments to log
   */
  debug(...args: unknown[]): void {
    const level = this.level();
    if (level < LogLevel.DEBUG) return;
    console.warn(this._formatHeader(LogLevel.DEBUG), ...args);
  }

  /**
   * Log at info level
   * @param args - Arguments to log
   */
  info(...args: unknown[]): void {
    const level = this.level();
    if (level < LogLevel.INFO) return;
    console.warn(this._formatHeader(LogLevel.INFO), ...args);
  }

  /**
   * Log at warn level
   * @param args - Arguments to log
   */
  warn(...args: unknown[]): void {
    const level = this.level();
    if (level < LogLevel.WARN) return;
    console.warn(this._formatHeader(LogLevel.WARN), ...args);
  }

  /**
   * Log at error level
   * @param args - Arguments to log
   */
  error(...args: unknown[]): void {
    const level = this.level();
    if (level < LogLevel.ERROR) return;
    console.error(this._formatHeader(LogLevel.ERROR), ...args);
  }
}
