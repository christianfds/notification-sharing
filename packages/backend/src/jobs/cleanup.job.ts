import cron, { type ScheduledTask } from 'node-cron';
import prisma from '../lib/prisma';
import loggerModule from '../lib/logger';

const CLEANUP_SCHEDULE = '0 0 * * *';

export interface CleanupDatabase {
  notification: Pick<typeof prisma.notification, 'deleteMany'>;
  loginAttempt: Pick<typeof prisma.loginAttempt, 'deleteMany'>;
}

export interface CleanupLogger {
  log: (...data: unknown[]) => void;
  error: (...data: unknown[]) => void;
}

export interface CleanupJobOptions {
  database?: CleanupDatabase;
  schedule?: (expression: string, task: () => void | Promise<void>) => ScheduledTask;
  logger?: CleanupLogger;
  now?: () => Date;
}

export interface CleanupResult {
  notifications: number;
  loginAttempts: number;
}

function dateMonthsAgo(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
}

/** Deletes records outside the application's retention windows. */
export async function runCleanup(
  database: CleanupDatabase = prisma,
  now: () => Date = () => new Date(),
  logger: CleanupLogger = console,
): Promise<CleanupResult> {
  const currentTime = now();
  const notificationCutoff = dateMonthsAgo(currentTime, 12);
  const loginAttemptCutoff = new Date(currentTime.getTime() - 30 * 24 * 60 * 60 * 1000);

  logger.log('cleanup.started');

  try {
    const [notifications, loginAttempts] = await Promise.all([
      database.notification.deleteMany({ where: { sentAt: { lt: notificationCutoff } } }),
      database.loginAttempt.deleteMany({ where: { attemptedAt: { lt: loginAttemptCutoff } } }),
    ]);

    const result = {
      notifications: notifications.count,
      loginAttempts: loginAttempts.count,
    };
    logger.log('cleanup.completed', result);
    return result;
  } catch (error) {
    logger.error('cleanup.failed', { error: error instanceof Error ? error.name : 'unknown' });
    throw error;
  }
}

/** Creates a daily cleanup task without starting it. */
export function createCleanupJob(options: CleanupJobOptions = {}): ScheduledTask {
  const database = options.database ?? prisma;
  const schedule = options.schedule ?? ((expression, task) => cron.schedule(expression, task));
  const logger: CleanupLogger = options.logger ?? {
    log: (...data: unknown[]) => loggerModule.info(typeof data[0] === 'string' ? data[0] : 'cleanup.log', isMetadata(data[1]) ? data[1] : undefined),
    error: (...data: unknown[]) => loggerModule.error(typeof data[0] === 'string' ? data[0] : 'cleanup.error', isMetadata(data[1]) ? data[1] : undefined),
  };
  const now = options.now ?? (() => new Date());

  return schedule(CLEANUP_SCHEDULE, async () => {
    await runCleanup(database, now, logger);
  });
}

function isMetadata(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

let cleanupJob: ScheduledTask | undefined;

/** Starts the process-wide cleanup task once. */
export function startCleanupJob(options: CleanupJobOptions = {}): ScheduledTask {
  cleanupJob ??= createCleanupJob(options);
  return cleanupJob;
}

export function stopCleanupJob(): void {
  cleanupJob?.stop();
  cleanupJob = undefined;
}
