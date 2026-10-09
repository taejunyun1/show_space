import {useEffect,useRef,useState} from 'react';
import {useEditor} from '../state/editor';

function selectionContext(state:ReturnType<typeof useEditor.getState>){
 const selected=state.selected[0];
 if(!selected)return '';
 const list=selected.type==='artwork'?state.project.artworks:selected.type==='wall'?state.project.walls:selected.type==='light'?state.project.lights:state.project.modelArtworks;
 const entity=list?.find(item=>item.id===selected.id);
 return `${selected.type}:${selected.id}:${!!entity}:${entity?.locked??false}`;
}
/** Edit drafts and deferred media belong to a single project/primary selection.
 * Store subscription catches transitions even when React batches A→B→A. */
export function useEditorEditScope(trackSelection=true){
 const epoch=useRef(0),alive=useRef(false),[version,setVersion]=useState(0);
 useEffect(()=>{
  alive.current=true;setVersion(epoch.current);
  const unsubscribe=useEditor.subscribe((next,previous)=>{
   if(next.project.id===previous.project.id&&(!trackSelection||selectionContext(next)===selectionContext(previous)))return;
   epoch.current++;setVersion(epoch.current);
  });
  return()=>{alive.current=false;epoch.current++;unsubscribe();};
 },[trackSelection]);
 return {version,current:()=>alive.current&&version===epoch.current};
}
