import type {OutdoorSettings} from '../domain/outdoor';
import {useEffect} from 'react';
import {useThree} from '@react-three/fiber';
import {surfaceEnvironment,SURFACE_ENVIRONMENT_INTENSITY} from '../lib/surfaceEnvironment';
export function SurfaceEnvironment({enabled,outdoor,intensity=SURFACE_ENVIRONMENT_INTENSITY}:{enabled:boolean;outdoor?:OutdoorSettings;intensity?:number}){const {scene,gl,invalidate}=useThree();useEffect(()=>{if(!enabled)return;const previous=scene.environment,previousIntensity=scene.environmentIntensity,environment=surfaceEnvironment(gl,outdoor);scene.environment=environment.texture;scene.environmentIntensity=intensity;invalidate();return()=>{scene.environment=previous;scene.environmentIntensity=previousIntensity;environment.dispose();invalidate();};},[enabled,outdoor,intensity,scene,gl,invalidate]);return null;}
