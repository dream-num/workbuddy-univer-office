import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Run phases separately so the real WorkBuddy preview can stay open during update.
const phase=process.argv[2];
assert.ok(['create','update','ready'].includes(phase),'Usage: node scripts/verify-base-live.mjs create|update|ready');
const evidencePath='.data/base-live-verification.json';
const config=JSON.parse(await readFile('.data/http-mcp-runtime.json','utf8'));
const client=new Client({name:'base-live-verifier',version:'1'});
const call=async(name,args)=>{
  const result=await client.callTool({name,arguments:args},undefined,{timeout:180000});
  if(result.isError)throw new Error(JSON.stringify(result.content));
  return result.structuredContent.result;
};
let evidence;
const save=()=>writeFile(evidencePath,JSON.stringify(evidence,null,2));
const read=()=>call('univer_execute',{target:evidence.target,mode:'read',code:'return base.getTables().map(t=>({id:t.getId(),name:t.getName(),records:t.getRecords().map(r=>({id:r.getId(),values:r.getValues()}))}));'});
try{
  await client.connect(new StreamableHTTPClientTransport(new URL(config.url),{requestInit:{headers:config.headers}}));
  if(phase==='create'){
    // Exclusive evidence creation prevents rerunning a partially completed setup.
    evidence={filename:`base-live-${Date.now()}.univer`};
    await writeFile(evidencePath,JSON.stringify(evidence),{flag:'wx'});
    const file=await call('univer_new',{file:evidence.filename});evidence.fileId=file.fileId;await save();
    const draft=await call('univer_worktree',{fileId:file.fileId,action:'create'});evidence.worktreeId=draft.worktreeID;await save();
    const unit=await call('univer_unit',{fileId:file.fileId,worktreeId:draft.worktreeID,action:'create',kind:'base',name:'任务库实时同步验证'});
    evidence.target={fileId:file.fileId,unitId:unit.unitId,worktreeId:draft.worktreeID,branch:'worktree'};await save();
    evidence.initial=await call('univer_execute',{target:evidence.target,mode:'write',code:`
      const table=base.insertTable('宿主验证任务',{primaryFieldName:'任务'});
      const state=table.addField('状态',api.Enum.BaseFieldType.Text);
      const count=table.addField('检查数',api.Enum.BaseFieldType.Number);
      const primary=table.getPrimaryFieldId();
      const records=table.addRecords([
        {values:{[primary]:'文档实时同步',[state.getId()]:'待检查',[count.getId()]:0}},
        {values:{[primary]:'任务库实时同步',[state.getId()]:'进行中',[count.getId()]:1}}
      ]);
      return {tableId:table.getId(),primaryFieldId:primary,stateFieldId:state.getId(),countFieldId:count.getId(),recordIds:records.map(r=>r.getId())};
    `});await save();assert.equal(evidence.initial.commit,'confirmed');
    evidence.readBefore=await read();await save();
  }else{
    evidence=JSON.parse(await readFile(evidencePath,'utf8'));
    if(phase==='update'){
      assert.ok(!evidence.updateAttemptedAt,'An update was already attempted; inspect evidence before retrying.');
      evidence.updateAttemptedAt=new Date().toISOString();await save();
      const ids=evidence.initial.value;
      evidence.update=await call('univer_execute',{target:evidence.target,mode:'write',code:`
        const ids=${JSON.stringify(ids)};
        const table=base.getTableById(ids.tableId);
        const first=table.getRecordById(ids.recordIds[0]);
        if(!first.setValues({[ids.stateFieldId]:'已通过',[ids.countFieldId]:3}))throw Error('Record update failed');
        table.addRecords([{values:{[ids.primaryFieldId]:'新增记录同步',[ids.stateFieldId]:'已新增',[ids.countFieldId]:2}}]);
        return true;
      `});await save();assert.equal(evidence.update.commit,'confirmed');
      evidence.readAfter=await read();await save();
      const records=evidence.readAfter.value.find(t=>t.id===ids.tableId).records;
      assert.equal(records.length,3);
      assert.equal(records.find(r=>r.id===ids.recordIds[0]).values[ids.stateFieldId],'已通过');
      assert.equal(records.find(r=>r.id===ids.recordIds[0]).values[ids.countFieldId],3);
      assert.equal(evidence.readAfter.mutations,0);
    }else{
      evidence.ready=await call('univer_worktree',{fileId:evidence.target.fileId,worktreeId:evidence.target.worktreeId,action:'ready'});await save();
      assert.equal(evidence.ready.worktree.status,'ready');
    }
  }
  console.log(JSON.stringify({phase,target:evidence.target,result:phase==='create'?evidence.initial:phase==='update'?evidence.update:evidence.ready}));
}finally{await client.close();}
