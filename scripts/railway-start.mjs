import { existsSync } from "fs";
import { spawn } from "child_process";
import { PrismaClient } from "@prisma/client";

process.env.NODE_ENV ||= "production";
process.env.NEXT_TELEMETRY_DISABLED ||= "1";
process.env.NODE_OPTIONS ||= "--max-old-space-size=384";
process.env.HOSTNAME = "0.0.0.0";
process.env.PORT = process.env.PORT || "8080";

console.log("[startup] ENV loaded");
console.log(`[startup] scheduler ${process.env.SCHEDULER_ENABLED?.trim().toLowerCase() === "true" ? "enabled" : "disabled"}`);

if (process.env.DATABASE_URL) {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("[startup] database connected");
  } catch (error) {
    console.log(`[startup] database connection failed: ${error instanceof Error ? error.message : "unknown"}`);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
} else {
  console.log("[startup] database not configured");
}

const standalone = ".next/standalone/server.js";
const command = existsSync(standalone) ? process.execPath : process.platform === "win32" ? "npx.cmd" : "npx";
const args = existsSync(standalone) ? [standalone] : ["next", "start", "-H", process.env.HOSTNAME, "-p", process.env.PORT];

console.log(`[startup] listening host=${process.env.HOSTNAME} port=${process.env.PORT}`);
console.log(`[startup] server ready command=${existsSync(standalone) ? "standalone" : "next-start"} port=${process.env.PORT}`);

const child = spawn(command, args, { stdio: "inherit", env: process.env });
child.on("error", (error) => {
  console.log(`[startup] server failed to start: ${error instanceof Error ? error.message : "unknown"}`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) console.log(`[startup] server exited by signal ${signal}`);
  process.exit(code ?? 0);
});
