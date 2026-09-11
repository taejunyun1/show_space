import {installationZones} from '../domain/installationZones';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line, useTexture } from '@react-three/drei';
import { Group, Path, Shape, SRGBColorSpace } from 'three';
import type { Artwork, Wall } from '../domain/types';
import { artworkPosition, artworkWarnings, wallLength } from '../domain/model';
import {floorWithOpenings,openingSegments} from '../domain/openings';
import { useEditor } from '../state/editor';
import { artPanel } from '../lib/art';
const frameColors = { black: '#282827', natural: '#b9a383', white: '#f5f4ef', none: '#eee8dc' };
function Painting({ artwork, wall }: { artwork: Artwork; wall: Wall }) {
  const project=useEditor(s=>s.project);
  const installationConflict=artworkWarnings(artwork,wall,project).some(w=>w.includes('계단'));
  const source = useTexture(artwork.imageUrl);
  const texture = useMemo(() => {
    const t = source.clone(); t.colorSpace = SRGBColorSpace;
    const panel = artPanel(artwork.imageUrl);
    if (panel !== null) { t.repeat.set(0.2, 1); t.offset.set(panel * 0.2, 0); }
    t.needsUpdate = true; return t;
  }, [source, artwork.imageUrl]);
  useEffect(() => () => texture.dispose(), [texture]);
  const selected = useEditor(s => s.selected.some(x => x.id === artwork.id));
  const { x, y, z, rotationY } = artworkPosition(artwork, wall);
  const w = artwork.widthMm / 1000, h = artwork.heightMm / 1000, d = artwork.depthMm / 1000;
  return <group position={[x / 1000, y / 1000, z / 1000]} rotation={[0, rotationY, 0]} onClick={e => { e.stopPropagation(); useEditor.getState().select({ type: 'artwork', id: artwork.id }, e.shiftKey); }} onPointerOver={e => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = 'auto'; }}><mesh castShadow receiveShadow><boxGeometry args={[w + (artwork.frame === 'none' ? 0 : 0.045), h + (artwork.frame === 'none' ? 0 : 0.045), d]} /><meshStandardMaterial color={frameColors[artwork.frame]} roughness={0.75} /></mesh><mesh position={[0, 0, d / 2 + 0.002]}><planeGeometry args={[w, h]} /><meshStandardMaterial map={texture} roughness={0.9} /></mesh>{installationConflict&&<Html position={[0,h/2+.15,0]} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="dimension-label" style={{color:'#a22'}}>계단·추정 범위와 겹침</span></Html>}{selected && <Line points={[[-w / 2 - 0.055, -h / 2 - 0.055, d / 2 + 0.008], [w / 2 + 0.055, -h / 2 - 0.055, d / 2 + 0.008], [w / 2 + 0.055, h / 2 + 0.055, d / 2 + 0.008], [-w / 2 - 0.055, h / 2 + 0.055, d / 2 + 0.008], [-w / 2 - 0.055, -h / 2 - 0.055, d / 2 + 0.008]]} color="#365cf5" lineWidth={2} />}</group>;
}
function GalleryWall({ wall, artworks, cutaway }: { wall: Wall; artworks: Artwork[]; cutaway: boolean }) {
  const group = useRef<Group>(null);
  const selected = useEditor(s => s.selected.some(x => x.id === wall.id));
  const length = wallLength(wall);
  const midX = (wall.start.x + wall.end.x) / 2000, midZ = (wall.start.z + wall.end.z) / 2000;
  const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
  useFrame(({ camera }) => {
    if (group.current) group.current.visible = wall.visible && (!cutaway || wall.role === 'partition' || (-dz * (camera.position.x - midX) + dx * (camera.position.z - midZ)) > 0);
  });
  return <group ref={group}><mesh position={[midX, wall.heightMm / 2000, midZ]} rotation={[0, -Math.atan2(dz, dx), 0]} castShadow receiveShadow onClick={e => { e.stopPropagation(); useEditor.getState().select({ type: 'wall', id: wall.id }, e.shiftKey); }}><boxGeometry args={[length / 1000, wall.heightMm / 1000, wall.thicknessMm / 1000]} /><meshStandardMaterial color={selected ? '#e6edff' : wall.color} roughness={0.92} /></mesh>{artworks.filter(a => a.visible && a.imageUrl).map(a => <Suspense key={a.id} fallback={null}><Painting artwork={a} wall={wall} /></Suspense>)}</group>;
}
function CameraSetup({ reset, onReady, centerX, centerZ, span, maxHeight }: { reset: number; onReady: (capture: () => void) => void; centerX:number; centerZ:number; span:number; maxHeight:number }) {
  const { camera, gl, scene, size } = useThree();
  useEffect(() => {
    camera.position.set(centerX-span, maxHeight+span, centerZ+span); camera.lookAt(centerX, maxHeight/3, centerZ);
    camera.far=Math.max(200,span*10+maxHeight*4);
    if ('zoom' in camera) camera.zoom = Math.min(size.width / (span*1.2+2), size.height / (span+maxHeight+2));
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, reset, centerX, centerZ, span, maxHeight]);
  useEffect(() => onReady(() => {
    gl.render(scene, camera);
    gl.domElement.toBlob(blob => {
      if (!blob) { useEditor.getState().notify('이미지를 만들지 못했습니다.'); return; }
      import('../lib/art').then(({ downloadBlob }) => downloadBlob(blob, `${useEditor.getState().project.name}.png`));
    });
  }), [gl, scene, camera, onReady]);
  return null;
}
function Dimension({ from, to, label }: { from: [number, number, number]; to: [number, number, number]; label: string }) {
  const mid: [number, number, number] = [(from[0] + to[0]) / 2, 0.035, (from[2] + to[2]) / 2];
  const across = Math.abs(from[0] - to[0]) > Math.abs(from[2] - to[2]);
  return <group><Line points={[from, to]} color="#748193" lineWidth={1} />{[from, to].map((p, i) => <Line key={i} points={across ? [[p[0], p[1], p[2] - 0.10], [p[0], p[1], p[2] + 0.10]] : [[p[0] - 0.10, p[1], p[2]], [p[0] + 0.10, p[1], p[2]]]} color="#748193" lineWidth={1} />)}<Html position={mid} center style={{ pointerEvents: 'none' }}><span className="dimension-label">{label}</span></Html></group>;
}
export function Gallery3D({ reset, onCaptureReady, cutaway }: { reset: number; onCaptureReady: (capture: () => void) => void; cutaway: boolean }) {
  const { project, showDimensions } = useEditor();
  const floor = useMemo(() => floorWithOpenings(project), [project.walls,project.openings]);
  const floorShapes = useMemo(() => floor.surfaces.map(({ outer: points, holes }) => {
    const shape = new Shape();
    shape.moveTo(points[0].x / 1000, points[0].z / 1000);
    points.slice(1).forEach(point => shape.lineTo(point.x / 1000, point.z / 1000));
    shape.closePath();
    shape.holes = holes.map(points => {
      const hole = new Path();
      // Hole winding opposes the counterclockwise outer boundary.
      const reversed = [...points].reverse();
      hole.moveTo(reversed[0].x / 1000, reversed[0].z / 1000);
      reversed.slice(1).forEach(point => hole.lineTo(point.x / 1000, point.z / 1000));
      hole.closePath();
      return hole;
    });
    return shape;
  }), [floor]);
  const points = project.walls.flatMap(w => [w.start, w.end]);
  const minX = Math.min(...points.map(p => p.x)) / 1000, maxX = Math.max(...points.map(p => p.x)) / 1000;
  const minZ = Math.min(...points.map(p => p.z)) / 1000, maxZ = Math.max(...points.map(p => p.z)) / 1000;
  const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
  const span=Math.max(Math.hypot(maxX-minX,maxZ-minZ),2),maxHeight=Math.max(...project.walls.map(w=>w.heightMm))/1000;
  return <Canvas orthographic shadows dpr={[1, 1.75]} gl={{ antialias: true, preserveDrawingBuffer: true }} camera={{ position: [-9, 10.5, 13], zoom: 65, near: 0.1, far: 200 }}><color attach="background" args={['#e9edf1']} /><ambientLight intensity={0.65} /><hemisphereLight args={['#ffffff', '#cad0d6', 0.7]} /><directionalLight position={[-3, 12, 6]} intensity={2.3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-bias={-0.001} /><CameraSetup reset={reset} onReady={onCaptureReady} centerX={centerX} centerZ={centerZ} span={span} maxHeight={maxHeight} /><gridHelper args={[60, 60, '#cbd3db', '#dce2e8']} position={[0, -0.105, 0]} />{floorShapes.map((shape, index) => <mesh key={index} rotation={[Math.PI / 2, 0, 0]} receiveShadow><extrudeGeometry args={[shape, { depth: 0.16, bevelEnabled: false, steps: 1 }]} /><meshStandardMaterial color={project.floorColor} roughness={0.96} /></mesh>)}{floorShapes.length === 0 && <Html position={[0, 0.1, 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}><span className="dimension-label">벽 끝점을 연결해 닫힌 외곽선을 만들면 바닥이 생성됩니다.</span></Html>}{openingSegments(project).map(o=><group key={o.id}><Line points={[[o.start.x/1000,.03,o.start.z/1000],[o.end.x/1000,.03,o.end.z/1000]]} color={o.kind==='door'?'#16816b':'#2785b8'} dashed dashSize={.1} gapSize={.08}/><Html position={[(o.start.x+o.end.x)/2000,.12,(o.start.z+o.end.z)/2000]} center style={{pointerEvents:'none'}}><span className="dimension-label">{o.kind==='door'?'출입구':o.kind==='stair-access'?'계단 통로':'창문'} · 개구부</span></Html></group>)}{installationZones(project).map(zone=><group key={zone.id}><mesh position={[(zone.x+zone.width/2)/1000,.025,(zone.z+zone.depth/2)/1000]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[zone.width/1000,zone.depth/1000]}/><meshBasicMaterial color="#e44b4b" transparent opacity={.3} depthWrite={false}/></mesh><Html position={[(zone.x+zone.width/2)/1000,.08,(zone.z+zone.depth/2)/1000]} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="dimension-label" style={{color:'#a22'}}>계단·추정 · 설치 제외 검출 범위</span></Html></group>)}{project.walls.map(wall => <GalleryWall key={wall.id} wall={wall} artworks={project.artworks.filter(a => a.wallId === wall.id)} cutaway={cutaway} />)}{showDimensions && <><Dimension from={[minX, 0, maxZ + 0.65]} to={[maxX, 0, maxZ + 0.65]} label={`${Math.round((maxX - minX) * 1000).toLocaleString()} mm`} /><Dimension from={[minX - 0.65, 0, minZ]} to={[minX - 0.65, 0, maxZ]} label={`${Math.round((maxZ - minZ) * 1000).toLocaleString()} mm`} /></>}<OrbitControls key={reset} makeDefault target={[centerX, maxHeight/3, centerZ]} minZoom={0.1} maxZoom={240} maxPolarAngle={Math.PI / 2.08} enableDamping /></Canvas>;
}
