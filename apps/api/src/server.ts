import { buildApp } from './app';
import { runMaintenance } from './application/maintenance';
import { ConfigError, describeConfig, loadConfig } from './config/env';

const MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const { app, services } = await buildApp(config);
  app.log.info({ op: 'startup', ...describeConfig(config) }, 'starting KaufCheck API');
  if (config.fetch.mode === 'live') {
    app.log.warn(
      { op: 'startup' },
      'Automatic listing retrieval is enabled (robots.txt is enforced). Make sure this is permitted by the source’s terms of use.',
    );
  }

  const maintenance = async () => {
    try {
      const report = await runMaintenance(services.db, {
        now: new Date(),
        anonRetentionDays: config.anonRetentionDays,
      });
      app.log.info({ op: 'maintenance', ...report }, 'maintenance finished');
    } catch (error) {
      app.log.error({ op: 'maintenance', err: error }, 'maintenance failed');
    }
  };
  const timer = setInterval(() => void maintenance(), MAINTENANCE_INTERVAL_MS);
  timer.unref();

  const shutdown = (signal: string) => {
    app.log.info({ op: 'shutdown', signal }, 'shutting down');
    clearInterval(timer);
    app
      .close()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  await app.listen({ host: config.host, port: config.port });
}

void main();
