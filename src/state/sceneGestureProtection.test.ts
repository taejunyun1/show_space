import {beforeEach,expect,it} from 'vitest';
import {useEditor} from './editor';
import {createDemoProject} from '../domain/model';
beforeEach(()=>useEditor.getState().loadProject({...createDemoProject(),scenes:[]},true));
it.each(['previewProject','wallGesture','artworkGesture','lightGesture','modelArtworkGesture','outdoorGesture','rotatingArtworkId'] as const)('refuses Scene commit while %s is active, retaining the gesture and history',key=>{
 const p=useEditor.getState().project;
 // Only the selected flag matters here; separate pointer tests create real gestures.
 useEditor.setState({[key]:key==='previewProject'?structuredClone(p):key==='rotatingArtworkId'?p.artworks[0].id:{id:p.artworks[0].id,base:p}} as unknown as Partial<ReturnType<typeof useEditor.getState>>);const before=useEditor.getState();expect(useEditor.getState().saveScene('보류')).toBe(false);for(const field of ['project','past','future','selected',key] as const)expect(useEditor.getState()[field]).toBe(before[field]);expect(useEditor.getState().message).toMatch(/이동·회전/);
});
