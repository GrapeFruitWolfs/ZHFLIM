import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, GripVertical, LockKeyhole } from 'lucide-react';
import type { DocumentBlock } from '../shared/model';
import { isFixedChapter, moveChapter } from '../shared/chapters';

type Drag = { id: string; target: number; offset: number; keyboard: boolean; tops: number[] };
type PointerDrag = { id: string; pointerId: number; startY: number; y: number; scrollTop: number; active: boolean; handle: HTMLButtonElement; rects: DOMRect[] };

export function ChapterList({ blocks, selected, disabled, onSelect, onVisibility, onMove }: {
  blocks: DocumentBlock[]; selected?: string; disabled: boolean;
  onSelect: (id: string) => void; onVisibility: (block: DocumentBlock) => void;
  onMove: (id: string, index: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const pointer = useRef<PointerDrag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const first = blocks.findIndex(block => !isFixedChapter(block));
  const last = blocks.findLastIndex(block => !isFixedChapter(block));
  const setCurrent = (value: Drag | null) => { dragRef.current = value; setDrag(value); };
  const cancel = () => {
    const current = pointer.current;
    pointer.current = null;
    if (current?.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
    setCurrent(null);
  };
  const commit = () => {
    const current = dragRef.current;
    cancel();
    if (!current || disabled) return;
    onMove(current.id, current.target);
    setAnnouncement(`顺序已调整到第 ${current.target + 1} 项。`);
  };
  const measure = () => [...root.current!.querySelectorAll<HTMLElement>('[data-chapter-id]')].map(node => node.getBoundingClientRect());
  const updatePointer = () => {
    const current = pointer.current;
    if (!current || disabled) return;
    const scroll = root.current?.closest('.block-nav')?.scrollTop ?? 0;
    const delta = current.y - current.startY + scroll - current.scrollTop;
    if (!current.active && Math.abs(delta) < 6) return;
    current.active = true;
    const index = blocks.findIndex(block => block.id === current.id);
    const rect = current.rects[index];
    const offset = Math.max(current.rects[first].top - rect.top, Math.min(current.rects[last].top - rect.top, delta));
    const center = rect.top + rect.height / 2 + offset;
    let target = first;
    for (let i = first; i <= last; i++) {
      const candidate = current.rects[i];
      if (Math.abs(center - (candidate.top + candidate.height / 2)) < Math.abs(center - (current.rects[target].top + current.rects[target].height / 2))) target = i;
    }
    setCurrent({ id: current.id, target, offset, keyboard: false, tops: current.rects.map(rect => rect.top) });
  };
  // Cancel safely if an import, template application or external state change replaces the list.
  const identity = blocks.map(block => block.id).join('|');
  useEffect(() => { cancel(); }, [identity, disabled]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (pointer.current || dragRef.current)) { event.preventDefault(); cancel(); setAnnouncement('已取消排序。'); }
    };
    const blur = () => cancel();
    window.addEventListener('keydown', escape);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', escape); window.removeEventListener('blur', blur); };
  }, []);
  useEffect(() => {
    if (!drag || drag.keyboard) return;
    const timer = setInterval(() => {
      const current = pointer.current;
      const scroll = root.current?.closest<HTMLElement>('.block-nav');
      if (!current || !scroll) return;
      const box = scroll.getBoundingClientRect();
      const amount = current.y < box.top + 45 ? -8 : current.y > box.bottom - 45 ? 8 : 0;
      if (amount) { scroll.scrollTop += amount; updatePointer(); }
    }, 24);
    return () => clearInterval(timer);
  }, [drag?.id, drag?.keyboard, identity, disabled]);
  useEffect(() => {
    if (drag?.keyboard) root.current?.querySelector<HTMLElement>('.is-dragging')?.scrollIntoView({ block: 'nearest' });
  }, [drag?.target, drag?.keyboard]);
  const preview = drag ? moveChapter(blocks, drag.id, drag.target) : blocks;
  const dragIndex = drag ? blocks.findIndex(block => block.id === drag.id) : -1;
  return <div className={`chapter-list ${drag ? 'is-sorting' : ''}`} ref={root} aria-label="交付章节">
    <p className="chapter-sort-hint">拖动手柄调整章节，首尾固定</p>
    <span className="sr-only" id="chapter-drag-help">按空格拾起章节，使用上下方向键调整，空格或回车放下，Escape 取消。</span>
    {blocks.map((block, index) => {
      const fixed = isFixedChapter(block);
      const targetIndex = preview.findIndex(item => item.id === block.id);
      const dragging = drag?.id === block.id;
      const offset = drag ? dragging && !drag.keyboard ? drag.offset : drag.tops[targetIndex] - drag.tops[index] : 0;
      return <div key={block.id} data-chapter-id={block.id} data-fixed={fixed || undefined}
        className={`block-nav-item chapter-row ${selected === block.id ? 'active' : ''} ${block.visible ? '' : 'is-hidden'} ${dragging ? 'is-dragging' : ''}`}
        style={{ transform: offset ? `translateY(${offset}px)` : undefined }}>
        {fixed ? <span className="chapter-lock" title={block.type === 'intro' ? '固定开头' : '固定结尾'}><LockKeyhole size={13} /></span> :
          <button className="chapter-handle" disabled={disabled} aria-label={`拖动章节 · ${block.title || '未命名章节'}`} aria-describedby="chapter-drag-help" aria-pressed={dragging} title="拖动排序；也可按空格和方向键"
            onPointerDown={event => {
              if (event.button !== 0 || pointer.current || dragRef.current || disabled) return;
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              pointer.current = { id: block.id, pointerId: event.pointerId, startY: event.clientY, y: event.clientY, scrollTop: root.current?.closest('.block-nav')?.scrollTop ?? 0, active: false, handle: event.currentTarget, rects: measure() };
            }}
            onPointerMove={event => { if (pointer.current?.pointerId === event.pointerId) { pointer.current.y = event.clientY; updatePointer(); } }}
            onPointerUp={event => { if (pointer.current?.pointerId === event.pointerId) commit(); }}
            onPointerCancel={cancel}
            onLostPointerCapture={() => { if (pointer.current) cancel(); }}
            onKeyDown={event => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                if (dragRef.current?.id === block.id) commit();
                else if (!dragRef.current) { setCurrent({ id: block.id, target: index, offset: 0, keyboard: true, tops: measure().map(rect => rect.top) }); setAnnouncement(`已拾起${block.title}，使用上下方向键调整。`); }
              } else if (dragRef.current?.keyboard && dragRef.current.id === block.id && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const value = dragRef.current;
                const target = Math.max(first, Math.min(last, event.key === 'Home' ? first : event.key === 'End' ? last : value.target + (event.key === 'ArrowUp' ? -1 : 1)));
                setCurrent({ ...value, target });
                setAnnouncement(`将移到第 ${target + 1} 项。`);
              }
            }}><GripVertical size={15} /></button>}
        <button className="chapter-select" onClick={() => onSelect(block.id)} aria-current={selected === block.id ? 'true' : undefined}>
          <span className="chapter-number">{String(targetIndex + 1).padStart(2, '0')}</span>
          <span className="chapter-name">{block.title || '未命名章节'}{fixed && <small>{block.type === 'intro' ? '固定开头' : '固定结尾'}</small>}</span>
        </button>
        <button className="icon-button" aria-label={block.visible ? '隐藏章节' : '显示章节'} disabled={disabled || !!drag} onClick={() => onVisibility(block)}>{block.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
      </div>;
    })}
    {drag && <div className="chapter-drop-line" aria-hidden="true" style={{ top: (root.current?.querySelectorAll<HTMLElement>('[data-chapter-id]')[dragIndex]?.offsetTop ?? 0) + drag.tops[drag.target] - drag.tops[dragIndex] }} />}
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  </div>;
}
