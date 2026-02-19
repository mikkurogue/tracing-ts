import {
  setGlobalSubscriber,
  info,
  debug,
  warn,
  error,
  trace,
  Level,
} from "./src/index.ts";
import { ConsoleSubscriber } from "./src/subscribers.ts";

// Test different timestamp formats
console.log("=== Default (datetime) ===");
setGlobalSubscriber(new ConsoleSubscriber({ minLevel: Level.TRACE }));
info("Default datetime format", { target: "test" });

console.log("\n=== ISO format ===");
setGlobalSubscriber(new ConsoleSubscriber({ minLevel: Level.TRACE, timestamp: "iso" }));
info("ISO timestamp format", { target: "test" });

console.log("\n=== Time only ===");
setGlobalSubscriber(new ConsoleSubscriber({ minLevel: Level.TRACE, timestamp: "time" }));
info("Time only with milliseconds", { target: "test" });

console.log("\n=== Time short ===");
setGlobalSubscriber(new ConsoleSubscriber({ minLevel: Level.TRACE, timestamp: "time-short" }));
info("Time without milliseconds", { target: "test" });

console.log("\n=== Unix timestamp ===");
setGlobalSubscriber(new ConsoleSubscriber({ minLevel: Level.TRACE, timestamp: "unix" }));
info("Unix timestamp in ms", { target: "test" });

console.log("\n=== Unix seconds ===");
setGlobalSubscriber(new ConsoleSubscriber({ minLevel: Level.TRACE, timestamp: "unix-secs" }));
info("Unix timestamp in seconds", { target: "test" });

console.log("\n=== Custom formatter ===");
setGlobalSubscriber(new ConsoleSubscriber({ 
  minLevel: Level.TRACE, 
  timestamp: (ts) => `[${new Date(ts).toLocaleTimeString()}]`
}));
info("Custom timestamp format", { target: "test" });

console.log("\n=== No timestamp ===");
setGlobalSubscriber(new ConsoleSubscriber({ minLevel: Level.TRACE, timestamp: false }));
info("No timestamp at all", { target: "test" });

console.log("\n=== Full example ===");
setGlobalSubscriber(new ConsoleSubscriber({ minLevel: Level.TRACE, timestamp: "time" }));

trace("Starting up", { target: "myapp" });
debug("Loading configuration", { target: "myapp::config", fields: { path: "/etc/app.toml" } });
info("Server listening", { target: "http::server", fields: { port: 3000, host: "0.0.0.0" } });
warn("Rate limit approaching", { target: "auth::ratelimit", fields: { remaining: 5 } });
error("Connection failed", { target: "myapp::db", fields: { error: "timeout" } });
