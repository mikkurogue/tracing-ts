import {
  setGlobalSubscriber,
  span,
  info,
  debug,
  warn,
  error,
  trace,
  instrument,
  Level,
} from "./src/index.ts";
import { ConsoleSubscriber } from "./src/subscribers.ts";

// Initialize the tracing system with a console subscriber
setGlobalSubscriber(new ConsoleSubscriber({ minLevel: Level.TRACE }));

// Example 1: Simple event logging with targets
info("Application started", { target: "myapp", fields: { version: "1.0.0" } });

// Example 2: Using spans to track operations
const requestSpan = span("handle_request", { method: "GET", path: "/users" }, { target: "http::server" });
requestSpan.enter();

debug("Parsing request", { target: "http::parser" });
info("Fetching users from database", { target: "myapp::handlers", fields: { limit: 10 } });

// Nested span
const dbSpan = span("db_query", { table: "users" }, { target: "myapp::db" });
dbSpan.run(() => {
  trace("Preparing statement", { target: "myapp::db" });
  debug("Executing query", { target: "myapp::db" });
  // Simulate some work
  const start = Date.now();
  while (Date.now() - start < 50) {} // 50ms delay
  info("Query completed", { target: "myapp::db", fields: { rows: 42 } });
});

requestSpan.exit();

// Example 3: Instrumenting functions
const processItem = instrument(
  "process_item",
  (item: { id: number; name: string }) => {
    info("Processing", { target: "myapp::processor", fields: { itemId: item.id } });
    return { ...item, processed: true };
  }
);

processItem({ id: 1, name: "Widget" });
processItem({ id: 2, name: "Gadget" });

// Example 4: Error handling with context
span("risky_operation", {}, { target: "myapp::risky" }).run(() => {
  try {
    warn("Attempting risky operation", { target: "myapp::risky" });
    throw new Error("Something went wrong");
  } catch (e) {
    error("Operation failed", { target: "myapp::risky", fields: { error: (e as Error).message } });
  }
});

// Example 5: Using simple fields syntax (backward compatible)
info("Simple log with fields", { userId: 123, action: "login" });

info("Application finished", { target: "myapp" });
