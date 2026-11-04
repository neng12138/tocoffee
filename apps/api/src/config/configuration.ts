export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwt: {
    customerSecret: string;
    staffSecret: string;
    customerExpiresIn: string;
    staffExpiresIn: string;
  };
  authDevMode: boolean;
  paymentMode: string;
  publicBaseUrl: string;
}

export default (): AppConfiguration => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwt: {
    customerSecret: process.env.JWT_CUSTOMER_SECRET ?? '',
    staffSecret: process.env.JWT_STAFF_SECRET ?? '',
    customerExpiresIn: process.env.JWT_CUSTOMER_EXPIRES_IN ?? '7d',
    staffExpiresIn: process.env.JWT_STAFF_EXPIRES_IN ?? '12h',
  },
  authDevMode: process.env.AUTH_DEV_MODE === 'true',
  paymentMode: process.env.PAYMENT_MODE ?? 'mock',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000',
});
