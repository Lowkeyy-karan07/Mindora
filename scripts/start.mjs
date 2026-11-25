import { spawn } from 'child_process';
import path from 'path';

const port = process.env.PORT || '3000';
const nextBin = path.resolve(
  process.cwd(),
  'node_modules',
  'next',
  'dist',
  'bin',
  'next'
);

const child = spawn(process.execPath, [nextBin, 'start', '-p', port], {
  stdio: 'inherit',
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) {
      child.kill(sig);
    }
  });
}

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
