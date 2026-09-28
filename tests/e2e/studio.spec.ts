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
  await page.locator('.block-nav-item').filter({ hasText: '为你交付' }).locator('button').first().click();
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
    await page.getByRole('button', { name: /Stacked · 上下/ }).click();
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
  await page.locator('.block-nav-item').filter({ hasText: '为你交付' }).locator('button').first().click();
  await page.getByLabel('下载链接', { exact: true }).fill('https://example.com/wedding-demo');
  await page.locator('.block-nav-item').filter({ hasText: 'LOG 工作流' }).locator('button').first().click();
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
