import {normalizeArtworkAngle} from './model';

type Point={x:number;y:number};

export function draggedArtworkAngle(initial:number,center:Point,start:Point,current:Point):number{
  if(Math.hypot(current.x-center.x,current.y-center.y)<1)return initial;
  const startAngle=Math.atan2(start.y-center.y,start.x-center.x);
  const currentAngle=Math.atan2(current.y-center.y,current.x-center.x);
  const delta=normalizeArtworkAngle((startAngle-currentAngle)*180/Math.PI);
  return normalizeArtworkAngle(initial+Math.round(delta/15)*15);
}
