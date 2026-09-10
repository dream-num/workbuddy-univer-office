import type {Target} from './contracts.js';

export type PreviewPrincipal=`preview:${string}`;
export function previewPrincipal(target:Target):PreviewPrincipal {
  return `preview:${encodeURIComponent(JSON.stringify(target))}`;
}
export function previewScope(userID:string):Target|undefined {
  return userID.startsWith('preview:')?JSON.parse(decodeURIComponent(userID.slice(8))) as Target:undefined;
}
