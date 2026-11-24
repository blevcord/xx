/* SoundCloud account-first discovery. Independent of Spotify and legacy SoundCloud artist view. */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const storage=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const save=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const n=s=>String(s??"").normalize("NFKC").trim().toLowerCase();
const sample=arr=>arr[Math.floor(Math.random()*arr.length)];
const K={library:"scLibraryV1",history:"scHistoryV1",sources:"scSourcesV2"};
function soundcloudUrl(value){
 if(typeof value!=="string")return null;
 try{
  const u=new URL(value.trim());
  if(u.protocol!=="https:"||!["soundcloud.com","www.soundcloud.com","m.soundcloud.com"].includes(u.hostname))return null;
  const segments=u.pathname.split("/").filter(Boolean);
  if(!segments.length||["search","discover","stream","you","upload","charts","settings","pro"].includes(segments[0].toLowerCase()))return null;
  u.hostname="soundcloud.com";u.hash="";u.pathname="/"+segments.join("/");
  for(const k of [...u.searchParams.keys()])if(k==="si"||k.startsWith("utm_"))u.searchParams.delete(k);
  return u.toString()
 }catch{return null}
}
function trackObject(obj){
 if(!obj||typeof obj!=="object")return null;
 const url=soundcloudUrl(obj.permalink_url||obj.url||"");
 if(!url||typeof obj.title!=="string"||!obj.title.trim())return null;
 const artist=obj.user?.username||obj.artist||obj.publisher_metadata?.artist||"SoundCloud";
 return {id:String(obj.id||url),url,title:obj.title.slice(0,400),artist:String(artist).slice(0,160),
  ...(typeof obj.artwork_url==="string"?{image:obj.artwork_url}:{}),...(Number.isFinite(obj.drawnAt)?{drawnAt:obj.drawnAt}:{}),
  ...(typeof obj.sourceUrl==="string"?{sourceUrl:obj.sourceUrl}:{}),...(typeof obj.sourceLabel==="string"?{sourceLabel:obj.sourceLabel}:{})}
}
function srcLabel(url){
 const parts=new URL(url).pathname.split("/").filter(Boolean);
 const p=parts[0].replace(/[-_]+/g," ");
 if(parts.length===1)return p;
 if(parts[1]==="sets")return p+" · "+(parts.slice(2).join(" ").replace(/[-_]+/g," ")||"Playlist");
 return p+" · "+parts.slice(1).join(" ").replace(/[-_]+/g," ")
}
function srcType(url){
 const arr=new URL(url).pathname.split("/").filter(Boolean);
 return arr.length===1?"Account":arr[1]==="sets"?"Playlist":"Track"
}
function newSource(url,label=""){
 return {url,label:label||srcLabel(url),type:srcType(url),trackIds:[],checkedAt:0,status:"new",error:""}
}
let library=(Array.isArray(storage(K.library,[]))?storage(K.library,[]):[]).map(trackObject).filter(Boolean);
let history=(Array.isArray(storage(K.history,[]))?storage(K.history,[]):[]).map(trackObject).filter(Boolean);
const oldSources=storage(K.sources,null);
let sources=Array.isArray(oldSources)?oldSources:[];
function addSource(input,label=""){
 const url=soundcloudUrl(input);
 if(!url)return false;
 if(sources.some(s=>s.url===url))return false;
 sources.push(newSource(url,label));return true
}
function mergeLegacy(){
 let added=0;
 const prior=storage("scArtistProfilesV1",{});
 if(prior&&typeof prior==="object"){
  for(const urls of Object.values(prior))for(const raw of Array.isArray(urls)?urls:[urls])if(addSource(raw))added++
 }
 const found=Array.isArray(window.SC_VERIFIED_ARCHIVE_SOURCES)?window.SC_VERIFIED_ARCHIVE_SOURCES:[];
 for(const entry of found){
  if(!entry||!Array.isArray(entry.urls))continue;
  for(const raw of entry.urls)if(addSource(raw))added++
 }
 // Prior track imports lack reliable account attribution; retain them in a separate source pool.
 return added
}
if(!Array.isArray(oldSources))mergeLegacy();

sources=sources.filter(s=>s&&typeof s==="object"&&soundcloudUrl(s.url||"")).map(s=>({
 ...newSource(soundcloudUrl(s.url),typeof s.label==="string"&&s.label.trim()?s.label.trim():""),
 trackIds:Array.isArray(s.trackIds)?[...new Set(s.trackIds.filter(x=>typeof x==="string"))]:[],
 status:["ready","failed","new"].includes(s.status)?s.status:"new",
 checkedAt:Number(s.checkedAt)||0,error:typeof s.error==="string"?s.error:""
}));
/* Add the freshly researched SoundCloud sources to existing installations once,
   preserving manually added/removed sources and every track and history record. */
const scResearchKey="scResearchVerifiedNov24V3";
let scResearchPending=false;
try{scResearchPending=localStorage.getItem(scResearchKey)!=="done"}catch(e){console.warn("SoundCloud import marker unavailable",e)}
if(scResearchPending){
 const verified=Array.isArray(window.SC_VERIFIED_ARCHIVE_SOURCES)?window.SC_VERIFIED_ARCHIVE_SOURCES:[];
 for(const row of verified){
   if(row?.researchBatch!=="2026-11-24-verified-direct"||!Array.isArray(row.urls))continue;
   for(const url of row.urls)addSource(url)
 }
}
const scResearchV4Key="scResearchVerifiedNov24V4";
let scResearchV4Pending=false;
try{scResearchV4Pending=localStorage.getItem(scResearchV4Key)!=="done"}catch(e){console.warn("SoundCloud V4 marker unavailable",e)}
if(scResearchV4Pending){
 const verified=Array.isArray(window.SC_VERIFIED_ARCHIVE_SOURCES)?window.SC_VERIFIED_ARCHIVE_SOURCES:[];
 for(const row of verified){
   if(row?.researchBatch!=="2026-11-24-verified-direct-v4"||!Array.isArray(row.urls))continue;
   for(const url of row.urls)addSource(url)
 }
}
if(library.length&&!sources.some(s=>s.url===null)){/* unsourced library represented by a virtual pool below */}
const libraryById=()=>new Map(library.map(t=>[String(t.id),t]));
const historySet=()=>new Set(history.map(t=>String(t.id)));
const sourceTracks=(source)=>{
 const lookup=libraryById();
 return (source.trackIds||[]).map(id=>lookup.get(id)).filter(Boolean)
};
function orphanTracks(){
 const claimed=new Set(sources.flatMap(s=>s.trackIds||[]));
 return library.filter(t=>!claimed.has(String(t.id)))
}
function persist(){
 save(K.sources,sources);save(K.library,library);save(K.history,history)
}
try{persist();if(scResearchPending)localStorage.setItem(scResearchKey,"done");if(scResearchV4Pending)localStorage.setItem(scResearchV4Key,"done")}catch(e){console.warn("SoundCloud migration storage:",e)}
let tab="shuffle",activeSource=null,isImporting=false,stopImport=false;
function accountGroups(){
 const groups=new Map();
 for(const source of sources){
  let account;
  try{account=new URL(source.url).pathname.split("/").filter(Boolean)[0]}catch{continue}
  const id=n(account);
  if(!id)continue;
  if(!groups.has(id))groups.set(id,{url:"https://soundcloud.com/"+account,label:account.replace(/[-_]+/g," "),items:new Map()});
  const group=groups.get(id);
  for(const track of sourceTracks(source))group.items.set(String(track.id),track)
 }
 return [...groups.values()]
}
const accountCount=()=>accountGroups().filter(g=>[...g.items.values()].some(t=>!historySet().has(String(t.id)))).length;
function state(text){$("scMessage").textContent=text}
function setPanel(next){
 tab=next;
 document.querySelectorAll("#scNav [data-sc-tab]").forEach(b=>b.classList.toggle("active",b.dataset.scTab===next));
 document.querySelectorAll("#soundcloudMain [data-sc-panel]").forEach(p=>p.hidden=p.dataset.scPanel!==next);
 if(next==="stats")renderStats();
 if(next==="accounts")renderSources();
 if(next==="library")renderLibrary();
 if(next==="history")renderHistory()
}
function updateKPIs(){
 const played=historySet(),unheard=library.filter(t=>!played.has(String(t.id)));
 const stats=[["scTotalSources",sources.length],["scReadySources",accountCount()],["scTotalTracks",library.length],["scUnheard",unheard.length],["scPlayedCount",history.length]];
 for(const [id,v]of stats)$(id).textContent=v.toLocaleString("de-CH");
}
function play(track,source){
 const record={...track,sourceUrl:source?.url||"",sourceLabel:source?.label||"Früher importiert",drawnAt:Date.now()};
 history.push(record);
 try{save(K.history,history)}catch(e){history.pop();state("Browserspeicher voll. Bitte zuerst ein Backup exportieren.");return}
 $("scCurrentSource").textContent=record.sourceLabel;
 $("scCurrentTrack").textContent=track.title;
 $("scCurrentUploader").textContent=track.artist;
 $("scDirectLink").href=track.url;$("scDirectLink").hidden=false;
 const widget=$("scWidget");widget.hidden=false;
 widget.src="https://w.soundcloud.com/player/?"+new URLSearchParams({url:track.url,auto_play:"false",visual:"false",show_artwork:"true",color:"#ff5500"});
 const cover=$("scCover");cover.hidden=!track.image;if(track.image)cover.src=track.image;
 state("Song gefunden · "+history.length+" SoundCloud-Shuffles bisher.");
 updateKPIs()
}
function chooseSong(){
 const listened=historySet();
 const options=accountGroups().map(group=>({
   source:{url:group.url,label:group.label},
   tracks:[...group.items.values()].filter(t=>!listened.has(String(t.id)))
 })).filter(x=>x.tracks.length);
 // Pre-existing SoundCloud songs without a known upload account remain discoverable.
 const orphan=orphanTracks().filter(t=>!listened.has(String(t.id)));
 if(orphan.length)options.push({source:null,tracks:orphan});
 if(!options.length){
   state(library.length?"Alle importierten SoundCloud-Songs wurden schon gezogen. Importiere weitere Quellen.":"Noch keine SoundCloud-Songs vorhanden. Öffne Accounts und importiere deine Quellen.");
   return false
 }
 // Accounts are equally weighted, regardless of their number of playlists or tracks.
 const recent=new Set(history.slice(-7).map(t=>t.sourceUrl||"_old"));
 let pool=options.filter(x=>!recent.has(x.source?.url||"_old"));
 if(!pool.length)pool=options;
 const choice=sample(pool);
 play(sample(choice.tracks),choice.source);
 return true
}
async function widgetGetTracks(url){
 if(!window.SC?.Widget)throw Error("SoundCloud-Player API nicht verfügbar. Eventuell blockiert ein Adblocker das Script.");
 return new Promise((resolve,reject)=>{
  let settled=false,widget;
  const frame=document.createElement("iframe");
  frame.title="SoundCloud-Quelle lesen";
  frame.style.cssText="position:absolute;width:320px;height:170px;left:-9999px;pointer-events:none";
  frame.src="https://w.soundcloud.com/player/?"+new URLSearchParams({url,auto_play:"false"});
  const finish=(err,result)=>{if(settled)return;settled=true;clearTimeout(timer);frame.remove();err?reject(err):resolve(result)};
  const timer=setTimeout(()=>finish(Error("SoundCloud-Player antwortet nicht (15 Sekunden).")),15000);
  document.body.append(frame);
  try{
   widget=window.SC.Widget(frame);
   widget.bind(window.SC.Widget.Events.READY,()=>widget.getSounds(items=>{
    if(!Array.isArray(items)||!items.length)return finish(Error("Keine öffentlich auslesbaren Tracks."));finish(null,items)
   }));
   widget.bind(window.SC.Widget.Events.ERROR,()=>finish(Error("SoundCloud konnte den Link nicht laden.")));
  }catch(e){finish(e)}
 })
}
async function importSource(source){
 source.status="loading";renderSources();
 try{
  const raw=await widgetGetTracks(source.url);
  const tracks=raw.map(trackObject).filter(Boolean);
  if(!tracks.length)throw Error("Kein öffentlicher Track mit gültigem SoundCloud-Link gefunden.");
  const known=new Set(library.map(t=>String(t.id)));
  const assoc=new Set(source.trackIds||[]);
  let added=0;
  for(const track of tracks){
   if(!known.has(String(track.id))){library.push(track);known.add(String(track.id));added++}
   assoc.add(String(track.id))
  }
  source.trackIds=[...assoc];source.status="ready";source.error="";source.checkedAt=Date.now();
  persist();updateKPIs();renderSources();
  return {count:tracks.length,added}
 }catch(err){
  source.status="failed";source.error=String(err.message||err);source.checkedAt=Date.now();
  try{save(K.sources,sources)}catch{}
  renderSources();
  throw err
 }
}
async function batchImport(){
 if(isImporting)return;
 isImporting=true;stopImport=false;$("scImportAll").disabled=true;
 const pending=sources.filter(s=>s.status!=="ready"||!(s.trackIds||[]).length);
 let completed=0,added=0,failed=0;
 try{
  for(const s of pending){
   if(stopImport)break;
   state("Importiere "+(completed+1)+"/"+pending.length+": "+s.label+" …");
   try{const result=await importSource(s);added+=result.added}catch{failed++}
   completed++
  }
  state((stopImport?"Gestoppt. ":"")+completed+" Quellen geprüft · "+added+" neue Tracks · "+failed+" nicht lesbar. Verfügbare Songs sind gespeichert.");
 }finally{isImporting=false;$("scImportAll").disabled=false;renderSources();updateKPIs()}
}
function sourceRow(source){
 const div=document.createElement("div");div.className="sc-source-row";
 const info=document.createElement("div");
 const name=document.createElement("strong");name.textContent=source.label;
 const meta=document.createElement("small");
 const count=sourceTracks(source).length;
 meta.textContent=source.type+" · "+count+" Songs · "+({ready:"Bereit",failed:"Nicht lesbar",new:"Noch nicht importiert",loading:"Wird gelesen"}[source.status]||"Neu");
 if(source.error)meta.title=source.error;
 info.append(name,meta);
 const actions=document.createElement("div");actions.className="sc-source-actions";
 const open=document.createElement("a");open.href=source.url;open.target="_blank";open.rel="noopener noreferrer";open.textContent="Öffnen";
 const imp=document.createElement("button");imp.className="secondary";imp.textContent="Importieren";imp.disabled=isImporting||source.status==="loading";
 imp.onclick=async()=>{if(isImporting)return;isImporting=true;imp.disabled=true;state("Lade "+source.label+" …");try{let r=await importSource(source);state(r.added+" neue Tracks aus "+source.label+" gespeichert.")}catch(e){state(source.label+": "+e.message)}finally{isImporting=false;renderSources()}};
 const rename=document.createElement("button");rename.className="secondary";rename.textContent="Name";rename.onclick=()=>{let label=prompt("Name für Account/Playlist:",source.label);if(label===null||!label.trim())return;source.label=label.trim().slice(0,100);save(K.sources,sources);renderSources()};
 const remove=document.createElement("button");remove.className="secondary";remove.textContent="×";remove.title="Quelle entfernen; Songs und Verlauf bleiben erhalten.";remove.onclick=()=>{if(!confirm(source.label+" aus den Quellen entfernen? Bereits importierte Songs bleiben in deiner Library."))return;sources=sources.filter(s=>s!==source);save(K.sources,sources);renderSources();updateKPIs()};
 actions.append(open,imp,rename,remove);div.append(info,actions);return div
}
function renderSources(){
 const root=$("scSourcesList");root.replaceChildren();
 const q=n($("scSourceSearch").value),filter=$("scSourceFilter").value;
 let items=sources.filter(s=>n(s.label+" "+s.url).includes(q)&&(filter==="all"||(filter==="ready"?sourceTracks(s).length>0:filter==="new"?s.status==="new":s.status==="failed")));
 $("scSourceSummary").textContent=items.length+" von "+sources.length+" Quellen · "+sources.filter(s=>s.status==="ready").length+" erfolgreich gelesen";
 for(const s of items.slice(0,250))root.append(sourceRow(s));
 if(items.length>250){let p=document.createElement("p");p.textContent="250 Quellen sichtbar. Suche nach weiteren.";root.append(p)}
}
function renderLibrary(){
 const root=$("scLibraryList");root.replaceChildren();
 const q=n($("scLibrarySearch").value),mode=$("scLibraryFilter").value,heard=historySet();
 const items=library.filter(t=>n(t.title+" "+t.artist).includes(q)&&(mode==="all"||(mode==="heard"?heard.has(String(t.id)):!heard.has(String(t.id)))));
 $("scLibrarySummary").textContent=items.length+" von "+library.length+" Songs";
 for(const t of items.slice().reverse().slice(0,250)){
  const div=document.createElement("div");div.className="sc-track-row";
  const main=document.createElement("div");const title=document.createElement("strong");title.textContent=t.title;
  const sub=document.createElement("small");sub.textContent=t.artist+(heard.has(String(t.id))?" · Bereits gezogen":"");
  main.append(title,sub);
  const link=document.createElement("a");link.href=t.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Anhören";
  div.append(main,link);root.append(div)
 }
}
function renderHistory(){
 const root=$("scHistoryList");root.replaceChildren();
 for(const t of history.slice().reverse().slice(0,350)){
  const div=document.createElement("div");div.className="sc-track-row";
  const meta=document.createElement("div");const title=document.createElement("strong");title.textContent=t.title;
  const sub=document.createElement("small");sub.textContent=(t.sourceLabel||t.artist||"SoundCloud")+(t.drawnAt?" · "+new Date(t.drawnAt).toLocaleString("de-CH"):"");
  meta.append(title,sub);const link=document.createElement("a");link.href=t.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Anhören";div.append(meta,link);root.append(div)
 }
 $("scHistorySummary").textContent=history.length+" Shuffles · "+new Set(history.map(t=>t.id)).size+" einzigartige Tracks";
}
function statBar(container,entries){
 const root=$(container);root.replaceChildren();
 const pairs=entries.filter(x=>x[1]>0).slice(0,12);
 if(!pairs.length){const p=document.createElement("p");p.textContent="Noch keine Daten.";root.append(p);return}
 const max=Math.max(...pairs.map(x=>x[1]));
 for(const [label,count]of pairs){
  const row=document.createElement("div");row.className="sc-bar-row";
  const name=document.createElement("span");name.textContent=label;name.title=label;
  const track=document.createElement("div");track.className="sc-bar-track";
  const fill=document.createElement("div");fill.className="sc-bar-fill";fill.style.width=Math.max(2,100*count/max)+"%";track.append(fill);
  const num=document.createElement("b");num.textContent=count;
  row.append(name,track,num);root.append(row)
 }
}
function renderStats(){
 const heard=historySet(),time=history.filter(t=>Number.isFinite(t.drawnAt));
 const counts=new Map();for(const t of history){let k=t.sourceLabel||t.sourceUrl||"Frühere Library";counts.set(k,(counts.get(k)||0)+1)}
 statBar("scTopSources",[...counts].sort((a,b)=>b[1]-a[1]));
 const c=[["Tracks insgesamt",library.length],["Noch nicht gezogen",library.filter(t=>!heard.has(String(t.id))).length],["Gezogene Songs",history.length],["Quellen",sources.length],["Lesbare Quellen",sources.filter(s=>sourceTracks(s).length).length],["Importfehler",sources.filter(s=>s.status==="failed").length],["Accounts",sources.filter(s=>s.type==="Account").length],["Playlists",sources.filter(s=>s.type==="Playlist").length]];
 const grid=$("scStatsNumbers");grid.replaceChildren();
 for(const [label,value]of c){const card=document.createElement("div");card.className="sc-stat-number";const big=document.createElement("b");big.textContent=value.toLocaleString("de-CH");const sub=document.createElement("small");sub.textContent=label;card.append(big,sub);grid.append(card)}
 statBar("scTrackSourceTypes",[["Accounts",sources.filter(s=>s.type==="Account").length],["Playlists",sources.filter(s=>s.type==="Playlist").length],["Einzelne Tracks",sources.filter(s=>s.type==="Track").length]]);
 const byDay=new Map();for(const item of time){const day=new Date(item.drawnAt).toLocaleDateString("de-CH");byDay.set(day,(byDay.get(day)||0)+1)}
 statBar("scRecentActivity",[...byDay].slice(-10).reverse());
}
function downloadBackup(){
 const data={type:"random-soundcloud-v2",version:2,sources,tracks:library,history,exportedAt:new Date().toISOString()};
 const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=u;a.download="soundcloud-discovery-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)
}
async function restoreBackup(file){
 const obj=JSON.parse(await file.text());
 if(!obj||!["random-soundcloud-v2","soundcloud-v1"].includes(obj.type)||!Array.isArray(obj.tracks)||!Array.isArray(obj.history))throw Error("Ungültige SoundCloud-Sicherung");
 if(obj.tracks.length>50000||obj.history.length>50000)throw Error("Zu viele Einträge");
 const known=new Set(library.map(t=>String(t.id))),historyKnown=new Set(history.map(t=>String(t.id)));
 let added=0,recovered=0;
 for(const raw of obj.tracks){let t=trackObject(raw);if(t&&!known.has(String(t.id))){library.push(t);known.add(String(t.id));added++}}
 for(const raw of obj.history){let t=trackObject(raw);if(t&&!historyKnown.has(String(t.id))){history.push({...t,sourceLabel:raw.sourceLabel||"",sourceUrl:raw.sourceUrl||""});historyKnown.add(String(t.id));recovered++}}
 for(const raw of Array.isArray(obj.sources)?obj.sources:[]){const url=soundcloudUrl(raw?.url||"");if(url){
  const existing=sources.find(s=>s.url===url);
  if(!existing){const src=newSource(url,raw.label);src.trackIds=Array.isArray(raw.trackIds)?raw.trackIds:[];sources.push(src)}
  else{existing.trackIds=[...new Set([...(existing.trackIds||[]),...(Array.isArray(raw.trackIds)?raw.trackIds:[])])]}
 }}
 persist();updateKPIs();renderSources();renderHistory();return {added,recovered}
}
function bind(){
 document.querySelectorAll("#scNav [data-sc-tab]").forEach(button=>button.onclick=()=>setPanel(button.dataset.scTab));
 $("scRoll").onclick=chooseSong;
 $("scImportAll").onclick=batchImport;
 $("scStopImport").onclick=()=>{stopImport=true;state("Stop wird nach der aktuellen Quelle ausgeführt.")};
 $("scAddSources").onclick=()=>{
  const lines=[...new Set($("scBulkLinks").value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean))];
  if(lines.length>200){state("Bitte höchstens 200 Quellen auf einmal hinzufügen.");return}
  let added=0,invalid=0,duplicate=0;
  for(const line of lines){if(!soundcloudUrl(line)){invalid++;continue}if(addSource(line))added++;else duplicate++}
  try{save(K.sources,sources)}catch(e){state("Speicherfehler: "+e.message);return}
  $("scBulkLinks").value="";renderSources();updateKPIs();
  state(added+" Quellen hinzugefügt, "+duplicate+" Duplikate, "+invalid+" ungültige Links.")
 };
 $("scSourceSearch").oninput=renderSources;$("scSourceFilter").onchange=renderSources;
 $("scLibrarySearch").oninput=renderLibrary;$("scLibraryFilter").onchange=renderLibrary;
 $("scSearchSoundCloud").onclick=()=>{const q=$("scSoundcloudSearch").value.trim();if(q)window.open("https://soundcloud.com/search?q="+encodeURIComponent(q),"_blank","noopener")};
 $("scExport").onclick=downloadBackup;
 $("scRestore").onchange=async()=>{const file=$("scRestore").files?.[0];if(!file)return;try{const result=await restoreBackup(file);state(result.added+" Songs und "+result.recovered+" Verlaufseinträge ergänzt; keine vorhandenen Daten ersetzt.")}catch(e){state("Import fehlgeschlagen: "+e.message)}finally{$("scRestore").value=""}};
 const clearSoundCloudHistory=()=>{
  const message=$("scHistoryNotice");
  if(!history.length){
    message.textContent="Der SoundCloud-Verlauf ist bereits leer.";
    state("Der SoundCloud-Verlauf ist bereits leer.");
    return;
  }
  if(!window.confirm("Alle "+history.length+" SoundCloud-Verlaufseinträge wirklich löschen? Die importierten Songs, Accounts und der Spotify-Verlauf bleiben erhalten."))return;
  const previous=history;
  try{
    save(K.history,[]);
    history=[];
    updateKPIs();
    renderHistory();
    renderLibrary();
    renderStats();
    message.textContent=previous.length+" SoundCloud-Verlaufseinträge gelöscht. Du kannst die Songs wieder ziehen.";
    state("SoundCloud-Verlauf gelöscht · "+previous.length+" Einträge. Spotify ist unverändert.");
  }catch(error){
    history=previous;
    message.textContent="Verlauf konnte nicht gelöscht werden: "+error.message;
    state("SoundCloud-Verlauf nicht gelöscht: "+error.message);
  }
 };
 $("scReset").onclick=clearSoundCloudHistory;
 $("scHistoryReset").onclick=clearSoundCloudHistory;
 $("scAutoCheck").onclick=async()=>{if(!sources.length){setPanel("accounts");state("Füge zunächst SoundCloud-Quellen hinzu.");return}if(!chooseSong()){setPanel("accounts");await batchImport();setPanel("shuffle");chooseSong()}};
}
bind();updateKPIs();renderSources();renderStats();setPanel("shuffle");
})();
