import { describe, expect, it } from 'vitest';
import { detectPlanLabels, transformPlanLabels, validatePlanLabels, type PlanText } from './planLabels';
const text = (value:string, x=10, y=20):PlanText => ({text:value,box:{x,y,width:40,height:10},source:'pdf-text'});
describe('plan semantic text candidates',()=>{
 it('recognizes Korean and English facilities without claiming footprints',()=>{
  const labels=detectPlanLabels(['출입구','AIR CONDITIONER','소화전','fire extinguisher','계단','COLUMN','DOOR','UP'].map(t=>text(t)));
  expect(labels.map(l=>l.kind)).toEqual(['entrance','air-conditioner','fire-hydrant','fire-extinguisher','stairs','column','door','stairs']);
  expect(labels.every(l=>l.status==='unreviewed' && l.note.includes('문자 위치'))).toBe(true);
 });
 it('does not infer facilities from substrings',()=>{
  expect(detectPlanLabels(['SPACE','BACKGROUND','STAIRLESS','문자','MAIN EXHIBITION'].map(t=>text(t)))).toEqual([]);
  expect(detectPlanLabels(['AC','A.C.','DN','비상구','냉난방기'].map(t=>text(t)))).toHaveLength(5);
 });
 it('accepts explicit dimension units but does not interpret measured wall geometry',()=>{
  const labels=detectPlanLabels(['3200 mm','높이 3.2m','H=12 ft',`8\' 6"`,'230cm','5 in'].map(t=>text(t)));
  expect(labels).toHaveLength(6);
  expect(labels.every(l=>l.kind==='dimension')).toBe(true);
 });
 it('keeps source confidence and limits result count',()=>{
  const labels=detectPlanLabels(Array.from({length:510},()=>({...text('소화전'),source:'ocr' as const,confidence:72})));
  expect(labels).toHaveLength(500);
  expect(labels[0]).toMatchObject({source:'ocr',confidence:72});
  expect(new Set(labels.map(l=>l.id)).size).toBe(500);
 });
});
describe('label transforms and persistence validation',()=>{
 const label=()=>detectPlanLabels([text('출입구')])[0];
 it('rotates clockwise and crops in rotated coordinates, preserving review state',()=>{
  const l={...label(),status:'confirmed' as const};
  expect(transformPlanLabels([l],100,200,90,{x:160,y:0,width:40,height:60})[0]).toMatchObject({box:{x:10,y:10,width:10,height:40},status:'confirmed'});
  expect(transformPlanLabels([l],100,200,180)[0].box).toEqual({x:50,y:170,width:40,height:10});
  expect(transformPlanLabels([l],100,200,270)[0].box).toEqual({x:20,y:50,width:10,height:40});
 });
 it('excludes partial and outside labels instead of creating misleading truncated labels',()=>{
  expect(transformPlanLabels([label()],100,200,0,{x:20,y:0,width:80,height:200})).toEqual([]);
  expect(transformPlanLabels([label()],100,200,0,{x:0,y:0,width:50,height:30})).toHaveLength(1);
 });
 it('rejects invalid and duplicate stored labels',()=>{
  const l=label();
  for(const bad of [null,{},[l,l],[{...l,kind:'secret'}],[{...l,status:'trusted'}],[{...l,source:'ai'}],[{...l,confidence:101}],[{...l,box:{...l.box,x:-1}}],[{...l,box:{...l.box,width:Infinity}}],[{...l,text:'x'.repeat(2001)}]]) expect(()=>validatePlanLabels(bad,100,200)).toThrow();
  expect(()=>validatePlanLabels([{...l,box:{...l.box,x:99}}],100,200)).toThrow();
  expect(validatePlanLabels([l],100,200)).toEqual([l]);
  expect(validatePlanLabels([l],100,200)[0]).not.toBe(l);
 });
 it('rejects invalid rotation and crop instead of silently distorting candidates',()=>{
  expect(()=>transformPlanLabels([label()],100,200,45 as 90)).toThrow();
  expect(()=>transformPlanLabels([label()],100,200,90,{x:190,y:0,width:30,height:20})).toThrow();
 });
});
it('preserves corrected numeric text and rejects invalid persisted corrections',()=>{
 const l={...detectPlanLabels([text('3200')])[0],correctedText:'3200 mm'};
 expect(validatePlanLabels([l],100,200)[0]).toEqual(l);
 expect(transformPlanLabels([l],100,200,90)[0].correctedText).toBe('3200 mm');
 for(const correctedText of ['',42,'x'.repeat(2001)])expect(()=>validatePlanLabels([{...l,correctedText}],100,200)).toThrow();
});

it('recognizes explicit fire-hose signage without interpreting ordinary hoses as equipment',()=>{
 expect(detectPlanLabels([text('FIRE HOSE REEL CABINET')]).map(l=>l.kind)).toEqual(['fire-hydrant']);
 expect(detectPlanLabels([text('garden hose')])).toEqual([]);
});
