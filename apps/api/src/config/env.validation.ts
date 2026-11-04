const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_CUSTOMER_SECRET',
  'JWT_STAFF_SECRET',
] as const;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of REQUIRED_ENV) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const port = Number(config.API_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid API_PORT: ${String(config.API_PORT)}`);
  }

  return config;
}
