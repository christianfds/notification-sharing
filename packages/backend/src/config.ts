import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET'),
  databaseUrl: requireEnv('DATABASE_URL'),
  bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] ?? '12', 10),
  accessTokenExpiresIn: process.env['ACCESS_TOKEN_EXPIRES_IN'] ?? '15m',
  refreshTokenExpiresIn: process.env['REFRESH_TOKEN_EXPIRES_IN'] ?? '8h',
};
