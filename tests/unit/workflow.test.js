import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pages = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8');

test('Pages solo despliega CI de pushes a main de este repo (nunca de forks ni de PR)', () => {
  assert.match(pages, /workflow_run\.event == 'push'/);
  assert.match(pages, /workflow_run\.head_branch == 'main'/);
  assert.match(pages, /workflow_run\.head_repository\.full_name == github\.repository/);
  assert.match(pages, /workflow_run\.conclusion == 'success'/);
});

test('Pages no despliega un commit más viejo que main y no usa expresiones sin comillas en run', () => {
  assert.match(pages, /rev-parse origin\/main/);
  const runs = [...pages.matchAll(/run: \|\n((?: {10}.*\n?)+)/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(runs, /\$\{\{/, 'ninguna expresión ${{ }} dentro de run (inyección de scripts)');
});
