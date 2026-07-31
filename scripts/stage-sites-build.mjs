import { spawn } from 'node:child_process';
import { cp, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const distDirectory = path.join(projectRoot, 'dist');
const serverDirectory = path.join(distDirectory, 'server');
const clientDirectory = path.join(distDirectory, 'client');
const hostingDirectory = path.join(distDirectory, '.openai');
const wranglerDirectory = path.join(projectRoot, '.wrangler');
const wranglerExecutable = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler',
);

await rm(distDirectory, { recursive: true, force: true });
await mkdir(serverDirectory, { recursive: true });
await mkdir(wranglerDirectory, { recursive: true });

await new Promise((resolve, reject) => {
  const processHandle = spawn(
    wranglerExecutable,
    ['deploy', '--dry-run', '--outdir', serverDirectory],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        WRANGLER_LOG_PATH: path.join(wranglerDirectory, 'wrangler.log'),
        WRANGLER_WRITE_LOGS: 'false',
      },
      stdio: 'inherit',
    },
  );
  processHandle.once('error', reject);
  processHandle.once('exit', (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Wrangler staging failed with exit code ${code}`));
  });
});

await rename(
  path.join(serverDirectory, 'worker.js'),
  path.join(serverDirectory, 'index.js'),
);
await Promise.all([
  rm(path.join(serverDirectory, 'worker.js.map'), { force: true }),
  rm(path.join(serverDirectory, 'README.md'), { force: true }),
]);
await Promise.all([
  cp(path.join(projectRoot, '.open-next', 'assets'), clientDirectory, {
    recursive: true,
  }),
  mkdir(hostingDirectory, { recursive: true }).then(() =>
    cp(
      path.join(projectRoot, '.openai', 'hosting.json'),
      path.join(hostingDirectory, 'hosting.json'),
    ),
  ),
]);

console.log(`Sites build staged in ${distDirectory}`);
