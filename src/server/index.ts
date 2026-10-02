import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { buildApp } from './app.js';
export { buildApp } from './app.js';
export { resolveChromiumPath } from '../rendering/engine.js';

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.env.WDS_PORT ?? 4318);
  const app = await buildApp({ port });
  await app.listen({ host: '127.0.0.1', port });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close().then(() => { process.exitCode = 0; }); });
}
