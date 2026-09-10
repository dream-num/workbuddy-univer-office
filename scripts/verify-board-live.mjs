import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const phase=process.argv[2];
assert.ok(['create','initialize','update','ready'].includes(phase),'Usage: node scripts/verify-board-live.mjs create|initialize|update|ready');
const evidencePath='.data/board-live-verification.json';
const config=JSON.parse(await readFile('.data/http-mcp-runtime.json','utf8'));
const client=new Client({name:'board-live-verifier',version:'1'});
const call=async(name,args)=>{const r=await client.callTool({name,arguments:args},undefined,{timeout:180000});if(r.isError)throw Error(JSON.stringify(r.content));return r.structuredContent.result;};
let evidence;
const save=()=>writeFile(evidencePath,JSON.stringify(evidence,null,2));
const read=()=>call('univer_execute',{target:evidence.target,mode:'read',code:'return {snapshot:JSON.parse(JSON.stringify(board.save())),elementCount:Object.keys(board.getElements()).length};'});
try{
 await client.connect(new StreamableHTTPClientTransport(new URL(config.url),{requestInit:{headers:config.headers}}));
 if(phase==='create'){
  evidence={filename:`board-live-${Date.now()}.univer`};await writeFile(evidencePath,JSON.stringify(evidence),{flag:'wx'});
  const file=await call('univer_new',{file:evidence.filename});evidence.fileId=file.fileId;await save();
  const draft=await call('univer_worktree',{fileId:file.fileId,action:'create'});evidence.worktreeId=draft.worktreeID;await save();
  const unit=await call('univer_unit',{fileId:file.fileId,worktreeId:draft.worktreeID,action:'create',kind:'board',name:'白板实时同步验证'});
  evidence.target={fileId:file.fileId,unitId:unit.unitId,worktreeId:draft.worktreeID,branch:'worktree'};await save();
 }else evidence=JSON.parse(await readFile(evidencePath,'utf8'));
 if(phase==='create'||phase==='initialize'){
  if(phase==='initialize'){
   assert.ok(!evidence.initial,'Initialization already recorded.');
   evidence.recoveryRead=await read();await save();
   assert.equal(evidence.recoveryRead.value.elementCount,0,'Do not repeat initialization on nonempty content.');
  }
  evidence.initial=await call('univer_execute',{target:evidence.target,mode:'write',code:`
    board.insertText({left:120,top:70,width:960,height:70,text:'WorkBuddy 白板实时同步验证',textStyle:{fontSize:32,bold:true,color:'#245442'}});
    const nodes=[];
    for(const [i,text]of ['创建草稿','等待检查'].entries()){
      const shape=board.insertShape({shapeType:api.Enum.ShapeTypeEnum.RoundRect,transform:{left:120+i*360,top:220,width:240,height:120}});
      if(!shape)throw Error('Shape creation failed');
      shape.setSolidFill('#e3f0e8');shape.getText().setText(text).setFontSize(26).setColor('#245442');nodes.push(shape.getId());
    }
    const link=board.insertConnector({fromElementId:nodes[0],toElementId:nodes[1],routing:'orthogonal',style:{endMarker:{type:'filledTriangle',size:'md'}}});
    if(!link)throw Error('Connector creation failed');return {nodeIds:nodes,connectorId:link.id};
  `});await save();assert.equal(evidence.initial.commit,'confirmed');evidence.readBefore=await read();await save();
 }else{
  evidence=JSON.parse(await readFile(evidencePath,'utf8'));
  if(phase==='update'){
   assert.ok(!evidence.updateAttemptedAt,'Update was already attempted; inspect before retrying.');evidence.updateAttemptedAt=new Date().toISOString();await save();
   evidence.update=await call('univer_execute',{target:evidence.target,mode:'write',code:`
     const second=board.getShape(${JSON.stringify(evidence.initial.value.nodeIds[1])});
     if(!second)throw Error('Existing node unavailable');second.setSolidFill('#367d67');second.getText().setText('检查通过').setFontSize(26).setColor('#ffffff');
     const third=board.insertShape({shapeType:api.Enum.ShapeTypeEnum.RoundRect,transform:{left:840,top:220,width:240,height:120}});
     if(!third)throw Error('New node failed');third.setSolidFill('#e3f0e8');third.getText().setText('等待审阅').setFontSize(26).setColor('#245442');
     const link=board.insertConnector({fromElementId:second.getId(),toElementId:third.getId(),routing:'orthogonal',style:{endMarker:{type:'filledTriangle',size:'md'}}});
     if(!link)throw Error('New connector failed');return {nodeId:third.getId(),connectorId:link.id};
   `});await save();assert.equal(evidence.update.commit,'confirmed');evidence.readAfter=await read();await save();
   assert.ok(JSON.stringify(evidence.readAfter.value.snapshot).includes('检查通过'));
   assert.ok(JSON.stringify(evidence.readAfter.value.snapshot).includes('等待审阅'));
   assert.equal(evidence.readAfter.value.elementCount,evidence.readBefore.value.elementCount+2);assert.equal(evidence.readAfter.mutations,0);
  }else{
   evidence.ready=await call('univer_worktree',{fileId:evidence.target.fileId,worktreeId:evidence.target.worktreeId,action:'ready'});await save();assert.equal(evidence.ready.worktree.status,'ready');
  }
 }
 console.log(JSON.stringify({phase,target:evidence.target,result:['create','initialize'].includes(phase)?evidence.initial:phase==='update'?evidence.update:evidence.ready}));
}finally{await client.close();}
