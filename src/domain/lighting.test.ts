import {expect,it} from 'vitest';
import {createDemoProject,parseProject,duplicateSelection,deleteSelection} from './model';
import {newLight,parseLight,parseLights,parseLighting,patchLight,translatedLight,kelvinRgb,spotShadowIds,DEFAULT_LIGHTING} from './lighting';
import {createPublicShare,parsePublicShare} from './publicShare';
it('validates type, physical ranges, aim and unique IDs without accepting unknown fields',()=>{
 const p=createDemoProject(),l=newLight(p,'spot');expect(parseLight({...l,privateData:'SECRET'})).toEqual(l);
 for(const patch of [{kelvin:2699},{intensity:Infinity},{beamDeg:151},{penumbra:2},{widthMm:0},{position:{...l.position,x:NaN}},{target:l.position},{shadow:1}])expect(()=>parseLight({...l,...patch})).toThrow();
 expect(()=>parseLights([l,l])).toThrow(/중복/);expect(()=>parseLights([{...l,id:'wall-a'}],['wall-a'])).toThrow();expect(()=>parseLights(Array.from({length:21},(_,i)=>({...l,id:`l-${i}`})))).toThrow(/20/);expect(()=>parseLighting({...DEFAULT_LIGHTING,ambient:-1})).toThrow();
 p.lights=[l];p.lighting=DEFAULT_LIGHTING;expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
 p.lights[0].id='artwork-1';expect(()=>parseProject(p)).toThrow(/중복/);
});
it('translates the aim with the fixture, duplicates independently and protects locked lights',()=>{
 const p=createDemoProject(),l=newLight(p,'spot');p.lights=[l];const moved=translatedLight(l,{...l.position,x:l.position.x+400});expect(moved.target.x-l.target.x).toBe(400);expect(moved.target.z).toBe(l.target.z);
 const {project,selection}=duplicateSelection(p,{type:'light',id:l.id});expect(selection.type).toBe('light');expect(project.lights).toHaveLength(2);expect(project.lights![1].target.x-l.target.x).toBe(400);expect(p.lights).toHaveLength(1);
 const locked=patchLight(p,l.id,{locked:true});expect(()=>patchLight(locked,l.id,{intensity:1})).toThrow(/잠긴/);expect(()=>deleteSelection(locked,{type:'light',id:l.id})).toThrow();expect(patchLight(locked,l.id,{visible:false}).lights![0].visible).toBe(false);
 expect(deleteSelection(project,selection).lights).toEqual([l]);
 const boundary={...p,lights:[{...l,position:{...l.position,x:999900},target:{...l.target,x:999000}}]};expect(()=>duplicateSelection(boundary,{type:'light',id:l.id})).toThrow(/범위/);
});
it('approximates warm and neutral color and budgets only visible emitting Spot shadows',()=>{
 const warm=kelvinRgb(2700),neutral=kelvinRgb(6500);expect(warm[0]).toBe(1);expect(warm[2]).toBeLessThan(neutral[2]);expect(neutral[2]).toBeGreaterThan(.97);
 const l=newLight(createDemoProject(),'spot'),list=Array.from({length:7},(_,i)=>({...l,id:`l${i}`}));list[0].visible=false;list[1].kind='area';list[2].intensity=0;expect(spotShadowIds(list)).toEqual(['l3','l4','l5','l6']);list.push({...l,id:'extra'});expect(spotShadowIds(list)).not.toContain('extra');
});
it('shares visible lighting only and strips private notes/locks/foreign fields on the server',()=>{
 const p=createDemoProject(),l=newLight(p,'spot');p.lights=[{...l,note:'SECRET',locked:true},{...l,id:'hidden-light',visible:false}];p.lighting=DEFAULT_LIGHTING;
 const {snapshot}=createPublicShare(p,{includeDimensions:false});expect(snapshot.lights).toHaveLength(1);expect(snapshot.lighting).toEqual(DEFAULT_LIGHTING);expect(JSON.stringify(snapshot)).not.toContain('SECRET');expect(snapshot.lights![0]).not.toHaveProperty('locked');
 const clean=parsePublicShare({...snapshot,lights:snapshot.lights!.map(l=>({...l,note:'SECRET',locked:true,external:'SECRET'})),lighting:{...DEFAULT_LIGHTING,secret:'SECRET'}});expect(JSON.stringify(clean)).not.toContain('SECRET');
 expect(()=>parsePublicShare({...snapshot,lights:[{...snapshot.lights![0],kelvin:0}]})).toThrow();expect(()=>parsePublicShare({...snapshot,lights:[{...snapshot.lights![0],id:'wall-a'}]})).toThrow();
});
