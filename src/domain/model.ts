import {validateReferenceModel} from './referenceModel';
import {removeWallOpenings} from './openingAnchors';
import {installationZones,footprintOverlapsZone} from './installationZones';
import {validateOpenings} from './openings';
import {validateDimensions} from './measurements';
import {validatePlanLabels,type PlanLabel} from './planLabels'
import { validatePlanReference } from './plan'
import type { Artwork, EntitySelection, Point, Project, UnplacedArtwork, Wall } from './types'

const frames = new Set<Artwork['frame']>(['black', 'natural', 'white', 'none'])
const imageLimit = 12 * 1024 * 1024
const wallLimit = 200
const artworkLimit = 500

function finite(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label}은(는) 유한한 숫자여야 합니다.`)
}

function positive(value: unknown, label: string): asserts value is number {
  finite(value, label)
  if (value <= 0) throw new Error(`${label}은(는) 0보다 커야 합니다.`)
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== 'object') return false
  const point = value as Record<string, unknown>
  return typeof point.x === 'number' && Number.isFinite(point.x) && typeof point.z === 'number' && Number.isFinite(point.z)
}

function samePoint(a: Point, b: Point) { return a.x === b.x && a.z === b.z }

function validateWall(wall: Wall) {
  if (wall.groupId !== undefined && (typeof wall.groupId !== 'string' || !wall.groupId.trim() || wall.groupId.length > 100)) throw new Error('벽 그룹이 올바르지 않습니다.')
  if (wall.role !== undefined && !['boundary','partition'].includes(wall.role)) throw new Error('벽 용도가 올바르지 않습니다.')
  if (!isPoint(wall.start) || !isPoint(wall.end)) throw new Error('벽 좌표는 유한한 숫자여야 합니다.')
  positive(wall.heightMm, '벽 높이')
  positive(wall.thicknessMm, '벽 두께')
  if (wallLength(wall) === 0) throw new Error('벽 길이는 0보다 커야 합니다.')
}

function validateArtwork(artwork: Artwork, wallIds: Set<string>) {
  if (artwork.groupId !== undefined && (typeof artwork.groupId !== 'string' || !artwork.groupId.trim() || artwork.groupId.length > 100)) throw new Error('작품 그룹이 올바르지 않습니다.')
  if (artwork.wallSide !== undefined && !['front','back'].includes(artwork.wallSide)) throw new Error('설치 면이 올바르지 않습니다.')
  if (artwork.rotationDeg !== undefined) {
    finite(artwork.rotationDeg, '작품 회전 각도')
    if (artwork.rotationDeg < -180 || artwork.rotationDeg > 180) throw new Error('작품 회전 각도는 -180°에서 180° 사이여야 합니다.')
  }
  positive(artwork.widthMm, '작품 너비')
  positive(artwork.heightMm, '작품 높이')
  positive(artwork.depthMm, '작품 깊이')
  finite(artwork.alongMm, '작품 위치')
  finite(artwork.centerHeightMm, '작품 중심 높이')
  if (!wallIds.has(artwork.wallId)) throw new Error(`존재하지 않는 벽을 참조합니다: ${artwork.wallId}`)
  if (!frames.has(artwork.frame)) throw new Error('작품 프레임 값이 올바르지 않습니다.')
  safeImage(artwork.imageUrl, '작품')
}

function validateArtworkGroups(artworks:Artwork[]) {
  const faces=new Map<string,string>();
  for(const artwork of artworks){
    if(!artwork.groupId)continue;
    const face=JSON.stringify([artwork.wallId,artwork.wallSide??'front']);
    if(faces.has(artwork.groupId)&&faces.get(artwork.groupId)!==face)throw new Error('작품 그룹은 같은 벽·같은 면에 있어야 합니다.');
    faces.set(artwork.groupId,face);
  }
}

function uniqueId(prefix: string, ids: Iterable<string>) {
  const used = new Set(ids)
  let index = 1
  while (used.has(`${prefix}-${index}`)) index += 1
  return `${prefix}-${index}`
}

export function createDemoProject(): Project {
  const points: Point[] = [{ x: -4000, z: -3000 }, { x: 4000, z: -3000 }, { x: 4000, z: 3000 }, { x: -4000, z: 3000 }]
  const walls: Wall[] = points.map((start, index) => ({
    id: `wall-${String.fromCharCode(97 + index)}`, name: `벽 ${String.fromCharCode(65 + index)}`,
    start: { ...start }, end: { ...points[(index + 1) % points.length] }, heightMm: 3200,
    thicknessMm: 160, color: '#ffffff', visible: true, locked: false, note: '',
  }))
  const names = ['고요한 면', '빛의 간격', '잔상', '겹쳐진 시간', '여백']
  const artworks: Artwork[] = names.map((name, index) => ({
    id: `artwork-${index + 1}`, name, artist: '', widthMm: 900, heightMm: 1200, depthMm: 30,
    wallId: index === 4 ? 'wall-b' : 'wall-a', alongMm: index === 4 ? 2800 : [1400, 3100, 4800, 6500][index],
    centerHeightMm: 1500, frame: 'natural', imageUrl: `/artworks/artwork-${index + 1}.png`,
    visible: true, locked: false, note: '',
  }))
  return { schemaVersion: 1, id: 'project-1', name: '여백의 기록', venue: '성수 갤러리', walls, artworks, scenes: [], floorColor: '#f1f1ed' }
}

export function canRestoreDemoBoundary(project:Project):boolean{
  if(project.id!=='project-1'||project.planImageUrl||project.planReference||project.sourcePlan||project.planDraft)return false
  return createDemoProject().walls.every(base=>project.walls.some(wall=>wall.id===base.id))
}

/** Explicit recovery of the sample room; all artwork and non-sample walls stay untouched. */
export function restoreDemoBoundary(project:Project):Project{
  if(!canRestoreDemoBoundary(project))throw new Error('기본 공간의 네 벽이 있어야 배치를 복원할 수 있습니다.')
  const base=new Map(createDemoProject().walls.map(wall=>[wall.id,wall]))
  if(project.walls.some(wall=>base.has(wall.id)&&wall.locked))throw new Error('잠긴 벽의 잠금을 먼저 해제해 주세요.')
  const walls=project.walls.map(wall=>{
    const original=base.get(wall.id)
    return original?{...wall,role:'boundary' as const,start:{...original.start},end:{...original.end}}:wall
  })
  return parseProject({...project,walls})
}

export function wallLength(wall: Wall): number { return Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z) }
export function mmToMeters(value: number): number { return value / 1000 }

export function normalizeArtworkAngle(value: number): number {
  finite(value, '작품 회전 각도')
  const angle = ((value + 180) % 360 + 360) % 360 - 180
  return angle === -180 ? 180 : angle
}

export function rotatedArtworkSize(artwork: Artwork): { widthMm: number; heightMm: number } {
  const radians = (artwork.rotationDeg ?? 0) * Math.PI / 180
  const cosine = Math.abs(Math.cos(radians)), sine = Math.abs(Math.sin(radians))
  const c = cosine < 1e-10 ? 0 : cosine, s = sine < 1e-10 ? 0 : sine
  return { widthMm: artwork.widthMm * c + artwork.heightMm * s, heightMm: artwork.widthMm * s + artwork.heightMm * c }
}

export function artworkPosition(artwork: Artwork, wall: Wall) {
  const length = wallLength(wall)
  if (!Number.isFinite(length) || length === 0) throw new Error('작품을 배치할 벽 길이가 올바르지 않습니다.')
  const dx = (wall.end.x - wall.start.x) / length
  const dz = (wall.end.z - wall.start.z) / length
  const side = artwork.wallSide === 'back' ? -1 : 1
  const nx = -dz * side
  const nz = dx * side
  const offset = wall.thicknessMm / 2 + artwork.depthMm / 2 + 5
  return { x: wall.start.x + dx * artwork.alongMm + nx * offset, y: artwork.centerHeightMm, z: wall.start.z + dz * artwork.alongMm + nz * offset, rotationY: Math.atan2(nx, nz) }
}

export function updateWall(project: Project, id: string, patch: Partial<Wall>): Project {
  const wall = project.walls.find(item => item.id === id)
  if (!wall) throw new Error(`벽을 찾을 수 없습니다: ${id}`)
  const allowed = new Set(['name', 'note', 'visible', 'locked'])
  if (wall.locked && Object.keys(patch).some(key => !allowed.has(key))) throw new Error('잠긴 벽의 위치나 크기는 변경할 수 없습니다.')
  const next = { ...wall, ...patch, start: patch.start ? { ...patch.start } : { ...wall.start }, end: patch.end ? { ...patch.end } : { ...wall.end } }
  validateWall(next)
  const walls = project.walls.map(item => {
    if (item.id === id) return next
    let start = item.start
    let end = item.end
    if (patch.start && samePoint(item.start, wall.start)) start = { ...patch.start }
    if (patch.start && samePoint(item.end, wall.start)) end = { ...patch.start }
    if (patch.end && samePoint(item.start, wall.end)) start = { ...patch.end }
    if (patch.end && samePoint(item.end, wall.end)) end = { ...patch.end }
    if (item.locked && (start !== item.start || end !== item.end)) throw new Error('연결된 잠긴 벽의 위치는 변경할 수 없습니다.')
    const connected = start !== item.start || end !== item.end ? { ...item, start, end } : item
    validateWall(connected)
    return connected
  })
  if(project.openings)validateOpenings(project.openings,walls)
  return { ...project, walls }
}

export function updateArtwork(project: Project, id: string, patch: Partial<Artwork>): Project {
  const artwork = project.artworks.find(item => item.id === id)
  if (!artwork) throw new Error(`작품을 찾을 수 없습니다: ${id}`)
  const allowed = new Set(['name', 'note', 'visible', 'locked'])
  if (artwork.locked && Object.keys(patch).some(key => !allowed.has(key))) throw new Error('잠긴 작품의 배치나 속성은 변경할 수 없습니다.')
  const next = { ...artwork, ...patch }
  validateArtwork(next, new Set(project.walls.map(wall => wall.id)))
  return { ...project, artworks: project.artworks.map(item => item.id === id ? next : item) }
}

export function addWall(project: Project): Project {
  if (project.walls.length >= wallLimit) throw new Error(`벽은 최대 ${wallLimit}개까지 만들 수 있습니다.`)
  const id = uniqueId('wall', [...project.walls, ...project.artworks, ...(project.unplacedArtworks??[])].map(item => item.id))
  const z = project.walls.length * 400
  const wall: Wall = { id, role: 'partition', name: `새 벽 ${project.walls.length + 1}`, start: { x: 0, z }, end: { x: 3000, z }, heightMm: 3200, thicknessMm: 160, color: '#ffffff', visible: true, locked: false, note: '' }
  return { ...project, walls: [...project.walls, wall] }
}

export function addArtwork(project: Project, imageUrl = '/artworks/artwork-1.png', name = '새 작품'): Project {
  if (!project.walls.length) throw new Error('작품을 배치할 벽이 없습니다.')
  if (project.artworks.length+(project.unplacedArtworks?.length??0) >= artworkLimit) throw new Error(`작품은 최대 ${artworkLimit}개까지 만들 수 있습니다.`)
  const id = uniqueId('artwork', [...project.walls, ...project.artworks, ...(project.unplacedArtworks??[])].map(item => item.id))
  const artwork: Artwork = { id, name, artist: '', widthMm: 900, heightMm: 1200, depthMm: 30, wallId: project.walls[0].id, alongMm: 450, centerHeightMm: 1500, frame: 'natural', imageUrl, visible: true, locked: false, note: '' }
  validateArtwork(artwork, new Set(project.walls.map(wall => wall.id)))
  return { ...project, artworks: [...project.artworks, artwork] }
}

export function duplicateSelection(project: Project, selection: EntitySelection): { project: Project; selection: EntitySelection } {
  if (selection.type === 'artwork') {
    const source = project.artworks.find(item => item.id === selection.id)
    if (!source) throw new Error('복제할 작품을 찾을 수 없습니다.')
    if (project.artworks.length+(project.unplacedArtworks?.length??0) >= artworkLimit) throw new Error(`작품은 최대 ${artworkLimit}개까지 만들 수 있습니다.`)
    const id = uniqueId('artwork', [...project.walls, ...project.artworks, ...(project.unplacedArtworks??[])].map(item => item.id))
    const copy = { ...source, groupId: undefined, id, name: `${source.name} 복사본`, alongMm: source.alongMm + 200, locked: false }
    return { project: { ...project, artworks: [...project.artworks, copy] }, selection: { type: 'artwork', id } }
  }
  const source = project.walls.find(item => item.id === selection.id)
  if (!source) throw new Error('복제할 벽을 찾을 수 없습니다.')
  if (project.walls.length >= wallLimit) throw new Error(`벽은 최대 ${wallLimit}개까지 만들 수 있습니다.`)
  const id = uniqueId('wall', [...project.walls, ...project.artworks, ...(project.unplacedArtworks??[])].map(item => item.id))
  const copy = { ...source, groupId: undefined, id, name: `${source.name} 복사본`, start: { x: source.start.x, z: source.start.z + 400 }, end: { x: source.end.x, z: source.end.z + 400 }, locked: false }
  return { project: { ...project, walls: [...project.walls, copy] }, selection: { type: 'wall', id } }
}

export function deleteSelection(project: Project, selection: EntitySelection): Project {
  if (selection.type === 'artwork') {
    const item = project.artworks.find(artwork => artwork.id === selection.id)
    if (!item) return project
    if (item.locked) throw new Error('잠긴 작품은 삭제할 수 없습니다.')
    return { ...project, artworks: project.artworks.filter(artwork => artwork.id !== selection.id) }
  }
  const item = project.walls.find(wall => wall.id === selection.id)
  if (!item) return project
  if (item.locked) throw new Error('잠긴 벽은 삭제할 수 없습니다.')
  if (project.walls.length === 1) throw new Error('마지막 벽은 삭제할 수 없습니다.')
  const attached=project.artworks.filter(artwork=>artwork.wallId===selection.id)
  if(attached.some(artwork=>artwork.locked))throw new Error('이 벽의 잠긴 작품을 먼저 잠금 해제해 주세요.')
  const unplaced:UnplacedArtwork[]=attached.map(({wallId:_,groupId:__,...artwork})=>artwork)
  const scenes = project.scenes.map(scene => {
    if(scene.structure)return scene
    const wallVisibility = Object.fromEntries(Object.entries(scene.wallVisibility).filter(([id]) => id !== selection.id))
    return { ...scene, artworks: scene.artworks.filter(artwork => artwork.wallId !== selection.id), wallVisibility }
  })
  return { ...project, walls: project.walls.filter(wall => wall.id !== selection.id), artworks:project.artworks.filter(artwork=>artwork.wallId!==selection.id), unplacedArtworks:[...(project.unplacedArtworks??[]),...unplaced], openings:removeWallOpenings(project.openings,selection.id), scenes }
}

export function placeUnplacedArtwork(project:Project,id:string,wallId:string):Project{
  const artwork=project.unplacedArtworks?.find(item=>item.id===id)
  if(!artwork)throw new Error('미배치 작품을 찾을 수 없습니다.')
  const wall=project.walls.find(item=>item.id===wallId)
  if(!wall)throw new Error('배치할 벽을 찾을 수 없습니다.')
  const size=rotatedArtworkSize({...artwork,wallId})
  const clampCenter=(value:number,extent:number,container:number)=>{
    const margin=Math.min(extent/2,container/2)
    return Math.max(margin,Math.min(container-margin,value))
  }
  const alongMm=clampCenter(artwork.alongMm,size.widthMm,wallLength(wall))
  const centerHeightMm=clampCenter(artwork.centerHeightMm,size.heightMm,wall.heightMm)
  const placed:Artwork={...artwork,groupId:undefined,wallId,alongMm,centerHeightMm}
  validateArtwork(placed,new Set(project.walls.map(item=>item.id)))
  return {...project,artworks:[...project.artworks,placed],unplacedArtworks:project.unplacedArtworks!.filter(item=>item.id!==id)}
}

export function distributeArtworks(project: Project, ids: string[], spacingMm: number): Project {
  finite(spacingMm, '간격')
  if (spacingMm < 0) throw new Error('작품 간격은 0 이상이어야 합니다.')
  const unique = [...new Set(ids)]
  if (unique.length < 2) throw new Error('간격을 맞출 작품을 2개 이상 선택해 주세요.')
  const selected = unique.map(id => project.artworks.find(item => item.id === id))
  if (selected.some(item => !item)) throw new Error('선택한 작품을 찾을 수 없습니다.')
  const artworks = selected as Artwork[]
  if (new Set(artworks.map(item => item.wallId)).size !== 1) throw new Error('같은 벽의 작품만 간격을 맞출 수 있습니다.')
  if (new Set(artworks.map(item => item.wallSide ?? 'front')).size !== 1) throw new Error('같은 벽의 같은 면에 있는 작품을 선택해 주세요.')
  if (artworks.some(item => item.locked)) throw new Error('잠긴 작품은 간격을 변경할 수 없습니다.')
  const sorted = [...artworks].sort((a, b) => a.alongMm - b.alongMm)
  let left = sorted[0].alongMm - rotatedArtworkSize(sorted[0]).widthMm / 2
  const positions = new Map<string, number>()
  for (const item of sorted) {
    const width=rotatedArtworkSize(item).widthMm
    positions.set(item.id, left + width / 2)
    left += width + spacingMm
  }
  return { ...project, artworks: project.artworks.map(item => positions.has(item.id) ? { ...item, alongMm: positions.get(item.id)! } : item) }
}

export function artworkWarnings(artwork: Artwork, wall: Wall, project?:Project): string[] {
  const warnings: string[] = []
  const size=rotatedArtworkSize(artwork)
  if (artwork.alongMm - size.widthMm / 2 < 0 || artwork.alongMm + size.widthMm / 2 > wallLength(wall)) warnings.push('작품이 벽의 좌우 경계를 벗어납니다.')
  if (artwork.centerHeightMm - size.heightMm / 2 < 0) warnings.push('작품이 바닥 아래로 내려갑니다.')
  if (artwork.centerHeightMm + size.heightMm / 2 > wall.heightMm) warnings.push('작품이 벽 높이를 넘어갑니다.')
  if(project){
    const position=artworkPosition(artwork,wall),c=Math.cos(position.rotationY),s=Math.sin(position.rotationY);
    const halfWidth=size.widthMm/2+(artwork.frame==='none'?0:22.5),halfDepth=artwork.depthMm/2;
    const footprint=[[-halfWidth,-halfDepth],[halfWidth,-halfDepth],[halfWidth,halfDepth],[-halfWidth,halfDepth]].map(([x,z])=>({x:position.x+c*x+s*z,z:position.z-s*x+c*z}));
    if(installationZones(project).some(zone=>footprintOverlapsZone(footprint,zone)))warnings.push('작품이 계단 또는 계단 추정 영역의 설치 제외 범위와 겹칩니다.');
  }
  return warnings
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 형식이 올바르지 않습니다.`)
  return value as Record<string, unknown>
}
function text(value: unknown, label: string): asserts value is string { if (typeof value !== 'string') throw new Error(`${label}은(는) 문자열이어야 합니다.`) }
function bool(value: unknown, label: string): asserts value is boolean { if (typeof value !== 'boolean') throw new Error(`${label}은(는) 참/거짓이어야 합니다.`) }
function safeImage(value: unknown, label: string) {
  text(value, label)
  if (value.length > imageLimit) throw new Error(`${label} 이미지 문자열은 12MB 이하여야 합니다.`)
  if (!/^\/artworks\/artwork-[1-5]\.png$/.test(value) && !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error(`${label} 이미지 URL은 안전한 PNG, JPEG, WEBP 또는 제공된 작품 경로여야 합니다.`)
}

export function parseProject(input: unknown): Project {
  const raw = object(input, '프로젝트')
  if(raw.referenceModel!==undefined)validateReferenceModel(raw.referenceModel)
  if (raw.schemaVersion !== 1) throw new Error('지원하지 않는 프로젝트 스키마입니다.')
  ;['id', 'name', 'venue', 'floorColor'].forEach(key => text(raw[key], `프로젝트 ${key}`))
  if (!Array.isArray(raw.walls) || !Array.isArray(raw.artworks) || !Array.isArray(raw.scenes)) throw new Error('벽, 작품, 장면 목록 형식이 올바르지 않습니다.')
  if (raw.walls.length === 0) throw new Error('프로젝트에는 벽이 하나 이상 있어야 합니다.')
  if (raw.unplacedArtworks!==undefined&&!Array.isArray(raw.unplacedArtworks))throw new Error('미배치 작품 목록 형식이 올바르지 않습니다.')
  if (raw.walls.length > wallLimit || raw.artworks.length+(raw.unplacedArtworks?.length??0) > artworkLimit) throw new Error('프로젝트 객체 수 제한을 초과했습니다.')
  const walls = raw.walls as Wall[]
  const wallIds = new Set<string>()
  for (const value of walls) {
    const wall = object(value, '벽') as unknown as Wall
    ;['id', 'name', 'color', 'note'].forEach(key => text((wall as unknown as Record<string, unknown>)[key], `벽 ${key}`))
    bool(wall.visible, '벽 표시 여부'); bool(wall.locked, '벽 잠금 여부'); validateWall(wall)
    if (wallIds.has(wall.id)) throw new Error(`중복된 벽 ID가 있습니다: ${wall.id}`)
    wallIds.add(wall.id)
  }
  if(raw.openings!==undefined)validateOpenings(raw.openings,walls);
  if(raw.dimensions!==undefined)validateDimensions(raw.dimensions);
  const validateArtworkRecord = (value: unknown, ids?: Set<string>,allowedWalls=wallIds) => {
    const artwork = object(value, '작품') as unknown as Artwork
    ;['id', 'name', 'artist', 'wallId', 'note'].forEach(key => text((artwork as unknown as Record<string, unknown>)[key], `작품 ${key}`))
    bool(artwork.visible, '작품 표시 여부'); bool(artwork.locked, '작품 잠금 여부')
    validateArtwork(artwork, allowedWalls)
    if (ids?.has(artwork.id)) throw new Error(`중복된 작품 ID가 있습니다: ${artwork.id}`)
    ids?.add(artwork.id)
    return artwork
  }
  const artworkIds = new Set<string>()
  for (const value of raw.artworks) validateArtworkRecord(value, artworkIds)
  validateArtworkGroups(raw.artworks as Artwork[])
  for(const value of raw.unplacedArtworks??[]){
    const unplaced=object(value,'미배치 작품')
    if('wallId' in unplaced)throw new Error('미배치 작품에는 설치 벽이 없어야 합니다.')
    validateArtworkRecord({...unplaced,wallId:walls[0].id},artworkIds)
  }
  for (const id of artworkIds) if (wallIds.has(id)) throw new Error(`서로 다른 객체에 중복된 ID가 있습니다: ${id}`)
  const sceneIds = new Set<string>()
  for (const value of raw.scenes) {
    const scene = object(value, '장면')
    const sceneId = scene.id
    text(sceneId, '장면 ID'); text(scene.name, '장면 이름')
    if (sceneIds.has(sceneId)) throw new Error(`중복된 장면 ID가 있습니다: ${sceneId}`)
    sceneIds.add(sceneId)
    let sceneWallIds=wallIds
    if(scene.structure!==undefined){
      const structure=object(scene.structure,'장면 구조')
      if(structure.referenceModel!==undefined)validateReferenceModel(structure.referenceModel)
      if(!Array.isArray(structure.walls)||structure.walls.length<1||structure.walls.length>wallLimit)throw new Error('장면 벽 목록이 올바르지 않습니다.')
      sceneWallIds=new Set<string>()
      for(const value of structure.walls){
        const wall=object(value,'장면 벽') as unknown as Wall
        for(const key of ['id','name','color','note'])text((wall as unknown as Record<string,unknown>)[key],`장면 벽 ${key}`)
        bool(wall.visible,'장면 벽 표시 여부');bool(wall.locked,'장면 벽 잠금 여부');validateWall(wall)
        if(sceneWallIds.has(wall.id))throw new Error(`장면에 중복된 벽 ID가 있습니다: ${wall.id}`)
        sceneWallIds.add(wall.id)
      }
      validateOpenings(structure.openings,structure.walls as Wall[])
      validateDimensions(structure.dimensions)
      if(!Array.isArray(structure.unplacedArtworks))throw new Error('장면 미배치 작품 목록이 올바르지 않습니다.')
    }
    if (!Array.isArray(scene.artworks) || scene.artworks.length > 500) throw new Error('장면 작품 목록이 올바르지 않습니다.')
    const snapshotIds = new Set<string>()
    for (const artwork of scene.artworks) validateArtworkRecord(artwork, snapshotIds,sceneWallIds)
    validateArtworkGroups(scene.artworks as Artwork[])
    if(scene.structure!==undefined){
      const structure=scene.structure as Record<string,unknown>
      if(scene.artworks.length+(structure.unplacedArtworks as unknown[]).length>artworkLimit)throw new Error('장면 작품 수 제한을 초과했습니다.')
      const firstWall=(structure.walls as Wall[])[0].id
      for(const value of structure.unplacedArtworks as unknown[]){
        const unplaced=object(value,'장면 미배치 작품')
        if('wallId' in unplaced)throw new Error('장면 미배치 작품에는 설치 벽이 없어야 합니다.')
        validateArtworkRecord({...unplaced,wallId:firstWall},snapshotIds,sceneWallIds)
      }
      for(const id of snapshotIds)if(sceneWallIds.has(id))throw new Error(`장면에 중복된 객체 ID가 있습니다: ${id}`)
    }
    const visibility = object(scene.wallVisibility, '장면 벽 표시 설정')
    for (const [id, visible] of Object.entries(visibility)) {
      if (!sceneWallIds.has(id)) throw new Error(`장면이 존재하지 않는 벽을 참조합니다: ${id}`)
      bool(visible, '장면 벽 표시 여부')
    }
    if(scene.cameraView!==undefined){
      const camera=object(scene.cameraView,'장면 시점')
      if(camera.projection!==undefined&&!['orthographic','perspective'].includes(String(camera.projection)))throw new Error('장면 투영 방식이 올바르지 않습니다.')
      if(camera.fov!==undefined&&(!Number.isFinite(camera.fov)||Number(camera.fov)<20||Number(camera.fov)>100))throw new Error('장면 화각이 올바르지 않습니다.')
      for(const key of ['position','target'] as const){
        const point=camera[key]
        if(!Array.isArray(point)||point.length!==3||point.some(value=>!Number.isFinite(value)))throw new Error('장면 시점 좌표가 올바르지 않습니다.')
      }
      if(!Number.isFinite(camera.zoom)||Number(camera.zoom)<=0)throw new Error('장면 시점 확대율이 올바르지 않습니다.')
    }
  }
  if ('planImageUrl' in raw && raw.planImageUrl !== undefined) safeImage(raw.planImageUrl, '도면')
  if ('planOpacity' in raw && raw.planOpacity !== undefined) { finite(raw.planOpacity, '도면 투명도'); if (raw.planOpacity < 0 || raw.planOpacity > 1) throw new Error('도면 투명도는 0에서 1 사이여야 합니다.') }
  if (raw.planReference !== undefined) {
    if (!raw.planImageUrl) throw new Error('도면 이미지가 필요합니다.')
    validatePlanReference(raw.planReference as Project['planReference'] & {})
  }
  if(raw.planDraft!==undefined){
    const draft=object(raw.planDraft,'도면 편집 초안');
    if(draft.kind!=='partial'||typeof draft.sourceEvidenceHash!=='string'||!/^[0-9a-f]{8}$/.test(draft.sourceEvidenceHash)||!raw.planImageUrl||!raw.planReference||!Array.isArray(draft.originalWalls)||draft.originalWalls.length<1||draft.originalWalls.length>wallLimit)throw new Error('도면 편집 초안 정보가 올바르지 않습니다.');
    const originalIds=new Set<string>();
    for(const value of draft.originalWalls){const wall=object(value,'원본 벽 후보') as unknown as Wall;for(const key of ['id','name','color','note'])text((wall as unknown as Record<string,unknown>)[key],`원본 벽 ${key}`);bool(wall.visible,'원본 벽 표시 여부');bool(wall.locked,'원본 벽 잠금 여부');validateWall(wall);if(originalIds.has(wall.id))throw new Error('중복된 원본 벽 후보가 있습니다.');originalIds.add(wall.id);}
  }
  if(raw.sourcePlan!==undefined){
    const source=object(raw.sourcePlan,'원본 도면');safeImage(source.imageUrl,'원본 도면');
    for(const key of ['widthPx','heightPx'])if(typeof source[key]!=='number'||!Number.isFinite(source[key])||source[key]<1||source[key]>10000)throw new Error('원본 도면 크기가 올바르지 않습니다.');
    validatePlanLabels(source.labels,source.widthPx as number,source.heightPx as number);
  }
  const result=structuredClone(raw);
  if(raw.planLabels!==undefined){const r=raw.planReference as Project['planReference'];if(!r)throw new Error('표기 인식 결과에 도면 정보가 필요합니다.');result.planLabels=validatePlanLabels(raw.planLabels,r.widthPx,r.heightPx);}
  if(raw.planAnalysis!==undefined){
    const a=raw.planAnalysis as Project['planAnalysis'],r=raw.planReference as Project['planReference'];
    if(!a||!r||!Array.isArray(a.lines)||a.lines.length>500||!Array.isArray(a.issues)||a.issues.length>30||a.issues.some(v=>typeof v!=='string'||v.length>2000)||!['complete','failed'].includes(a.textState)||!['complete','failed'].includes(a.lineState)||!Number.isInteger(a.numericCount)||a.numericCount<0||a.numericCount>500)throw new Error('자동 도면 분석 정보가 올바르지 않습니다.');
    if(a.selfCheck&&(!['stable','withheld'].includes(a.selfCheck.status)||!Number.isInteger(a.selfCheck.attempts)||a.selfCheck.attempts<2||a.selfCheck.attempts>3))throw new Error('자동 검증 정보가 올바르지 않습니다.');
    if(a.stairRegions!==undefined){
      if(!Array.isArray(a.stairRegions)||a.stairRegions.length>50)throw new Error('계단 검출 영역이 올바르지 않습니다.');
      const regionIds=new Set<string>();
      for(const region of a.stairRegions){const b=region?.box;if(!region||region.kind!=='stairs'||typeof region.id!=='string'||region.id.length>200||regionIds.has(region.id)||!Array.isArray(region.lineIds)||region.lineIds.length<3||region.lineIds.length>30||region.lineIds.some(id=>!a.lines.some(l=>l.id===id))||(region.evidence==='shape'?(region.labelId!==undefined||!Array.isArray(region.railIds)||region.railIds.length<2||region.railIds.length>30||region.railIds.some(id=>!a.lines.some(l=>l.id===id))):(region.evidence!==undefined||!result.planLabels||!(result.planLabels as PlanLabel[]).some(l=>l.id===region.labelId&&l.kind==='stairs')))||!b||![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.x<0||b.y<0||b.width<=0||b.height<=0||b.x+b.width>r.widthPx||b.y+b.height>r.heightPx)throw new Error('계단 검출 영역이 올바르지 않습니다.');regionIds.add(region.id);}
    }
    const ids=new Set<string>();
    for(const line of a.lines){if(!line||typeof line.id!=='string'||line.id.length>200||ids.has(line.id)||!Number.isFinite(line.thicknessPx)||line.thicknessPx<=0||(line.solidSupportThicknessPx!==undefined&&(!Number.isFinite(line.solidSupportThicknessPx)||line.solidSupportThicknessPx<=0||line.solidSupportThicknessPx>Math.max(r.widthPx,r.heightPx)))||![line.start,line.end].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=r.widthPx&&p.y<=r.heightPx))throw new Error('자동 분석 선 정보가 올바르지 않습니다.');ids.add(line.id);}
  }
  return result as unknown as Project
}
