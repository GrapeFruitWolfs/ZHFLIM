import test from 'node:test';
import assert from 'node:assert/strict';
import { fromDrop } from '../src/ui/importFiles.js';

const fileEntry = (file: File) => ({
  name: file.name, isFile: true, isDirectory: false,
  file: (success: (file: File) => void) => success(file),
});
const transfer = (items: unknown[]) => ({ items, files: [] }) as unknown as DataTransfer;
const item = (entry: unknown, file: File | null = null) => ({
  kind: 'file', getAsFile: () => file, webkitGetAsEntry: () => entry,
});

test('drop preserves readable plain files alongside directories and reports unreadable items', async () => {
  const photo = new File(['image'], '01-1.jpg');
  const plain = new File(['image'], 'manual.png');
  let batch = 0;
  const directory = {
    name: '02_调色对比', isFile: false, isDirectory: true,
    createReader: () => ({ readEntries: (success: (entries: unknown[]) => void) => success(batch++ ? [] : [fileEntry(photo)]) }),
  };
  const result = await fromDrop(transfer([item(directory), item(null, plain), item(null)]));
  assert.deepEqual(result.files.map(value => value.relativePath), ['02_调色对比/01-1.jpg', 'manual.png']);
  assert.equal(result.files[1].file, plain);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /无法读取/);
});

test('drop reads every directory batch and retains siblings after one unreadable file', async () => {
  const photo = new File(['image'], 'later.png');
  let batch = 0;
  const broken = { ...fileEntry(photo), name: 'broken.jpg', file: (_ok: unknown, reject: (error: DOMException) => void) => reject(new DOMException('读取权限已撤销', 'NotReadableError')) };
  const directory = {
    name: 'Project', isFile: false, isDirectory: true,
    createReader: () => ({ readEntries: (success: (entries: unknown[]) => void) => success([[broken], [fileEntry(photo)], []][batch++]) }),
  };
  const result = await fromDrop(transfer([item(directory)]));
  assert.deepEqual(result.files.map(value => value.relativePath), ['Project/later.png']);
  assert.match(result.errors[0], /Project\/broken.jpg.*读取权限/);
  assert.equal(batch, 3);
});

test('cancelling an outstanding directory read settles immediately even without a browser callback', async () => {
  const controller = new AbortController();
  const directory = {
    name: 'Project', isFile: false, isDirectory: true,
    createReader: () => ({ readEntries: () => undefined }),
  };
  const pending = fromDrop(transfer([item(directory)]), controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('an already-cancelled file drop does not return successful empty selection', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fromDrop(transfer([]), controller.signal), { name: 'AbortError' });
});
