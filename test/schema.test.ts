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

test('accepts retry, if and needs', () => {
  const result = workflowSchema.safeParse({
    version: 1,
    name: 'Advanced',
    steps: [
      { id: 'first', run: 'echo hello', retry: { attempts: 3, delay_seconds: 1 } },
      { id: 'second', needs: ['first'], if: 'success()', run: 'echo done' },
    ],
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

test('rejects duplicate step ids', () => {
  const result = workflowSchema.safeParse({
    version: 1,
    name: 'Invalid',
    steps: [
      { id: 'same', run: 'echo one' },
      { id: 'same', run: 'echo two' },
    ],
  });
  assert.equal(result.success, false);
});

test('rejects dependencies on later steps', () => {
  const result = workflowSchema.safeParse({
    version: 1,
    name: 'Invalid',
    steps: [
      { id: 'first', needs: ['later'], run: 'echo one' },
      { id: 'later', run: 'echo two' },
    ],
  });
  assert.equal(result.success, false);
});
