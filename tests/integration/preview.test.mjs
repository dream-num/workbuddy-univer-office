import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../../dist/server/main.js';
import {collaborationUrls} from '../../dist/shared/urls.js';
import {createCollaborationServerAdapter} from '@univer-cli/univer-collaboration-runtime';
import {UniverInstanceType} from '@univerjs/core';
import {ErrorCode,UnitAction} from '@univerjs/protocol';

await test('embedded preview reads one target without cookies and denies writes and other targets',async()=>{
  const workspace=await mkdtemp(join(tmpdir(),'office-preview-'));
  const app=await startServer({workspace,port:0});
  const handles=[];
  try{
    const file=await app.office.open('preview.univer',true);
    const fileId=file.catalog.fileId;
    const draft=await app.office.createWorktree(fileId,[]);
    const first=await app.office.createUnit(fileId,draft.worktreeID,'sheet','Visible');
    const second=await app.office.createUnit(fileId,draft.worktreeID,'sheet','Private');
    const target={fileId,unitId:first.unitId,worktreeId:draft.worktreeID,branch:'worktree'};
    const url=new URL(await app.createPreview(target));
    const prefix=url.pathname.replace(/\/$/,'');
    const req=(path,body)=>fetch(app.origin+prefix+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
    assert.equal((await fetch(url)).status,200);
    const status=await (await req(`/api/files/${fileId}`)).json();
    assert.deepEqual(status.units.map(u=>u.unitId),[first.unitId]);
    assert.deepEqual(status.worktrees[0].units.map(u=>u.unitID),[first.unitId]);
    assert.equal((await req('/api/files',{file:'forbidden.univer'})).status,403);
    assert.equal((await req(`/api/files/${fileId}/review/${draft.worktreeID}`,{action:'merge'})).status,403);
    assert.equal((await req('/api/files/another-file')).status,403);
    const permissions=await (await req(`/api/files/${fileId}/permissions/${draft.worktreeID}/-/object/-/batch_allowed`,{requests:[first,second].map(u=>({unitID:u.unitId,objectID:u.unitId,actions:[UnitAction.View,UnitAction.Edit]}))})).json();
    assert.deepEqual(permissions.objectActions.map(o=>o.actions.map(a=>a.allowed)),[[true,false],[false,false]]);
    const backend=createCollaborationServerAdapter({...collaborationUrls(app.origin,fileId,draft.worktreeID,prefix),httpRequest:fetch});
    const handle=await backend.open({unitId:first.unitId,unitType:UniverInstanceType.UNIVER_SHEET});handles.push(handle);
    const snapshot=await handle.getUnitOnRev();
    assert.equal(snapshot.error.code,ErrorCode.OK,JSON.stringify(snapshot));
    await assert.rejects(()=>backend.open({unitId:second.unitId,unitType:UniverInstanceType.UNIVER_SHEET}),/application review operation/);
    const submitted=await handle.submitChangeset({baseRev:1,mutations:[{id:'sheet.mutation.set-range-values',params:{unitId:first.unitId,subUnitId:'wrong-sheet',cellValue:{0:{0:{v:999}}}}}],sid:'preview-test',reqId:1});
    assert.equal(submitted.status,'rejected');assert.equal(submitted.reason,'permission-denied');
    const trunkPath=`/files/${fileId}/universer-api/snapshot`;
    assert.equal((await req(trunkPath)).status,403);
    const expired=new URL(url);expired.pathname=expired.pathname.replace(/[a-f0-9]{64}/,'0'.repeat(64));assert.equal((await fetch(expired)).status,401);
  }finally{await Promise.allSettled(handles.map(handle=>handle.close()));await app.close();await rm(workspace,{recursive:true,force:true});}
});

await test('terminal preview resolves only its original Unit on trunk and preserves review status',async()=>{
  const workspace=await mkdtemp(join(tmpdir(),'office-preview-terminal-'));
  const app=await startServer({workspace,port:0});
  const handles=[];
  const resolvePreview=async url=>{
    const response=await fetch(new URL('api/preview/resolve',url));
    assert.equal(response.status,200);return response.json();
  };
  const act=async(fileId,worktreeId,action)=>{
    const {fingerprint}=await app.office.reviewState(fileId,worktreeId);
    return app.office.action(fileId,worktreeId,action,'viewer',fingerprint);
  };
  try{
    const file=await app.office.open('terminal.univer',true),fileId=file.catalog.fileId;
    const draft=await app.office.createWorktree(fileId,[]);
    const unit=await app.office.createUnit(fileId,draft.worktreeID,'sheet','Terminal');
    const target={fileId,unitId:unit.unitId,branch:'worktree',worktreeId:draft.worktreeID};
    const original=await app.createPreview(target);
    assert.deepEqual(await resolvePreview(original),{state:'draft',review:null,available:true,previewUrl:null});
    await act(fileId,draft.worktreeID,'ready');
    assert.equal((await resolvePreview(original)).state,'ready');
    await act(fileId,draft.worktreeID,'merge');
    const merged=await resolvePreview(original);
    assert.equal(merged.state,'merged');assert.equal(merged.available,true);assert.ok(merged.previewUrl);
    const trunk=new URL(merged.previewUrl);
    assert.equal(trunk.searchParams.get('unit'),unit.unitId);assert.equal(trunk.searchParams.has('worktree'),false);
    assert.deepEqual(await resolvePreview(trunk),{state:'trunk',review:'merged',available:true,previewUrl:null});
    assert.equal((await resolvePreview(original)).previewUrl,trunk.href,'resolution is stable for repeated polls');
    const prefix=trunk.pathname.replace(/\/$/,'');
    const backend=createCollaborationServerAdapter({...collaborationUrls(app.origin,fileId,undefined,prefix),httpRequest:fetch});
    const handle=await backend.open({unitId:unit.unitId,unitType:UniverInstanceType.UNIVER_SHEET});handles.push(handle);
    assert.equal((await handle.getUnitOnRev()).error.code,ErrorCode.OK);
    const forbidden=await fetch(new URL(`api/files/${fileId}/review/${draft.worktreeID}`,trunk),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'merge'})});
    assert.equal(forbidden.status,403);
    const branch=await app.office.createWorktree(fileId,[unit.unitId]);
    const discardedUrl=await app.createPreview({...target,worktreeId:branch.worktreeID});
    await act(fileId,branch.worktreeID,'discard');
    const discarded=await resolvePreview(discardedUrl);
    assert.equal(discarded.state,'discarded');assert.equal(discarded.available,true);
    assert.equal((await resolvePreview(discarded.previewUrl)).review,'discarded');
    const isolated=await app.office.createWorktree(fileId,[]);
    const isolatedUnit=await app.office.createUnit(fileId,isolated.worktreeID,'sheet','Never merged');
    const isolatedUrl=await app.createPreview({...target,unitId:isolatedUnit.unitId,worktreeId:isolated.worktreeID});
    await act(fileId,isolated.worktreeID,'discard');
    assert.deepEqual(await resolvePreview(isolatedUrl),{state:'discarded',review:'discarded',available:false,previewUrl:null});
    assert.equal((await fetch(app.origin+'/api/preview/resolve',{headers:{Authorization:`Bearer ${app.agentToken}`}})).status,403);
  }finally{await Promise.allSettled(handles.map(handle=>handle.close()));await app.close();await rm(workspace,{recursive:true,force:true});}
});

await test('viewer cookies on separate local ports coexist without granting cross-service access',async()=>{
  const workspace=await mkdtemp(join(tmpdir(),'office-viewer-cookies-'));
  const first=await startServer({workspace:join(workspace,'first'),port:0});
  const second=await startServer({workspace:join(workspace,'second'),port:0});
  try{
    const cookies=[];
    for(const app of [first,second]){
      const response=await fetch(app.launchUrl,{redirect:'manual'});
      assert.equal(response.status,303);
      cookies.push(response.headers.get('set-cookie').split(';')[0]);
    }
    assert.notEqual(cookies[0].split('=')[0],cookies[1].split('=')[0]);
    for(const [index,app]of [first,second].entries()){
      assert.equal((await fetch(app.origin+'/api/files',{headers:{cookie:cookies.join('; ')}})).status,200);
      assert.equal((await fetch(app.origin+'/api/files',{headers:{cookie:cookies[1-index]}})).status,401);
    }
  }finally{await first.close();await second.close();await rm(workspace,{recursive:true,force:true});}
});

await test('View stays read-only for all five draft products while Agent editing remains available',async()=>{
  const workspace=await mkdtemp(join(tmpdir(),'office-readonly-view-'));
  const app=await startServer({workspace,port:0});
  const handles=[];
  try{
    const file=await app.office.open('readonly.univer',true),fileId=file.catalog.fileId;
    const draft=await app.office.createWorktree(fileId,[]);
    const launch=await fetch(app.launchUrl,{redirect:'manual'});
    const cookie=launch.headers.get('set-cookie').split(';')[0];
    const units=[];
    for(const kind of ['sheet','doc','slide','base','board'])units.push(await app.office.createUnit(fileId,draft.worktreeID,kind,kind));
    const path=`/api/files/${fileId}/permissions/${draft.worktreeID}/-/object/-/batch_allowed`;
    const body={requests:units.map(u=>({unitID:u.unitId,objectID:u.unitId,actions:[UnitAction.View,UnitAction.Copy,UnitAction.Edit]}))};
    for(const [headers,expected]of [[{cookie},[true,true,false]],[{authorization:`Bearer ${app.agentToken}`},[true,true,true]]]){
      const response=await fetch(app.origin+path,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(body)});
      assert.equal(response.status,200);
      const result=await response.json();
      assert.equal(result.objectActions.length,5);
      for(const item of result.objectActions)assert.deepEqual(item.actions.map(a=>a.allowed),expected);
    }
    const types=[UniverInstanceType.UNIVER_SHEET,UniverInstanceType.UNIVER_DOC,UniverInstanceType.UNIVER_SLIDE,UniverInstanceType.UNIVER_BASE,UniverInstanceType.UNIVER_BOARD];
    const backend=createCollaborationServerAdapter({...collaborationUrls(app.origin,fileId,draft.worktreeID),httpRequest:(url,init)=>fetch(url,{...init,headers:{...init?.headers,cookie}})});
    for(const [index,unit]of units.entries()){
      const handle=await backend.open({unitId:unit.unitId,unitType:types[index]});handles.push(handle);
      const before=await handle.getUnitOnRev();
      assert.equal(before.error.code,ErrorCode.OK);
      const result=await handle.submitChangeset({baseRev:1,mutations:[{id:'test.forbidden-viewer-mutation',params:{unitId:unit.unitId}}],sid:'readonly-view',reqId:index+1});
      assert.equal(result.status,'rejected',unit.kind);assert.equal(result.reason,'permission-denied',unit.kind);
      assert.deepEqual(await handle.getUnitOnRev(),before);
    }
  }finally{await Promise.allSettled(handles.map(h=>h.close()));await app.close();await rm(workspace,{recursive:true,force:true});}
});
