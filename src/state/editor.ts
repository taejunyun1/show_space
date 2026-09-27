import { create } from 'zustand'
import {
  addArtwork as addArtworkToProject,
  addWall as addWallToProject,
  createDemoProject,
  deleteSelection,
  distributeArtworks,
  duplicateSelection,
  parseProject,
  updateArtwork,
  updateWall,
} from '../domain/model'
import type { Artwork, EntitySelection, MeasurementAnchor, Project, SavedDimension, Wall } from '../domain/types'
import type {Point} from '../domain/types'
import {transformWalls} from '../domain/wallTransform'
import {addWallBetween,updateWallEndpoint} from '../domain/wallEditing'
import {addMeasurement,measureDistance,resolveAnchor} from '../domain/measurements'
import { readDraft, writeDraft } from '../lib/persistence'

export type View = '3d' | 'plan' | 'elevation'
type SaveStatus = 'loading' | 'saved' | 'saving' | 'error'
type EditTool = 'select' | 'move' | 'rotate' | 'draw' | 'measure'
interface WallGesture {id:string;ids:string[];mode:'move'|'rotate';start:Point;base:Project}
interface MeasurementDraft {view:View; elevationWallId?:string;start:MeasurementAnchor;end?:MeasurementAnchor}

interface EditorState {
  project: Project
  previewProject: Project | null
  wallGesture: WallGesture | null
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
  updateWallTransform(point:Point):void
  finishWallTransform(cancel?:boolean):void
  setView(view: View): void
  setActiveWall(id: string): void
  toggleDimensions(): void
  setCaptureMode(clean:boolean,includeDimensions?:boolean):void
  notify(message: string | null): void
  commit(next: Project): void
  patchArtwork(id: string, patch: Partial<Artwork>): void
  patchWall(id: string, patch: Partial<Wall>): void
  moveWallEndpoint(id:string,endpoint:'start'|'end',point:Point):void
  renameProject(name: string): void
  patchProject(patch: Pick<Partial<Project>, 'floorColor' | 'venue' | 'planImageUrl' | 'planOpacity' | 'planReference' | 'planLabels' | 'planAnalysis' | 'sourcePlan'>): void
  addArtwork(imageUrl?: string, name?: string): void
  addWall(): void
  drawWall(start:Point,end:Point):void
  duplicateSelected(): void
  lockSelected(locked:boolean):void
  deleteSelected(): void
  spaceSelected(gap: number): void
  undo(): void
  redo(): void
  loadProject(project: Project): void
  saveScene(name: string): void
  restoreScene(id: string): void
  deleteScene(id: string): void
}

const clone = <T,>(value: T): T => structuredClone(value)

function firstSelection(project: Project): EntitySelection[] {
  if (project.artworks[0]) return [{ type: 'artwork', id: project.artworks[0].id }]
  if (project.walls[0]) return [{ type: 'wall', id: project.walls[0].id }]
  return []
}

function validSelection(project: Project, selected: EntitySelection[]) {
  return selected.filter((selection) => selection.type === 'artwork'
    ? project.artworks.some((artwork) => artwork.id === selection.id)
    : project.walls.some((wall) => wall.id === selection.id))
}

function validWall(project: Project, preferred: string) {
  return project.walls.some((wall) => wall.id === preferred) ? preferred : (project.walls[0]?.id ?? '')
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '작업을 완료할 수 없습니다.'
}

const initialProject = createDemoProject()

export const useEditor = create<EditorState>((set, get) => {
  const attempt = (operation: () => void) => {
    try { operation() } catch (error) { set({ message: errorMessage(error) }) }
  }
  return {
    project: initialProject,
    previewProject: null,
    wallGesture: null,
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
      const selected = additive
        ? state.selected.some((item) => item.type === selection.type && item.id === selection.id)
          ? state.selected.filter((item) => item.type !== selection.type || item.id !== selection.id)
          : [...state.selected, selection]
        : [selection]
      const artwork = selection.type === 'artwork' ? state.project.artworks.find((item) => item.id === selection.id) : undefined
      return { selected, activeWallId: selection.type === 'wall' ? selection.id : (artwork?.wallId ?? state.activeWallId) }
    }),
    setTool: (activeTool) => set({activeTool,measurementDraft:null,previewProject:null,wallGesture:null}),
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
        ? selected.filter(item=>item.type==='wall').map(item=>item.id) : [id];
      if(project.walls.some(w=>ids.includes(w.id)&&w.locked))throw new Error('잠긴 벽은 이동하거나 회전할 수 없습니다.');
      if(!Number.isFinite(start.x)||!Number.isFinite(start.z))throw new Error('시작점이 올바르지 않습니다.');
      set({wallGesture:{id,ids,mode,start,base:project},previewProject:null,selected:ids.map(id=>({type:'wall',id})),activeWallId:id});
    }),
    updateWallTransform: (point) => attempt(()=>{
      const gesture=get().wallGesture;if(!gesture)return;
      const points=gesture.base.walls.filter(w=>gesture.ids.includes(w.id)).flatMap(w=>[w.start,w.end]);
      const center={x:(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,z:(Math.min(...points.map(p=>p.z))+Math.max(...points.map(p=>p.z)))/2};
      const dx=point.x-gesture.start.x,dz=point.z-gesture.start.z;
      const radians=Math.atan2(point.z-center.z,point.x-center.x)-Math.atan2(gesture.start.z-center.z,gesture.start.x-center.x);
      const transform=gesture.mode==='move'?{kind:'move' as const,dx,dz}:{kind:'rotate' as const,radians};
      set({previewProject:transformWalls(gesture.base,gesture.ids,transform)});
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
    setView: (view) => set(state=>({view,measurementDraft:state.view===view?state.measurementDraft:null,activeTool:view!=='plan'&&state.activeTool==='draw'?'select':state.activeTool})),
    setActiveWall: (activeWallId) => set({ activeWallId }),
    toggleDimensions: () => set((state) => ({ showDimensions: !state.showDimensions })),
    setCaptureMode: (captureClean,captureDimensions=true) => set({captureClean,captureDimensions}),
    notify: (message) => set({ message }),
    commit: (next) => set((state) => ({
      project: clone(next),
      previewProject:null,wallGesture:null,
      past: [...state.past, clone(state.project)].slice(-50),
      future: [],
      message: null,
      selected: validSelection(next, state.selected),
      activeWallId: validWall(next, state.activeWallId),
    })),
    patchArtwork: (id, patch) => attempt(() => get().commit(updateArtwork(get().project, id, patch))),
    patchWall: (id, patch) => attempt(() => get().commit(updateWall(get().project, id, patch))),
    moveWallEndpoint: (id,endpoint,point) => attempt(()=>get().commit(updateWallEndpoint(get().project,id,endpoint,point,get().linkedCorners))),
    renameProject: (name) => get().commit({ ...get().project, name }),
    patchProject: (patch) => get().commit({ ...get().project, ...patch }),
    addArtwork: (imageUrl, name) => attempt(() => {
      const next = addArtworkToProject(get().project, imageUrl, name)
      const created = next.artworks[next.artworks.length - 1]
      get().commit(next)
      set({ selected: [{ type: 'artwork', id: created.id }], activeWallId: created.wallId })
    }),
    addWall: () => attempt(() => {
      const next = addWallToProject(get().project)
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
    duplicateSelected: () => attempt(() => {
      const selections=get().selected;
      if(!selections.length)throw new Error('복제할 항목을 선택해 주세요.');
      let next=get().project;
      const copied:EntitySelection[]=[];
      for(const selection of selections){const result=duplicateSelection(next,selection);next=result.project;copied.push(result.selection);}
      get().commit(next);
      set({selected:copied,activeWallId:copied[0].type==='wall'?copied[0].id:next.artworks.find(item=>item.id===copied[0].id)?.wallId??get().activeWallId});
    }),
    lockSelected: (locked) => attempt(()=>{
      if(!get().selected.length)throw new Error('잠글 항목을 선택해 주세요.');
      let next=get().project;
      for(const selection of get().selected)next=selection.type==='wall'?updateWall(next,selection.id,{locked}):updateArtwork(next,selection.id,{locked});
      get().commit(next);
    }),
    deleteSelected: () => attempt(() => {
      const selections = get().selected
      if (!selections.length) throw new Error('삭제할 항목을 선택해 주세요.')
      const next = selections.reduce((project, selection) => deleteSelection(project, selection), get().project)
      get().commit(next)
      set({ selected: [] })
    }),
    spaceSelected: (gap) => attempt(() => {
      const ids = get().selected.filter((item) => item.type === 'artwork').map((item) => item.id)
      get().commit(distributeArtworks(get().project, ids, gap))
    }),
    undo: () => set((state) => {
      const previous = state.past[state.past.length - 1]
      if (!previous) return state
      const project = clone(previous)
      return { project, previewProject:null,wallGesture:null,measurementDraft:null,past: state.past.slice(0, -1), future: [clone(state.project), ...state.future].slice(0, 50), selected: validSelection(project, state.selected), activeWallId: validWall(project, state.activeWallId), message: null }
    }),
    redo: () => set((state) => {
      const next = state.future[0]
      if (!next) return state
      const project = clone(next)
      return { project,previewProject:null,wallGesture:null,measurementDraft:null,past: [...state.past, clone(state.project)].slice(-50), future: state.future.slice(1), selected: validSelection(project, state.selected), activeWallId: validWall(project, state.activeWallId), message: null }
    }),
    loadProject: (project) => attempt(() => {
      const parsed = parseProject(project)
      set({ project: parsed, previewProject:null,wallGesture:null,measurementDraft:null,selected: firstSelection(parsed), activeWallId: validWall(parsed, ''), past: [], future: [], hydrated: true, saveStatus: 'saved', message: null })
    }),
    saveScene: (name) => attempt(() => {
      const project = get().project
      const used = new Set(project.scenes.map((scene) => scene.id))
      let index = 1
      while (used.has(`scene-${index}`)) index += 1
      get().commit({ ...project, scenes: [...project.scenes, { id: `scene-${index}`, name, artworks: clone(project.artworks), wallVisibility: Object.fromEntries(project.walls.map((wall) => [wall.id, wall.visible])) }] })
    }),
    restoreScene: (id) => attempt(() => {
      const project = get().project
      const scene = project.scenes.find((item) => item.id === id)
      if (!scene) throw new Error('장면을 찾을 수 없습니다.')
      const wallIds = new Set(project.walls.map((wall) => wall.id))
      const artworks = clone(scene.artworks.filter((artwork) => wallIds.has(artwork.wallId)))
      const walls = project.walls.map((wall) => ({ ...wall, visible: scene.wallVisibility[wall.id] ?? wall.visible }))
      get().commit({ ...project, artworks, walls })
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
    useEditor.setState({ project, selected: firstSelection(project), activeWallId: validWall(project, ''), past: [], future: [], hydrated: true, saveStatus: 'saved', message: null })
  } catch (error) {
    useEditor.setState({ hydrated: true, saveStatus: 'error', message: `저장된 프로젝트를 불러오지 못했습니다. ${errorMessage(error)}` })
  }
}

export function startAutosave(
  writer: (project: Project) => Promise<void> = writeDraft,
  debounceMs = 250,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastProject = useEditor.getState().project
  let queued = Promise.resolve()
  let revision = 0
  const unsubscribe = useEditor.subscribe((state) => {
    if (!state.hydrated || state.project === lastProject) return
    lastProject = state.project
    if (timer) clearTimeout(timer)
    useEditor.setState({ saveStatus: 'saving' })
    const scheduledRevision = ++revision
    timer = setTimeout(() => {
      const snapshot = state.project
      queued = queued.then(() => writer(snapshot)).then(
        () => {
          if (scheduledRevision === revision) useEditor.setState({ saveStatus: 'saved' })
        },
        (error: unknown) => useEditor.setState({ saveStatus: 'error', message: `프로젝트를 저장하지 못했습니다. ${errorMessage(error)}` }),
      )
    }, debounceMs)
  })
  return () => { if (timer) clearTimeout(timer); unsubscribe() }
}
