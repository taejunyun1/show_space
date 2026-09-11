import {it,expect} from 'vitest';
import {readUnitDeclaration,pageUnit} from './planUnits';
import {detectPlanLabels,validatePlanLabels} from './planLabels';
const labels=(texts:string[])=>detectPlanLabels(texts.map(text=>({text,source:'pdf-text',box:{x:0,y:0,width:100,height:20}})));
it('recognizes explicit sheet units and preserves them in stored labels',()=>{for(const text of ['All measurements in cm','All dimensions are in centimeters.','단위: cm','전체 치수 단위 cm'])expect(readUnitDeclaration(text)).toBe('cm');const l=labels(['All measurements in cm']);expect(validatePlanLabels(l,100,100)[0].kind).toBe('unit');expect(pageUnit(l)).toEqual({unit:'cm',conflict:false});});
it('rejects local object units, area and unclear declarations',()=>{for(const text of ['Ceiling height: 275cm','dimensions in cm','Door dimensions in mm','All measurements in cm or mm','All measurements in sqm'])expect(readUnitDeclaration(text)).toBeUndefined();});
it('withholds conflicting declarations and low OCR confidence',()=>{expect(pageUnit(labels(['All measurements in cm','단위: mm'])).conflict).toBe(true);expect(pageUnit(labels(['단위: mm']).map(l=>({...l,source:'ocr',confidence:70}))).unit).toBeUndefined();});
