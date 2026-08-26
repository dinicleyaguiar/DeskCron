import process from 'node:process';
import type { RunContext } from './types.js';

const VARIABLE = '[A-Za-z_][A-Za-z0-9_.-]*';

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeVariableName(input: string): string {
  const trimmed = stripQuotes(input.trim());
  const template = trimmed.match(/^\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}$/);
  return template?.[1] ?? trimmed;
}

function resolveValue(name: string, context: RunContext): string | undefined {
  return context.variables[name] ?? process.env[name];
}

export function validateCondition(condition: string): void {
  const input = condition.trim();
  if (/^(always|success|failure)\(\)$/.test(input)) return;
  if (new RegExp(`^(exists|empty)\\((?:${VARIABLE}|['\"]${VARIABLE}['\"])\\)$`).test(input)) return;
  if (
    new RegExp(
      `^(?:\\{\\{\\s*${VARIABLE}\\s*\\}\\}|${VARIABLE})\\s*(?:==|!=)\\s*(?:"[^"]*"|'[^']*'|[^\\s].*)$`,
    ).test(input)
  ) {
    return;
  }
  throw new Error(
    `Unsupported condition: ${condition}. Use always(), success(), failure(), exists(NAME), empty(NAME), NAME == "value", or NAME != "value".`,
  );
}

export function evaluateCondition(condition: string, context: RunContext): boolean {
  validateCondition(condition);
  const input = condition.trim();

  if (input === 'always()') return true;
  if (input === 'success()') return !context.hadFailure;
  if (input === 'failure()') return context.hadFailure;

  const functionMatch = input.match(/^(exists|empty)\((.+)\)$/);
  if (functionMatch) {
    const [, fn, rawName] = functionMatch;
    const name = normalizeVariableName(rawName ?? '');
    const value = resolveValue(name, context);
    return fn === 'exists' ? value !== undefined : value === undefined || value.trim() === '';
  }

  const comparison = input.match(
    /^(?:\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}|([A-Za-z_][A-Za-z0-9_.-]*))\s*(==|!=)\s*(.+)$/,
  );
  if (!comparison) return false;

  const [, templated, plain, operator, rawExpected] = comparison;
  const name = templated ?? plain ?? '';
  const actual = resolveValue(name, context) ?? '';
  const expected = stripQuotes(rawExpected ?? '');
  return operator === '==' ? actual === expected : actual !== expected;
}
