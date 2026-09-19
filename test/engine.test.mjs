import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeReceipt as analyze,formatUnits,SYSTEM_EMITTER as S,USDC as U,TRANSFER_TOPIC as T} from '../engine.mjs';
const hash='0x'+'ab'.repeat(32), a='0x'+'11'.repeat(20),b='0x'+'22'.repeat(20);
const topic=x=>'0x'+x.slice(2).padStart(64,'0');
const log=(i=0,amount=10n**18n,emitter=S)=>({logIndex:'0x'+i.toString(16),address:emitter,topics:[T,topic(a),topic(b)],data:'0x'+amount.toString(16).padStart(64,'0'),removed:false});
const receipt=(logs=[])=>({transactionHash:hash,status:'0x1',blockNumber:'0xa',gasUsed:'0x5208',effectiveGasPrice:'0x4a817c800',logs});
test('exact decimal math including tiny dust and very large values',()=>{
 assert.equal(formatUnits(1n),'0.000000000000000001');assert.equal(formatUnits(1234567890123456789012345678n),'1234567890.123456789012345678');assert.equal(formatUnits(42n,0),'42');assert.throws(()=>formatUnits(-1n));
});
test('native transfer and receipt fee remain separate',()=>{const x=analyze(receipt([log()]));assert.equal(x.movements[0].amount,'1');assert.equal(x.fee,'0.00042');});
test('dual emitters do not double count',()=>{const x=analyze(receipt([log(),log(1,1000000n,U)]));assert.equal(x.movements.length,1);assert.equal(x.erc20LogCount,1);});
test('two equal payments survive unchanged',()=>{const x=analyze(receipt([log(),log(1,1000000n,U),log(2),log(3,1000000n,U)]));assert.equal(x.movements.length,2);});
test('reverted execution has no movements but retains gas fee',()=>{const r=receipt([log()]);r.status='0x0';const x=analyze(r);assert.equal(x.movements.length,0);assert.equal(x.fee,'0.00042');assert.equal(x.warnings.length,1);});
test('ERC20 alone is incomplete evidence, never an invented transfer',()=>{const x=analyze(receipt([log(0,1000000n,U)]));assert.equal(x.movements.length,0);assert.match(x.warnings[0],/incomplete/);});
test('unrelated tokens are not USDC',()=>{assert.equal(analyze(receipt([log(0,100n,a)])).movements.length,0);});
test('malformed known events are rejected',()=>{for(const change of [l=>l.topics.pop(),l=>l.data='0x01',l=>l.topics[1]='0x'+'f'.repeat(64),l=>l.removed=true]){const l=log();change(l);assert.throws(()=>analyze(receipt([l])));}});
test('duplicate or unsafe log indices fail closed',()=>{assert.throws(()=>analyze(receipt([log(),log()])));const l=log();l.logIndex='0x20000000000000';assert.throws(()=>analyze(receipt([l])));});
test('missing and malformed receipt fields fail instead of claiming zero',()=>{assert.throws(()=>analyze(null));for(const key of ['logs','gasUsed','status','transactionHash','blockNumber','effectiveGasPrice']){const r=receipt();delete r[key];assert.throws(()=>analyze(r));}});
test('mint and burn classified by zero endpoint',()=>{const l=log();l.topics[1]=topic('0x'+'0'.repeat(40));assert.equal(analyze(receipt([l])).movements[0].kind,'mint');l.topics[1]=topic(a);l.topics[2]=topic('0x'+'0'.repeat(40));assert.equal(analyze(receipt([l])).movements[0].kind,'burn');});
test('three saved mainnet receipts agree with independently counted system events',()=>{
 for(let i=1;i<=3;i++){
  const f=JSON.parse(readFileSync(new URL(`../fixtures/live-${i}.json`,import.meta.url)));const r=f.receipt,x=analyze(r);
  const events=r.logs.filter(l=>l.address.toLowerCase()===S&&l.topics[0]===T);
  assert.equal(x.movements.length,events.length);assert.equal(x.feeRaw,(BigInt(r.gasUsed)*BigInt(r.effectiveGasPrice)).toString());assert.equal(f.chainId,5042);
 }
});
