import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCondition, validateCondition } from '../src/condition.js';
import type { RunContext } from '../src/types.js';

function context(overrides: Partial<RunContext> = {}): RunContext {
  return {
    variables: { status: 'ready', emptyValue: '' },
    cwd: process.cwd(),
    stepResults: {},
    hadFailure: false,
    dryRun: false,
    ...overrides,
  };
}

test('evaluates status functions', () => {
  assert.equal(evaluateCondition('success()', context()), true);
  assert.equal(evaluateCondition('failure()', context({ hadFailure: true })), true);
  assert.equal(evaluateCondition('always()', context({ hadFailure: true })), true);
});

test('evaluates variable checks and comparisons', () => {
  const ctx = context();
  assert.equal(evaluateCondition('exists(status)', ctx), true);
  assert.equal(evaluateCondition('empty(emptyValue)', ctx), true);
  assert.equal(evaluateCondition('status == "ready"', ctx), true);
  assert.equal(evaluateCondition('{{ status }} != "blocked"', ctx), true);
});

test('rejects unsupported expressions', () => {
  assert.throws(() => validateCondition('status && ready'), /Unsupported condition/);
});
