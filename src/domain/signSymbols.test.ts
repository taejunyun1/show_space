import {expect,it} from 'vitest';
import {fireHoseTemplate} from './fireHoseTemplate';
import {matchFireHoseSymbol,mergeSignSymbol} from './signSymbols';
import {validatePlanLabels,transformPlanLabels} from './planLabels';
const pixels=(color=[230,0,0])=>{
 const data=new Uint8ClampedArray(32*46*4);
 for(let y=0;y<46;y++)for(let x=0;x<32;x++)data.set([...(y<32&&fireHoseTemplate[y][x]==='1'?[255,255,255]:color),255],(y*32+x)*4);
 return data;
};
it('recognizes the known pictogram without depending on footer text',()=>{
 const data=pixels();expect(matchFireHoseSymbol(data,32,46)?.similarity).toBe(1);
 data.fill(0,32*32*4);expect(matchFireHoseSymbol(data,32,46)?.similarity).toBe(1);
});
it('rejects green signs, blank red panels, removed hose shapes and malformed rasters',()=>{
 expect(matchFireHoseSymbol(pixels([0,180,0]),32,46)).toBeUndefined();
 const blank=pixels();for(let y=8;y<26;y++)for(let x=7;x<25;x++)blank.set([230,0,0,255],(y*32+x)*4);
 expect(matchFireHoseSymbol(blank,32,46)).toBeUndefined();
 expect(matchFireHoseSymbol(new Uint8ClampedArray(32*46*4).fill(255),32,46)).toBeUndefined();
 expect(matchFireHoseSymbol(pixels(),46,32)).toBeUndefined();
 expect(matchFireHoseSymbol(pixels().slice(4),32,46)).toBeUndefined();
});
it('preserves symbol provenance through validation and rotation without inventing OCR confidence',()=>{
 const labels=mergeSignSymbol([],{x:20,y:30,width:32,height:46},matchFireHoseSymbol(pixels(),32,46));
 expect(labels[0]).toMatchObject({kind:'fire-hydrant',source:'symbol'});expect(labels[0].confidence).toBeUndefined();
 expect(validatePlanLabels(labels,200,200)).toEqual(labels);
 expect(transformPlanLabels(labels,200,200,90)[0]).toMatchObject({source:'symbol',box:{x:124,y:20,width:46,height:32}});
 expect(mergeSignSymbol(labels,labels[0].box,matchFireHoseSymbol(pixels(),32,46))).toBe(labels);
 const dismissed=labels.map(l=>({...l,status:'dismissed' as const}));
 expect(mergeSignSymbol(dismissed,labels[0].box,matchFireHoseSymbol(pixels(),32,46))).toBe(dismissed);
});
