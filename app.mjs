import {analyzeReceipt,assessReceiptHealth} from './engine.mjs';
const RPC='https://rpc.mainnet.arc.io';
const EXAMPLE='0xb147ec455818b74b6511e905abc6f56e15c189432f3c0e98b397108e6916d8e3';
const $=id=>document.getElementById(id);
const form=$('tx-form'),input=$('tx-hash'),status=$('status'),result=$('result-region'),error=$('tx-error');
const buttons=[...form.querySelectorAll('button')];
let busy=false, bundle=null;
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function link(text,url){const a=node('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function metric(label,value){const e=node('div',undefined,'metric');e.append(node('span',label,'label'),node('strong',value));return e;}
function shareURL(mode,hash){const url=new URL(window.location.href);url.search='';if(mode==='live')url.searchParams.set('tx',hash);else url.searchParams.set('sample','captured');return url.toString();}
function shortAddress(address){return `${address.slice(0,8)}…${address.slice(-6)}`;}
async function copyText(text){
 if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
 const area=node('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();
 const copied=document.execCommand('copy');area.remove();if(!copied)throw Error('Copy failed');
}
function effectRow(effect){
 const row=node('li',undefined,`effect-row effect-row--${effect.role}`);
 const identity=node('div');identity.append(node('span',effect.role.toUpperCase(),'label'),node('code',shortAddress(effect.address),'effect-address'));identity.querySelector('code').title=effect.address;
 const values=node('div',undefined,'effect-values');values.append(node('strong',`${effect.net} USDC`),node('span',`in ${effect.inflow} · out ${effect.outflow}`));row.append(identity,values);return row;
}
function renderNetEffects(report){
 const effects=report.netEffects;if(!effects.participants.length)return null;
 const section=node('section',undefined,'net-effects');section.setAttribute('aria-labelledby','net-effects-title');
 const title=node('h3','Net USDC effects','net-effects__title');title.id='net-effects-title';section.append(node('p','RECEIPT-LEVEL NET FLOW','kicker'),title);
 const summary=node('div',undefined,'net-effects__summary');summary.append(metric('SOURCES',String(effects.sourceCount)),metric('RECIPIENTS',String(effects.recipientCount)),metric('TRANSIT',String(effects.transitCount)));section.append(summary);
 const primary=node('ul',undefined,'effect-list');effects.participants.filter(item=>item.role!=='transit').forEach(item=>primary.append(effectRow(item)));section.append(primary);
 const transit=effects.participants.filter(item=>item.role==='transit');if(transit.length){const details=node('details',undefined,'transit-details');details.append(node('summary',`${transit.length} zero-net transit ${transit.length===1?'address':'addresses'}`));const list=node('ul',undefined,'effect-list');transit.forEach(item=>list.append(effectRow(item)));details.append(list);section.append(details);}
 if(effects.supply.mintedRaw!=='0'||effects.supply.burnedRaw!=='0')section.append(node('p',`Supply events: minted ${effects.supply.minted} USDC · burned ${effects.supply.burned} USDC · net ${effects.supply.net} USDC.`,'net-effects__note'));
 section.append(node('p','Derived only from canonical system-emitter movements in this receipt. Network fee is excluded and shown separately.','net-effects__note'));return section;
}
function renderStreamProof(report){
 if(report.status!=='success'||!report.systemLogCount||!report.erc20LogCount)return null;
 const total=report.systemLogCount+report.erc20LogCount;
 const proof=node('section',undefined,'stream-proof');proof.setAttribute('aria-label','Double-counting check');
 const before=node('div',undefined,'stream-proof__number');before.append(node('span','TRANSFER EVENT RECORDS','label'),node('strong',String(total)));
 const arrow=node('span','→','stream-proof__arrow');arrow.setAttribute('aria-hidden','true');
 const after=node('div',undefined,'stream-proof__number stream-proof__number--answer');after.append(node('span','CANONICAL MOVEMENTS','label'),node('strong',String(report.movements.length)));
 const copy=node('p',`${report.systemLogCount} system events + ${report.erc20LogCount} ERC-20 records. Arc Lens counts the verified system stream once instead of reporting ${total} movements.`,'stream-proof__copy');
 proof.append(before,arrow,after,copy);return proof;
}
function renderHealth(health){
 const section=node('section',undefined,'health');section.setAttribute('aria-labelledby','health-title');
 const heading=node('div',undefined,'health__heading');const copy=node('div');const title=node('h3','Integration health check','health__title');title.id='health-title';copy.append(node('p','DETERMINISTIC RECEIPT CHECKS','kicker'),title);heading.append(copy,node('strong',health.verdict==='pass'?'PASS':'REVIEW',`health__verdict health__verdict--${health.verdict}`));section.append(heading);
 section.append(node('p','Checks describe the available receipt evidence. They do not certify safety, compliance or accounting correctness.','health__note'));
 const list=node('ul',undefined,'health__list');
 for(const check of health.checks){const item=node('li',undefined,'health__item');const badge=node('span',check.status==='na'?'N/A':check.status.toUpperCase(),`health__badge health__badge--${check.status}`);const body=node('div');body.append(node('strong',check.label),node('p',check.detail),node('code',check.source));item.append(badge,body);list.append(item);}section.append(list);return section;
}
function setBusy(v){busy=v;buttons.forEach(b=>b.disabled=v);input.disabled=v;form.setAttribute('aria-busy',String(v));}
async function rpc(method,params,signal){
 const response=await fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal});
 if(!response.ok)throw Error(`Arc RPC returned HTTP ${response.status}. Try again or inspect the captured example.`);
 const data=await response.json();if(data.error)throw Error(`Arc RPC: ${String(data.error.message||'request failed').slice(0,250)}`);
 if(!Object.hasOwn(data,'result'))throw Error('Arc RPC returned an incomplete response.');return data.result;
}
function render(receipt,source){
 const report=analyzeReceipt(receipt);
 const health=assessReceiptHealth(report,{chainId:5042,sourceMode:source.mode});
 const shareUrl=shareURL(source.mode,report.hash);history.replaceState(null,'',shareUrl);
 bundle={tool:'Arc Lens',version:'0.3.0',chainId:5042,source:{...source,shareUrl},health,analysis:report,receipt};
 result.replaceChildren();result.hidden=false;
 const header=node('div',undefined,'result-heading');header.append(node('p',source.mode==='live'?'FETCHED FROM ARC MAINNET':'CAPTURED SNAPSHOT','kicker'),link('Open in explorer ↗',`https://explorer.arc.io/tx/${report.hash}`));result.append(header);
 result.append(node('h2',report.status==='success'?'The receipt, made readable.':'Transaction reverted.','result-title'));
 result.append(node('p',source.mode==='live'?`Fetched ${new Date(source.fetchedAt).toLocaleString()} · chain 5042`:`Recorded ${source.capturedAt}. This is saved evidence, not a live request.`,'hint'));
 result.append(node('p',report.hash,'tx-full'));
 const metrics=node('div',undefined,'metrics');metrics.append(metric('RESULT',report.status==='success'?'Success':'Reverted'),metric('USDC MOVEMENTS',String(report.movements.length)),metric('NETWORK FEE',`${report.fee} USDC`));result.append(metrics);
 result.append(node('p','Fee = gas used × effective gas price, expressed in USDC. It is separate from transfers and can still be charged when execution reverts.','hint'));
 for(const warning of report.warnings)result.append(node('p',warning,'warning'));
 const proof=renderStreamProof(report);if(proof)result.append(proof);
 const stream=node('div',undefined,'stream-note');stream.append(node('strong',`${report.systemLogCount} system logs · ${report.erc20LogCount} ERC-20 logs`),node('p','Only system-emitter transfers count as movements. ERC-20 logs are another view, not extra money. No equal-amount transfers are merged.'));result.append(stream);
 result.append(renderHealth(health));
 const effects=renderNetEffects(report);if(effects)result.append(effects);
 result.append(node('h3','Canonical USDC movements'));
 if(!report.movements.length)result.append(node('p',report.status==='reverted'?'No completed USDC movements: execution reverted.':'No canonical USDC movements were found in this receipt. Other assets and approvals are outside this view.','empty-result'));
 const list=node('ol',undefined,'movements');
 report.movements.forEach(m=>{const row=node('li');const top=node('div',undefined,'movement-top');top.append(node('span',`${m.kind.toUpperCase()} · LOG ${m.logIndex}`,'label'),node('strong',`${m.amount} USDC`));row.append(top,node('p',`From  ${m.from}`,'address'),node('p',`To      ${m.to}`,'address'));list.append(row);});result.append(list);
 const details=node('details',undefined,'raw');details.append(node('summary','Inspect the raw RPC receipt'),node('pre',JSON.stringify(receipt,null,2)));result.append(details);
 const actions=node('div',undefined,'evidence-actions');const download=node('button','Download evidence JSON','btn btn--primary');download.type='button';download.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=node('a');a.href=url;a.download=`arc-lens-${report.hash.slice(2,14)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});const copy=node('button','Copy shareable link','btn btn--ghost');copy.type='button';copy.addEventListener('click',async()=>{try{await copyText(shareUrl);status.textContent='Shareable link copied.';}catch{status.textContent='Could not copy the link. Copy it from the address bar.';}});actions.append(download,copy,link('Read Arc’s event specification ↗','https://docs.arc.io/arc/references/usdc-system-events'));result.append(actions);
}
async function load(mode){
 if(busy)return;
 error.hidden=true;input.removeAttribute('aria-invalid');
 if(mode==='live'&&!/^0x[0-9a-fA-F]{64}$/.test(input.value.trim())){error.textContent='Enter a transaction hash: 0x followed by 64 hexadecimal characters.';error.hidden=false;input.setAttribute('aria-invalid','true');input.focus();return;}
 setBusy(true);result.hidden=true;bundle=null;status.textContent=mode==='live'?'Checking Arc mainnet and reading the receipt…':'Opening the captured mainnet example…';
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
 try{
  if(mode==='captured'){
   const response=await fetch('./fixtures/live-1.json',{signal:controller.signal});if(!response.ok)throw Error('Captured example is unavailable.');const data=await response.json();
   if(data.chainId!==5042)throw Error('Captured evidence is not Arc mainnet.');
   render(data.receipt,{mode:'captured',rpc:data.source,capturedAt:data.capturedAt});
  }else{
   const chain=await rpc('eth_chainId',[],controller.signal);if(chain!=='0x13b2')throw Error('The RPC is not Arc mainnet. No receipt was accepted.');
   const hash=input.value.trim().toLowerCase();const receipt=await rpc('eth_getTransactionReceipt',[hash],controller.signal);
   if(!receipt)throw Error('No mined receipt found. The hash may be pending, unknown, or from another network.');
   if(receipt.transactionHash?.toLowerCase()!==hash)throw Error('RPC receipt hash does not match your request.');
   render(receipt,{mode:'live',rpc:RPC,fetchedAt:new Date().toISOString()});
  }
  status.textContent=mode==='live'?'Mainnet receipt loaded.':'Captured snapshot loaded. No live RPC request was made.';
 }catch(e){status.textContent='Receipt not loaded.';error.textContent=e.name==='AbortError'?'The request timed out. Try again or open the captured example.':e.message;error.hidden=false;}
 finally{clearTimeout(timer);setBusy(false);}
}
form.addEventListener('submit',e=>{e.preventDefault();load('live');});
$('btn-example').addEventListener('click',()=>{input.value=EXAMPLE;load('live');});
$('btn-captured').addEventListener('click',()=>load('captured'));
const params=new URLSearchParams(window.location.search);const linkedTx=params.get('tx');
if(linkedTx!==null){input.value=linkedTx;load('live');}else if(params.get('sample')==='captured')load('captured');
