import type {Shape} from 'three';
import {wallMetricUv,floorMetricUv} from '../lib/surfaceUv';
export function WallSurfaceGeometry({length,height,depth}:{length:number;height:number;depth:number}){return <boxGeometry args={[length,height,depth]} onUpdate={wallMetricUv}/>;}
export function FloorSurfaceGeometry({shape,flat=false}:{shape:Shape;flat?:boolean}){return flat?<shapeGeometry args={[shape]} onUpdate={g=>floorMetricUv(g,1)}/>:<extrudeGeometry args={[shape,{depth:.16,bevelEnabled:false,steps:1}]} onUpdate={g=>floorMetricUv(g,-1)}/>;}
