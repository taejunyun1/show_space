import {Matrix4,Mesh,Vector3,type Object3D} from 'three';
import {floorFromLoops} from '../domain/importedFloor';
import type {Point,ReferenceModel,Wall} from '../domain/types';
interface Triangle {points:Vector3[];area:number}
interface Plane {nx:number;nz:number;d:number;triangles:Triangle[]}
interface Face {nx:number;nz:number;d:number;minT:number;maxT:number;minY:number;maxY:number}
const normalKey=(x:number,z:number)=>`${Math.round(x*10000)},${Math.round(z*10000)}`;
const pointKey=(p:Vector3)=>`${Math.round(p.x*10000)},${Math.round(p.y*10000)},${Math.round(p.z*10000)}`;
function canonical(x:number,z:number):[number,number]{return x< -1e-5||Math.abs(x)<1e-5&&z<0?[-x,-z]:[x,z];}
// Connected planar patches must fill a rectangle. An opening never becomes its bounding box.
function rectangles(plane:Plane):Face[]{
 const parents=plane.triangles.map((_,i)=>i),owners=new Map<string,number>();
 const root=(i:number):number=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 plane.triangles.forEach((triangle,i)=>{for(const p of triangle.points){const key=pointKey(p),owner=owners.get(key);if(owner!==undefined)parents[root(i)]=root(owner);else owners.set(key,i);}});
 const groups=new Map<number,{minT:number;maxT:number;minY:number;maxY:number;area:number}>();
 plane.triangles.forEach((triangle,i)=>{const key=root(i),g=groups.get(key)??{minT:Infinity,maxT:-Infinity,minY:Infinity,maxY:-Infinity,area:0};for(const p of triangle.points){const t=-plane.nz*p.x+plane.nx*p.z;g.minT=Math.min(g.minT,t);g.maxT=Math.max(g.maxT,t);g.minY=Math.min(g.minY,p.y);g.maxY=Math.max(g.maxY,p.y);}g.area+=triangle.area;groups.set(key,g);});
 return [...groups.values()].filter(g=>{const rectangle=(g.maxT-g.minT)*(g.maxY-g.minY);return rectangle>0&&g.area/rectangle>=.995&&g.area/rectangle<=1.005;}).map(g=>({...g,nx:plane.nx,nz:plane.nz,d:plane.d}));
}
export function extractModelWalls(scene:Object3D,model:ReferenceModel):{walls:Wall[];triangles:number;importedFloor?:Point[][]}{
 const root=scene.clone(true);root.updateMatrixWorld(true);
 const transform=new Matrix4().makeTranslation(...model.positionMm.map(v=>v/1000) as [number,number,number]);
 transform.multiply(new Matrix4().makeRotationY(model.rotationDeg*Math.PI/180)).multiply(new Matrix4().makeScale(model.scale,model.scale,model.scale)).multiply(new Matrix4().makeTranslation(...model.sourceOffsetM));
 const planes=new Map<string,Plane>(),seen=new Set<string>(),ground=new Map<number,{area:number;edges:Map<string,{a:Point;b:Point;count:number}>;seen:Set<string>}>();let triangles=0;
 const floorLimit=model.positionMm[1]/1000+.25*model.scale;
 root.traverse(object=>{
  if(!(object instanceof Mesh)||'isSkinnedMesh' in object||'isInstancedMesh' in object||object.morphTargetInfluences?.some(v=>v!==0))return;
  const geometry=object.geometry,position=geometry.getAttribute('position'),index=geometry.index;if(!position)return;
  const matrix=transform.clone().multiply(object.matrixWorld),winding=matrix.determinant()<0?-1:1,count=index?.count??position.count;
  for(let i=0;i+2<count;i+=3){
   if(++triangles>200000)throw new Error('벽 추출은 삼각형 20만 개 이하 모델을 지원합니다. 모델을 단순화한 뒤 다시 시도하세요.');
   const points=[0,1,2].map(j=>new Vector3().fromBufferAttribute(position,index?index.getX(i+j):i+j).applyMatrix4(matrix));
   const cross=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])),area=cross.length()/2;if(area<1e-8)continue;
   const normal=cross.normalize().multiplyScalar(winding);
   if(normal.y>.998&&points[0].y<=floorLimit){
    const level=Math.round(points[0].y*1000),g=ground.get(level)??{area:0,edges:new Map(),seen:new Set()},ps=points.map(p=>({x:Math.round(p.x*1000),z:Math.round(p.z*1000)})),keys=ps.map(p=>`${p.x},${p.z}`),id=[...keys].sort().join('|');
    if(!g.seen.has(id)){g.seen.add(id);g.area+=area;for(let j=0;j<3;j++){const k=[keys[j],keys[(j+1)%3]].sort().join('|'),e=g.edges.get(k);if(e)e.count++;else g.edges.set(k,{a:ps[j],b:ps[(j+1)%3],count:1});}}
    ground.set(level,g);
   }
   if(Math.abs(normal.y)>.002)continue;
   const [nx,nz]=canonical(normal.x,normal.z),d=nx*points[0].x+nz*points[0].z,key=`${normalKey(nx,nz)}:${Math.round(d*1000)}`;
   const triangleKey=points.map(pointKey).sort().join('|');if(seen.has(triangleKey))continue;seen.add(triangleKey);
   const plane=planes.get(key)??{nx,nz,d,triangles:[]};plane.triangles.push({points,area});planes.set(key,plane);
  }
 });
 const faces=[...planes.values()].flatMap(rectangles),byNormal=new Map<string,Face[]>();
 for(const face of faces){const key=normalKey(face.nx,face.nz);byNormal.set(key,[...(byNormal.get(key)??[]),face]);}
 const used=new Set<Face>(),walls:Wall[]=[];
 const major=faces.filter(f=>f.maxT-f.minT>=.8&&f.maxY-f.minY>=1.6&&f.minY<=floorLimit).sort((a,b)=>(b.maxT-b.minT)-(a.maxT-a.minT));
 if(major.length>2000)throw new Error('벽 면이 너무 많습니다. 전시장 구조만 포함한 모델로 다시 시도하세요.');
 for(const a of major){
  if(used.has(a))continue;
  const candidates=(byNormal.get(normalKey(a.nx,a.nz))??[]).filter(b=>b!==a&&!used.has(b)&&Math.abs(b.d-a.d)>=.03&&Math.abs(b.d-a.d)<=.6&&Math.abs(b.minY-a.minY)<=.015&&Math.abs(b.maxY-a.maxY)<=.015&&Math.abs(b.minT-a.minT)<=.015&&Math.abs(b.maxT-a.maxT)<=.015).sort((b,c)=>Math.abs(b.d-a.d)-Math.abs(c.d-a.d));
  for(const b of candidates){
   const width=a.maxT-a.minT,thickness=Math.abs(a.d-b.d);if(width<thickness*3)continue;
   const [cx,cz]=canonical(-a.nz,a.nx),caps=byNormal.get(normalKey(cx,cz))??[];
   const capped=(end:number)=>caps.some(c=>{
    if(Math.abs(c.minY-a.minY)>.015||Math.abs(c.maxY-a.maxY)>.015)return false;
    const corners=[c.minT,c.maxT].map(t=>({x:c.nx*c.d-c.nz*t,z:c.nz*c.d+c.nx*t}));
    const ts=corners.map(p=>-a.nz*p.x+a.nx*p.z),ds=corners.map(p=>a.nx*p.x+a.nz*p.z);
    return ts.every(t=>Math.abs(t-end)<.015)&&Math.abs(Math.min(...ds)-Math.min(a.d,b.d))<.015&&Math.abs(Math.max(...ds)-Math.max(a.d,b.d))<.015;
   });
   if(!capped(a.minT)||!capped(a.maxT))continue;
   const d=(a.d+b.d)/2,point=(t:number)=>({x:Math.round((a.nx*d-a.nz*t)*1000),z:Math.round((a.nz*d+a.nx*t)*1000)});
   walls.push({id:`model-wall-${walls.length+1}`,name:`모델 벽 ${walls.length+1}`,start:point(a.minT),end:point(a.maxT),heightMm:Math.round((a.maxY-a.minY)*1000),thicknessMm:Math.round(thickness*1000),color:'#e4e4e0',visible:true,locked:false,note:`${model.name}의 닫힌 직선 벽 형상에서 추출`});
   used.add(a);used.add(b);break;
  }
 }
 const maxArea=Math.max(0,...[...ground.values()].map(g=>g.area)),floorPlane=[...ground].filter(([,g])=>g.area>=4&&g.area>=maxArea*.7).sort(([a],[b])=>b-a)[0]?.[1];
 let importedFloor:Point[][]|undefined;
 if(floorPlane){
  const edges=[...floorPlane.edges.values()].filter(e=>e.count===1),key=(p:Point)=>`${p.x},${p.z}`,neighbors=new Map<string,Point[]>();
  for(const edge of edges)for(const [p,q] of [[edge.a,edge.b],[edge.b,edge.a]])neighbors.set(key(p),[...(neighbors.get(key(p))??[]),q]);
  if(edges.length<=5000&&[...neighbors.values()].every(n=>n.length===2)){
   const remaining=new Set(neighbors.keys()),loops:Point[][]=[];
   while(remaining.size){const start=remaining.values().next().value!,loop:Point[]=[];let current=start,previous='';
    do{const p=current.split(',').map(Number);loop.push({x:p[0],z:p[1]});remaining.delete(current);const next=neighbors.get(current)!.find(p=>key(p)!==previous)!;previous=current;current=key(next);}while(current!==start&&remaining.has(current));
    if(current!==start){loops.length=0;break;}
    const simplified=loop.filter((b,i)=>{const a=loop[(i+loop.length-1)%loop.length],c=loop[(i+1)%loop.length];return Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))>Math.hypot(c.x-a.x,c.z-a.z);});loops.push(simplified);
   }
   if(loops.length&&loops.length<=40&&loops.reduce((sum,l)=>sum+l.length,0)<=1000&&loops.every(l=>l.length>=3)){
    const floor=floorFromLoops(loops);if(!floor.invalidComponents&&floor.surfaces.length)importedFloor=floor.polygons;
   }
  }
 }
 const inside=(point:Point)=>{let within=false;for(const loop of importedFloor??[]){for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],b=loop[j];if((a.z>point.z)!==(b.z>point.z)&&point.x<(b.x-a.x)*(point.z-a.z)/(b.z-a.z)+a.x)within=!within;}}return within;};
 const center={x:walls.reduce((s,w)=>s+w.start.x+w.end.x,0)/(walls.length*2||1),z:walls.reduce((s,w)=>s+w.start.z+w.end.z,0)/(walls.length*2||1)};
 for(const wall of walls){const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z,length=Math.hypot(dx,dz),mid={x:(wall.start.x+wall.end.x)/2,z:(wall.start.z+wall.end.z)/2},offset=wall.thicknessMm/2+20,nx=-dz/length,nz=dx/length;
  const front=inside({x:mid.x+nx*offset,z:mid.z+nz*offset}),back=inside({x:mid.x-nx*offset,z:mid.z-nz*offset});
  wall.role=importedFloor?(front!==back?'boundary':'partition'):'boundary';
  if(importedFloor?back&&!front:nx*(center.x-mid.x)+nz*(center.z-mid.z)<0){const start=wall.start;wall.start=wall.end;wall.end=start;}
 }
 return {walls,triangles,...(importedFloor?{importedFloor}:{})};
}
