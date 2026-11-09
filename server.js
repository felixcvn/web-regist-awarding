/* eslint-disable @typescript-eslint/no-require-imports */
// Production entry point for cPanel's Setup NodeJS App (Passenger).
const { createServer } = require('node:http');
const { existsSync } = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'production';
process.chdir(__dirname);

const next = require('next');

async function start() {
  // Rumahweb's guide uses 8080; also accept the lowercase variable in its example.
  const rawPort = process.env.PORT || process.env.port || '8080';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535. Default: 8080.');
  }
  if (!existsSync(path.join(__dirname, '.next', 'BUILD_ID'))) {
    throw new Error('Production build missing. Extract the complete cPanel package, including .next.');
  }

  // cPanel's web server terminates HTTPS and forwards requests to this process.
  const hostname = process.env.HOST || '127.0.0.1';
  const app = next({ dev: false, dir: __dirname, hostname, port, webpack: true });
  await app.prepare();
  const handle = app.getRequestHandler();

  const server = createServer(async (req, res) => {
    try {
      // Forward the original stream: multipart imports must not be parsed here.
      await handle(req, res);
    } catch (error) {
      // Request URLs can contain bearer ticket tokens; do not include them in logs.
      console.error('[cPanel] Request handler failed:', error instanceof Error ? error.name : 'UnknownError');
      if (!res.headersSent) {
        res.writeHead(500, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'private, no-store',
        });
        res.end('Internal Server Error');
      } else {
        res.destroy();
      }
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, hostname, resolve);
  });
  console.log(`> Ready on http://${hostname}:${port} (cPanel production)`);

  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => {
      server.closeAllConnections();
      process.exit(1);
    }, 15_000);
    deadline.unref();
    server.close(async () => {
      await app.close();
      clearTimeout(deadline);
      process.exit(0);
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

start().catch((error) => {
  console.error('[cPanel] Startup failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
