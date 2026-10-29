// Modo desarrollo: reinicia el servidor y recompila Tailwind al guardar cambios.
import { spawn } from 'node:child_process';

const run = (cmd, args) =>
  spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });

const css = run('npx', ['tailwindcss', '-i', './src/styles/tailwind.css', '-o', './public/css/app.css', '--watch']);
const server = run(process.execPath, ['--disable-warning=ExperimentalWarning', '--watch-path=./src', '--watch-path=./server.js', 'server.js']);

const stop = () => {
  css.kill();
  server.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
