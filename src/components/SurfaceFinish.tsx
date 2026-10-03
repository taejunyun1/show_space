import type {SurfaceMaterial} from '../domain/materials';
import {physicalMaterialParameters} from '../lib/surfaceMaterial';
import type {Texture,Side} from 'three';
export function SurfaceFinish({color,material,roughness,map,side}:{color:string;material?:SurfaceMaterial;roughness:number;map?:Texture;side?:Side}){return material?<meshPhysicalMaterial {...physicalMaterialParameters(color,material)} map={map} side={side}/>:<meshStandardMaterial color={color} roughness={roughness} map={map} side={side}/>;}
