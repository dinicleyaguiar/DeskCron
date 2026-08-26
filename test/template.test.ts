import test from 'node:test';
import assert from 'node:assert/strict';
import { expandEnv, renderVariables } from '../src/template.js';

test('expands environment variables', () => {
  assert.equal(expandEnv('token=${TOKEN}', { TOKEN: 'abc' }), 'token=abc');
});

test('renders workflow variables', () => {
  assert.equal(renderVariables('Result: {{summary}}', { summary: 'ok' }), 'Result: ok');
});
