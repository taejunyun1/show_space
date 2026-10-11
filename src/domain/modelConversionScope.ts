import type {Project} from './types';
// Conversion replaces these fields. Compare their plain schema data without
// serializing uploaded image strings; project metadata/model notes can change.
const replaced=['walls','artworks','openings','dimensions','planDraft','planImageUrl','planReference','planLabels','planAnalysis','sourcePlan'] as const;
function equal(a:unknown,b:unknown):boolean{
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 if(Array.isArray(a)&&a.length!==(b as unknown[]).length)return false;
 const left=a as Record<string,unknown>,right=b as Record<string,unknown>,keys=Object.keys(left);
 return keys.length===Object.keys(right).length&&keys.every(k=>Object.hasOwn(right,k)&&equal(left[k],right[k]));
}
export function sameModelConversionSpace(a:Project,b:Project){return replaced.every(key=>equal(a[key],b[key]));}
