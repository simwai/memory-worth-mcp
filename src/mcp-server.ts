#!/usr/bin/env node
import { main } from "./server.js";

main().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
