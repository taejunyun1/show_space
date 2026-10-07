import {beforeEach,expect,it} from 'vitest';
import {createDemoProject} from '../domain/model';
import {useEditor} from './editor';

beforeEach(()=>useEditor.getState().loadProject(createDemoProject()));
it('rejects a stale project target at the command boundary without changing redo or selection',()=>{
 useEditor.getState().addArtwork();useEditor.getState().undo();const before=useEditor.getState();useEditor.getState().addArtwork(undefined,'과거 파일',{projectId:'previous-project',wallId:before.project.walls[0].id});const after=useEditor.getState();expect(after.project).toBe(before.project);expect(after.past).toBe(before.past);expect(after.future).toBe(before.future);expect(after.selected).toBe(before.selected);expect(after.message).toContain('프로젝트가 바뀌어');
});
it('rejects a removed explicit wall without falling back to the currently selected wall',()=>{
 const p=createDemoProject(),wallId=p.walls[1].id;p.walls=p.walls.filter(w=>w.id!==wallId);p.artworks=p.artworks.filter(a=>a.wallId!==wallId);useEditor.getState().loadProject(p);const before=useEditor.getState();useEditor.getState().addArtwork(undefined,'사라진 벽 파일',{projectId:p.id,wallId});expect(useEditor.getState().project).toBe(before.project);expect(useEditor.getState().past).toBe(before.past);expect(useEditor.getState().selected).toBe(before.selected);expect(useEditor.getState().message).toContain('설치 벽');
});
