# @tracing/core

A runtime-agnostic tracing library for TypeScript/JavaScript, inspired by Rust's [tracing](https://docs.rs/tracing/latest/tracing/) crate.

## Features

- **Runtime agnostic** - Works in Node.js, Bun, Deno, browsers, and edge runtimes
- **Structured logging** - Attach typed fields to events, not just strings
- **Spans** - Track operations over time with nested context
- **Pluggable subscribers** - Implement your own trace processors
- **Zero dependencies** - No external runtime dependencies
- **TypeScript first** - Full type safety with comprehensive type definitions

## Installation

```bash
npm install @mikkurogue/tracing-core
```

## Quick Start

```typescript
import { 
  setGlobalSubscriber, 
  ConsoleSubscriber, 
  Level,
  info, 
  warn, 
  error,
  span 
} from "@mikkurogue/tracing-core";

// Initialize with a console subscriber
setGlobalSubscriber(new ConsoleSubscriber({ 
  minLevel: Level.DEBUG,
  timestamp: "time"
}));

// Log events
info("Server starting", { target: "http::server", fields: { port: 3000 } });
warn("Cache miss", { target: "cache", fields: { key: "user:123" } });
error("Connection failed", { target: "db", fields: { error: "timeout" } });

// Or use simple fields syntax
info("Request received", { method: "GET", path: "/api/users" });
```

Output:
```
14:30:45.123  INFO http::server: Server starting port=3000
14:30:45.124  WARN cache: Cache miss key="user:123"
14:30:45.125 ERROR db: Connection failed error="timeout"
14:30:45.126  INFO Request received method="GET" path="/api/users"
```

## Spans

Spans represent a period of time and provide context for events:

```typescript
import { span, info, debug } from "@mikkurogue/tracing-core";

// Using run() for automatic enter/exit
span("handle_request", { method: "GET" }).run(() => {
  debug("Parsing request");
  
  // Nested span
  span("db_query", { table: "users" }).run(() => {
    info("Executing query");
  });
});

// Manual enter/exit
const s = span("long_operation");
s.enter();
// ... do work ...
s.exit();

// Async operations
await span("fetch_data").runAsync(async () => {
  const data = await fetch("/api/data");
  return data.json();
});
```

## Log Levels

Five levels available (from most to least verbose):

```typescript
import { trace, debug, info, warn, error } from "@mikkurogue/tracing-core";

trace("Very detailed info");   // Level.TRACE
debug("Debugging info");       // Level.DEBUG  
info("General info");          // Level.INFO
warn("Warning");               // Level.WARN
error("Error occurred");       // Level.ERROR
```

## Console Subscriber Options

```typescript
new ConsoleSubscriber({
  // Minimum level to display (default: Level.INFO)
  minLevel: Level.DEBUG,
  
  // Enable/disable ANSI colors (default: true)
  colors: true,
  
  // Timestamp format (default: "datetime")
  // Options: "iso", "datetime", "time", "time-short", "unix", "unix-secs", false
  // Or provide a custom function: (ts: number) => string
  timestamp: "time",
  
  // Show target names (default: true)
  targets: true,
});
```

### Timestamp Formats

| Format | Example |
|--------|---------|
| `"datetime"` | `Feb 19 14:30:45.123` |
| `"iso"` | `2024-02-19T14:30:45.123Z` |
| `"time"` | `14:30:45.123` |
| `"time-short"` | `14:30:45` |
| `"unix"` | `1708354245123` |
| `"unix-secs"` | `1708354245` |
| `false` | (no timestamp) |
| `(ts) => string` | Custom formatter |

## Function Instrumentation

Automatically wrap functions with spans:

```typescript
import { instrument, instrumentAsync } from "@mikkurogue/tracing-core";

// Sync function
const processItem = instrument("process_item", (item: Item) => {
  // ... processing logic
  return result;
});

// Async function
const fetchUser = instrumentAsync("fetch_user", async (id: string) => {
  const response = await fetch(`/users/${id}`);
  return response.json();
});
```

## Custom Subscribers

Implement the `Subscriber` interface to create custom trace processors:

```typescript
import type { Subscriber, SpanContext, Event, Metadata } from "@tracing/core";

class MySubscriber implements Subscriber {
  enabled(metadata: Metadata): boolean {
    return metadata.level >= Level.INFO;
  }

  onSpanEnter(span: SpanContext): void {
    // Called when a span is entered
  }

  onSpanExit(span: SpanContext): void {
    // Called when a span is exited
  }

  onEvent(event: Event): void {
    // Called for each log event
    // Send to external service, write to file, etc.
  }
}

setGlobalSubscriber(new MySubscriber());
```

## Testing

Use `CollectorSubscriber` to capture events in tests:

```typescript
import { CollectorSubscriber, setGlobalSubscriber, info } from "@mikkurogue/tracing-core";

const collector = new CollectorSubscriber();
setGlobalSubscriber(collector);

// Run code that logs
info("Test event", { key: "value" });

// Assert on collected events
expect(collector.events).toHaveLength(1);
expect(collector.events[0].message).toBe("Test event");

// Clear between tests
collector.clear();
```

## License

MIT
