import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowSchema } from '../src/schema.js';

test('accepts a minimal workflow', () => {
  const result = workflowSchema.safeParse({
    version: 1,
    name: 'Test',
    steps: [{ run: 'echo hello' }],
  });
  assert.equal(result.success, true);
});

test('rejects a workflow without steps', () => {
  const result = workflowSchema.safeParse({
    version: 1,
    name: 'Invalid',
    steps: [],
  });
  assert.equal(result.success, false);
});
