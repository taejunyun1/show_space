import type {ProjectDatabase} from './projectApi';
import {memberRole,type ProjectRole} from '../domain/collaboration';
export interface ProjectRow {id:string;owner_id:string;name:string;venue:string;source_project_id:string;revision:number;snapshot_key:string;snapshot_sha256:string;snapshot_bytes:number;created_at:string;updated_at:string;archived:number}
export interface ProjectAccess {row:ProjectRow;role:ProjectRole;memberRevision?:number}
/** Owner data remains authoritative. Membership grants never change owner_id. */
export async function projectAccess(db:ProjectDatabase,id:string,user:string):Promise<ProjectAccess|null>{
 const own=await db.prepare('SELECT * FROM cloud_projects WHERE id = ? AND owner_id = ?').bind(id,user).first<ProjectRow>();if(own)return {row:own,role:'owner'};
 let shared:(ProjectRow&{member_role:string;member_revision:number})|null;
 try{shared=await db.prepare('SELECT p.*, m.role AS member_role, m.revision AS member_revision FROM cloud_projects p JOIN project_members m ON m.project_id = p.id WHERE p.id = ? AND m.user_id = ? AND m.revoked = 0').bind(id,user).first();}catch{return null;} // Pre-migration databases have no membership grants; fail closed.
 return shared?{row:shared,role:memberRole(shared.member_role),memberRevision:shared.member_revision}:null;
}
export function editorWriteConstraint(user:string,access:ProjectAccess){return {sql:' AND (owner_id = ? OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = cloud_projects.id AND m.user_id = ? AND m.role = \'editor\' AND m.revoked = 0 AND m.revision = ?))',values:[user,user,access.memberRevision??0]};}
