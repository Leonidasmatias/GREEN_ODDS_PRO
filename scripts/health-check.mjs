const baseUrl = (process.env.HEALTHCHECK_URL || process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
const url = `${baseUrl}/api/health`;

try {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const body = await response.json().catch(() => ({}));
  const status = body.status || `HTTP_${response.status}`;
  console.log(`Health check: ${status} (${url})`);

  if (!response.ok || status === "RED") {
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }
} catch (error) {
  console.error(`Health check failed for ${url}:`, error instanceof Error ? error.message : error);
  process.exit(1);
}
