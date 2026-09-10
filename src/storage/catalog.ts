import Database from 'libsql';
import { randomUUID } from 'node:crypto';
import { existsSync,openSync,closeSync,statSync,realpathSync, type Stats } from 'node:fs';
import { OfficeError, type UnitRecord } from '../shared/contracts.js';

/** Application tables only. SDK-owned content is never read or written with SQL here. */
export class Catalog {
  readonly db: InstanceType<typeof Database>;
  readonly fileId: string;
  private readonly identity:Stats;
  constructor(readonly filename: string, create = false) {
    if (create && existsSync(filename)) throw new OfficeError('FILE_EXISTS', 'The Office file already exists.');
    if (!create && !existsSync(filename)) throw new OfficeError('FILE_NOT_FOUND', 'Office file is missing.', 404);
    if(create){const descriptor=openSync(filename,'wx',0o600);closeSync(descriptor);}
    this.identity=statSync(filename);
    this.db = new Database(filename);
    try {
      if (create) {
        this.db.exec(`CREATE TABLE wb_office_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE wb_office_records (kind TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(kind,id));`);
        const insert = this.db.prepare('INSERT INTO wb_office_metadata VALUES (?, ?)');
        insert.run('formatId', 'workbuddy-univer-office');
        insert.run('schemaVersion', '1');
        insert.run('fileId', randomUUID());
      }
      const get = (key: string) => (this.db.prepare('SELECT value FROM wb_office_metadata WHERE key=?').get(key) as {value:string}|undefined)?.value;
      if (get('formatId') !== 'workbuddy-univer-office' || get('schemaVersion') !== '1') throw new Error('unsupported schema');
      this.fileId = get('fileId')!;
    } catch (error) { this.db.close(); throw new OfficeError('UNKNOWN_FORMAT', `Cannot open this file as a WorkBuddy Office container: ${String(error)}`); }
  }
  put(kind: string, id: string, value: unknown) {
    this.db.prepare('INSERT INTO wb_office_records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value').run(kind,id,JSON.stringify(value));
  }
  get<T>(kind: string, id: string): T | undefined {
    const row = this.db.prepare('SELECT value FROM wb_office_records WHERE kind=? AND id=?').get(kind,id) as {value:string}|undefined;
    return row ? JSON.parse(row.value) as T : undefined;
  }
  list<T>(kind: string): T[] {
    return (this.db.prepare('SELECT value FROM wb_office_records WHERE kind=? ORDER BY rowid').all(kind) as {value:string}[]).map(row => JSON.parse(row.value) as T);
  }
  units() { return this.list<UnitRecord>('unit'); }
  assertAvailable(){
    try{
      const current=statSync(this.filename);
      if(current.dev===this.identity.dev&&current.ino===this.identity.ino&&realpathSync(this.filename)===this.filename)return;
    }catch{}
    throw new OfficeError('FILE_UNAVAILABLE','文件已移走、删除或被替换。请恢复原文件，或重新打开工作区。',404);
  }
  remove(kind:string,id:string){this.db.prepare('DELETE FROM wb_office_records WHERE kind=? AND id=?').run(kind,id);}
  close() { this.db.close(); }
}
