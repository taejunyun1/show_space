import type {PlanLabel} from './planLabels';
export type PlanUnit='mm'|'cm'|'m';
/** Only an explicit whole-sheet declaration supplies a default; local measurements do not. */
export function readUnitDeclaration(value:string):PlanUnit|undefined{
 const text=value.normalize('NFKC').trim();
 const match=text.match(/^(?:all\s+(?:measurements|dimensions)\s+(?:are\s+)?(?:given\s+)?in\s*|(?:전체\s*|모든\s*)?(?:치수\s*)?단위\s*[:：=]?\s*)(mm|cm|m|millimet(?:er|re)s?|centimet(?:er|re)s?|met(?:er|re)s?)(?:\s*\.?\s*(?:unless otherwise (?:noted|specified))?\s*\.?)$/i);
 if(!match)return undefined;const unit=match[1].toLowerCase();return unit==='mm'||unit.startsWith('milli')?'mm':unit==='cm'||unit.startsWith('centi')?'cm':'m';
}
export function pageUnit(labels:PlanLabel[]):{unit?:PlanUnit;conflict:boolean}{
 const units=labels.filter(l=>l.kind==='unit'&&l.status!=='dismissed'&&(l.source==='pdf-text'||(l.confidence??0)>=90)).flatMap(l=>{const unit=readUnitDeclaration(l.correctedText??l.text);return unit?[unit]:[];});
 const unique=[...new Set(units)];return {unit:unique.length===1?unique[0]:undefined,conflict:unique.length>1};
}
