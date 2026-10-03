import {describe,it,expect} from 'vitest';
import {Mesh,Group} from 'three';
import {editorHits3d} from './editorHits3d';
describe('editor pointer hits',()=>{
 it('gives an intentional overlay handle priority without exposing hidden walls',()=>{
  const wall=new Mesh(),hidden=new Mesh(),handle=new Mesh(),cutaway=new Group();
  hidden.visible=false;cutaway.visible=false;cutaway.add(hidden);
  handle.visible=false;handle.userData.lightMoveHandle=true;
  const hits=[{object:wall,distance:1},{object:hidden,distance:2},{object:handle,distance:3}];
  expect(editorHits3d(hits).map(hit=>hit.object)).toEqual([handle,wall]);
 });
});
