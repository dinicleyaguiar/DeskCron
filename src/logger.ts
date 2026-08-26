const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

const c = {
  dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  blue: (s: string) => (useColor ? `\x1b[36m${s}\x1b[0m` : s),
  green: (s: string) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s: string) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
  red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
};

function stamp(): string {
  return new Date().toLocaleTimeString([], { hour12: false });
}

export const log = {
  info(message: string): void {
    console.log(`${c.dim(stamp())} ${c.blue('i')} ${message}`);
  },
  ok(message: string): void {
    console.log(`${c.dim(stamp())} ${c.green('✓')} ${message}`);
  },
  warn(message: string): void {
    console.warn(`${c.dim(stamp())} ${c.yellow('!')} ${message}`);
  },
  error(message: string): void {
    console.error(`${c.dim(stamp())} ${c.red('×')} ${message}`);
  },
};
