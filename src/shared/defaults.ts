import { newId, type Comparison, type CoverSettings, type ProductionDetails, type DeliveryItem, type DocumentBlock, type Preset, type ProjectRecord, type StudioSettings, type TextBlock } from './model.js';

export const createCover = (): CoverSettings => ({ emphasis: 'names', headline: '这一天，值得一次次重温。', message: '', image: null });
export const createProductionDetails = (): ProductionDetails => ({ content: '', image: null, caption: '', placement: 'hidden' });

export const CONTENT_LIBRARY = [
  { id: 'log-workflow', title: 'LOG 工作流', content: '通过 LOG 拍摄与统一的色彩管理，保留高光与暗部的丰富层次，让婚礼影像呈现自然、细腻的质感。' },
  { id: 'skin-refinement', title: '肤色精修', content: '逐镜调整肤色与画面色彩，在保留真实情绪的同时，让人物肤色自然、通透，并维持不同场景之间的一致性。' },
  { id: 'narrative-audio', title: '叙事音频优化', content: '整理誓言、致辞与现场声音，完成降噪、响度平衡和音乐衔接，让声音与画面共同讲述这一天。' },
  { id: 'viewing', title: '观看与保存建议', content: '建议下载原文件后观看，以获得完整画质与声音体验。请及时保存，并将珍贵影像备份至至少两处独立存储。' },
  { id: 'revisions', title: '关于修改', content: '如有需要调整的内容，请整理时间点与具体说明，一次发送给我们，方便准确沟通。具体修改范围与安排以双方约定为准。' },
] as const;

export function createDeliveryItem(title = '新的交付内容'): DeliveryItem {
  return { id: newId(), title, description: '', format: '', method: 'description', downloadUrl: '', playbackUrl: '', accessNote: '', visible: true, order: 0 };
}
export function createComparison(): Comparison {
  return { id: newId(), title: '', order: 0, visible: true, before: null, after: null, locked: true };
}
export function createTextBlock(title: string, content: string): TextBlock {
  return { id: newId(), title, content, type: 'text', visible: true, order: 0 };
}

function presetBlocks(withComparisons: boolean): DocumentBlock[] {
  const film = { ...createDeliveryItem('婚礼完整成片'), description: '那些值得珍藏的瞬间，已经整理成一段完整的婚礼故事。', format: 'MP4 · 高清影片', method: 'link' as const };
  const blocks: DocumentBlock[] = [
    { id: newId(), type: 'intro', title: '序言与新人信息', visible: true, order: 0 },
    { id: newId(), type: 'deliveries', title: '为你交付', items: [film], visible: true, order: 1 },
    ...CONTENT_LIBRARY.slice(0, withComparisons ? 3 : 1).map(item => ({ ...createTextBlock(item.title, item.content), sourceDefinitionId: item.id })),
    ...(withComparisons ? [{ id: newId(), type: 'comparisons' as const, title: '色彩与情绪', visible: true, order: 0, layout: 'inherit' as const, comparisons: [] }] : []),
    ...CONTENT_LIBRARY.slice(3).map(item => ({ ...createTextBlock(item.title, item.content), sourceDefinitionId: item.id })),
    { id: newId(), type: 'signature', title: '摄影师署名', visible: true, order: 0 }
  ];
  return blocks.map((block, order) => ({ ...block, order }));
}
export const BUILTIN_PRESETS: Preset[] = [
  { id: 'essential', version: 1, name: '简约交付', description: '影片清单、制作说明与保存建议，从一份清晰的交付开始。', builtin: true, blocks: presetBlocks(false), templateId: 'editorial', comparisonLayout: 'stacked' },
  { id: 'signature', version: 1, name: '完整影像', description: '完整交付清单、后期制作说明与调色对比，内容仍可自由修改。', builtin: true, blocks: presetBlocks(true), templateId: 'editorial', comparisonLayout: 'stacked' },
  { id: 'blank', version: 1, name: '自由创建', description: '从新人信息与署名开始，按本次需要添加内容。', builtin: true, blocks: presetBlocks(false).filter(block => block.type === 'intro' || block.type === 'signature').map((block, order) => ({ ...block, order })), templateId: 'editorial', comparisonLayout: 'stacked' }
];

export function cloneBlocks(blocks: DocumentBlock[], stripProjectData = false): DocumentBlock[] {
  return structuredClone(blocks).map((block, order) => {
    block.id = newId(); block.order = order;
    if (stripProjectData && block.type === 'intro' && block.cover) block.cover = { ...block.cover, image: null, headline: '', message: '' };
    if (stripProjectData && block.type === 'text' && block.details) block.details = { ...block.details, image: null, caption: '' };
    if (block.type === 'deliveries') block.items = block.items.map((item, index) => ({ ...item, id: newId(), order: index, ...(stripProjectData ? { downloadUrl: '', playbackUrl: '', accessNote: '' } : {}) }));
    if (block.type === 'comparisons') block.comparisons = stripProjectData ? [] : block.comparisons.map((item, index) => ({ ...item, id: newId(), order: index }));
    return block;
  });
}
export function applyPreset(project: ProjectRecord, preset: Preset): ProjectRecord {
  const next = structuredClone(project);
  next.document.blocks = cloneBlocks(preset.blocks, true);
  next.document.templateId = preset.templateId;
  next.document.comparisonLayout = preset.comparisonLayout;
  return next;
}
export function createProject(options: { title: string; presetId?: string; settings: StudioSettings; preset?: Preset }): ProjectRecord {
  const preset = options.preset ?? BUILTIN_PRESETS.find(item => item.id === options.presetId) ?? BUILTIN_PRESETS[0];
  const now = new Date().toISOString();
  const id = newId();
  const projectNo = `WD-${now.slice(0,10).replaceAll('-', '')}-${id.slice(0,4).toUpperCase()}`;
  const field = (value = '', visible = true) => ({ value, visible });
  return {
    schemaVersion: 1, id, tenantId: options.settings.tenantId, clientId: newId(),
    title: options.title.trim() || '未命名婚礼项目', projectNo,
    internalNotes: '', draftRevision: 0, archived: false, createdAt: now, updatedAt: now,
    document: {
      id: newId(),
      fields: { salutation: field('', false), coupleNames: field(), weddingDate: field(), studioName: field(options.settings.studioName), photographerName: field(options.settings.photographerName, !!options.settings.photographerName), projectNo: field(projectNo, false) },
      deliveryDate: { mode: 'auto', manualDate: '', visible: true },
      brand: { tagline: options.settings.tagline, accent: options.settings.accent, logo: null },
      templateId: preset.templateId, templateVersion: 1, comparisonLayout: preset.comparisonLayout,
      blocks: cloneBlocks(preset.blocks, true),
      output: { mode: 'both', imageWidth: 1080, segmentHeight: 12000, allowImageSegments: false, allowComparisonPageBreak: false }
    },
    assets: [], importRoots: [], excludedSourceKeys: [], importReports: []
  };
}
