export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;

  console.log("[startup] ENV loaded");
  const schedulerConfigured = process.env.SCHEDULER_ENABLED?.trim().toLowerCase() === "true";
  const schedulerProcess = process.env.SCHEDULER_PROCESS?.trim().toLowerCase() === "true";
  const schedulerEnabled = schedulerConfigured && schedulerProcess;
  console.log(`[startup] scheduler ${schedulerEnabled ? "enabled" : "disabled"}`);
  if (schedulerConfigured && !schedulerProcess) {
    console.log("[startup] scheduler skipped for web process");
  }

  if (process.env.DATABASE_URL) {
    const { prisma } = await import("./lib/prisma");
    await prisma.$queryRaw`SELECT 1`
      .then(() => console.log("[startup] database connected"))
      .catch((error) => console.log(`[startup] database connection failed: ${error instanceof Error ? error.message : "unknown"}`));
  } else {
    console.log("[startup] database not configured");
  }

  if (schedulerEnabled) {
    const { startScheduler } = await import("./services/schedulerService");
    startScheduler();
  }

  console.log("[startup] server ready");
}
