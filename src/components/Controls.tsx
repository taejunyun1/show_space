import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
export function IconButton({ label, children, onClick, active, disabled }: { label: string; children: ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean }) {
  return <button type="button" className={`icon-button ${active ? 'active' : ''}`} title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>;
}
export function NumberField({ label, value, onChange, disabled, min, max, step = 10, suffix = 'mm' }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean; min?: number; max?: number; step?: number; suffix?: string }) {
  const [draft, setDraft] = useState(String(Math.round(value * 100) / 100));
  useEffect(() => setDraft(String(Math.round(value * 100) / 100)), [value]);
  function commit() {
    const n = Number(draft);
    if (draft.trim() && Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) { if (n !== value) onChange(n); }
    else setDraft(String(value));
  }
  return <label className="number-field"><span>{label}</span><div><input aria-label={label} type="number" value={draft} step={step} min={min} max={max} disabled={disabled} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /><span className="unit">{suffix}</span></div></label>;
}

export function TextEditor({value, onCommit, label, multiline = false, placeholder}: {value:string; onCommit:(value:string)=>void; label:string; multiline?:boolean; placeholder?:string}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => { if (draft !== value) onCommit(draft); };
  return multiline ? <textarea aria-label={label} value={draft} placeholder={placeholder} onChange={e=>setDraft(e.target.value)} onBlur={commit} /> : <input aria-label={label} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} />;
}
