import type {PlanAnalysis} from '../lib/analyzePlan';
import type {PlanLabel} from './planLabels';
export interface Point { x: number; z: number }

export interface Wall {
  role?: 'boundary' | 'partition'
  id: string; name: string; start: Point; end: Point
  heightMm: number; thicknessMm: number; color: string
  visible: boolean; locked: boolean; note: string
}

export interface Artwork {
  wallSide?: 'front' | 'back'
  id: string; name: string; artist: string
  widthMm: number; heightMm: number; depthMm: number
  wallId: string; alongMm: number; centerHeightMm: number
  frame: 'black' | 'natural' | 'white' | 'none'
  imageUrl: string; visible: boolean; locked: boolean; note: string
}

export interface Scene {
  id: string; name: string; artworks: Artwork[]
  wallVisibility: Record<string, boolean>
}

export interface PlanReference {
 widthPx:number; heightPx:number; origin:Point; mmPerPixel:number; calibrated:boolean
}

/** A source junction joins adjacent openings where no solid wall remains. */
export type OpeningAnchor = {wallId:string;endpoint:'start'|'end';point?:never} | {point:Point;wallId?:never;endpoint?:never};

export interface Opening {
 id:string;kind:'door'|'window'|'stair-access';role:'boundary'|'partition';
 start:OpeningAnchor;end:OpeningAnchor;
 note:string;
}

export interface Project {
  sourcePlan?:{imageUrl:string;widthPx:number;heightPx:number;labels:PlanLabel[]};
  openings?:Opening[];
  schemaVersion: 1; id: string; name: string; venue: string
  walls: Wall[]; artworks: Artwork[]; scenes: Scene[]
  planLabels?: PlanLabel[];
  planAnalysis?:PlanAnalysis;
  floorColor: string; planImageUrl?: string; planOpacity?: number; planReference?: PlanReference
}

export interface EntitySelection { type: 'wall' | 'artwork'; id: string }
