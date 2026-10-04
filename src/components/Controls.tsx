import {lengthDraft, lengthFactor, readLengthDraft} from '../domain/lengthUnits';
import {useLengthUnit} from './LengthUnits';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
export function IconButton({ label, children, onClick, active, disabled }: { label: string; children: ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean }) {
  return <button type="button" className={`icon-button ${active ? 'active' : ''}`} title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>;
}
export function NumberField({ label, value, onChange, disabled, min, max, step = 10, suffix = 'mm', precision = 2 }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean; min?: number; max?: number; step?: number; suffix?: string; precision?:number }) {
  const selectedUnit = useLengthUnit(), unit = suffix === 'mm' ? selectedUnit : 'mm';
  const initial = lengthDraft(value, unit, precision), factor = lengthFactor(unit);
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial, value, unit]);
  function commit() {
    const n = readLengthDraft(draft, initial, value, unit, min, max);
    if (n !== null) { if (n !== value) onChange(n); }
    else setDraft(initial);
  }
  return <label className="number-field"><span>{label}</span><div><input aria-label={label} type="number" value={draft} step={step / factor} min={min === undefined ? undefined : min / factor} max={max === undefined ? undefined : max / factor} disabled={disabled} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /><span className="unit">{suffix === 'mm' ? selectedUnit : suffix}</span></div></label>;
}

export function TextEditor({value, onCommit, label, multiline = false, placeholder,disabled,maxLength}: {value:string;disabled?:boolean;maxLength?:number; onCommit:(value:string)=>void; label:string; multiline?:boolean; placeholder?:string}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => { if (draft !== value) onCommit(draft); };
  return multiline ? <textarea aria-label={label} maxLength={maxLength} disabled={disabled} value={draft} placeholder={placeholder} onChange={e=>setDraft(e.target.value)} onBlur={commit} /> : <input aria-label={label} maxLength={maxLength} disabled={disabled} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} />;
}
