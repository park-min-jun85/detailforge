import { useRef, useState } from "react";
import type { EditorSection } from "../schemas";
import { SECTION_LABELS, sectionTitle } from "../fields";
import styles from "./editor.module.css";
export function SectionNavigator({ sections, selectedId, disabled, canDrag, onSelect, onMove }: { sections: EditorSection[]; selectedId: string; disabled: boolean; canDrag: boolean;
  onSelect: (id: string) => void; onMove: (from: string, to: string) => void }) {
  const dragging = useRef<string | null>(null), [dragId, setDragId] = useState<string | null>(null), [overId, setOverId] = useState<string | null>(null);
  function end() { dragging.current = null; setDragId(null); setOverId(null); }
  return <nav className={styles.navigator} aria-label="Section Navigator"><h2 className={styles.panelTitle}>섹션 <span className="font-normal text-zinc-500">{sections.length}</span></h2>
    <p className="px-4 pt-3 text-xs leading-5 text-zinc-500">위·아래 버튼으로 이동하거나 항목을 끌어 순서를 바꾸세요.</p>
    <ol className="space-y-2 p-3">{sections.map((section, i) => <li key={section.id} className={styles.orderItem} data-dragging={dragId === section.id} data-drop-target={overId === section.id}
      draggable={!disabled && canDrag} onDragStart={event => { if (disabled || !canDrag) { event.preventDefault(); return; } dragging.current = section.id; setDragId(section.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", section.id); }}
      onDragEnd={end} onDragOver={event => { if (dragging.current && !disabled) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setOverId(section.id); } }}
      onDrop={event => { event.preventDefault(); if (dragging.current && !disabled) onMove(dragging.current, section.id); end(); }}>
      <button type="button" className={styles.navItem} aria-current={selectedId === section.id ? "true" : undefined} disabled={disabled} onClick={() => onSelect(section.id)}>
        <span className="block text-xs text-zinc-500">{i + 1}. {SECTION_LABELS[section.type]}</span><span className="mt-1 block truncate text-sm font-medium">{sectionTitle(section.content)}</span></button>
      <div className="flex gap-2 px-2 pb-2"><button type="button" className={styles.moveButton} aria-label={`${i + 1}. ${SECTION_LABELS[section.type]} 섹션 위로 이동`} disabled={disabled || i === 0} onClick={() => onMove(section.id, sections[i - 1].id)}>↑ 위로</button>
        <button type="button" className={styles.moveButton} aria-label={`${i + 1}. ${SECTION_LABELS[section.type]} 섹션 아래로 이동`} disabled={disabled || i === sections.length - 1} onClick={() => onMove(section.id, sections[i + 1].id)}>↓ 아래로</button></div>
    </li>)}</ol>
  </nav>;
}
