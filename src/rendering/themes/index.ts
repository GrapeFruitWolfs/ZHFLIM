import type { TemplateId } from '../../shared/model.js';
import { editorialTheme } from './editorial.js';
import { cinematicTheme } from './cinematic.js';
import { archiveTheme } from './archive.js';
import { correspondenceTheme } from './correspondence.js';
import { galleryTheme } from './gallery.js';

/** The final, per-template aesthetic layer. */
export const themeCss: Record<TemplateId, string> = { editorial: editorialTheme, cinematic: cinematicTheme, archive: archiveTheme, correspondence: correspondenceTheme, gallery: galleryTheme };
