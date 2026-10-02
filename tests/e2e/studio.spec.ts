import { test, expect, type Page } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import type { ProjectRecord, PreviewCandidate, ExportRecord } from '../../src/shared/model';
import { TEMPLATE_IDS } from '../../src/shared/templates';

async function createInBrowser(page: Page, title: string) {
  await page.goto('/');
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '开始一份新的交付' });
  const input = dialog.getByLabel('项目名称');
  await input.pressSequentially(title, { delay: 20 });
  await expect(input).toHaveValue(title);
  const created = page.waitForResponse(response => response.url().endsWith('/api/projects') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: '创建并开始' }).click();
  const project = await (await created).json() as ProjectRecord;
  await expect(page.getByLabel('新人姓名', { exact: true })).toBeVisible();
  return project.id;
}

async function saved(page: Page) {
  await expect(page.locator('.save-state')).toHaveText('所有修改已保存');
}

async function projectFromApi(page: Page, id: string): Promise<ProjectRecord> {
  const response = await page.request.get(`/api/projects/${id}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test('browser workflow: directory recognition, manual control, persistence and real PDF/image downloads', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const projectId = await createInBrowser(page, '浏览器验收 · Wedding Story');
  await page.getByLabel('新人姓名', { exact: true }).fill('林岚 & 周屿');
  await page.getByLabel('婚礼日期', { exact: true }).fill('2026-09-12');
  await page.getByLabel('内部备注', { exact: true }).fill('PRIVATE-BROWSER-NOTE');
  await page.locator('.block-nav-item').filter({ hasText: '为你交付' }).locator('.chapter-select').click();
  await page.getByLabel('下载链接', { exact: true }).fill('https://pan.baidu.com/s/wds-fictional-test');
  await saved(page);

  const fixture = await mkdtemp(join(tmpdir(), 'wds-browser-fixture-'));
  const comparisonDir = join(fixture, '02_调色对比');
  const deliveryDir = join(fixture, '01_交付', '完整成片');
  const otherDir = join(fixture, '03_其他');
  await Promise.all([mkdir(comparisonDir, { recursive: true }), mkdir(deliveryDir, { recursive: true }), mkdir(otherDir, { recursive: true })]);
  const image = (background: string) => sharp({ create: { width: 1280, height: 720, channels: 3, background } }).png().toBuffer();
  await Promise.all([
    image('#bd9275').then(data => writeFile(join(comparisonDir, '01-1.png'), data)),
    image('#8a9298').then(data => writeFile(join(comparisonDir, '01-2.png'), data)),
    image('#f4ede4').then(data => writeFile(join(otherDir, 'unrelated-photo.png'), data)),
    writeFile(join(deliveryDir, 'metadata-only.mp4'), 'Synthetic fixture, not a video. It must never be uploaded.')
  ]);
  try {
    await page.getByRole('button', { name: /素材与对比/ }).click();
    const uploads: string[] = [];
    page.on('request', request => { if (request.url().endsWith(`/api/projects/${projectId}/assets`) && request.method() === 'POST') uploads.push(request.url()); });
    await page.locator('input[webkitdirectory]').setInputFiles(fixture);
    const card = page.locator('.comparison-card');
    await expect(card).toHaveCount(1);
    await expect(card.locator('img')).toHaveCount(2);
    await page.getByLabel('对比组 1 说明', { exact: true }).fill('保留完整构图，整理肤色与现场光线。');
    await saved(page);
    await expect(page.getByRole('button', { name: '交换前后' })).toBeEnabled();
    expect(uploads).toHaveLength(2);
    let record = await projectFromApi(page, projectId);
    expect(record.assets).toHaveLength(2);
    const initial = record.document.blocks.flatMap(block => block.type === 'comparisons' ? block.comparisons : [])[0];
    expect(initial.description).toBe('保留完整构图，整理肤色与现场光线。');
    const originalBefore = initial.before;
    await page.getByRole('button', { name: '交换前后' }).click();
    await expect(card.getByText('手动调整', { exact: true })).toBeVisible();
    await saved(page);
    record = await projectFromApi(page, projectId);
    expect(record.document.blocks.flatMap(block => block.type === 'comparisons' ? block.comparisons : [])[0].after).toEqual(originalBefore);
    await card.getByRole('button', { name: '隐藏对比', exact: true }).click();
    await expect(card).toHaveClass(/is-hidden/);
    await page.getByRole('button', { name: '撤销上次调整' }).click();
    await expect(card).not.toHaveClass(/is-hidden/);
    await saved(page);

    await page.getByRole('button', { name: '视觉与输出', exact: true }).click();
    await page.locator('.template-card[data-template="cinematic"]').click();
    await saved(page);
    await expect(page.frameLocator('iframe[title="交付文档手机预览"]').locator('body')).toHaveAttribute('data-template', 'cinematic');
    await expect(page.locator('.phone-frame .preview-loading')).toHaveCount(0);
    await page.locator('.editor-pane').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: testInfo.outputPath('workbench-cinematic.png'), fullPage: true });
    await page.reload();
    await expect(page.getByLabel('新人姓名', { exact: true })).toHaveValue('林岚 & 周屿');
    await expect(page.locator('.preview-footer')).toContainText('Cinematic');

    const prepared = page.waitForResponse(response => response.url().endsWith(`/api/projects/${projectId}/candidates`) && response.request().method() === 'POST', { timeout: 120000 });
    await page.getByRole('button', { name: '检查并导出' }).click();
    const candidateResponse = await prepared;
    expect(candidateResponse.status()).toBe(200);
    const candidate = await candidateResponse.json() as PreviewCandidate;
    expect(candidate.issues.filter(issue => issue.severity === 'error'), JSON.stringify(candidate.issues)).toEqual([]);
    expect(candidate.results.map(result => result.status)).toEqual(['ready', 'ready']);
    const warningCheckbox = page.getByRole('checkbox', { name: '我已查看以上提醒，确认继续生成当前内容' });
    if (await warningCheckbox.count()) await warningCheckbox.check();
    await page.locator('.target-card').filter({ hasText: '长图' }).getByRole('button', { name: '打开正式预览' }).click();
    await expect(page.locator('iframe[title="长图正式预览"]')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('formal-image-preview.png'), fullPage: true });
    const exported = page.waitForResponse(response => response.url().endsWith(`/api/projects/${projectId}/exports`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: '生成交付文件', exact: true }).click();
    const output = await (await exported).json() as ExportRecord;
    expect(output.status).toBe('success');
    await expect(page.locator('.export-record')).toHaveCount(1);
    for (const artifact of output.results.flatMap(result => result.artifacts)) {
      const downloadEvent = page.waitForEvent('download');
      await page.locator('.export-history').getByRole('link', { name: artifact.filename, exact: false }).click();
      const download = await downloadEvent;
      const destination = testInfo.outputPath(artifact.filename);
      await download.saveAs(destination);
      const bytes = await readFile(destination);
      expect(bytes.byteLength).toBe(artifact.byteSize);
      if (artifact.filename.endsWith('.pdf')) expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      else expect((await sharp(bytes).metadata()).width).toBe(1080);
    }
    const quick = await page.request.get(`/api/projects/${projectId}/preview?target=pdf`);
    expect(await quick.text()).not.toContain('PRIVATE-BROWSER-NOTE');
    expect(errors).toEqual([]);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('failed saves retain input and block stale candidate generation', async ({ page }) => {
  const id = await createInBrowser(page, '保存失败保护');
  let candidates = 0;
  page.on('request', request => { if (request.url().endsWith(`/api/projects/${id}/candidates`) && request.method() === 'POST') candidates++; });
  await page.route(`**/api/projects/${id}`, async route => {
    if (route.request().method() === 'PUT') await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'TEST_SAVE_FAILURE', message: '测试模拟磁盘暂不可写' }) });
    else await route.continue();
  });
  await page.getByLabel('新人姓名', { exact: true }).fill('未保存的新人姓名');
  await expect(page.locator('.save-state')).toHaveText('保存失败');
  await expect(page.getByRole('button', { name: '保存草稿副本' })).toBeVisible();
  await page.getByRole('button', { name: '检查并导出' }).click();
  await expect(page.getByRole('heading', { name: '准备正式预览' })).toBeVisible();
  expect(candidates).toBe(0);
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByLabel('新人姓名', { exact: true })).toHaveValue('未保存的新人姓名');
  await page.unroute(`**/api/projects/${id}`);
  await page.getByRole('button', { name: '重试保存', exact: true }).click();
  await saved(page);
  expect((await projectFromApi(page, id)).document.fields.coupleNames.value).toBe('未保存的新人姓名');
});

test('cover upload, production appendix and hidden details survive reopen and formal output', async ({ page }, testInfo) => {
  const id = await createInBrowser(page, '私人展册 · 封面与制作附录');
  await page.getByLabel('新人姓名', { exact: true }).fill('林岚 & 周屿');
  await page.getByLabel('婚礼日期', { exact: true }).fill('2026-09-12');
  await page.getByLabel('封面版式', { exact: true }).selectOption('photo');
  await page.getByLabel('封面短句', { exact: true }).fill('这一天，值得重温。');
  await page.getByLabel('开篇寄语', { exact: true }).fill('为真实的情绪，留一份影像。');
  await page.getByRole('button', { name: '选择封面图', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '选择封面图' });
  await picker.locator('input[type="file"]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#9caa8e' } }).png().toBuffer() });
  await expect(picker).toHaveCount(0);
  await saved(page);
  const frame = page.frameLocator('iframe[title="交付文档手机预览"]');
  await expect(frame.locator('.story-cover')).toHaveClass(/photo-first/);
  await expect(frame.locator('.story-photo img')).toBeVisible();
  await page.locator('.block-nav-item').filter({ hasText: '为你交付' }).locator('.chapter-select').click();
  await page.getByLabel('下载链接', { exact: true }).fill('https://example.com/wedding-demo');
  await page.locator('.block-nav-item').filter({ hasText: 'LOG 工作流' }).locator('.chapter-select').click();
  await page.getByLabel('技术说明', { exact: true }).fill('PRIVATE_HIDDEN_TECHNICAL_NOTE');
  await saved(page);
  const hidden = await page.request.get(`/api/projects/${id}/preview?target=pdf`);
  expect(await hidden.text()).not.toContain('PRIVATE_HIDDEN_TECHNICAL_NOTE');
  await page.getByLabel('技术说明', { exact: true }).fill('使用统一色彩管理，保留高光与暗部层次。');
  await page.getByLabel('制作详情位置', { exact: true }).selectOption('appendix');
  await page.getByRole('button', { name: '选择制作说明图', exact: true }).click();
  await page.getByRole('dialog', { name: '选择制作说明图' }).locator('.picker-grid button').first().click();
  await page.getByLabel('制作图说明', { exact: true }).fill('测试用制作说明图，图注必须紧随图片。');
  await saved(page);
  await expect(frame.locator('.appendix-title')).toHaveText('制作附录');
  expect(await frame.locator('.units').evaluate(element => {
    const appendix = element.querySelector('.appendix-start')!;
    const signature = element.querySelector('.signature')!;
    return !!(appendix.compareDocumentPosition(signature) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await page.reload();
  await expect(page.getByLabel('封面版式', { exact: true })).toHaveValue('photo');
  await expect(page.getByLabel('开篇寄语', { exact: true })).toHaveValue('为真实的情绪，留一份影像。');
  const record = await projectFromApi(page, id);
  expect(record.assets).toHaveLength(1);
  expect(record.document.blocks.find(block => block.type === 'text')?.details?.placement).toBe('appendix');
  const prepared = page.waitForResponse(response => response.url().endsWith(`/api/projects/${id}/candidates`) && response.request().method() === 'POST', { timeout: 120000 });
  await page.getByRole('button', { name: '检查并导出', exact: true }).click();
  const candidate = await (await prepared).json() as PreviewCandidate;
  expect(candidate.issues.filter(issue => issue.severity === 'error')).toEqual([]);
  expect(candidate.results.map(result => result.status)).toEqual(['ready', 'ready']);
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.locator('.phone-frame .preview-loading')).toHaveCount(0);
  await page.locator('.phone-frame').screenshot({ path: testInfo.outputPath('personalized-cover.png') });
});

test('five distinct templates persist and phone preview recovers without duplicate refreshes', async ({ page }, testInfo) => {
  const id = await createInBrowser(page, '五模板与预览恢复');
  await page.getByLabel('新人姓名', { exact: true }).fill('林岚 & 周屿');
  await page.getByLabel('婚礼日期', { exact: true }).fill('2026-09-12');
  await saved(page);
  const phone = page.locator('.phone-frame');
  const frame = page.frameLocator('iframe[title="交付文档手机预览"]');
  await expect(frame.locator('.render-root')).toBeVisible();
  await expect(phone.locator('.preview-loading')).toHaveCount(0);
  let previews = 0;
  page.on('request', request => { if (request.url().includes(`/api/projects/${id}/preview?`)) previews++; });
  await page.locator('.preview-heading').getByRole('button', { name: 'PDF', exact: true }).click();
  await page.waitForTimeout(400);
  await expect(phone.locator('.preview-loading')).toHaveCount(0);
  expect(previews).toBe(0);

  await page.route(`**/api/projects/${id}/preview?**`, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'PREVIEW_TEST_FAILURE', message: '测试预览暂不可用' }) }));
  await page.getByRole('button', { name: '刷新预览', exact: true }).click();
  await expect(phone.getByText('预览暂不可用', { exact: true })).toBeVisible();
  await page.unroute(`**/api/projects/${id}/preview?**`);
  await phone.getByRole('button', { name: '重试预览' }).click();
  await expect(phone.locator('.preview-loading')).toHaveCount(0);
  await expect(frame.locator('.render-root')).toBeVisible();

  await page.getByRole('button', { name: '视觉与输出', exact: true }).click();
  await expect(page.locator('.template-card')).toHaveCount(5);
  for (const template of TEMPLATE_IDS) {
    await page.locator(`.template-card[data-template="${template}"]`).click();
    await saved(page);
    await expect(frame.locator('body')).toHaveAttribute('data-template', template);
    await expect(phone.locator('.preview-loading')).toHaveCount(0);
    if (['archive', 'correspondence', 'gallery'].includes(template)) {
      await phone.screenshot({ path: testInfo.outputPath(`phone-${template}.png`) });
    }
  }
  await page.locator('.editor-pane').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath('five-template-workbench.png'), fullPage: true });
  await page.reload();
  await expect(page.getByLabel('新人姓名', { exact: true })).toHaveValue('林岚 & 周屿');
  expect((await projectFromApi(page, id)).document.templateId).toBe('gallery');
  await expect(frame.locator('body')).toHaveAttribute('data-template', 'gallery');
});

const chapterIds = (project: ProjectRecord) => [...project.document.blocks].sort((a, b) => a.order - b.order).map(block => block.id);

test('chapter handles support mouse, keyboard, cancellation, undo and fixed anchors across reload', async ({ page }, testInfo) => {
  const id = await createInBrowser(page, '章节拖拽验收');
  const original = await projectFromApi(page, id);
  const ids = chapterIds(original);
  const first = page.locator(`[data-chapter-id="${ids[0]}"]`);
  const last = page.locator(`[data-chapter-id="${ids.at(-1)}"]`);
  await expect(first.locator('.chapter-handle')).toHaveCount(0);
  await expect(last.locator('.chapter-handle')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '章节上移', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '章节下移', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '删除章节', exact: true })).toBeDisabled();
  const moving = ids[1];
  const handle = page.locator(`[data-chapter-id="${moving}"] .chapter-handle`);
  const from = await handle.boundingBox();
  const to = await page.locator(`[data-chapter-id="${ids[3]}"]`).boundingBox();
  expect(from).not.toBeNull(); expect(to).not.toBeNull();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2, to!.y + to!.height / 2, { steps: 12 });
  await expect(page.locator('.chapter-drop-line')).toBeVisible();
  await page.locator('.block-nav').screenshot({ path: testInfo.outputPath('chapter-dragging.png') });
  await page.mouse.up();
  const expected = [...ids]; expected.splice(1, 1); expected.splice(3, 0, moving);
  await expect.poll(async () => chapterIds(await projectFromApi(page, id))).toEqual(expected);
  await saved(page);
  await page.getByRole('button', { name: '撤销上次调整', exact: true }).click();
  await expect.poll(async () => chapterIds(await projectFromApi(page, id))).toEqual(ids);
  await saved(page);
  await handle.focus();
  await handle.press('Space');
  await handle.press('End');
  await handle.press('Escape');
  await expect(page.locator('.chapter-drop-line')).toHaveCount(0);
  expect(chapterIds(await projectFromApi(page, id))).toEqual(ids);
  await handle.press('Space');
  await handle.press('End');
  await handle.press('Space');
  const keyboardOrder = [...ids]; keyboardOrder.splice(1, 1); keyboardOrder.splice(keyboardOrder.length - 1, 0, moving);
  await expect.poll(async () => chapterIds(await projectFromApi(page, id))).toEqual(keyboardOrder);
  await saved(page);
  await page.reload();
  await expect(page.locator('[data-chapter-id]').first()).toHaveAttribute('data-chapter-id', ids[0]);
  await expect(page.locator('[data-chapter-id]').last()).toHaveAttribute('data-chapter-id', ids.at(-1)!);
  expect(chapterIds(await projectFromApi(page, id))).toEqual(keyboardOrder);
  await page.getByLabel('添加章节', { exact: true }).selectOption('custom');
  await saved(page);
  const added = await projectFromApi(page, id);
  const addedBlocks = [...added.document.blocks].sort((a, b) => a.order - b.order);
  expect(addedBlocks.at(-2)?.title).toBe('新的章节');
  expect(addedBlocks.at(-1)?.type).toBe('signature');
  await page.locator('.block-nav').screenshot({ path: testInfo.outputPath('chapter-order-saved.png') });
});

test('project menu can archive, trash, undo, restore after reload and permanently delete', async ({ page }, testInfo) => {
  const title = '回收站浏览器验收';
  const id = await createInBrowser(page, title);
  await saved(page);
  await page.getByRole('button', { name: 'Delivery Studio 项目首页', exact: true }).click();
  const card = page.locator('.project-card').filter({ has: page.locator('.card-title', { hasText: title }) });
  const menu = () => card.getByRole('button', { name: `项目操作 · ${title}`, exact: true });
  await menu().click();
  await card.getByRole('button', { name: '删除项目', exact: true }).click();
  await page.getByRole('dialog', { name: '移入回收站' }).getByRole('button', { name: '取消', exact: true }).click();
  await expect(card).toBeVisible();
  await menu().click();
  await card.getByRole('button', { name: '删除项目', exact: true }).click();
  await page.getByRole('dialog', { name: '移入回收站' }).getByRole('button', { name: '移入回收站', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: '撤销删除', exact: true }).click();
  await expect(card).toBeVisible();
  await menu().click();
  await card.getByRole('button', { name: '归档项目', exact: true }).click();
  await page.getByRole('button', { name: /^已归档/ }).click();
  await expect(card).toBeVisible();
  await menu().click();
  await card.getByRole('button', { name: '删除项目', exact: true }).click();
  await page.getByRole('dialog', { name: '移入回收站' }).getByRole('button', { name: '移入回收站', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: /^回收站/ }).click();
  await expect(card).toBeVisible();
  await expect(card.locator('.project-cover')).toBeDisabled();
  await card.getByRole('button', { name: '恢复项目', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: /^已归档/ }).click();
  await expect(card).toBeVisible();
  expect((await projectFromApi(page, id)).archived).toBe(true);
  await menu().click();
  await card.getByRole('button', { name: '删除项目', exact: true }).click();
  await page.getByRole('dialog', { name: '移入回收站' }).getByRole('button', { name: '移入回收站', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /^回收站/ }).click();
  await card.getByRole('button', { name: '彻底删除', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: '彻底删除项目', exact: true });
  await expect(confirmation).toContainText('原始素材文件夹、网盘文件和已另存的交付文件不会被删除');
  await page.screenshot({ path: testInfo.outputPath('project-permanent-delete.png') });
  await confirmation.getByRole('button', { name: '彻底删除', exact: true }).click();
  await expect(card).toHaveCount(0);
  expect((await page.request.get(`/api/projects/${id}`)).status()).toBe(404);
});

test.describe('touch chapter ordering', () => {
  test.use({ hasTouch: true });
  test('touch drag clamps to the middle and leaves both anchors fixed', async ({ page }) => {
    const id = await createInBrowser(page, '触屏排序验收');
    const ids = chapterIds(await projectFromApi(page, id));
    const moving = ids[3];
    const handle = page.locator(`[data-chapter-id="${moving}"] .chapter-handle`);
    const source = await handle.boundingBox();
    const anchor = await page.locator('[data-chapter-id]').first().boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const x = source!.x + source!.width / 2;
    const y = source!.y + source!.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (anchor!.y - y) * step / 8 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const expected = [...ids]; expected.splice(3, 1); expected.splice(1, 0, moving);
    await expect.poll(async () => chapterIds(await projectFromApi(page, id))).toEqual(expected);
    await saved(page);
    await cdp.detach();
  });
});

test('highlight stills, timeline and cover teaser are editable and persist', async ({ page }) => {
  const id = await createInBrowser(page, '高光画面与当天时间线');
  await page.getByLabel('添加章节', { exact: true }).selectOption('stills');
  await expect(page.getByText('已添加 3 张 · 可见 3 张', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '选择画面 1', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '选择高光画面' });
  await picker.locator('input[type="file"]').setInputFiles({ name: 'still-01.png', mimeType: 'image/png', buffer: await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#b9a48c' } }).png().toBuffer() });
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole('button', { name: '替换画面 1', exact: true })).toBeVisible();
  await page.getByLabel('画面 1 说明', { exact: true }).fill('交换戒指前的一次深呼吸。');
  await saved(page);

  await page.getByLabel('添加章节', { exact: true }).selectOption('timeline');
  await page.getByLabel('时刻标题 1', { exact: true }).fill('清晨，化妆间的阳光');
  await saved(page);

  await page.locator('.block-nav-item').filter({ hasText: '序言与新人信息' }).locator('.chapter-select').click();
  await page.getByLabel('预告链接', { exact: true }).fill('https://example.com/teaser');
  await page.getByLabel('预告说明', { exact: true }).fill('1 分钟预告片');
  await saved(page);

  await page.reload();
  await expect(page.getByLabel('预告链接', { exact: true })).toHaveValue('https://example.com/teaser');
  const record = await projectFromApi(page, id);
  const blocks = [...record.document.blocks].sort((a, b) => a.order - b.order);
  expect(blocks.at(-1)?.type).toBe('signature');
  const stills = blocks.find(block => block.type === 'stills');
  const timeline = blocks.find(block => block.type === 'timeline');
  const intro = blocks.find(block => block.type === 'intro');
  if (stills?.type !== 'stills' || timeline?.type !== 'timeline' || intro?.type !== 'intro') throw new Error('expected stills, timeline and intro chapters');
  const frames = [...stills.frames].sort((a, b) => a.order - b.order);
  expect(frames).toHaveLength(3);
  expect(frames[0].image).not.toBeNull();
  expect(record.assets.some(asset => asset.id === frames[0].image?.assetId)).toBe(true);
  expect(frames[0].caption).toBe('交换戒指前的一次深呼吸。');
  const entries = [...timeline.entries].sort((a, b) => a.order - b.order);
  expect(entries[0].title).toBe('清晨，化妆间的阳光');
  expect(intro.cover?.teaser).toEqual({ url: 'https://example.com/teaser', label: '1 分钟预告片' });
});
