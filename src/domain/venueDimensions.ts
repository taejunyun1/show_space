import type {PlanPage} from '../lib/planImport';
import type {Wall} from './types';
import {createDemoProject} from './model';
import {readMeasuredSpans} from './dimensionSpans';
import {wallAnnotationScale} from './wallAnnotationScale';
import {readOpeningDimensions} from './openingDimensions';
import {openingAxisEvidence} from './openingAxisEvidence';
import {solveDimensionConstraints} from './dimensionConstraints';

/** Shared by venue preparation and corpus evaluation so the benchmark cannot
 * silently solve a stronger set of constraints than the application. */
export function venueDimensions(page:PlanPage,candidates:Wall[],structure:Wall[],gaps:{wall:Wall;kind:string}[]){
 const labels=page.labels??[];
 const measuredSpans=readMeasuredSpans({...createDemoProject(),walls:candidates,planReference:{origin:{x:0,z:0},mmPerPixel:1,calibrated:true,widthPx:page.widthPx,heightPx:page.heightPx}},labels,page.analysis?.lines??[]);
 const annotations=wallAnnotationScale(candidates,labels);
 const openingDimensions=readOpeningDimensions(structure,gaps,labels);
 const solution=solveDimensionConstraints([...candidates,...gaps.map(g=>g.wall)],[...annotations.allMatches,...openingDimensions],measuredSpans,openingAxisEvidence(structure,gaps));
 return {measuredSpans,annotations,openingDimensions,solution};
}
