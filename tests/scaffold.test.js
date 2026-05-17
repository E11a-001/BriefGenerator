import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

test('public app scaffold exists', () => {
  assert.equal(existsSync('public/index.html'), true);
  assert.equal(existsSync('public/style.css'), true);
  assert.equal(existsSync('public/app.js'), true);
  assert.equal(existsSync('package.json'), true);
});
