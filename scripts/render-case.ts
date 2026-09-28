import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { createCover, createDeliveryItem, createProject, createTextBlock } from '../src/shared/defaults.js';
import { newId, type AssetRef, type DocumentBlock, type ProjectRecord } from '../src/shared/model.js';
import { SqliteStudioStore } from '../src/server/store.js';
import { beginImport, importImage, finalizeImport } from '../src/server/imports.js';
import { loadFonts, prepareDisplay, escapeHtml } from '../src/rendering/display.js';
import { renderHtml } from '../src/rendering/html.js';
import { startRenderer, renderTarget } from '../src/rendering/engine.js';
import { checkGlyphCoverage } from '../src/rendering/fonts.js';

const source = process.argv[2];
if (!source) throw new Error('Usage: npm run review:case -- /path/to/private-case.json');
const configPath = resolve(source);
const caseSchema = z.object({
  title: z.string(), names: z.string(), weddingDate: z.string(), studio: z.string(), photographer: z.string(), tagline: z.string(),
  cover: z.object({ file: z.string(), headline: z.string(), message: z.string() }),
  deliveries: z.array(z.object({ title: z.string(), description: z.string(), format: z.string(), accessNote: z.string() })),
  notes: z.array(z.object({ title: z.string(), content: z.string(), details: z.object({ file: z.string().optional(), content: z.string(), caption: z.string(), placement: z.enum(['inline', 'appendix', 'hidden']) }).optional() })),
  comparisons: z.array(z.object({ title: z.string(), description: z.string(), before: z.string(), after: z.string() })),
  closing: z.array(z.object({ title: z.string(), content: z.string() })),
});
const config = caseSchema.parse(JSON.parse(await readFile(configPath, 'utf8')));
const directory = resolve('release', `case-review-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(directory, { recursive: true });
const store = new SqliteStudioStore(join(directory, 'workspace'));
const assetRefs = new Map<string, AssetRef>();
let project: ProjectRecord;
try {
  const settings = store.saveSettings({ ...store.getSettings(), studioName: config.studio, photographerName: config.photographer, tagline: config.tagline, accent: '#57654f', timezone: 'Asia/Shanghai' });
  project = store.saveProject(createProject({ title: config.title, presetId: 'blank', settings }), 0);
  const files = [...new Set([config.cover.file, ...config.comparisons.flatMap(pair => [pair.before, pair.after]), ...config.notes.flatMap(note => note.details?.file ? [note.details.file] : [])])];
  const sourceFiles = await Promise.all(files.map(async (file, index) => ({ file, path: `reference-${String(index).padStart(2, '0')}${basename(file).endsWith('.png') ? '.png' : '.jpg'}`, bytes: await readFile(resolve(dirname(configPath), file)) })));
  const imported = beginImport(store, project.id, { label: '用户提供的 PDF 参考画面', rule: 'manual', includeUnclassifiedImages: true, files: sourceFiles.map(file => ({ relativePath: file.path, size: file.bytes.length, type: 'image/jpeg', lastModified: 0 })) });
  for (const file of sourceFiles) {
    const result = await importImage(store, project.id, imported.rootId, file.path, file.bytes, imported.report.id);
    assetRefs.set(file.file, { assetId: result.asset.id, versionId: result.asset.latestVersionId });
  }
  finalizeImport(store, project.id, imported.rootId, false, imported.report.id);
  project = store.getProject(project.id);
  project.document.fields.coupleNames.value = config.names;
  project.document.fields.weddingDate.value = config.weddingDate;
  project.document.deliveryDate.visible = false;
  project.document.output.allowImageSegments = true;
  project.document.output.allowComparisonPageBreak = true;
  const intro = project.document.blocks.find(block => block.type === 'intro')!;
  if (intro.type !== 'intro') throw new Error('Missing intro');
  intro.cover = { ...createCover(), headline: config.cover.headline, message: config.cover.message, image: assetRefs.get(config.cover.file)! };
  const blocks: DocumentBlock[] = [intro, { id: newId(), type: 'deliveries', title: '为你准备的，都在这里。', visible: true, order: 1, items: config.deliveries.map((item, order) => ({ ...createDeliveryItem(item.title), ...item, method: 'description', order })) }];
  for (const note of config.notes) blocks.push({ ...createTextBlock(note.title, note.content), details: note.details ? { content: note.details.content, caption: note.details.caption, placement: note.details.placement, image: note.details.file ? assetRefs.get(note.details.file)! : null } : undefined });
  blocks.push({ id: newId(), type: 'comparisons', title: '画面与色彩', visible: true, order: 0, layout: 'stacked', comparisons: config.comparisons.map((pair, order) => ({ id: newId(), title: pair.title, description: pair.description, order, visible: true, locked: true, before: assetRefs.get(pair.before)!, after: assetRefs.get(pair.after)! })) });
  blocks.push(...config.closing.map(note => createTextBlock(note.title, note.content)), { id: newId(), type: 'signature', title: '谢谢你的信任', visible: true, order: 0 });
  project.document.blocks = blocks.map((block, order) => ({ ...block, order }));
  project = store.saveProject(project, project.draftRevision);
  const fonts = await loadFonts(process.cwd());
  if (fonts.issues.length) throw new Error(JSON.stringify(fonts.issues));
  await cp(resolve('public/fonts'), join(directory, 'fonts'), { recursive: true });
  const localFonts = await loadFonts(process.cwd(), false);
  const { browser, dependencies } = await startRenderer();
  const report: unknown[] = [];
  const cards: string[] = [];
  try {
    for (const emphasis of ['names', 'photo'] as const) {
      const cover = project.document.blocks.find(block => block.type === 'intro')!;
      if (cover.type === 'intro' && cover.cover) cover.cover.emphasis = emphasis;
      const prepared = await prepareDisplay(project, store, '');
      const issues = [...prepared.issues, ...await checkGlyphCoverage(prepared.display, process.cwd())];
      if (issues.some(issue => issue.severity === 'error')) throw new Error(JSON.stringify(issues));
      const output = join(directory, emphasis);
      const pdf = await renderTarget(browser, renderHtml(prepared.display, 'pdf', fonts), 'pdf', project.document.output, output);
      const images = await renderTarget(browser, renderHtml(prepared.display, 'image', fonts), 'image', project.document.output, output);
      const preview = renderHtml(prepared.display, 'image', { ...localFonts, css: localFonts.css.replaceAll('/fonts/', '../fonts/') });
      await writeFile(join(output, 'phone-preview.html'), preview);
      const page = await browser.newPage({ viewport: { width: 432, height: 768 } });
      try {
        await page.setContent(renderHtml(prepared.display, 'image', fonts), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: join(output, 'opening.png') });
      } finally { await page.close(); }
      report.push({ emphasis, issues, pdfPages: pdf[0].pages, images: images.map(image => ({ filename: image.filename, width: image.width, height: image.height })) });
      cards.push(`<article><h2>${emphasis === 'names' ? '姓名主导' : '照片主导'}</h2><p><a href="${emphasis}/wedding-delivery.pdf">PDF · ${pdf[0].pages} 页</a> · <a href="${emphasis}/phone-preview.html">连续手机预览</a></p><img src="${emphasis}/opening.png" alt="${emphasis === 'names' ? '姓名' : '照片'}主导封面">${images.map(image => `<p><a href="${emphasis}/${image.filename}">长图 · ${image.width} × ${image.height}</a></p>`).join('')}</article>`);
      console.log(`${emphasis}: ${pdf[0].pages} PDF pages, ${images.length} long images`);
    }
  } finally { await browser.close(); }
  await writeFile(join(directory, 'report.json'), JSON.stringify({ title: config.title, projectId: project.id, dependencies, report }, null, 2));
  await writeFile(join(directory, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(config.title)} · 样稿对照</title><style>body{margin:0;padding:32px;font:16px/1.8 system-ui,sans-serif;color:#252923;background:#f4f5f1}h1{font-size:27px}main{display:flex;flex-wrap:wrap;gap:32px}article{width:375px;max-width:100%}article img{width:100%;height:auto}a{color:#385947}header{max-width:840px;margin-bottom:30px}p{color:#60665c}</style><header><h1>一份婚礼交付，两种开篇</h1><p>基于你提供的真实参考 PDF 重排。下载地址尚未提供，样稿不设置虚构的下载入口；交付日期暂不显示。图片来自参考文件，技术截图集中在制作附录。</p></header><main>${cards.join('')}</main></html>`);
  console.log(`Case review: ${directory}`);
} finally { store.close(); }
