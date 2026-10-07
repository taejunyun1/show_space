import {inviteId,inviteToken} from './collaboration';
export function invitationSecret(fragment:string){const match=/^#token=([0-9a-f]{48})$/.exec(fragment);return match?inviteToken(match[1]):undefined;}
export function invitationStorageKey(id:string){return 'gonggan-private-invite:'+inviteId(id);}
/** Account/provider secrets are never included in this short-lived invitation record. */
export function storedInvitationSecret(value:string|null,now=Date.now()){try{const v=JSON.parse(value??'null');if(!v||!Number.isFinite(v.expiresAt)||v.expiresAt<=now||v.expiresAt>now+7*86400000)return undefined;return inviteToken(v.token);}catch{return undefined;}}
