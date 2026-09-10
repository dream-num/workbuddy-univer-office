import { fork } from 'node:child_process';
import type { ContentJob } from '../worker/content.js';
import { OfficeError } from '../shared/contracts.js';

/** One short-lived content process; the caller's serial queue bounds concurrency. */
export async function runContent(job: ContentJob): Promise<unknown> {
  return new Promise((resolve,reject) => {
    const child = fork(new URL('../worker/content.js',import.meta.url), [], {stdio:['ignore','ignore','pipe','ipc']});
    let settled=false, diagnostic='';
    child.stderr?.on('data',(chunk:Buffer) => { diagnostic=(diagnostic+chunk.toString()).slice(-6000); });
    const timer = setTimeout(() => {
      settled=true; child.kill('SIGKILL');
      reject(new OfficeError('EXECUTION_OUTCOME_UNKNOWN','Content process timed out; inspect the target before attempting another write.',504));
    },120000);
    child.once('error',error => { clearTimeout(timer); settled=true; reject(error); });
    child.once('message',(message: {ok:boolean;value?:unknown;error?:string}) => {
      clearTimeout(timer); settled=true;
      if (message.ok) resolve(message.value); else reject(new OfficeError('CONTENT_ERROR',message.error!));
    });
    child.once('exit', code => {clearTimeout(timer);if (!settled) reject(new OfficeError('WORKER_EXIT',`Content worker exited (${code}): ${diagnostic}`));});
    child.send(job);
  });
}
