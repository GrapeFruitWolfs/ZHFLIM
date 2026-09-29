import { useEffect, useId, useRef, useState } from 'react';
import { Archive, Copy, MoreHorizontal, Trash2, Undo2 } from 'lucide-react';
import type { ProjectSummary } from '../shared/model';

export function ProjectMenu({ project, disabled, onDuplicate, onArchive, onDelete }: {
  project: ProjectSummary; disabled: boolean;
  onDuplicate: () => void; onArchive: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const run = (action: () => void) => { setOpen(false); action(); };
  return <div className="project-menu" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button ref={trigger} className="icon-button" aria-label={`项目操作 · ${project.title}`} aria-expanded={open} aria-controls={id} disabled={disabled} onClick={() => setOpen(!open)}><MoreHorizontal size={18} /></button>
    {open && <div className="project-menu-popover" id={id}>
      <button onClick={() => run(onDuplicate)}><Copy size={15} />复制为另一场婚礼</button>
      <button onClick={() => run(onArchive)}>{project.archived ? <Undo2 size={15} /> : <Archive size={15} />}{project.archived ? '恢复项目' : '归档项目'}</button>
      <button className="danger-text" onClick={() => run(onDelete)}><Trash2 size={15} />删除项目</button>
    </div>}
  </div>;
}
