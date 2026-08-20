import http from 'http';
import app from './app';
import initializeWebSocketServer from './modules/websocket/websocket.server';
import { startCleanupJob } from './jobs/cleanup.job';

// Config is imported for side-effect of dotenv.config() and validation
// Wrap in try/catch so missing env vars produce a clear error message
let port = 3001;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { config } = require('./config') as typeof import('./config');
  port = config.port;
} catch (err) {
  console.warn('Config validation skipped (env vars not set) — using default port 3001');
}

const server = http.createServer(app);
initializeWebSocketServer(server);

startCleanupJob();

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default server;
