import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function validateSecret(name: string, value: string, nodeEnv: string): string {
  if (nodeEnv === 'production' && (value.length < 32 || /change-me|your-|secret-here/i.test(value))) {
    throw new Error(`${name} must be a strong, non-placeholder secret in production`);
  }
  return value;
}

const nodeEnv = process.env['NODE_ENV'] ?? 'development';
const bcryptRounds = parseInt(process.env['BCRYPT_ROUNDS'] ?? '12', 10);
if (!Number.isInteger(bcryptRounds) || bcryptRounds < 10 || bcryptRounds > 15) {
  throw new Error('BCRYPT_ROUNDS must be an integer between 10 and 15');
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv,
  jwtSecret: validateSecret('JWT_SECRET', requireEnv('JWT_SECRET'), nodeEnv),
  jwtRefreshSecret: validateSecret('JWT_REFRESH_SECRET', requireEnv('JWT_REFRESH_SECRET'), nodeEnv),
  databaseUrl: requireEnv('DATABASE_URL'),
  bcryptRounds,
  accessTokenExpiresIn: process.env['ACCESS_TOKEN_EXPIRES_IN'] ?? '15m',
  refreshTokenExpiresIn: process.env['REFRESH_TOKEN_EXPIRES_IN'] ?? '8h',
};
