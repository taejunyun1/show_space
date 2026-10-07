import {afterEach,expect,it,vi} from 'vitest';
import {Group} from 'three';
import {createDemoProject} from '../domain/model';
import {addModelArtwork} from '../domain/modelArtworks';
import {testArtworkModel} from './modelArtworkTestFixture';
import {captureAssetsReady,captureModelBoundsKey,captureModelMatches,captureModelStatus,waitForCaptureAssets,type LoadedCaptureModel} from './captureAssets';

function fixture(){const project=createDemoProject();project.artworks=[];project.referenceModel=testArtworkModel();const added=addModelArtwork(project,testArtworkModel());return {project:added.project,art:added.artwork,scene:new Group()};}
function marker(name:string,model:Pick<ReturnType<typeof testArtworkModel>,'dataUrl'|'sizeMm'|'sourceOffsetM'>,phase:'ready'|'pending'|'failed'='ready',error=''){
 const group=new Group();group.name=name;group.userData.captureModel={dataUrl:model.dataUrl,boundsKey:captureModelBoundsKey(model),phase,error};return group;
}
afterEach(()=>{vi.useRealTimers();});
it('requires a loaded reference venue as well as every visible model artwork',()=>{
 const {project,art,scene}=fixture(),before=JSON.stringify(project);scene.add(marker(`capture-model-artwork-${art.id}`,art.model));expect(captureAssetsReady(scene,project)).toBe(false);
 scene.add(marker('capture-reference-model',project.referenceModel!));expect(captureAssetsReady(scene,project)).toBe(true);expect(JSON.stringify(project)).toBe(before);
});
it('does not accept a legacy mesh name, missing status or a previous model source or bounds',()=>{
 const {project,art,scene}=fixture();project.referenceModel=undefined;const old=new Group();old.name=`model-artwork-${art.id}`;scene.add(old);expect(captureAssetsReady(scene,project)).toBe(false);
 const m=marker(`capture-model-artwork-${art.id}`,art.model);scene.add(m);m.userData={};expect(captureAssetsReady(scene,project)).toBe(false);m.userData.captureModel={dataUrl:'old',boundsKey:captureModelBoundsKey(art.model),phase:'ready'};expect(captureAssetsReady(scene,project)).toBe(false);
 m.userData.captureModel.dataUrl=art.model.dataUrl;m.userData.captureModel.boundsKey='old bounds';expect(captureAssetsReady(scene,project)).toBe(false);
});
it('makes a stale success or failure pending before an effect can load a changed source',()=>{
 const model=testArtworkModel(),loaded:LoadedCaptureModel={dataUrl:model.dataUrl,boundsKey:captureModelBoundsKey(model),scene:new Group(),error:''};expect(captureModelMatches(model,loaded)).toBe(true);expect(captureModelStatus(model,loaded).phase).toBe('ready');
 const changed={...model,dataUrl:'replacement'};expect(captureModelMatches(changed,loaded)).toBe(false);expect(captureModelStatus(changed,loaded)).toMatchObject({phase:'pending',error:''});
 expect(captureModelStatus({...model,sizeMm:[1201,2100,900]},loaded).phase).toBe('pending');expect(captureModelStatus({...model,sourceOffsetM:[-11,-2,-5]},loaded).phase).toBe('pending');
 expect(captureModelStatus(changed,{...loaded,scene:null,error:'previous texture failure'})).toMatchObject({phase:'pending',error:''});expect(captureModelStatus(model,{...loaded,scene:null,error:'텍스처 실패'})).toMatchObject({phase:'failed',error:'텍스처 실패'});
});
it('ignores hidden models and images on hidden or deleted walls',()=>{
 const {project,scene}=fixture();project.referenceModel!.visible=false;project.modelArtworks![0].visible=false;const demo=createDemoProject();project.artworks=demo.artworks;project.walls=demo.walls.map(w=>({...w,visible:false}));expect(captureAssetsReady(scene,project)).toBe(true);
 project.walls=[];expect(captureAssetsReady(scene,project)).toBe(true);
});
it('requires explicit image readiness and reports known image failures immediately',()=>{
 const project=createDemoProject(),scene=new Group(),image=project.artworks[0];project.artworks=[image];const group=new Group();group.name=`artwork-${image.id}`;scene.add(group);expect(captureAssetsReady(scene,project)).toBe(false);group.userData.artworkImageReady=true;expect(captureAssetsReady(scene,project)).toBe(true);group.userData.artworkImageFailed=true;expect(()=>captureAssetsReady(scene,project)).toThrow('작품 이미지');
});
it('waits for loading models to become ready and stops requesting frames after success',async()=>{
 vi.useFakeTimers();const {project,art,scene}=fixture(),venue=marker('capture-reference-model',project.referenceModel!,'pending');scene.add(venue,marker(`capture-model-artwork-${art.id}`,art.model));const invalidate=vi.fn(),promise=waitForCaptureAssets(scene,project,invalidate);expect(invalidate).toHaveBeenCalledTimes(1);
 venue.userData.captureModel.phase='ready';await vi.advanceTimersByTimeAsync(60);await expect(promise).resolves.toBeUndefined();expect(vi.getTimerCount()).toBe(0);expect(invalidate).toHaveBeenCalledTimes(1);
});
it('propagates model failure even when another asset is still loading, without waiting ten seconds',async()=>{
 vi.useFakeTimers();const {project,art,scene}=fixture();scene.add(marker(`capture-model-artwork-${art.id}`,art.model,'pending'),marker('capture-reference-model',project.referenceModel!,'failed','3D 모델 텍스처를 읽지 못했습니다.'));const invalidate=vi.fn();await expect(waitForCaptureAssets(scene,project,invalidate)).rejects.toThrow('텍스처');expect(invalidate).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
it('rejects missing assets at the deadline and leaves no polling timers',async()=>{
 vi.useFakeTimers();const {project,scene}=fixture(),promise=waitForCaptureAssets(scene,project,()=>{}),assertion=expect(promise).rejects.toThrow('3D 모델');await vi.advanceTimersByTimeAsync(10100);await assertion;expect(vi.getTimerCount()).toBe(0);
});
it('checks the project guard before returning ready and on each pending poll',async()=>{
 vi.useFakeTimers();const {project,art,scene}=fixture();scene.add(marker(`capture-model-artwork-${art.id}`,art.model),marker('capture-reference-model',project.referenceModel!));const assertCurrent=()=>{throw new Error('전시 변경');};await expect(waitForCaptureAssets(scene,project,()=>{},assertCurrent)).rejects.toThrow('전시 변경');
 scene.clear();let current=true;const promise=waitForCaptureAssets(scene,project,()=>{},()=>{if(!current)throw new Error('다른 프로젝트');}),assertion=expect(promise).rejects.toThrow('다른 프로젝트');current=false;await vi.advanceTimersByTimeAsync(60);await assertion;expect(vi.getTimerCount()).toBe(0);
});
