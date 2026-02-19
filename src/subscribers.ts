import {
	type Event,
	Level,
	type Metadata,
	type SpanContext,
	type Subscriber,
} from "./index";

/**
 * ANSI color codes
 */
const ansi = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	italic: "\x1b[3m",

	// Colors matching tracing-subscriber
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",

	// Bright variants
	brightRed: "\x1b[91m",
	brightYellow: "\x1b[93m",
	brightBlue: "\x1b[94m",
	brightMagenta: "\x1b[95m",
	brightCyan: "\x1b[96m",

	// Light gray for timestamps (like tracing-rs)
	gray: "\x1b[90m",
} as const;

/**
 * Get the color for a log level (matching tracing-subscriber colors)
 */
function getLevelColor(level: Level): string {
	switch (level) {
		case Level.TRACE:
			return ansi.brightMagenta;
		case Level.DEBUG:
			return ansi.brightBlue;
		case Level.INFO:
			return ansi.green;
		case Level.WARN:
			return ansi.brightYellow;
		case Level.ERROR:
			return ansi.brightRed;
		default:
			return ansi.white;
	}
}

/**
 * Format level string with fixed width (5 chars, right-aligned like tracing-rs)
 */
function formatLevel(level: Level): string {
	const names: Record<Level, string> = {
		[Level.TRACE]: "TRACE",
		[Level.DEBUG]: "DEBUG",
		[Level.INFO]: " INFO",
		[Level.WARN]: " WARN",
		[Level.ERROR]: "ERROR",
	};
	return names[level] ?? "?????";
}

/**
 * Timestamp format options
 */
export type TimestampFormat =
	| "iso" // 2026-02-19T14:30:45.123Z
	| "datetime" // Feb 19 14:30:45.123
	| "time" // 14:30:45.123
	| "time-short" // 14:30:45
	| "unix" // 1708354245123
	| "unix-secs" // 1708354245
	| ((timestamp: number) => string); // Custom formatter

export interface ConsoleSubscriberOptions {
	/** Minimum level to log */
	minLevel?: Level;
	/** Whether to use ANSI colors */
	colors?: boolean;
	/**
	 * Timestamp configuration:
	 * - false: disable timestamps
	 * - true: use default format ("datetime")
	 * - TimestampFormat: use specified format or custom function
	 */
	timestamp?: boolean | TimestampFormat;
	/** Whether to show targets  */
	targets?: boolean;
}

/**
 * A simple console-based subscriber that works in any JS runtime
 * Features ANSI coloring similar to Rust's tracing-subscriber
 */
export class ConsoleSubscriber implements Subscriber {
	private minLevel: Level;
	private colors: boolean;
	private timestampFormat: TimestampFormat | false;
	private showTargets: boolean;
	private spanStack: SpanContext[] = [];

	constructor(options: ConsoleSubscriberOptions = {}) {
		this.minLevel = options.minLevel ?? Level.INFO;
		this.colors = options.colors ?? true;
		this.showTargets = options.targets ?? true;

		// Handle timestamp option
		if (options.timestamp === false) {
			this.timestampFormat = false;
		} else if (options.timestamp === true || options.timestamp === undefined) {
			this.timestampFormat = "datetime";
		} else {
			this.timestampFormat = options.timestamp;
		}
	}

	enabled(metadata: Metadata): boolean {
		return metadata.level >= this.minLevel;
	}

	onSpanEnter(span: SpanContext): void {
		this.spanStack.push(span);
		if (!this.enabled(span.metadata)) return;

		const indent = "  ".repeat(this.spanStack.length - 1);
		const fields = this.formatFields(span.fields);
		const target = this.formatTarget(span.metadata.target);

		if (this.colors) {
			console.log(
				`${indent}${ansi.cyan}${ansi.bold}->${ansi.reset} ${ansi.bold}${span.name}${ansi.reset}${target}${fields}`,
			);
		} else {
			console.log(`${indent}-> ${span.name}${target}${fields}`);
		}
	}

	onSpanExit(span: SpanContext): void {
		if (this.enabled(span.metadata)) {
			const duration = Date.now() - span.startTime;
			const indent = "  ".repeat(this.spanStack.length - 1);

			if (this.colors) {
				console.log(
					`${indent}${ansi.cyan}${ansi.bold}<-${ansi.reset} ${ansi.bold}${span.name}${ansi.reset} ${ansi.gray}(${duration}ms)${ansi.reset}`,
				);
			} else {
				console.log(`${indent}<- ${span.name} (${duration}ms)`);
			}
		}
		this.spanStack.pop();
	}

	onEvent(event: Event): void {
		const indent = "  ".repeat(this.spanStack.length);
		const level = event.metadata.level;
		const levelStr = formatLevel(level);
		const fields = this.formatFields(event.fields);
		const timestamp = this.formatTimestamp(event.timestamp);
		const target = this.formatTarget(event.metadata.target);

		if (this.colors) {
			const levelColor = getLevelColor(level);
			console.log(
				`${indent}${timestamp}${levelColor}${ansi.bold}${levelStr}${ansi.reset}${target} ${event.message}${fields}`,
			);
		} else {
			console.log(
				`${indent}${timestamp}${levelStr}${target} ${event.message}${fields}`,
			);
		}
	}

	private formatTimestamp(ts: number): string {
		if (this.timestampFormat === false) return "";

		const date = new Date(ts);
		let formatted: string;

		if (typeof this.timestampFormat === "function") {
			formatted = this.timestampFormat(ts);
		} else {
			switch (this.timestampFormat) {
				case "iso":
					formatted = date.toISOString();
					break;
				case "time":
					formatted = this.formatTime(date, true);
					break;
				case "time-short":
					formatted = this.formatTime(date, false);
					break;
				case "unix":
					formatted = String(ts);
					break;
				case "unix-secs":
					formatted = String(Math.floor(ts / 1000));
					break;
				case "datetime":
				default:
					formatted = this.formatDateTime(date);
					break;
			}
		}

		if (this.colors) {
			return `${ansi.gray}${ansi.dim}${formatted}${ansi.reset} `;
		}
		return `${formatted} `;
	}

	// Refactor to use Temporal once available
	private formatDateTime(date: Date): string {
		const months = [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"May",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Oct",
			"Nov",
			"Dec",
		];
		const month = months[date.getMonth()];
		const day = String(date.getDate()).padStart(2, " ");
		return `${month} ${day} ${this.formatTime(date, true)}`;
	}

	private formatTime(date: Date, includeMs: boolean): string {
		const hours = String(date.getHours()).padStart(2, "0");
		const mins = String(date.getMinutes()).padStart(2, "0");
		const secs = String(date.getSeconds()).padStart(2, "0");

		if (includeMs) {
			const ms = String(date.getMilliseconds()).padStart(3, "0");
			return `${hours}:${mins}:${secs}.${ms}`;
		}
		return `${hours}:${mins}:${secs}`;
	}

	private formatTarget(target?: string): string {
		if (!this.showTargets || !target) return "";

		if (this.colors) {
			return ` ${ansi.gray}${ansi.italic}${target}:${ansi.reset}`;
		}
		return ` ${target}:`;
	}

	private formatFields(fields: Record<string, unknown>): string {
		const entries = Object.entries(fields);
		if (entries.length === 0) return "";

		const formatted = entries
			.map(([k, v]) => {
				const value = JSON.stringify(v);
				if (this.colors) {
					return `${ansi.italic}${k}${ansi.reset}${ansi.gray}=${ansi.reset}${value}`;
				}
				return `${k}=${value}`;
			})
			.join(" ");

		return ` ${formatted}`;
	}
}

/**
 * A minimal subscriber that just collects events for testing
 */
export class CollectorSubscriber implements Subscriber {
	public events: Event[] = [];
	public spans: { span: SpanContext; action: "enter" | "exit" }[] = [];
	private minLevel: Level;

	constructor(minLevel: Level = Level.TRACE) {
		this.minLevel = minLevel;
	}

	enabled(metadata: Metadata): boolean {
		return metadata.level >= this.minLevel;
	}

	onSpanEnter(span: SpanContext): void {
		this.spans.push({ span, action: "enter" });
	}

	onSpanExit(span: SpanContext): void {
		this.spans.push({ span, action: "exit" });
	}

	onEvent(event: Event): void {
		this.events.push(event);
	}

	clear(): void {
		this.events = [];
		this.spans = [];
	}
}
