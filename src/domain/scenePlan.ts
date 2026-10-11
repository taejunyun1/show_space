import type {Project,ScenePlan} from './types';

export const scenePlanKeys=['planImageUrl','planOpacity','planReference','planLabels','planAnalysis','sourcePlan','planDraft'] as const;

/** Always capture a plan marker, including a plan-free document. */
export function captureScenePlan(project:Project):ScenePlan{
 return structuredClone(Object.fromEntries(scenePlanKeys.filter(key=>project[key]!==undefined).map(key=>[key,project[key]])));
}

/** Legacy Scenes have no marker and retain the current plan. New snapshots replace all plan fields. */
export function restoreScenePlan(project:Project,plan:ScenePlan|undefined):Project{
 if(plan===undefined)return project;
 const result={...project};for(const key of scenePlanKeys)delete result[key];
 return Object.assign(result,structuredClone(plan));
}
