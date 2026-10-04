import {describe,it,expect} from 'vitest';
import {displayLength,formatLength,lengthDraft,lengthFactor,lengthInMm,parseLengthUnit,readLengthDraft} from './lengthUnits';
import {createDemoProject,parseProject} from './model';
import {copyProject,newProject} from './projects';
import {createPublicShare,parsePublicShare} from './publicShare';

describe('project display units preserve canonical millimetres',()=>{
 it('round trips negative positions, fractional thickness, and venue sizes in all units',()=>{
  for(const unit of ['mm','cm','m'] as const)for(const mm of [-4000.125,0,0.01,900,3200,200000])expect(lengthInMm(displayLength(mm,unit),unit)).toBeCloseTo(mm,8);
  expect(formatLength(900,'cm')).toBe('90 cm');expect(formatLength(900,'m')).toBe('0.9 m');expect(formatLength(0.01,'m')).toBe('0.00001 m');
 });
 it('converts bounds before checking input, retains precise values on unchanged blur, and rejects invalid drafts',()=>{
  const v=900.123456,initial=lengthDraft(v,'m');expect(readLengthDraft(initial,initial,v,'m')).toBe(v);
  expect(readLengthDraft('0.92',initial,v,'m',1,50000)).toBe(920);
  expect(readLengthDraft('-4.5','0',0,'m',-5000,0)).toBe(-4500);
  for(const draft of ['', ' ', 'Infinity','NaN','-1','50.001'])expect(readLengthDraft(draft,initial,v,'m',1,50000)).toBeNull();
  expect(lengthFactor('cm')).toBe(10);expect(lengthDraft(0.01,'cm')).toBe('0.001');
 });
 it('loads legacy projects and rejects unsupported project/public snapshot units',()=>{
  const old=createDemoProject();expect(parseLengthUnit(parseProject(old).displayUnit)).toBe('mm');
  for(const unit of ['px','ft',null,100]){
   expect(()=>parseProject({...old,displayUnit:unit})).toThrow('표시 단위');
   expect(()=>parsePublicShare({...createPublicShare(old,{includeDimensions:true}).snapshot,displayUnit:unit})).toThrow('표시 단위');
  }
 });
 it('saves and copies the preference without rescaling geometry or assets and carries it to read-only sharing',()=>{
  const source=createDemoProject(),p=parseProject({...source,displayUnit:'m'});
  expect(p.walls).toEqual(source.walls);expect(p.artworks).toEqual(source.artworks);
  const loaded=parseProject(JSON.parse(JSON.stringify(p)));expect(loaded.displayUnit).toBe('m');expect(copyProject(loaded).displayUnit).toBe('m');
  const publicScene=createPublicShare(p,{includeDimensions:true}).snapshot;expect(parsePublicShare(publicScene).displayUnit).toBe('m');expect(publicScene.walls[0].heightMm).toBe(3200);expect(publicScene.artworks[0].widthMm).toBe(900);
  const fresh=newProject({name:'미터 공간',venue:'',widthMm:8000,depthMm:6000,heightMm:3200,displayUnit:'m'});expect(fresh.displayUnit).toBe('m');expect(fresh.walls[0].start.x).toBe(-4000);
 });
});
