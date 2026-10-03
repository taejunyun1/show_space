import {useEffect} from 'react';
import {useThree} from '@react-three/fiber';
import {surfaceEnvironment,SURFACE_ENVIRONMENT_INTENSITY} from '../lib/surfaceEnvironment';
export function SurfaceEnvironment({enabled}:{enabled:boolean}){const {scene,gl,invalidate}=useThree();useEffect(()=>{if(!enabled)return;const previous=scene.environment,previousIntensity=scene.environmentIntensity,environment=surfaceEnvironment(gl);scene.environment=environment.texture;scene.environmentIntensity=SURFACE_ENVIRONMENT_INTENSITY;invalidate();return()=>{scene.environment=previous;scene.environmentIntensity=previousIntensity;environment.dispose();invalidate();};},[enabled,scene,gl,invalidate]);return null;}
