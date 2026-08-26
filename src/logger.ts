const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

const c = {
  dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  cyan: (s: string) => (useColor ? `\x1b[36m${s}\x1b[0m` : s),
  green: (s: string) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s: string) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
  red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  magenta: (s: string) => (useColor ? `\x1b[35m${s}\x1b[0m` : s),
};

function stamp(): string {
  return new Date().toLocaleTimeString([], { hour12: false });
}

function line(tag: string, message: string, paint: (value: string) => string): string {
  return `${c.dim(stamp())} ${paint(tag.padEnd(6))} ${message}`;
}

export const log = {
  run(message: string): void {
    console.log(line('RUN', message, c.magenta));
  },
  step(message: string): void {
    console.log(line('STEP', message, c.cyan));
  },
  info(message: string): void {
    console.log(line('INFO', message, c.cyan));
  },
  success(message: string): void {
    console.log(line('OK', message, c.green));
  },
  ok(message: string): void {
    console.log(line('OK', message, c.green));
  },
  skip(message: string): void {
    console.log(line('SKIP', message, c.dim));
  },
  retry(message: string): void {
    console.warn(line('RETRY', message, c.yellow));
  },
  warn(message: string): void {
    console.warn(line('WARN', message, c.yellow));
  },
  error(message: string): void {
    console.error(line('ERROR', message, c.red));
  },
};

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return `${milliseconds}ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)}s`;
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.round((milliseconds % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}
