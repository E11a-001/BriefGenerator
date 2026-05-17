import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileDatabase } from '../../server/file-db.js';

test('file database supports bootstrap reads and basic writes', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brief-generator-file-db-'));
  const db = new FileDatabase(path.join(tempDir, 'app-data.json'));

  const { rows: createdKocs } = await db.query(
    `
    insert into kocs (
      id, name, platform, email, channel_url, status
    ) values ($1, $2, $3, $4, $5, 'draft')
    returning *
    `,
    ['koc_1', 'Ella', 'YouTube', 'ella@example.com', 'https://example.com/channel']
  );

  assert.equal(createdKocs[0].id, 'koc_1');

  const { rows: bootstrapKocs } = await db.query('select * from kocs order by created_at desc');
  const { rows: bootstrapUseCases } = await db.query('select * from use_cases order by created_at desc');
  const { rows: bootstrapAssignments } = await db.query('select * from koc_use_cases');

  assert.equal(bootstrapKocs.length, 1);
  assert.equal(bootstrapKocs[0].primary_use_case_id, '');
  assert.equal(bootstrapUseCases.length, 0);
  assert.equal(bootstrapAssignments.length, 0);
});

test('file database preserves structured suggested element arrays on use cases', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brief-generator-file-db-'));
  const db = new FileDatabase(path.join(tempDir, 'app-data.json'));

  const { rows } = await db.query(
    `
    insert into use_cases (
      id, title, description, opening_hook, who_this_is_for, problem,
      how_to_show_it, expected_outcome, must_show_elements, suggested_elements_json, links_json
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
    returning *
    `,
    [
      'uc_1',
      'Digest',
      'Description',
      'Stop checking manually every morning.',
      'Operators',
      'Manual work is slow',
      'Show setup',
      'Audience sees the value',
      'Prompt, Delivery',
      JSON.stringify(['Prompt', 'Delivery']),
      JSON.stringify(['https://example.com'])
    ]
  );

  assert.equal(rows[0].opening_hook, 'Stop checking manually every morning.');
  assert.deepEqual(rows[0].suggested_elements_json, ['Prompt', 'Delivery']);

  const { rows: bootstrapUseCases } = await db.query('select * from use_cases order by created_at desc');
  assert.equal(bootstrapUseCases[0].opening_hook, 'Stop checking manually every morning.');
  assert.deepEqual(bootstrapUseCases[0].suggested_elements_json, ['Prompt', 'Delivery']);
});

test('file database preserves reference materials and AI context on use cases', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brief-generator-file-db-'));
  const db = new FileDatabase(path.join(tempDir, 'app-data.json'));

  const { rows } = await db.query(
    `
    insert into use_cases (
      id, title, description, opening_hook, who_this_is_for, problem,
      how_to_show_it, expected_outcome, must_show_elements, suggested_elements_json, reference_materials_json, ai_context_json, links_json
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb)
    returning *
    `,
    [
      'uc_2',
      'Prompt-based digest',
      'Description',
      'You are still doing this workflow manually.',
      'Operators',
      'Manual work is slow',
      'Show prompt and digest',
      'Audience sees the value',
      'Prompt, Digest',
      JSON.stringify(['Prompt', 'Digest']),
      JSON.stringify([
        { type: 'prompt', title: 'Prompt', content: 'Build my digest.' },
        { type: 'output', title: 'Output', content: 'Five updates.' }
      ]),
      JSON.stringify({
        audienceKeywords: ['operators'],
        mustHighlight: ['scheduled delivery']
      }),
      JSON.stringify(['https://example.com'])
    ]
  );

  assert.equal(rows[0].opening_hook, 'You are still doing this workflow manually.');
  assert.deepEqual(rows[0].reference_materials_json, [
    { type: 'prompt', title: 'Prompt', content: 'Build my digest.' },
    { type: 'output', title: 'Output', content: 'Five updates.' }
  ]);
  assert.deepEqual(rows[0].ai_context_json, {
    audienceKeywords: ['operators'],
    mustHighlight: ['scheduled delivery']
  });

  const { rows: bootstrapUseCases } = await db.query('select * from use_cases order by created_at desc');
  assert.equal(bootstrapUseCases[0].opening_hook, 'You are still doing this workflow manually.');
  assert.deepEqual(bootstrapUseCases[0].reference_materials_json, [
    { type: 'prompt', title: 'Prompt', content: 'Build my digest.' },
    { type: 'output', title: 'Output', content: 'Five updates.' }
  ]);
  assert.deepEqual(bootstrapUseCases[0].ai_context_json, {
    audienceKeywords: ['operators'],
    mustHighlight: ['scheduled delivery']
  });
});
