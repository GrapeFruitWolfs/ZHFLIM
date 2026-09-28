import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import sharp from 'sharp';
import type { OutputSettings, OutputTarget } from '../shared/model.js';
import { digest, RENDERER_VERSION, RENDER_BUDGET } from './display.js';
import { PAGE_CONTENT_HEIGHT, PAGE_HEIGHT, PAGE_WIDTH } from './templates.js';

export class RenderFailure extends Error {
  constructor(public code: string, message: string, public blockId?: string, public comparisonId?: string) { super(message); }
}
export interface RenderedFile { filename: string; path: string; mime: string; byteSize: number; hash: string; width?: number; height?: number; pages?: number }
export interface EngineDependencies { renderer: string; chromium: string; platform: string }

export async function startRenderer(): Promise<{ browser: Browser; dependencies: EngineDependencies }> {
  const executablePath = process.env.WDS_CHROMIUM_PATH || (process.platform === 'linux' && existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const browser = await chromium.launch({
    headless: true, executablePath, timeout: 45_000,
    args: [...(typeof process.getuid === 'function' && process.getuid() === 0 ? ['--no-sandbox'] : []), ...(process.platform === 'linux' ? ['--disable-dev-shm-usage'] : [])],
  });
  return { browser, dependencies: { renderer: RENDERER_VERSION, chromium: browser.version(), platform: `${process.platform}-${process.arch}` } };
}

async function persistFile(directory: string, filename: string, bytes: Buffer, metadata: Omit<RenderedFile, 'filename' | 'path' | 'byteSize' | 'hash'>): Promise<RenderedFile> {
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, filename);
  const temporary = `${destination}.${randomUUID()}.part`;
  await writeFile(temporary, bytes, { flag: 'wx' });
  await rename(temporary, destination);
  const info = await stat(destination);
  if (!info.size) throw new RenderFailure('ARTIFACT_EMPTY', '导出文件为空，请重试。');
  return { filename, path: destination, byteSize: info.size, hash: digest(bytes), ...metadata };
}

/** Each PDF page / image segment is laid out before capture, never sliced through text. */
export async function renderTarget(browser: Browser, html: string, target: OutputTarget, settings: OutputSettings, directory: string): Promise<RenderedFile[]> {
  if (Buffer.byteLength(html, 'utf8') > RENDER_BUDGET.htmlBytes) throw new RenderFailure('RESOURCE_BUDGET', '本次渲染内容超过 96MiB 工作预算，请减少可见图片或分为不同文档。');
  const imageWidth = settings.imageWidth;
  if (target === 'image' && (!Number.isInteger(imageWidth) || imageWidth < 720 || imageWidth > 2160 || !Number.isInteger(settings.segmentHeight) || settings.segmentHeight < 2000 || settings.segmentHeight > 16000)) {
    throw new RenderFailure('IMAGE_DIMENSIONS', '长图宽度需要在 720–2160 像素内，每段高度需要在 2000–16000 像素内。');
  }
  const scale = target === 'image' ? imageWidth / PAGE_WIDTH : 1;
  // Keep the persisted source self-contained, but avoid sending a 20+ MiB font data URL
  // through HTML/CSS parsing. Only these exact, immutable bytes may satisfy a font request.
  const fontResources = new Map<string, Buffer>();
  const compactHtml = html.replace(/data:font\/ttf;base64,([A-Za-z0-9+/=]+)/g, (_match, encoded: string) => {
    const bytes = Buffer.from(encoded, 'base64');
    const address = `https://studio-fonts.invalid/${digest(bytes)}.ttf`;
    fontResources.set(address, bytes);
    return address;
  }).replace("font-src data: 'self'", 'font-src https://studio-fonts.invalid');
  const context = await browser.newContext({ viewport: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, deviceScaleFactor: scale, colorScheme: 'light', locale: 'zh-CN', reducedMotion: 'reduce' });
  await context.route('**/*', async route => {
    const font = fontResources.get(route.request().url());
    if (font) await route.fulfill({ status: 200, contentType: 'font/ttf', headers: { 'Access-Control-Allow-Origin': '*' }, body: font });
    else await route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45_000);
  try {
    await page.setContent(compactHtml, { waitUntil: 'load', timeout: 45_000 });
    // tsx/esbuild can annotate nested evaluated functions with this naming helper.
    // It affects function names only; the customer HTML never contains executable code.
    await page.evaluate('globalThis.__name = (value) => value');
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode()));
    });
    const fontFailed = await page.evaluate(() => [...document.fonts].some(font => font.status === 'error'));
    if (fontFailed) throw new RenderFailure('FONT_LOAD_FAILED', '正式渲染字体未能加载，请恢复打包字体后重新预览。');
    const layout = await page.evaluate(({ target, capacity, imageCap, allowImageSegments, allowComparisonPageBreak }) => {
      const root = document.querySelector<HTMLElement>('.render-root')!;
      const flow = root.querySelector<HTMLElement>('.flow')!;
      const source = root.querySelector<HTMLElement>('.units')!;
      const masthead = flow.querySelector<HTMLElement>('.masthead')!;
      const units = [...source.children] as HTMLElement[];
      const size = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return element.getBoundingClientRect().height + parseFloat(style.marginTop || '0') + parseFloat(style.marginBottom || '0');
      };
      const fail = (code: string, message: string, unit?: HTMLElement) => ({ error: { code, message, blockId: unit?.dataset.block, comparisonId: unit?.dataset.comparison }, count: 0, heights: [] as number[] });
      const compactHeadings = (group: HTMLElement[]) => {
        if (group.length < 2) return;
        const headings = group.slice(0, -1);
        const context = document.createElement('div');
        context.className = 'compact-context';
        context.textContent = headings.map(heading => heading.textContent?.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ');
        headings.forEach(heading => heading.remove());
        group[group.length - 1].prepend(context);
      };
      // A pair is the only atomic unit allowed to split. Both resulting units keep the group identity.
      for (let index = 0; index < units.length; index++) {
        const unit = units[index];
        const limit = target === 'pdf' ? capacity : imageCap - 120;
        if (size(unit) <= limit || !unit.dataset.comparison) continue;
        if (target === 'pdf' && !allowComparisonPageBreak) return fail('COMPARISON_PAGE_OVERFLOW', '一组调色对比无法在一页清晰展示。请开启“允许对比跨页”，或改用左右布局。', unit);
        if (target === 'image' && !allowImageSegments) return fail('IMAGE_TOO_LONG', '长图超过当前安全高度，请允许分段或调整输出宽度。', unit);
        const figures = [...unit.querySelectorAll<HTMLElement>('.comparison-figure')];
        if (figures.length !== 2) return fail('UNIT_TOO_TALL', '这个对比模块超过可用版面，请调整布局或图片。', unit);
        const replacements = figures.map((figure, figureIndex) => {
          const replacement = unit.cloneNode(false) as HTMLElement;
          replacement.classList.add('comparison-single');
          if (target === 'pdf') replacement.dataset.pageBefore = 'true';
          const heading = unit.querySelector<HTMLElement>('.comparison-heading')!.cloneNode(true) as HTMLElement;
          const number = heading.querySelector('.comparison-number');
          if (number) number.textContent += ` · ${figureIndex + 1}/2`;
          replacement.append(heading, figure.cloneNode(true));
          source.insertBefore(replacement, unit);
          return replacement;
        });
        unit.remove();
        units.splice(index, 1, ...replacements);
        index += 1;
      }

      if (target === 'pdf') {
        // A spacious chapter title must not become its own page when the comparison
        // below it already fills the page. Preserve its semantic title in the pair header.
        for (let index = 0; index < units.length - 1; index++) {
          const chapter = units[index]; const next = units[index + 1];
          if (!chapter.classList.contains('chapter') || !next.dataset.comparison || size(chapter) + size(next) <= capacity) continue;
          const chapterTitle = chapter.querySelector('.chapter-heading')?.textContent ?? '';
          const chapterNumber = chapter.querySelector('.chapter-index')?.textContent ?? '';
          const nextTitle = next.querySelector('.comparison-heading > span');
          if (nextTitle) nextTitle.textContent = `${chapterNumber} ${chapterTitle} · ${nextTitle.textContent ?? ''}`;
          chapter.remove(); units.splice(index, 1); index -= 1;
        }
        const pages = document.createElement('div'); pages.className = 'pdf-pages'; root.append(pages);
        const pageBodies: HTMLElement[] = [];
        const addPage = () => {
          const page = document.createElement('section'); page.className = 'pdf-page';
          const header = masthead.cloneNode(true) as HTMLElement; header.className = 'page-masthead';
          const body = document.createElement('div'); body.className = 'page-body';
          const footer = document.createElement('div'); footer.className = 'page-footer';
          const label = document.createElement('span'); label.textContent = 'WEDDING COLLECTION';
          const number = document.createElement('span'); number.className = 'page-number';
          footer.append(label, number); page.append(header, body, footer); pages.append(page); pageBodies.push(body); return body;
        };
        let body = addPage();
        for (let index = 0; index < units.length; index++) {
          const unit = units[index];
          if (unit.dataset.pageBefore === 'true' && body.children.length) body = addPage();
          const group = [unit];
          while (units[index].dataset.keepNext === 'true' && units[index + 1] && units[index + 1].dataset.pageBefore !== 'true') group.push(units[++index]);
          body.append(...group);
          if (body.scrollHeight > capacity + 1) {
            group.forEach(element => element.remove());
            if (body.children.length) body = addPage();
            body.append(...group);
            if (body.scrollHeight > capacity + 1) return fail('PDF_UNIT_OVERFLOW', `第 ${pageBodies.length} 页有内容超过可读范围，请缩短标题、拆分长段落或更换图片布局。`, unit);
          }
        }
        flow.remove();
        if (pageBodies.some(body => body.children.length === 1 && body.firstElementChild?.classList.contains('chapter'))) return fail('PDF_ORPHAN_HEADING', '一个章节标题与内容无法同页展示，请调整该章节的内容或图片布局。');
        if (pageBodies.length > 200) return fail('PDF_PAGE_BUDGET', '文档超过 200 页，请减少本次交付内容后重试。');
        pages.querySelectorAll('.page-number').forEach((node, index) => { node.textContent = `${String(index + 1).padStart(2, '0')} / ${String(pageBodies.length).padStart(2, '0')}`; });
        return { count: pageBodies.length, heights: pageBodies.map(() => 768) };
      }

      const segments = document.createElement('div'); segments.className = 'image-segments'; root.append(segments);
      const sections: HTMLElement[] = [];
      const addSegment = () => {
        const segment = document.createElement('section'); segment.className = 'image-segment';
        const header = masthead.cloneNode(true) as HTMLElement; header.classList.add('unit');
        segment.append(header); segments.append(segment); sections.push(segment); return segment;
      };
      let section = addSegment();
      for (let index = 0; index < units.length; index++) {
        const unit = units[index];
        const group = [unit];
        while (units[index].dataset.keepNext === 'true' && units[index + 1]) group.push(units[++index]);
        section.append(...group);
        if (section.getBoundingClientRect().height + 64 > imageCap) {
          group.forEach(element => element.remove());
          if (!allowImageSegments) return fail('IMAGE_TOO_LONG', '长图超过当前安全高度，请开启“允许长图分段”后重新预览。', unit);
          if (section.children.length > 1) section = addSegment();
          section.append(...group);
          if (section.getBoundingClientRect().height + 64 > imageCap) compactHeadings(group);
          if (section.getBoundingClientRect().height + 64 > imageCap) return fail('IMAGE_UNIT_OVERFLOW', `第 ${sections.length} 段有内容超过长图高度，请增加每段高度或调整图片布局。`, unit);
        }
      }
      flow.remove();
      if (sections.length > 100) return fail('IMAGE_SEGMENT_BUDGET', '长图超过 100 段，请减少本次交付内容后重试。');
      sections.forEach((section, index) => {
        const footer = document.createElement('footer'); footer.className = 'image-segment-footer';
        const label = document.createElement('span'); label.textContent = 'WEDDING COLLECTION';
        const number = document.createElement('span'); number.textContent = sections.length > 1 ? `${index + 1} / ${sections.length}` : 'WITH GRATITUDE';
        footer.append(label, number); section.append(footer);
      });
      return { count: sections.length, heights: sections.map(section => Math.ceil(section.getBoundingClientRect().height)) };
    }, { target, capacity: PAGE_CONTENT_HEIGHT, imageCap: settings.segmentHeight / scale, allowImageSegments: settings.allowImageSegments, allowComparisonPageBreak: settings.allowComparisonPageBreak });
    if ('error' in layout && layout.error) throw new RenderFailure(layout.error.code, layout.error.message, layout.error.blockId, layout.error.comparisonId);
    const overflow = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.unit')].some(unit => unit.scrollWidth > unit.clientWidth + 2));
    if (overflow) throw new RenderFailure('HORIZONTAL_OVERFLOW', '内容超出版面宽度，请检查超长标题或链接。');
    await mkdir(directory, { recursive: true });
    if (target === 'pdf') {
      const bytes = await page.pdf({ width: `${PAGE_WIDTH}px`, height: `${PAGE_HEIGHT}px`, printBackground: true, preferCSSPageSize: true, tagged: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new RenderFailure('PDF_INVALID', 'PDF 文件校验失败，请重试。');
      return [await persistFile(directory, 'wedding-delivery.pdf', bytes, { mime: 'application/pdf', pages: layout.count })];
    }
    if (layout.heights.reduce((total, height) => total + Math.ceil(height * scale) * imageWidth, 0) > 250_000_000) throw new RenderFailure('IMAGE_PIXEL_BUDGET', '本次长图的总像素超过工作预算，请减少内容或降低输出宽度。');
    const results: RenderedFile[] = [];
    for (let index = 0; index < layout.count; index++) {
      const image = await page.locator('.image-segment').nth(index).screenshot({ type: 'png', animations: 'disabled', timeout: 45_000 });
      const encoded = await sharp(image).toColourspace('srgb').jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toBuffer({ resolveWithObject: true });
      if (encoded.info.height > settings.segmentHeight + 2 || Math.abs(encoded.info.width - imageWidth) > 1) throw new RenderFailure('IMAGE_DIMENSION_MISMATCH', '长图尺寸校验失败，产物未登记成功。');
      results.push(await persistFile(directory, `wedding-delivery${layout.count > 1 ? `-${String(index + 1).padStart(2, '0')}` : ''}.jpg`, encoded.data, { mime: 'image/jpeg', width: encoded.info.width, height: encoded.info.height }));
    }
    return results;
  } finally { await context.close(); }
}
