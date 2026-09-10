import Database from 'libsql';
import {join} from 'node:path';
import {OfficeError} from '../shared/contracts.js';

/** An OS-backed SQLite write lock, separate from every Office content database.
 * Keep this file in place: unlinking it could let another process lock a new inode.
 * Process exit releases the lock, including when no shutdown handler can run.
 */
export function acquireWorkspaceLease(workspace:string) {
  const db=new Database(join(workspace,'.workbuddy-office-lease.sqlite'));
  try {
    db.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;');
  } catch(error) {
    db.close();
    if((error as {code?:string}).code==='SQLITE_BUSY') {
      throw new OfficeError('WORKSPACE_IN_USE','Another Office service owns this workspace. Stop that service before starting a new one.',409);
    }
    throw error;
  }
  let closed=false;
  return ()=>{if(!closed){closed=true;db.close();}};
}
