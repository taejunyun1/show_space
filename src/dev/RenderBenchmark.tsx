import type {RenderQuality} from '../lib/renderQuality';
import type {CaptureOptions} from '../lib/captureSvg';
import {downloadBlob} from '../lib/art';
import {useCallback,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Light,Mesh,Texture} from 'three';
import {Gallery3D} from '../components/Gallery3D';
import {createDemoProject,parseProject} from '../domain/model';
import {newLight,CUSTOM_LIGHTING} from '../domain/lighting';
import type {Project,Wall} from '../domain/types';
import {useEditor} from '../state/editor';

function fixture():Project{
 const p=createDemoProject();p.id='render-benchmark';p.name='50벽·100작품·20조명 성능 검증';p.scenes=[];
 const points=[{x:-30000,z:-20000},{x:30000,z:-20000},{x:30000,z:20000},{x:-30000,z:20000}];
 const walls:Wall[]=points.map((start,i)=>({...p.walls[0],id:`bench-wall-${i}`,name:`검증 벽 ${i+1}`,start,end:points[(i+1)%4],role:'boundary'}));
 for(let i=4;i<50;i++){const x=-26000+(i-4)%8*6500,z=-16000+Math.floor((i-4)/8)*6000;walls.push({...p.walls[0],id:`bench-wall-${i}`,name:`검증 벽 ${i+1}`,role:'partition',start:{x,z},end:{x:x+6000,z}});}
 p.walls=walls;
 p.artworks=Array.from({length:100},(_,i)=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const c=canvas.getContext('2d')!;const g=c.createLinearGradient(0,0,512,512);g.addColorStop(0,`hsl(${i*23%360} 55% 45%)`);g.addColorStop(1,`hsl(${(i*23+90)%360} 45% 75%)`);c.fillStyle=g;c.fillRect(0,0,512,512);c.fillStyle='#fff';c.font='bold 100px sans-serif';c.fillText(String(i+1),40,270);
  return {...p.artworks[0],id:`bench-art-${i}`,name:`검증 작품 ${i+1}`,imageUrl:canvas.toDataURL('image/jpeg',.8),wallId:walls[Math.floor(i/2)].id,alongMm:i%2?4500:1500,widthMm:1000,heightMm:1400,depthMm:30,centerHeightMm:1500};
 });
 const light=newLight(p,'spot');p.lights=Array.from({length:20},(_,i)=>({...light,id:`bench-light-${i}`,name:`검증 조명 ${i+1}`,kind:i%2?'area' as const:'spot' as const,position:{x:-24000+i%8*6500,y:3100,z:-15000+Math.floor(i/8)*7000},target:{x:-24000+i%8*6500,y:1400,z:-16000+Math.floor(i/8)*7000},shadow:i%2===0}));p.lighting=CUSTOM_LIGHTING;
 return parseProject(p);
}
type Report={frames:number;durationMs:number;medianFrameMs:number;p95FrameMs:number;medianSubmitMs:number;p95SubmitMs:number;calls:number;triangles:number;textures:number;imageTextureMiB:number;dpr:number;shadowCasters:number;canvasPixels:number};
function percentile(values:number[],p:number){const a=[...values].sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor((a.length-1)*p))]??0;}
function Probe({run,onDone,onCaptureFrame}:{run:number;onDone:(report:Report)=>void;onCaptureFrame:(report:{shadowCasters:number;dpr:number})=>void}){
 const captureSample=useRef('');
 const {invalidate}=useThree();const samples=useRef<{run:number;start:number;last:number;frames:number[];submit:number[]}>({run:0,start:0,last:0,frames:[],submit:[]});
 useFrame(({gl,scene,camera})=>{
  const now=performance.now();let s=samples.current;
  if(run&&s.run!==run){s=samples.current={run,start:now,last:now,frames:[],submit:[]};}
  const elapsed=now-s.start;
  if(run&&elapsed<6000){const angle=elapsed/4000;camera.position.set(Math.sin(angle)*65,55,Math.cos(angle)*65);camera.lookAt(0,1,0);camera.updateMatrixWorld();}
  const before=performance.now();gl.render(scene,camera);const submit=performance.now()-before;
  const capturing=useEditor.getState().captureClean;if(capturing){let shadowCasters=0;scene.traverse(o=>{if(o instanceof Light&&o.castShadow)shadowCasters++;});const sample=JSON.stringify([shadowCasters,gl.getPixelRatio()]);if(sample!==captureSample.current){captureSample.current=sample;onCaptureFrame({shadowCasters,dpr:gl.getPixelRatio()});}}else captureSample.current='';
  if(run&&s.run===run&&elapsed<=6000){if(elapsed>1000){s.frames.push(now-s.last);s.submit.push(submit);}s.last=now;invalidate();}
  else if(run&&s.run===run&&s.frames.length){
   const maps=new Set<Texture>();scene.traverse(o=>{if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if('map' in m&&m.map instanceof Texture)maps.add(m.map);});
   let bytes=0,shadowCasters=0;for(const t of maps){const image=t.image as {width?:number;height?:number};bytes+=(image?.width??0)*(image?.height??0)*4*(t.generateMipmaps?4/3:1);}scene.traverse(o=>{if(o instanceof Light&&o.castShadow)shadowCasters++;});
   onDone({frames:s.frames.length,durationMs:elapsed,medianFrameMs:percentile(s.frames,.5),p95FrameMs:percentile(s.frames,.95),medianSubmitMs:percentile(s.submit,.5),p95SubmitMs:percentile(s.submit,.95),calls:gl.info.render.calls,triangles:gl.info.render.triangles,textures:gl.info.memory.textures,imageTextureMiB:bytes/1048576,dpr:gl.getPixelRatio(),shadowCasters,canvasPixels:gl.domElement.width*gl.domElement.height});s.frames=[];
  }
 },1);
 return null;
}
export default function RenderBenchmark(){
 const capture=useRef<((options:CaptureOptions)=>Promise<Blob>)|null>(null);
 const ready=useCallback((fn:(options:CaptureOptions)=>Promise<Blob>)=>{capture.current=fn;},[]);
 const [captureFrame,setCaptureFrame]=useState<{shadowCasters:number;dpr:number}|null>(null),[captureMessage,setCaptureMessage]=useState('');
 const [quality,setQuality]=useState<RenderQuality>('edit');
 const [loaded,setLoaded]=useState(false),[run,setRun]=useState(0),[running,setRunning]=useState(false),[report,setReport]=useState<Report|null>(null);
 const done=useCallback((r:Report)=>{setReport(r);setRunning(false);},[]);
 return <main style={{height:'100vh',display:'flex',flexDirection:'column'}}><div style={{background:'white',padding:12,display:'flex',gap:12,alignItems:'center'}}><strong>개발용 렌더 검증</strong><select aria-label="렌더 품질" value={quality} disabled={running} onChange={e=>{setQuality(e.target.value as RenderQuality);setReport(null);}}><option value="edit">빠른 편집</option><option value="preview">미리보기</option></select><button className="button secondary" disabled={running} onClick={()=>{useEditor.setState({project:fixture(),previewProject:null,hydrated:true,selected:[],activeTool:'pan',showDimensions:false,past:[],future:[]});setLoaded(true);setReport(null);}}>검증 장면 만들기</button><button className="button primary" disabled={!loaded||running} onClick={()=>{setReport(null);setRunning(true);setRun(n=>n+1);}}>6초 회전 측정</button><button className="button secondary" disabled={!loaded||running} onClick={()=>{if(capture.current){setCaptureMessage('캡처 중');void capture.current({longEdge:1920,aspectRatio:{width:16,height:9},includeDimensions:false,includeGrid:false,includePlan:false}).then(blob=>{downloadBlob(blob,'렌더품질-검증-캡처.png');setCaptureMessage('캡처 완료');},error=>setCaptureMessage(String(error)));}}}>1920 캡처</button><span>{running?'측정 중':loaded?'50벽 · 100개의 서로 다른 512px 이미지 · 10 Spot + 10 Area':'운영 데이터와 자동 저장에 연결하지 않습니다.'}</span></div><div style={{flex:1,minHeight:0}}>{loaded&&<Gallery3D quality={quality} reset={0} cutaway={false} onCaptureReady={ready}><Probe run={run} onDone={done} onCaptureFrame={setCaptureFrame}/></Gallery3D>}</div><output aria-label="캡처 품질 검증" style={{position:'absolute',bottom:12,left:12,fontSize:11,background:'#ffffffdd'}}>{captureFrame?JSON.stringify(captureFrame):''} {captureMessage}</output><pre aria-label="렌더 측정 결과" style={{position:'absolute',right:12,top:70,fontSize:12,padding:12,background:'#ffffffee',pointerEvents:'none'}}>{report?JSON.stringify(report,null,2):''}</pre></main>;
}
