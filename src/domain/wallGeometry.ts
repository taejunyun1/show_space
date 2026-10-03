import type {Wall} from './types';
/** Length in the plan plane; safe for public wall geometry without editor state. */
export function wallLength(wall:Pick<Wall,'start'|'end'>):number{return Math.hypot(wall.end.x-wall.start.x,wall.end.z-wall.start.z);}
