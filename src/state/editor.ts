import {installArtworkTemplate,type ArtworkTemplate} from '../domain/artworkLibrary';
import {layoutArtworks,type ArtworkLayout} from '../domain/artworkLayout';
import {updateNote,preserveCurrentNotes,validateProjectNotes,type NoteTarget,type NoteDetails} from '../domain/notes';
import {addModelArtwork as addModelArtworkToProject,patchModelArtwork as updateModelArtwork,modelArtworkMembers,groupModelArtworks,transformModelArtworks,modelArtworkBounds} from '../domain/modelArtworks';
import {parseOutdoor,DEFAULT_OUTDOOR,type OutdoorSettings} from '../domain/outdoor';
import {newLight,patchLight as updateLight,parseLighting,translatedLight,CUSTOM_LIGHTING,DEFAULT_LIGHTING,type ExhibitionLight,type LightingSettings} from '../domain/lighting';
import {adoptModelSpace,sameModelGeometry} from '../domain/modelSpace'
import {artworkGroupMembers,groupArtworks,ungroupArtworks,patchGroupedArtwork} from '../domain/artworkGroups'
import { create } from 'zustand'
import {
  addArtwork as addArtworkToProject,
  addWall as addWallToProject,
  createDemoProject,
  deleteSelection,
  duplicateSelection,
  parseProject,
  placeUnplacedArtwork,
  restoreDemoBoundary,
  updateArtwork,
  updateWall,
} from '../domain/model'
import type { Artwork, CameraView, EntitySelection, MeasurementAnchor, Project, ReferenceModel, SavedDimension, Wall, ModelArtwork, WorldPoint } from '../domain/types'
import type {Point} from '../domain/types'
import {snapWallTranslation,transformWalls} from '../domain/wallTransform'
import {addWallBetween,updateWallEndpoint} from '../domain/wallEditing'
import {addMeasurement,measureDistance,resolveAnchor} from '../domain/measurements'
import { readDraft, writeDraft } from '../lib/persistence'
import {draggedArtworkPlacement,type ArtworkFacePoint} from '../domain/artworkDrag3d'

export type View = '3d' | 'plan' | 'elevation'
type SaveStatus = 'loading' | 'saved' | 'saving' | 'error'
type EditTool = 'select' | 'pan' | 'move' | 'rotate' | 'draw' | 'measure'
interface WallGesture {id:string;ids:string[];mode:'move'|'rotate';start:Point;base:Project}
interface ArtworkGesture {id:string;grab:ArtworkFacePoint;base:Project}
type ArtworkDragHit=ArtworkFacePoint&{wallId?:string;wallSide?:'front'|'back'}
interface MeasurementDraft {view:View; elevationWallId?:string;start:MeasurementAnchor;end?:MeasurementAnchor}

interface EditorState {
  project: Project
  previewProject: Project | null
  wallGesture: WallGesture | null
  artworkGesture: ArtworkGesture | null
  rotatingArtworkId:string|null
  activeTool: EditTool
  measurementDraft:MeasurementDraft|null
  linkedCorners: boolean
  selected: EntitySelection[]
  view: View
  activeWallId: string
  showDimensions: boolean
  captureClean:boolean
  captureDimensions:boolean
  saveStatus: SaveStatus
  message: string | null
  past: Project[]
  future: Project[]
  hydrated: boolean
  select(selection: EntitySelection, additive?: boolean): void
  setTool(tool:EditTool):void
  pickMeasurement(anchor:MeasurementAnchor,view:View,elevationWallId?:string):void
  saveMeasurement():void
  clearMeasurement():void
  deleteMeasurement(id:string):void
  patchMeasurement(id:string,patch:Pick<Partial<SavedDimension>,'offsetMm'>):void
  setLinkedCorners(linked:boolean):void
  beginWallTransform(id:string,mode:'move'|'rotate',start:Point):void
  updateWallTransform(point:Point,snap?:boolean):void
  finishWallTransform(cancel?:boolean):void
  beginArtworkDrag(id:string,hit:ArtworkFacePoint):void
  updateArtworkDrag(hit:ArtworkDragHit):void
  finishArtworkDrag(cancel?:boolean):void
  setArtworkRotationActive(id:string|null):void
  setView(view: View): void
  setActiveWall(id: string): void
  toggleDimensions(): void
  setCaptureMode(clean:boolean,includeDimensions?:boolean):void
  notify(message: string | null): void
  commit(next: Project): void
  addLight(kind:'spot'|'area'):void
  patchLight(id:string,patch:Partial<ExhibitionLight>):void
  patchLighting(patch:LightingSettings):void
  outdoorGesture:{base:Project}|null
  patchOutdoor(settings:OutdoorSettings):void
  beginOutdoorTime():void
  updateOutdoorTime(time:string):void
  finishOutdoorTime(cancel?:boolean):void
  modelArtworkGesture:{id:string;ids:string[];base:Project}|null
  addModelArtwork(model:ReferenceModel,expectedProjectId:string):void
  patchModelArtwork(id:string,patch:Partial<ModelArtwork>):void
  groupSelectedModelArtworks(ungroup?:boolean):void
  beginModelArtworkTransform(id:string):void
  updateModelArtworkTransform(position:WorldPoint,rotation:WorldPoint):void
  finishModelArtworkTransform(cancel?:boolean):void
  floorSelectedModelArtwork():void
  lightGesture:{id:string;base:Project}|null
  beginLightMove(id:string):void
  updateLightMove(position:import('../domain/types').WorldPoint):void
  finishLightMove(cancel?:boolean):void
  patchArtwork(id: string, patch: Partial<Artwork>): void
  patchWall(id: string, patch: Partial<Wall>): void
  moveWallEndpoint(id:string,endpoint:'start'|'end',point:Point):void
  patchNote(target:NoteTarget,patch:{text?:string;details?:NoteDetails}):void
  renameProject(name: string): void
  patchProject(patch: Pick<Partial<Project>, 'referenceModel' | 'floorColor' | 'floorMaterial' | 'venue' | 'planImageUrl' | 'planOpacity' | 'planReference' | 'planLabels' | 'planAnalysis' | 'sourcePlan' | 'planDraft'>): void
  addArtwork(imageUrl?: string, name?: string): void
  installLibraryArtwork(template:ArtworkTemplate,expectedProjectId:string,wallId?:string):void
  placeUnplaced(id:string):void
  adoptModelWalls(walls:Wall[],expected:ReferenceModel,importedFloor?:Point[][]):void
  restoreDemoSpace():void
  addWall(): void
  drawWall(start:Point,end:Point):void
  groupSelectedArtworks(): void
  ungroupSelectedArtworks(): void
  groupSelectedWalls(): void
  ungroupSelectedWalls(): void
  duplicateSelected(): void
  lockSelected(locked:boolean):void
  deleteSelected(): void
  spaceSelected(gap: number): void
  layoutSelectedArtworks(layout:ArtworkLayout):void
  undo(): void
  redo(): void
  loadProject(project: Project, alreadySaved?:boolean): void
  saveScene(name: string,cameraView?:CameraView): void
  restoreScene(id: string): void
  deleteScene(id: string): void
}

const clone = <T,>(value: T): T => structuredClone(value)

function firstSelection(project: Project): EntitySelection[] {
  if (project.artworks[0]) return artworkGroupMembers(project,project.artworks[0].id).map(a=>({type:'artwork',id:a.id}))
  if(project.modelArtworks?.[0])return [{type:'modelArtwork',id:project.modelArtworks[0].id}]
  if (project.walls[0]) return [{ type: 'wall', id: project.walls[0].id }]
  return []
}

function groupMembers(project:Project,id:string):EntitySelection[] {
  const wall=project.walls.find(w=>w.id===id);
  return project.walls.filter(w=>w.id===id || !!wall?.groupId && w.groupId===wall.groupId).map(w=>({type:'wall',id:w.id}));
}

function validSelection(project: Project, selected: EntitySelection[]) {
  return selected.filter((selection) => selection.type === 'artwork'
    ? project.artworks.some((artwork) => artwork.id === selection.id)
    : selection.type==='modelArtwork'?project.modelArtworks?.some(a=>a.id===selection.id):selection.type==='light'?project.lights?.some(l=>l.id===selection.id):project.walls.some((wall) => wall.id === selection.id))
}

function selectedModelArtworkIds(project:Project,selected:EntitySelection[],id:string){return selected.some(i=>i.type==='modelArtwork'&&i.id===id)?[...new Set(selected.filter(i=>i.type==='modelArtwork').flatMap(i=>modelArtworkMembers(project,i.id).map(a=>a.id)))]:modelArtworkMembers(project,id).map(a=>a.id);}

function validWall(project: Project, preferred: string) {
  return project.walls.some((wall) => wall.id === preferred) ? preferred : (project.walls[0]?.id ?? '')
}

function safeView(project:Project,view:View):View {
  return project.planDraft&&!project.planReference?.calibrated?'plan':view
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '작업을 완료할 수 없습니다.'
}

const initialProject = createDemoProject()
let savedSnapshot:Project|undefined;

export const useEditor = create<EditorState>((set, get) => {
  const attempt = (operation: () => void) => {
    try { operation() } catch (error) { set({ message: errorMessage(error) }) }
  }
  return {
    project: initialProject,
    lightGesture:null,modelArtworkGesture:null,outdoorGesture:null,
    previewProject: null,
    wallGesture: null,
    artworkGesture:null,
    rotatingArtworkId:null,
    activeTool: 'select',
    measurementDraft:null,
    linkedCorners: true,
    selected: firstSelection(initialProject),
    view: '3d',
    activeWallId: 'wall-a',
    showDimensions: true,
    captureClean:false,
    captureDimensions:true,
    saveStatus: 'loading',
    message: null,
    past: [],
    future: [],
    hydrated: false,
    select: (selection, additive = false) => set((state) => {
      const members=selection.type==='wall'?groupMembers(state.project,selection.id):selection.type==='light'?[selection]:selection.type==='modelArtwork'?modelArtworkMembers(state.project,selection.id).map(a=>({type:'modelArtwork' as const,id:a.id})):artworkGroupMembers(state.project,selection.id).map(a=>({type:'artwork' as const,id:a.id}));
      const matches=(item:EntitySelection)=>members.some(member=>member.type===item.type&&member.id===item.id);
      const selected = !additive ? members : members.every(member=>state.selected.some(item=>item.type===member.type&&item.id===member.id))
        ? state.selected.filter(item=>!matches(item)) : [...state.selected.filter(item=>!matches(item)),...members];
      const artwork = selection.type === 'artwork' ? state.project.artworks.find((item) => item.id === selection.id) : undefined
      return { selected, activeWallId: selection.type === 'wall' ? selection.id : (artwork?.wallId ?? state.activeWallId) }
    }),
    setTool: (activeTool) => set({activeTool,measurementDraft:null,previewProject:null,wallGesture:null,artworkGesture:null,lightGesture:null,modelArtworkGesture:null,outdoorGesture:null,rotatingArtworkId:null}),
    pickMeasurement: (anchor,view,elevationWallId) => attempt(()=>{
      const state=get(),current=state.measurementDraft;
      const next:MeasurementDraft= !current||current.end||current.view!==view||current.elevationWallId!==elevationWallId
        ? {view,elevationWallId,start:anchor}:{...current,end:anchor};
      if(next.end&&measureDistance(resolveAnchor(state.project,next.start).point,resolveAnchor(state.project,next.end).point)<1)throw new Error('서로 다른 두 점을 선택해 주세요.');
      set({measurementDraft:next,message:null});
    }),
    saveMeasurement: () => attempt(()=>{
      const draft=get().measurementDraft;
      if(!draft?.end)throw new Error('줄자로 두 점을 먼저 선택해 주세요.');
      get().commit(addMeasurement(get().project,draft.view,draft.start,draft.end,draft.elevationWallId));
      set({measurementDraft:null});
    }),
    clearMeasurement: () => set({measurementDraft:null}),
    deleteMeasurement: (id) => attempt(()=>{
      const project=get().project;
      if(!project.dimensions?.some(item=>item.id===id))throw new Error('치수선을 찾을 수 없습니다.');
      get().commit({...project,dimensions:project.dimensions.filter(item=>item.id!==id)});
    }),
    patchMeasurement: (id,patch) => attempt(()=>{
      const project=get().project;
      if(!project.dimensions?.some(item=>item.id===id))throw new Error('치수선을 찾을 수 없습니다.');
      const next={...project,dimensions:project.dimensions.map(item=>item.id===id?{...item,...patch}:item)};
      get().commit(parseProject(next));
    }),
    setLinkedCorners: (linkedCorners) => set({linkedCorners}),
    beginWallTransform: (id,mode,start) => attempt(()=>{
      const project=get().project,wall=project.walls.find(w=>w.id===id);
      if(!wall)throw new Error('벽을 찾을 수 없습니다.');
      const selected=get().selected;
      const ids=selected.some(item=>item.type==='wall'&&item.id===id)
        ? [...new Set(selected.filter(item=>item.type==='wall').flatMap(item=>groupMembers(project,item.id).map(w=>w.id)))] : groupMembers(project,id).map(w=>w.id);
      if(project.walls.some(w=>ids.includes(w.id)&&w.locked))throw new Error('잠긴 벽은 이동하거나 회전할 수 없습니다.');
      if(!Number.isFinite(start.x)||!Number.isFinite(start.z))throw new Error('시작점이 올바르지 않습니다.');
      set({wallGesture:{id,ids,mode,start,base:project},outdoorGesture:null,modelArtworkGesture:null,artworkGesture:null,rotatingArtworkId:null,previewProject:null,selected:ids.map(id=>({type:'wall',id})),activeWallId:id});
    }),
    updateWallTransform: (point,snap=false) => attempt(()=>{
      const gesture=get().wallGesture;if(!gesture)return;
      const points=gesture.base.walls.filter(w=>gesture.ids.includes(w.id)).flatMap(w=>[w.start,w.end]);
      const center={x:(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,z:(Math.min(...points.map(p=>p.z))+Math.max(...points.map(p=>p.z)))/2};
      const raw={x:point.x-gesture.start.x,z:point.z-gesture.start.z};
      const offset=gesture.mode==='move'&&snap?snapWallTranslation(gesture.base,gesture.ids,raw,get().linkedCorners):raw;
      const radians=Math.atan2(point.z-center.z,point.x-center.x)-Math.atan2(gesture.start.z-center.z,gesture.start.x-center.x);
      const transform=gesture.mode==='move'?{kind:'move' as const,dx:offset.x,dz:offset.z}:{kind:'rotate' as const,radians};
      set({previewProject:transformWalls(gesture.base,gesture.ids,transform,get().linkedCorners)});
    }),
    finishWallTransform: (cancel=false) => {
      const gesture=get().wallGesture,preview=get().previewProject;
      set({wallGesture:null,previewProject:null});
      if(!gesture||cancel||!preview)return;
      const changed=gesture.ids.some(id=>{
        const before=gesture.base.walls.find(w=>w.id===id),after=preview.walls.find(w=>w.id===id);
        return before&&after&&JSON.stringify([before.start,before.end])!==JSON.stringify([after.start,after.end]);
      });
      if(changed)attempt(()=>get().commit(parseProject(preview)));
    },
    beginArtworkDrag: (id,hit) => attempt(()=>{
      const project=get().project,artwork=project.artworks.find(item=>item.id===id);
      if(!artwork)throw new Error('작품을 찾을 수 없습니다.');
      if(artworkGroupMembers(project,id).some(a=>a.locked))throw new Error('잠긴 작품은 이동할 수 없습니다.');
      if(!Number.isFinite(hit.alongMm)||!Number.isFinite(hit.centerHeightMm))throw new Error('작품 시작점이 올바르지 않습니다.');
      set({outdoorGesture:null,modelArtworkGesture:null,artworkGesture:{id,base:project,grab:{alongMm:artwork.alongMm-hit.alongMm,centerHeightMm:artwork.centerHeightMm-hit.centerHeightMm}},wallGesture:null,rotatingArtworkId:null,previewProject:null,selected:artworkGroupMembers(project,id).map(a=>({type:'artwork',id:a.id})),activeWallId:artwork.wallId,message:null});
    }),
    updateArtworkDrag: (hit) => attempt(()=>{
      const gesture=get().artworkGesture;if(!gesture)return;
      const artwork=gesture.base.artworks.find(item=>item.id===gesture.id),wall=gesture.base.walls.find(item=>item.id===(hit.wallId??artwork?.wallId));
      if(!artwork||!wall)return;
      if(!Number.isFinite(hit.alongMm)||!Number.isFinite(hit.centerHeightMm))return;
      const wallSide=hit.wallSide??artwork.wallSide;
      const placement=draggedArtworkPlacement({...artwork,wallId:wall.id,wallSide},wall,gesture.grab,hit);
      set({previewProject:null});
      set({previewProject:patchGroupedArtwork(gesture.base,gesture.id,{...placement,wallId:wall.id,wallSide},true)});
    }),
    finishArtworkDrag: (cancel=false) => {
      const gesture=get().artworkGesture,preview=get().previewProject;
      set({artworkGesture:null,previewProject:null});
      if(!gesture||cancel||!preview)return;
      const before=gesture.base.artworks.find(item=>item.id===gesture.id),after=preview.artworks.find(item=>item.id===gesture.id);
      if(before&&after&&(before.alongMm!==after.alongMm||before.centerHeightMm!==after.centerHeightMm||before.wallId!==after.wallId||before.wallSide!==after.wallSide))attempt(()=>{get().commit(preview);set({activeWallId:after.wallId});});
    },
    setArtworkRotationActive:(rotatingArtworkId)=>set({rotatingArtworkId}),
    setView: (view) => set(state=>{
      if(view!=='plan'&&state.project.planDraft&&!state.project.planReference?.calibrated)return {view:'plan',message:'두 점 축척 보정 후 3D와 벽면도를 열 수 있습니다.',wallGesture:null,artworkGesture:null,lightGesture:null,modelArtworkGesture:null,outdoorGesture:null,rotatingArtworkId:null,previewProject:null};
      return {view,measurementDraft:state.view===view?state.measurementDraft:null,activeTool:view!=='plan'&&state.activeTool==='draw'?'select':state.activeTool,wallGesture:null,artworkGesture:null,lightGesture:null,modelArtworkGesture:null,outdoorGesture:null,rotatingArtworkId:null,previewProject:null};
    }),
    setActiveWall: (activeWallId) => set({ activeWallId }),
    toggleDimensions: () => set((state) => ({ showDimensions: !state.showDimensions })),
    setCaptureMode: (captureClean,captureDimensions=true) => set({captureClean,captureDimensions}),
    notify: (message) => set({ message }),
    commit: (next) => set((state) => ({
      project: clone(next),
      view:safeView(next,state.view),
      previewProject:null,wallGesture:null,artworkGesture:null,lightGesture:null,modelArtworkGesture:null,outdoorGesture:null,rotatingArtworkId:null,
      past: [...state.past, clone(state.project)].slice(-50),
      future: [],
      message: null,
      selected: validSelection(next, state.selected),
      activeWallId: validWall(next, state.activeWallId),
    })),
    addLight: kind=>attempt(()=>{const project=get().project;if(project.planDraft&&!project.planReference?.calibrated)throw new Error('도면 축척을 먼저 보정해주세요.');const light=newLight(project,kind);get().commit({...project,lights:[...(project.lights??[]),light],lighting:project.lighting??CUSTOM_LIGHTING});set({selected:[{type:'light',id:light.id}],view:'3d',activeTool:'select'});}),
    patchNote:(target,patch)=>attempt(()=>{const next=updateNote(get().project,target,patch);validateProjectNotes(next);get().commit(next);}),
    patchLight:(id,patch)=>attempt(()=>get().commit(updateLight(get().project,id,patch))),
    patchOutdoor: outdoor=>attempt(()=>get().commit({...get().project,outdoor:parseOutdoor(outdoor)})),
    beginOutdoorTime:()=>{const s=get();if(s.project.outdoor?.mode!=='outdoor'||s.wallGesture||s.artworkGesture||s.lightGesture||s.modelArtworkGesture)return;set({outdoorGesture:{base:s.project},previewProject:null});},
    updateOutdoorTime:time=>attempt(()=>{const g=get().outdoorGesture;if(!g)return;set({previewProject:{...g.base,outdoor:parseOutdoor({...g.base.outdoor??DEFAULT_OUTDOOR,time})}});}),
    finishOutdoorTime:(cancel=false)=>{const {outdoorGesture,previewProject}=get();set({outdoorGesture:null,previewProject:null});if(!cancel&&outdoorGesture&&previewProject&&JSON.stringify(outdoorGesture.base.outdoor)!==JSON.stringify(previewProject.outdoor))attempt(()=>get().commit(previewProject));},
    patchLighting: lighting=>attempt(()=>get().commit({...get().project,lighting:parseLighting(lighting)})),
    beginLightMove:id=>attempt(()=>{const p=get().project,l=p.lights?.find(l=>l.id===id);if(!l||l.locked)throw new Error('잠긴 조명은 이동할 수 없습니다.');set({lightGesture:{id,base:p},outdoorGesture:null,previewProject:null});}),
    updateLightMove:position=>attempt(()=>{const g=get().lightGesture;if(!g)return;const l=g.base.lights!.find(l=>l.id===g.id)!;set({previewProject:updateLight(g.base,g.id,translatedLight(l,position))});}),
    finishLightMove:(cancel=false)=>{const {lightGesture,previewProject}=get();set({lightGesture:null,modelArtworkGesture:null,outdoorGesture:null,previewProject:null});if(!cancel&&lightGesture&&previewProject&&JSON.stringify(lightGesture.base.lights)!==JSON.stringify(previewProject.lights))attempt(()=>get().commit(previewProject));},
    addModelArtwork:(model,expectedProjectId)=>attempt(()=>{const p=get().project;if(p.id!==expectedProjectId)throw new Error('프로젝트가 바뀌어 3D 작품 가져오기를 취소했습니다.');const result=addModelArtworkToProject(p,model);get().commit(result.project);set({selected:[{type:'modelArtwork',id:result.artwork.id}],view:'3d',activeTool:'select',message:'3D 작품을 등록했습니다. 실제 크기는 오른쪽 숫자 입력으로 조절하세요.'});}),
    patchModelArtwork:(id,patch)=>attempt(()=>{const p=get().project,a=p.modelArtworks?.find(a=>a.id===id);if(!a)throw new Error('3D 작품을 찾을 수 없습니다.');let next=updateModelArtwork(p,id,patch);if(patch.position||patch.rotation){next=transformModelArtworks(p,selectedModelArtworkIds(p,get().selected,id),id,patch.position??a.position,patch.rotation??a.rotation);const {position:_,rotation:__,...other}=patch;if(Object.keys(other).length)next=updateModelArtwork(next,id,other);}get().commit(next);}),
    groupSelectedModelArtworks:(ungroup=false)=>attempt(()=>{const s=get();if(s.selected.some(i=>i.type!=='modelArtwork'))throw new Error('3D 작품만 선택하세요.');get().commit(groupModelArtworks(s.project,s.selected.map(i=>i.id),ungroup));}),
    beginModelArtworkTransform:id=>attempt(()=>{const s=get(),p=s.project,a=p.modelArtworks?.find(a=>a.id===id);if(!a)throw new Error('3D 작품이 없습니다.');const ids=selectedModelArtworkIds(p,s.selected,id);if(p.modelArtworks?.some(a=>ids.includes(a.id)&&a.locked))throw new Error('잠긴 3D 작품이 포함되어 이동·회전할 수 없습니다.');set({modelArtworkGesture:{id,ids,base:p},wallGesture:null,artworkGesture:null,lightGesture:null,outdoorGesture:null,rotatingArtworkId:null,previewProject:null,selected:ids.map(id=>({type:'modelArtwork',id}))});}),
    updateModelArtworkTransform:(position,rotation)=>attempt(()=>{const g=get().modelArtworkGesture;if(g)set({previewProject:transformModelArtworks(g.base,g.ids,g.id,position,rotation)});}),
    finishModelArtworkTransform:(cancel=false)=>{const s=get(),g=s.modelArtworkGesture,preview=s.previewProject;set({modelArtworkGesture:null,previewProject:null});if(!cancel&&g&&preview&&JSON.stringify(g.base.modelArtworks?.map(a=>[a.position,a.rotation]))!==JSON.stringify(preview.modelArtworks?.map(a=>[a.position,a.rotation])))attempt(()=>get().commit(parseProject(preview)));},
    floorSelectedModelArtwork:()=>attempt(()=>{const s=get(),id=s.selected.find(i=>i.type==='modelArtwork')?.id;if(!id)throw new Error('3D 작품을 선택하세요.');const a=s.project.modelArtworks!.find(a=>a.id===id)!;const ids=selectedModelArtworkIds(s.project,s.selected,id),members=s.project.modelArtworks!.filter(a=>ids.includes(a.id));if(members.some(a=>a.locked))throw new Error('잠긴 3D 작품은 이동할 수 없습니다.');const minY=Math.min(...members.map(a=>modelArtworkBounds(a).minY));s.patchModelArtwork(id,{position:{...a.position,y:a.position.y-minY}});}),
    patchArtwork: (id, patch) => attempt(() => get().commit(patchGroupedArtwork(get().project, id, patch))),
    patchWall: (id, patch) => attempt(() => get().commit(updateWall(get().project, id, patch))),
    moveWallEndpoint: (id,endpoint,point) => attempt(()=>get().commit(updateWallEndpoint(get().project,id,endpoint,point,get().linkedCorners))),
    renameProject: (name) => get().commit({ ...get().project, name }),
    patchProject: (patch) => get().commit({ ...get().project, ...patch }),
    addArtwork: (imageUrl, name) => attempt(() => {
      if(get().project.planDraft&&!get().project.planReference?.calibrated)throw new Error('실제 작품 크기를 배치하려면 도면의 두 점 축척을 먼저 보정하세요.');
      const next = addArtworkToProject(get().project, imageUrl, name)
      const created = next.artworks[next.artworks.length - 1]
      get().commit(next)
      set({ selected: [{ type: 'artwork', id: created.id }], activeWallId: created.wallId })
    }),
    installLibraryArtwork:(template,expectedProjectId,wallId)=>{
      const s=get();if(s.project.id!==expectedProjectId)throw new Error('프로젝트가 바뀌어 작품 배치를 취소했습니다.');
      const result=installArtworkTemplate(s.project,template,wallId??(s.activeWallId||s.project.walls[0]?.id));
      get().commit(result.project);
      const art=result.project.artworks.find(a=>a.id===result.selection.id);
      set({selected:[result.selection],...(art?{activeWallId:art.wallId}:{}),...(result.selection.type==='modelArtwork'?{view:'3d' as const}:{}),activeTool:'select',message:'라이브러리 작품을 새 객체로 배치했습니다.'});
    },
    placeUnplaced: (id) => attempt(() => {
      const wallId=validWall(get().project,get().activeWallId)
      const next=placeUnplacedArtwork(get().project,id,wallId)
      get().commit(next)
      set({selected:[{type:'artwork',id}],activeWallId:wallId})
    }),
    adoptModelWalls: (walls,expected,importedFloor) => attempt(()=>{
      const project=get().project;if(!sameModelGeometry(project.referenceModel,expected))throw new Error('모델이 변경되어 벽 추출을 취소했습니다. 다시 시도해주세요.');
      get().commit(adoptModelSpace(project,walls,importedFloor));set({view:'3d',activeTool:'select',selected:[{type:'wall',id:get().project.walls[0].id}],activeWallId:get().project.walls[0].id});
    }),
    restoreDemoSpace: () => attempt(() => get().commit(restoreDemoBoundary(get().project))),
    addWall: () => attempt(() => {
      const current=get().project;
      let next = addWallToProject(current)
      if(current.planDraft&&!current.planReference?.calibrated){
        const reference=current.planReference!,index=next.walls.length-1;
        const start={x:reference.widthPx*.2,z:reference.heightPx*(.3+(index%4)*.08)};
        const end={x:start.x+reference.widthPx*.3,z:start.z};
        next={...next,walls:next.walls.map((w,i)=>i===index?{...w,start,end,note:'사용자가 추가한 벽 · 축척 미정. 실제 길이는 두 점 축척 보정 후 결정됩니다.'}:w)};
      }
      const created = next.walls[next.walls.length - 1]
      get().commit(next)
      set({ selected: [{ type: 'wall', id: created.id }], activeWallId: created.id })
    }),
    drawWall: (start,end) => attempt(()=>{
      const next=addWallBetween(get().project,start,end);
      const created=next.walls[next.walls.length-1];
      get().commit(next);
      set({selected:[{type:'wall',id:created.id}],activeWallId:created.id});
    }),
    groupSelectedArtworks: () => attempt(()=>{
      const {project,selected}=get();
      if(selected.some(item=>item.type!=='artwork'))throw new Error('작품만 선택해 주세요.');
      const next=groupArtworks(project,selected.map(item=>item.id));
      get().commit(next);
      set({selected:artworkGroupMembers(next,selected[0].id).map(a=>({type:'artwork',id:a.id}))});
    }),
    ungroupSelectedArtworks: () => attempt(()=>{
      const {project,selected}=get();
      get().commit(ungroupArtworks(project,selected.filter(item=>item.type==='artwork').map(item=>item.id)));
    }),
    groupSelectedWalls: () => attempt(()=>{
      const {project,selected}=get();
      if(selected.length<2||selected.some(item=>item.type!=='wall'))throw new Error('묶을 벽을 두 개 이상 선택해 주세요.');
      const ids=new Set(selected.flatMap(item=>groupMembers(project,item.id).map(w=>w.id)));
      if(project.walls.some(w=>ids.has(w.id)&&w.locked))throw new Error('잠긴 벽은 그룹을 변경할 수 없습니다.');
      const groupId=crypto.randomUUID();
      get().commit({...project,walls:project.walls.map(w=>ids.has(w.id)?{...w,groupId}:w)});
      set({selected:[...ids].map(id=>({type:'wall',id}))});
    }),
    ungroupSelectedWalls: () => attempt(()=>{
      const {project,selected}=get();
      const groups=new Set(project.walls.filter(w=>selected.some(item=>item.type==='wall'&&item.id===w.id)).map(w=>w.groupId).filter(Boolean));
      if(!groups.size)return;
      if(project.walls.some(w=>groups.has(w.groupId)&&w.locked))throw new Error('잠긴 벽은 그룹을 변경할 수 없습니다.');
      get().commit({...project,walls:project.walls.map(w=>groups.has(w.groupId)?{...w,groupId:undefined}:w)});
    }),
    duplicateSelected: () => attempt(() => {
      const selections=get().selected;
      if(!selections.length)throw new Error('복제할 항목을 선택해 주세요.');
      let next=get().project;
      const copied:EntitySelection[]=[];
      const copiedGroups=new Map<string,string>();
      for(const selection of selections){
        const result=duplicateSelection(next,selection);next=result.project;
        if(selection.type==='wall'&&next.planDraft&&!next.planReference?.calibrated){
          const source=next.walls.find(w=>w.id===selection.id),copyId=result.selection.id;
          const shift=Math.max(10,Math.min(next.planReference!.widthPx,next.planReference!.heightPx)*.025);
          if(source)next={...next,walls:next.walls.map(w=>w.id===copyId?{...w,start:{x:source.start.x,z:source.start.z+shift},end:{x:source.end.x,z:source.end.z+shift}}:w)};
        }
        if(selection.type==='modelArtwork'){const groupId=next.modelArtworks?.find(a=>a.id===selection.id)?.groupId;if(groupId){const key='modelArtwork:'+groupId;if(!copiedGroups.has(key))copiedGroups.set(key,crypto.randomUUID());next={...next,modelArtworks:next.modelArtworks?.map(a=>a.id===result.selection.id?{...a,groupId:copiedGroups.get(key)}:a)};}}
        if(selection.type==='artwork'){
          const groupId=next.artworks.find(a=>a.id===selection.id)?.groupId;
          if(groupId){
            const key=`artwork:${groupId}`;
            if(!copiedGroups.has(key))copiedGroups.set(key,crypto.randomUUID());
            next={...next,artworks:next.artworks.map(a=>a.id===result.selection.id?{...a,groupId:copiedGroups.get(key)}:a)};
          }
        }
        if(selection.type==='wall'){
          const groupId=next.walls.find(w=>w.id===selection.id)?.groupId;
          if(groupId){
            if(!copiedGroups.has(groupId))copiedGroups.set(groupId,crypto.randomUUID());
            next={...next,walls:next.walls.map(w=>w.id===result.selection.id?{...w,groupId:copiedGroups.get(groupId)}:w)};
          }
        }
        copied.push(result.selection);
      }
      get().commit(next);
      set({selected:copied,activeWallId:copied[0].type==='wall'?copied[0].id:next.artworks.find(item=>item.id===copied[0].id)?.wallId??get().activeWallId});
    }),
    lockSelected: (locked) => attempt(()=>{
      if(!get().selected.length)throw new Error('잠글 항목을 선택해 주세요.');
      let next=get().project;
      for(const selection of get().selected)next=selection.type==='wall'?updateWall(next,selection.id,{locked}):selection.type==='modelArtwork'?updateModelArtwork(next,selection.id,{locked}):selection.type==='light'?updateLight(next,selection.id,{locked}):updateArtwork(next,selection.id,{locked});
      get().commit(next);
    }),
    deleteSelected: () => attempt(() => {
      const selections = get().selected
      if (!selections.length) throw new Error('삭제할 항목을 선택해 주세요.')
      const next = selections.reduce((project, selection) => deleteSelection(project, selection), get().project)
      get().commit(next)
      set({ selected: [] })
    }),
    spaceSelected: (gap) => get().layoutSelectedArtworks({kind:'spacing',axis:'horizontal',gapMm:gap}),
    layoutSelectedArtworks: (layout) => attempt(() => {
      const {project,selected}=get();
      if(selected.some(item=>item.type!=='artwork'))throw new Error('같은 벽면의 이미지 작품만 선택해 주세요.');
      const next=layoutArtworks(project,selected.map(item=>item.id),layout);
      if(next===project){set({message:'이미 같은 배치입니다.'});return;}
      get().commit(next);
      set({message:'선택한 작품의 배치를 적용했습니다.'});
    }),
    undo: () => set((state) => {
      const previous = state.past[state.past.length - 1]
      if (!previous) return state
      const project = clone(previous)
      return { project, view:safeView(project,state.view),previewProject:null,wallGesture:null,artworkGesture:null,lightGesture:null,modelArtworkGesture:null,outdoorGesture:null,rotatingArtworkId:null,measurementDraft:null,past: state.past.slice(0, -1), future: [clone(state.project), ...state.future].slice(0, 50), selected: validSelection(project, state.selected), activeWallId: validWall(project, state.activeWallId), message: null }
    }),
    redo: () => set((state) => {
      const next = state.future[0]
      if (!next) return state
      const project = clone(next)
      return { project,view:safeView(project,state.view),previewProject:null,wallGesture:null,artworkGesture:null,lightGesture:null,modelArtworkGesture:null,outdoorGesture:null,rotatingArtworkId:null,measurementDraft:null,past: [...state.past, clone(state.project)].slice(-50), future: state.future.slice(1), selected: validSelection(project, state.selected), activeWallId: validWall(project, state.activeWallId), message: null }
    }),
    loadProject: (project,alreadySaved=false) => attempt(() => {
      const parsed = parseProject(project)
      if(alreadySaved)savedSnapshot=parsed;
      set({ project: parsed, view:safeView(parsed,get().view),previewProject:null,wallGesture:null,artworkGesture:null,lightGesture:null,modelArtworkGesture:null,outdoorGesture:null,rotatingArtworkId:null,measurementDraft:null,selected: firstSelection(parsed), activeWallId: validWall(parsed, ''), past: [], future: [], hydrated: true, saveStatus: 'saved', message: null })
    }),
    saveScene: (name,cameraView) => attempt(() => {
      const project = get().project
      const used = new Set(project.scenes.map((scene) => scene.id))
      let index = 1
      while (used.has(`scene-${index}`)) index += 1
      const structure={modelArtworks:clone(project.modelArtworks??[]),outdoor:clone(project.outdoor??DEFAULT_OUTDOOR),lights:clone(project.lights??[]),lighting:clone(project.lighting??DEFAULT_LIGHTING),floorColor:project.floorColor,...(project.floorMaterial?{floorMaterial:clone(project.floorMaterial)}:{}),...(project.importedFloor?{importedFloor:clone(project.importedFloor)}:{}),...(project.referenceModel?{referenceModel:clone(project.referenceModel)}:{}),walls:clone(project.walls),openings:clone(project.openings??[]),dimensions:clone(project.dimensions??[]),unplacedArtworks:clone(project.unplacedArtworks??[])}
      get().commit(parseProject({ ...project, scenes: [...project.scenes, { id: `scene-${index}`, name, artworks: clone(project.artworks), wallVisibility: Object.fromEntries(project.walls.map((wall) => [wall.id, wall.visible])),structure,...(cameraView?{cameraView:clone(cameraView)}:{}) }] }))
    }),
    restoreScene: (id) => attempt(() => {
      const project = get().project
      const scene = project.scenes.find((item) => item.id === id)
      if (!scene) throw new Error('장면을 찾을 수 없습니다.')
      const commitScene=(next:Project)=>get().commit(preserveCurrentNotes(project,next));
      if(scene.structure){
        commitScene(parseProject({...project,...(scene.structure.modelArtworks!==undefined?{modelArtworks:clone(scene.structure.modelArtworks)}:{}),...(scene.structure.outdoor?{outdoor:clone(scene.structure.outdoor)}:{}),...(scene.structure.lights!==undefined?{lights:clone(scene.structure.lights),lighting:clone(scene.structure.lighting)}:{}),...(scene.structure.floorColor!==undefined?{floorColor:scene.structure.floorColor,floorMaterial:scene.structure.floorMaterial?clone(scene.structure.floorMaterial):undefined}:{}),importedFloor:scene.structure.importedFloor?clone(scene.structure.importedFloor):undefined,referenceModel:scene.structure.referenceModel?clone(scene.structure.referenceModel):undefined,walls:clone(scene.structure.walls),artworks:clone(scene.artworks),unplacedArtworks:clone(scene.structure.unplacedArtworks),openings:clone(scene.structure.openings),dimensions:clone(scene.structure.dimensions)}))
      }else{
        const wallIds = new Set(project.walls.map((wall) => wall.id))
        const artworks = clone(scene.artworks.filter((artwork) => wallIds.has(artwork.wallId)))
        const walls = project.walls.map((wall) => ({ ...wall, visible: scene.wallVisibility[wall.id] ?? wall.visible }))
        commitScene({ ...project, artworks, walls })
      }
    }),
    deleteScene: (id) => get().commit({ ...get().project, scenes: get().project.scenes.filter((scene) => scene.id !== id) }),
  }
})

export async function hydrateEditor(reader: () => Promise<unknown> = readDraft): Promise<void> {
  const projectAtStart = useEditor.getState().project
  try {
    const raw = await reader()
    if (useEditor.getState().project !== projectAtStart) {
      useEditor.setState({ hydrated: true, saveStatus: 'saved' })
      return
    }
    if (raw === undefined) {
      useEditor.setState({ hydrated: true, saveStatus: 'saved' })
      return
    }
    const project = parseProject(raw)
    savedSnapshot=project;
    useEditor.setState({ project,view:safeView(project,useEditor.getState().view),selected: firstSelection(project), activeWallId: validWall(project, ''), past: [], future: [], hydrated: true, saveStatus: 'saved', message: null })
  } catch (error) {
    useEditor.setState({ hydrated: true, saveStatus: 'error', message: `저장된 프로젝트를 불러오지 못했습니다. ${errorMessage(error)}` })
  }
}

let flushCurrentAutosave:()=>Promise<void>=async()=>{};
export const flushAutosave=()=>flushCurrentAutosave();
export function startAutosave(
  writer: (project: Project) => Promise<void> = writeDraft,
  debounceMs = 250,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastProject = useEditor.getState().project
  let queued = Promise.resolve()
  let revision = 0
  let pending:Project|undefined,error:unknown;
  const schedule=()=>{
    if(timer)clearTimeout(timer);timer=undefined;
    if(!pending)return;
    const snapshot=pending;pending=undefined;const scheduledRevision=revision;
    queued=queued.then(()=>writer(snapshot)).then(()=>{
      error=undefined;
      if(scheduledRevision===revision&&useEditor.getState().project.id===snapshot.id)useEditor.setState({saveStatus:'saved'});
    },(failure:unknown)=>{error=failure;if(useEditor.getState().project.id===snapshot.id)useEditor.setState({saveStatus:'error',message:`프로젝트를 저장하지 못했습니다. ${errorMessage(failure)}`});});
  };
  const flush=async()=>{schedule();await queued;if(error)throw error;};
  flushCurrentAutosave=flush;
  const unsubscribe = useEditor.subscribe((state) => {
    if (!state.hydrated || state.project === lastProject) return
    lastProject = state.project
    if(state.project===savedSnapshot){error=undefined;return;}
    if (timer) clearTimeout(timer)
    useEditor.setState({ saveStatus: 'saving' })
    revision++;pending=state.project;
    timer = setTimeout(schedule, debounceMs)
  })
  return () => { if (timer) clearTimeout(timer); unsubscribe();if(flushCurrentAutosave===flush)flushCurrentAutosave=async()=>{}; }
}
