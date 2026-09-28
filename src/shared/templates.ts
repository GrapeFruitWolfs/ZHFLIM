export const TEMPLATE_IDS = ['editorial', 'cinematic', 'archive', 'correspondence', 'gallery'] as const;
export type TemplateId = typeof TEMPLATE_IDS[number];

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  label: string;
  description: string;
}

/** Product-facing choices; rendering styles and output formats have separate owners. */
export const TEMPLATES: readonly TemplateDefinition[] = [
  { id: 'editorial', name: 'Editorial', label: '私人影像展册', description: '以新人、真实画面和清晰中文为中心，完整呈现交付内容与制作用心。' },
  { id: 'cinematic', name: 'Cinematic', label: '电影序章', description: '深色画布与电影式节奏，突出婚礼影片的沉浸氛围。' },
  { id: 'archive', name: 'Archive', label: '制作档案', description: '档案编号、记录式章节与交付清单，让专业制作过程有据可循。' },
  { id: 'correspondence', name: 'Correspondence', label: '写给你们', description: '以新人姓名和书信式留白为主角，适合温柔、私密的个人交付。' },
  { id: 'gallery', name: 'Gallery', label: '私人展映', description: '海报式开篇与画廊图注，把调色画面和最终作品放在视觉中心。' },
];

export const getTemplate = (id: TemplateId): TemplateDefinition => TEMPLATES.find(template => template.id === id)!;
