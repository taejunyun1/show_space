import {it,expect} from 'vitest';
import {newProject,copyProject} from './projects';
import {createDemoProject} from './model';
import {deriveFloor} from './floor';
it('creates the requested full-size empty exhibition room and outdoor option',()=>{
 const p=newProject({name:' 새 전시 ',venue:' 갤러리 ',widthMm:14000,depthMm:9000,heightMm:4500,outdoor:true});expect(p.name).toBe('새 전시');expect(p.venue).toBe('갤러리');expect(p.id).not.toBe(createDemoProject().id);expect(p.artworks).toEqual([]);expect(p.scenes).toEqual([]);expect(p.walls).toHaveLength(4);expect(p.walls.every(w=>w.heightMm===4500&&w.role==='boundary')).toBe(true);expect(deriveFloor(p.walls).surfaces).toHaveLength(1);expect(p.outdoor?.mode).toBe('outdoor');
});
it('duplicates the complete project as an independent identity without altering assets or placement',()=>{
 const p=createDemoProject();p.note='설치 계획';p.planImageUrl='data:image/png;base64,AAAA';const copy=copyProject(p);expect(copy.id).not.toBe(p.id);expect(copy.name).toBe(p.name+' 복사본');expect(copy.artworks).toEqual(p.artworks);expect(copy.planImageUrl).toBe(p.planImageUrl);copy.walls[0].start.x=123;expect(p.walls[0].start.x).toBe(-4000);
 p.name='기존 프로젝트 이름'.repeat(50);expect(copyProject(p,p.name).name).toBe(p.name);
});
it('rejects empty names and invalid dimensions',()=>{const good={name:'전시',venue:'',widthMm:8000,depthMm:6000,heightMm:3200};expect(()=>newProject({...good,name:' '})).toThrow();for(const invalid of [NaN,Infinity,0,200001])expect(()=>newProject({...good,widthMm:invalid})).toThrow();expect(()=>copyProject(createDemoProject(),'')).toThrow();});
