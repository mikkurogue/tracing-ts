// Core types and interfaces for the tracing library

/**
 * Log levels, ordered by severity (lower = more verbose)
 */
export enum Level {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
}

/**
 * Arbitrary key-value pairs attached to spans and events
 */
export type Fields = Record<string, unknown>;

/**
 * Metadata about a span or event
 */
export interface Metadata {
  level: Level;
  target?: string;
  file?: string;
  line?: number;
}

/**
 * Represents a period of time with associated context
 */
export interface SpanContext {
  id: number;
  name: string;
  metadata: Metadata;
  fields: Fields;
  parent?: SpanContext;
  startTime: number;
}

/**
 * An event that occurred at a point in time
 */
export interface Event {
  metadata: Metadata;
  message: string;
  fields: Fields;
  span?: SpanContext;
  timestamp: number;
}

/**
 * Subscriber interface - implement this to create custom trace processors
 * This is what makes the library runtime-agnostic
 */
export interface Subscriber {
  /** Called when a new span is created */
  onSpanEnter(span: SpanContext): void;
  /** Called when a span is exited */
  onSpanExit(span: SpanContext): void;
  /** Called when an event is recorded */
  onEvent(event: Event): void;
  /** Filter to determine if a level should be recorded */
  enabled(metadata: Metadata): boolean;
}

// Global state
let globalSubscriber: Subscriber | null = null;
let spanIdCounter = 0;
let currentSpan: SpanContext | undefined;

/**
 * Set the global subscriber for processing traces
 */
export function setGlobalSubscriber(subscriber: Subscriber): void {
  globalSubscriber = subscriber;
}

/**
 * Get the current active span
 */
export function currentSpanContext(): SpanContext | undefined {
  return currentSpan;
}

/**
 * Create and enter a new span
 */
export function span(
  name: string,
  fields: Fields = {},
  metadata: Partial<Metadata> = {}
): Span {
  return new Span(name, fields, metadata);
}

/**
 * Span class for managing span lifecycle
 */
export class Span {
  private context: SpanContext;
  private previousSpan: SpanContext | undefined;
  private entered = false;

  constructor(
    name: string,
    fields: Fields = {},
    metadata: Partial<Metadata> = {}
  ) {
    this.context = {
      id: ++spanIdCounter,
      name,
      metadata: {
        level: metadata.level ?? Level.INFO,
        target: metadata.target,
        file: metadata.file,
        line: metadata.line,
      },
      fields,
      parent: currentSpan,
      startTime: Date.now(),
    };
  }

  /**
   * Enter the span, making it the current context
   */
  enter(): this {
    if (this.entered) return this;
    this.entered = true;
    this.previousSpan = currentSpan;
    currentSpan = this.context;
    globalSubscriber?.onSpanEnter(this.context);
    return this;
  }

  /**
   * Exit the span, restoring the previous context
   */
  exit(): void {
    if (!this.entered) return;
    globalSubscriber?.onSpanExit(this.context);
    currentSpan = this.previousSpan;
    this.entered = false;
  }

  /**
   * Run a function within this span's context
   */
  run<T>(fn: () => T): T {
    this.enter();
    try {
      return fn();
    } finally {
      this.exit();
    }
  }

  /**
   * Run an async function within this span's context
   */
  async runAsync<T>(fn: () => Promise<T>): Promise<T> {
    this.enter();
    try {
      return await fn();
    } finally {
      this.exit();
    }
  }

  /**
   * Get the span's context
   */
  getContext(): SpanContext {
    return this.context;
  }
}

/**
 * Record an event at the given level
 */
function recordEvent(
  level: Level,
  message: string,
  fields: Fields = {},
  metadata: Partial<Metadata> = {}
): void {
  const fullMetadata: Metadata = {
    level,
    target: metadata.target,
    file: metadata.file,
    line: metadata.line,
  };

  if (!globalSubscriber?.enabled(fullMetadata)) return;

  const event: Event = {
    metadata: fullMetadata,
    message,
    fields,
    span: currentSpan,
    timestamp: Date.now(),
  };

  globalSubscriber.onEvent(event);
}

/**
 * Options for logging functions
 */
export interface LogOptions {
  /** Target/module that produced this log (e.g., "myapp::db", "http::server") */
  target?: string;
  /** Additional structured fields */
  fields?: Fields;
}

// Convenience functions for different log levels
export function trace(message: string, options?: LogOptions | Fields): void {
  const opts = normalizeLogOptions(options);
  recordEvent(Level.TRACE, message, opts.fields, { target: opts.target });
}

export function debug(message: string, options?: LogOptions | Fields): void {
  const opts = normalizeLogOptions(options);
  recordEvent(Level.DEBUG, message, opts.fields, { target: opts.target });
}

export function info(message: string, options?: LogOptions | Fields): void {
  const opts = normalizeLogOptions(options);
  recordEvent(Level.INFO, message, opts.fields, { target: opts.target });
}

export function warn(message: string, options?: LogOptions | Fields): void {
  const opts = normalizeLogOptions(options);
  recordEvent(Level.WARN, message, opts.fields, { target: opts.target });
}

export function error(message: string, options?: LogOptions | Fields): void {
  const opts = normalizeLogOptions(options);
  recordEvent(Level.ERROR, message, opts.fields, { target: opts.target });
}

/**
 * Normalize log options - accepts either Fields directly or LogOptions
 */
function normalizeLogOptions(options?: LogOptions | Fields): { target?: string; fields?: Fields } {
  if (!options) return {};
  
  // If it has 'target' or 'fields' keys, treat as LogOptions
  if ('target' in options || 'fields' in options) {
    const logOpts = options as LogOptions;
    return { target: logOpts.target, fields: logOpts.fields };
  }
  
  // Otherwise treat as plain Fields
  return { fields: options as Fields };
}

/**
 * Instrument a function with a span
 * The span will be entered when the function is called and exited when it returns
 */
export function instrument<TArgs extends unknown[], TReturn>(
  name: string,
  fn: (...args: TArgs) => TReturn,
  fields?: Fields
): (...args: TArgs) => TReturn {
  return (...args: TArgs): TReturn => {
    const s = span(name, { ...fields, args });
    return s.run(() => fn(...args));
  };
}

/**
 * Decorator-style instrumentation for async functions
 */
export function instrumentAsync<TArgs extends unknown[], TReturn>(
  name: string,
  fn: (...args: TArgs) => Promise<TReturn>,
  fields?: Fields
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const s = span(name, { ...fields, args });
    return s.runAsync(() => fn(...args));
  };
}

// Re-export subscribers for convenience
export {
  ConsoleSubscriber,
  CollectorSubscriber,
  type ConsoleSubscriberOptions,
  type TimestampFormat,
} from "./subscribers";
