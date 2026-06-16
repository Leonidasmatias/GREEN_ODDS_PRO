const secretNames = ["ODDS_API_KEY", "FOOTBALL_API_KEY", "SPORTMONKS_API_KEY", "DATABASE_URL", "ADMIN_PASSWORD"] as const;

export function redactSecrets(value: string) {
  let safe = value;
  for (const name of secretNames) {
    const secret = process.env[name]?.trim();
    if (secret) safe = safe.split(secret).join(`[REDACTED:${name}]`);
  }
  safe = safe.replace(/([?&](?:apiKey|api_token|token|key)=)[^&\s]+/gi, "$1[REDACTED]");
  safe = safe.replace(/(x-apisports-key["':=\s]+)[^,}\s]+/gi, "$1[REDACTED]");
  return safe.slice(0, 2000);
}

export function auditEnvironment() {
  const required = ["DATABASE_URL", "ODDS_SYNC_INTERVAL_MINUTES", "RESULTS_SYNC_INTERVAL_MINUTES", "SCHEDULER_ENABLED", "ADMIN_USERNAME", "ADMIN_PASSWORD", "BACKUP_DIR"] as const;
  const providers = ["ODDS_API_KEY", "SPORTMONKS_API_KEY", "FOOTBALL_API_KEY"] as const;
  const requiredStatus = required.map((name) => ({ name, configured: Boolean(process.env[name]?.trim()) }));
  const providerStatus = providers.map((name) => ({ name, configured: Boolean(process.env[name]?.trim()) }));
  const production = process.env.NODE_ENV === "production";
  return {
    production,
    required: requiredStatus,
    providers: providerStatus,
    adminProtected: Boolean(process.env.ADMIN_USERNAME?.trim() && process.env.ADMIN_PASSWORD?.trim()),
    anyProviderConfigured: providerStatus.some((item) => item.configured),
    missing: requiredStatus.filter((item) => !item.configured).map((item) => item.name),
    secretValuesExposed: false,
  };
}
