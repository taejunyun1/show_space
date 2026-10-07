import {beforeEach,expect,it} from 'vitest';
import {createDemoProject} from '../domain/model';
import {useEditor} from './editor';
beforeEach(()=>{const p=createDemoProject();useEditor.setState({project:p,hydrated:true,view:'3d',focusRequest:null,selected:[{type:'artwork',id:p.artworks[0].id}],message:null,previewProject:null,wallGesture:null,artworkGesture:null,lightGesture:null,modelArtworkGesture:null,outdoorGesture:null,rotatingArtworkId:null,past:[],future:[]});});
it('emits repeatable view-local focus requests without dirtying the project or history',()=>{
 const state=useEditor.getState(),project=state.project,selected=state.selected;state.focusSelected();const first=useEditor.getState().focusRequest!;expect(first).toEqual({token:1,projectId:project.id,view:'3d',selected});expect(first.selected).not.toBe(selected);expect(first.selected[0]).not.toBe(selected[0]);useEditor.setState({view:'plan'});state.focusSelected();expect(useEditor.getState().focusRequest?.token).toBe(2);expect(useEditor.getState().focusRequest?.view).toBe('plan');expect(useEditor.getState().project).toBe(project);expect(useEditor.getState().past).toEqual([]);expect(useEditor.getState().future).toEqual([]);
});
it('does not interrupt an active transform or create empty selection requests',()=>{
 useEditor.setState({selected:[]});useEditor.getState().focusSelected();expect(useEditor.getState().focusRequest).toBeNull();expect(useEditor.getState().message).toContain('선택');
 const p=useEditor.getState().project;useEditor.setState({selected:[{type:'wall',id:p.walls[0].id}],wallGesture:{id:p.walls[0].id,ids:[p.walls[0].id],mode:'move',start:{x:0,z:0},base:p},previewProject:{...p}});const before=useEditor.getState();before.focusSelected();expect(useEditor.getState().focusRequest).toBeNull();expect(useEditor.getState().previewProject).toBe(before.previewProject);expect(useEditor.getState().wallGesture).toBe(before.wallGesture);expect(useEditor.getState().message).toContain('마친 뒤');
});
