import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compactComparisonRanges} from '../../dist/shared/comparison-ranges.js';
const cell=(row,column,kind='update')=>({kind,startRow:row,endRow:row,startColumn:column,endColumn:column});
const coverage=ranges=>new Set(ranges.flatMap(range=>Array.from({length:range.endRow-range.startRow+1},(_,r)=>Array.from({length:range.endColumn-range.startColumn+1},(_,c)=>`${range.kind}:${range.startRow+r}:${range.startColumn+c}`)).flat()));
test('contiguous highlights collapse without painting holes or merging different change kinds',()=>{
 const column=Array.from({length:2205},(_,row)=>cell(row,0));
 assert.deepEqual(compactComparisonRanges(column),[{kind:'update',startRow:0,endRow:2204,startColumn:0,endColumn:0}]);
 const varied=[cell(0,0),cell(0,1),cell(1,0),cell(2,1),cell(2,1),cell(1,1,'insert'),cell(0,0,'delete'),{kind:'update',startRow:4,endRow:8,startColumn:0,endColumn:2}];
 const original=structuredClone(varied),compact=compactComparisonRanges(varied);
 assert.deepEqual(coverage(compact),coverage(varied));assert.deepEqual(varied,original);
 assert.ok(!coverage(compact).has('update:1:1'));
});
