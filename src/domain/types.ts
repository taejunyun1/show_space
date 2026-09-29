import type {PlanAnalysis} from '../lib/analyzePlan';
import type {PlanLabel} from './planLabels';
export interface Point { x: number; z: number }
export interface WorldPoint extends Point { y:number }

export type MeasurementAnchor =
  | {kind:'fixed';fallback:WorldPoint}
  | {kind:'wall';wallId:string;t:number;heightRatio:number;offsetMm:number;fallback:WorldPoint}

export interface SavedDimension {
  id:string;view:'plan'|'elevation'|'3d';elevationWallId?:string
  start:MeasurementAnchor;end:MeasurementAnchor;offsetMm:number
}

export interface Wall {
  groupId?: string
  role?: 'boundary' | 'partition'
  id: string; name: string; start: Point; end: Point
  heightMm: number; thicknessMm: number; color: string
  visible: boolean; locked: boolean; note: string
}

export interface Artwork {
  groupId?: string
  wallSide?: 'front' | 'back'
  /** Counterclockwise rotation within the wall plane, in degrees. */
  rotationDeg?: number
  id: string; name: string; artist: string
  widthMm: number; heightMm: number; depthMm: number
  wallId: string; alongMm: number; centerHeightMm: number
  frame: 'black' | 'natural' | 'white' | 'none'
  imageUrl: string; visible: boolean; locked: boolean; note: string
}

export type UnplacedArtwork = Omit<Artwork,'wallId'>

export interface CameraView {
  projection?:'orthographic'|'perspective';fov?:number
  position:[number,number,number];target:[number,number,number];zoom:number
}

export interface SceneStructure {
  walls:Wall[];openings:Opening[];dimensions:SavedDimension[];unplacedArtworks:UnplacedArtwork[]
}

export interface Scene {
  id: string; name: string; artworks: Artwork[]
  wallVisibility: Record<string, boolean>
  cameraView?:CameraView
  structure?:SceneStructure
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
  /** The detector's untouched geometry; current walls can be edited independently. */
  planDraft?:{kind:'partial';sourceEvidenceHash:string;originalWalls:Wall[]};
  dimensions?:SavedDimension[];
  sourcePlan?:{imageUrl:string;widthPx:number;heightPx:number;labels:PlanLabel[]};
  openings?:Opening[];
  schemaVersion: 1; id: string; name: string; venue: string
  walls: Wall[]; artworks: Artwork[]; unplacedArtworks?:UnplacedArtwork[]; scenes: Scene[]
  planLabels?: PlanLabel[];
  planAnalysis?:PlanAnalysis;
  floorColor: string; planImageUrl?: string; planOpacity?: number; planReference?: PlanReference
}

export interface EntitySelection { type: 'wall' | 'artwork'; id: string }
