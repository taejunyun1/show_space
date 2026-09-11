import {validateOpenings} from './openings';
import {validatePlanLabels} from './planLabels'
import { validatePlanReference } from './plan'
import type { Artwork, EntitySelection, Point, Project, Wall } from './types'

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
  if (wall.role !== undefined && !['boundary','partition'].includes(wall.role)) throw new Error('벽 용도가 올바르지 않습니다.')
  if (!isPoint(wall.start) || !isPoint(wall.end)) throw new Error('벽 좌표는 유한한 숫자여야 합니다.')
  positive(wall.heightMm, '벽 높이')
  positive(wall.thicknessMm, '벽 두께')
  if (wallLength(wall) === 0) throw new Error('벽 길이는 0보다 커야 합니다.')
}

function validateArtwork(artwork: Artwork, wallIds: Set<string>) {
  if (artwork.wallSide !== undefined && !['front','back'].includes(artwork.wallSide)) throw new Error('설치 면이 올바르지 않습니다.')
  positive(artwork.widthMm, '작품 너비')
  positive(artwork.heightMm, '작품 높이')
  positive(artwork.depthMm, '작품 깊이')
  finite(artwork.alongMm, '작품 위치')
  finite(artwork.centerHeightMm, '작품 중심 높이')
  if (!wallIds.has(artwork.wallId)) throw new Error(`존재하지 않는 벽을 참조합니다: ${artwork.wallId}`)
  if (!frames.has(artwork.frame)) throw new Error('작품 프레임 값이 올바르지 않습니다.')
  safeImage(artwork.imageUrl, '작품')
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

export function wallLength(wall: Wall): number { return Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z) }
export function mmToMeters(value: number): number { return value / 1000 }

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
  const id = uniqueId('wall', [...project.walls, ...project.artworks].map(item => item.id))
  const z = project.walls.length * 400
  const wall: Wall = { id, role: 'partition', name: `새 벽 ${project.walls.length + 1}`, start: { x: 0, z }, end: { x: 3000, z }, heightMm: 3200, thicknessMm: 160, color: '#ffffff', visible: true, locked: false, note: '' }
  return { ...project, walls: [...project.walls, wall] }
}

export function addArtwork(project: Project, imageUrl = '/artworks/artwork-1.png', name = '새 작품'): Project {
  if (!project.walls.length) throw new Error('작품을 배치할 벽이 없습니다.')
  if (project.artworks.length >= artworkLimit) throw new Error(`작품은 최대 ${artworkLimit}개까지 만들 수 있습니다.`)
  const id = uniqueId('artwork', [...project.walls, ...project.artworks].map(item => item.id))
  const artwork: Artwork = { id, name, artist: '', widthMm: 900, heightMm: 1200, depthMm: 30, wallId: project.walls[0].id, alongMm: 450, centerHeightMm: 1500, frame: 'natural', imageUrl, visible: true, locked: false, note: '' }
  validateArtwork(artwork, new Set(project.walls.map(wall => wall.id)))
  return { ...project, artworks: [...project.artworks, artwork] }
}

export function duplicateSelection(project: Project, selection: EntitySelection): { project: Project; selection: EntitySelection } {
  if (selection.type === 'artwork') {
    const source = project.artworks.find(item => item.id === selection.id)
    if (!source) throw new Error('복제할 작품을 찾을 수 없습니다.')
    if (project.artworks.length >= artworkLimit) throw new Error(`작품은 최대 ${artworkLimit}개까지 만들 수 있습니다.`)
    const id = uniqueId('artwork', [...project.walls, ...project.artworks].map(item => item.id))
    const copy = { ...source, id, name: `${source.name} 복사본`, alongMm: source.alongMm + 200, locked: false }
    return { project: { ...project, artworks: [...project.artworks, copy] }, selection: { type: 'artwork', id } }
  }
  const source = project.walls.find(item => item.id === selection.id)
  if (!source) throw new Error('복제할 벽을 찾을 수 없습니다.')
  if (project.walls.length >= wallLimit) throw new Error(`벽은 최대 ${wallLimit}개까지 만들 수 있습니다.`)
  const id = uniqueId('wall', [...project.walls, ...project.artworks].map(item => item.id))
  const copy = { ...source, id, name: `${source.name} 복사본`, start: { x: source.start.x, z: source.start.z + 400 }, end: { x: source.end.x, z: source.end.z + 400 }, locked: false }
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
  if (project.artworks.some(artwork => artwork.wallId === selection.id)) throw new Error('이 벽의 작품을 다른 벽으로 먼저 이동해 주세요.')
  const scenes = project.scenes.map(scene => {
    const wallVisibility = Object.fromEntries(Object.entries(scene.wallVisibility).filter(([id]) => id !== selection.id))
    return { ...scene, artworks: scene.artworks.filter(artwork => artwork.wallId !== selection.id), wallVisibility }
  })
  return { ...project, walls: project.walls.filter(wall => wall.id !== selection.id), openings:project.openings?.filter(o=>o.start.wallId!==selection.id&&o.end.wallId!==selection.id), scenes }
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
  let left = sorted[0].alongMm - sorted[0].widthMm / 2
  const positions = new Map<string, number>()
  for (const item of sorted) {
    positions.set(item.id, left + item.widthMm / 2)
    left += item.widthMm + spacingMm
  }
  return { ...project, artworks: project.artworks.map(item => positions.has(item.id) ? { ...item, alongMm: positions.get(item.id)! } : item) }
}

export function artworkWarnings(artwork: Artwork, wall: Wall): string[] {
  const warnings: string[] = []
  if (artwork.alongMm - artwork.widthMm / 2 < 0 || artwork.alongMm + artwork.widthMm / 2 > wallLength(wall)) warnings.push('작품이 벽의 좌우 경계를 벗어납니다.')
  if (artwork.centerHeightMm - artwork.heightMm / 2 < 0) warnings.push('작품이 바닥 아래로 내려갑니다.')
  if (artwork.centerHeightMm + artwork.heightMm / 2 > wall.heightMm) warnings.push('작품이 벽 높이를 넘어갑니다.')
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
  if (raw.schemaVersion !== 1) throw new Error('지원하지 않는 프로젝트 스키마입니다.')
  ;['id', 'name', 'venue', 'floorColor'].forEach(key => text(raw[key], `프로젝트 ${key}`))
  if (!Array.isArray(raw.walls) || !Array.isArray(raw.artworks) || !Array.isArray(raw.scenes)) throw new Error('벽, 작품, 장면 목록 형식이 올바르지 않습니다.')
  if (raw.walls.length === 0) throw new Error('프로젝트에는 벽이 하나 이상 있어야 합니다.')
  if (raw.walls.length > wallLimit || raw.artworks.length > artworkLimit) throw new Error('프로젝트 객체 수 제한을 초과했습니다.')
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
  const validateArtworkRecord = (value: unknown, ids?: Set<string>) => {
    const artwork = object(value, '작품') as unknown as Artwork
    ;['id', 'name', 'artist', 'wallId', 'note'].forEach(key => text((artwork as unknown as Record<string, unknown>)[key], `작품 ${key}`))
    bool(artwork.visible, '작품 표시 여부'); bool(artwork.locked, '작품 잠금 여부')
    validateArtwork(artwork, wallIds)
    if (ids?.has(artwork.id)) throw new Error(`중복된 작품 ID가 있습니다: ${artwork.id}`)
    ids?.add(artwork.id)
    return artwork
  }
  const artworkIds = new Set<string>()
  for (const value of raw.artworks) validateArtworkRecord(value, artworkIds)
  for (const id of artworkIds) if (wallIds.has(id)) throw new Error(`서로 다른 객체에 중복된 ID가 있습니다: ${id}`)
  const sceneIds = new Set<string>()
  for (const value of raw.scenes) {
    const scene = object(value, '장면')
    const sceneId = scene.id
    text(sceneId, '장면 ID'); text(scene.name, '장면 이름')
    if (sceneIds.has(sceneId)) throw new Error(`중복된 장면 ID가 있습니다: ${sceneId}`)
    sceneIds.add(sceneId)
    if (!Array.isArray(scene.artworks) || scene.artworks.length > 500) throw new Error('장면 작품 목록이 올바르지 않습니다.')
    const snapshotIds = new Set<string>()
    for (const artwork of scene.artworks) validateArtworkRecord(artwork, snapshotIds)
    const visibility = object(scene.wallVisibility, '장면 벽 표시 설정')
    for (const [id, visible] of Object.entries(visibility)) {
      if (!wallIds.has(id)) throw new Error(`장면이 존재하지 않는 벽을 참조합니다: ${id}`)
      bool(visible, '장면 벽 표시 여부')
    }
  }
  if ('planImageUrl' in raw && raw.planImageUrl !== undefined) safeImage(raw.planImageUrl, '도면')
  if ('planOpacity' in raw && raw.planOpacity !== undefined) { finite(raw.planOpacity, '도면 투명도'); if (raw.planOpacity < 0 || raw.planOpacity > 1) throw new Error('도면 투명도는 0에서 1 사이여야 합니다.') }
  if (raw.planReference !== undefined) {
    if (!raw.planImageUrl) throw new Error('도면 이미지가 필요합니다.')
    validatePlanReference(raw.planReference as Project['planReference'] & {})
  }
  const result=structuredClone(raw);
  if(raw.planLabels!==undefined){const r=raw.planReference as Project['planReference'];if(!r)throw new Error('표기 인식 결과에 도면 정보가 필요합니다.');result.planLabels=validatePlanLabels(raw.planLabels,r.widthPx,r.heightPx);}
  if(raw.planAnalysis!==undefined){
    const a=raw.planAnalysis as Project['planAnalysis'],r=raw.planReference as Project['planReference'];
    if(!a||!r||!Array.isArray(a.lines)||a.lines.length>500||!Array.isArray(a.issues)||a.issues.length>30||a.issues.some(v=>typeof v!=='string'||v.length>2000)||!['complete','failed'].includes(a.textState)||!['complete','failed'].includes(a.lineState)||!Number.isInteger(a.numericCount)||a.numericCount<0||a.numericCount>500)throw new Error('자동 도면 분석 정보가 올바르지 않습니다.');
    if(a.selfCheck&&(!['stable','withheld'].includes(a.selfCheck.status)||!Number.isInteger(a.selfCheck.attempts)||a.selfCheck.attempts<2||a.selfCheck.attempts>3))throw new Error('자동 검증 정보가 올바르지 않습니다.');
    const ids=new Set<string>();
    for(const line of a.lines){if(!line||typeof line.id!=='string'||line.id.length>200||ids.has(line.id)||!Number.isFinite(line.thicknessPx)||line.thicknessPx<=0||![line.start,line.end].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=r.widthPx&&p.y<=r.heightPx))throw new Error('자동 분석 선 정보가 올바르지 않습니다.');ids.add(line.id);}
  }
  return result as unknown as Project
}
