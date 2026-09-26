import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPreset, BUILTIN_PRESETS, createProject } from '../src/shared/defaults.js';
import type { StudioSettings } from '../src/shared/model.js';

const settings: StudioSettings = { tenantId: 'test-workspace', studioName: '测试工作室', photographerName: '测试摄影师', tagline: 'A STORY IN MOTION', accent: '#88775b', timezone: 'Asia/Shanghai' };
test('preset instances receive independent IDs and editing one project does not change another', () => {
  const a = createProject({ title: 'A', settings, presetId: 'signature' });
  const b = createProject({ title: 'B', settings, presetId: 'signature' });
  const firstIds = new Set(a.document.blocks.map(block => block.id));
  assert.ok(b.document.blocks.every(block => !firstIds.has(block.id)));
  const original = b.document.blocks[0].title;
  a.document.blocks[0].title = '私有修改';
  assert.equal(b.document.blocks[0].title, original);
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.clientId, b.clientId);
});
test('applying a reusable preset strips customer-specific delivery links and preserves project identity', () => {
  const project = createProject({ title: '真实项目', settings });
  project.document.fields.coupleNames.value = '本次客户';
  project.internalNotes = '不公开';
  const preset = structuredClone(BUILTIN_PRESETS[0]);
  const delivery = preset.blocks.find(block => block.type === 'deliveries');
  assert.ok(delivery?.type === 'deliveries');
  delivery.items[0].downloadUrl = 'https://example.com/private-old-customer';
  delivery.items[0].accessNote = 'old-password';
  const applied = applyPreset(project, preset);
  const newDelivery = applied.document.blocks.find(block => block.type === 'deliveries');
  assert.ok(newDelivery?.type === 'deliveries');
  assert.equal(newDelivery.items[0].downloadUrl, '');
  assert.equal(newDelivery.items[0].accessNote, '');
  assert.equal(applied.document.fields.coupleNames.value, '本次客户');
  assert.equal(applied.id, project.id);
  assert.equal(applied.document.id, project.document.id);
  assert.equal(project.internalNotes, '不公开');
});
