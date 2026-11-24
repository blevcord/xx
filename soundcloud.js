/* SoundCloud discovery module — official oEmbed and Widget API, no API keys */
(()=>{
"use strict";
const el=id=>document.getElementById(id);
const store=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const read=(key,defaultValue)=>{try{return JSON.parse(localStorage.getItem(key))??defaultValue}catch{return defaultValue}};
const K={tracks:"sc_tracks_v1",history:"sc_history_v1",sources:"sc_sources_v1"};
let tracks=Array.isArray(read(K.tracks,[]))?read(K.tracks,[]):[];
let history=Array.isArray(read(K.history,[]))?read(K.history,[]):[];
let sources=Array.isArray(read(K.sources,[]))?read(K.sources,[]):[];
let importing=false,widgetLoader=null;
const norm=s=>String(s||"").normalize("NFKC").trim().toLowerCase();
const sample=a=>a[Math.floor(Math.random()*a.length)];
const validUrl=s=>{
  try{let u=new URL(s.trim()); if(!["http:","https:"].includes(u.protocol))return null;
    if(!["soundcloud.com","www.soundcloud.com","m.soundcloud.com"].includes(u.hostname))return null;
    if(u.pathname.split("/").filter(Boolean).length<1)return null;
    u.protocol="https:";u.hash="";for(const k of [...u.searchParams.keys()])if(k.startsWith("utm_")||k==="si")u.searchParams.delete(k);
    return u.href;
  }catch{return null}
};
const key=t=>t.id?"id:"+String(t.id):"url:"+String(t.url||"").split("?")[0].replace(/\/$/,"");
function putAll(){
  store(K.tracks,tracks);store(K.history,history);store(K.sources,sources)
}
function status(msg){el("scStatus").textContent=msg}
function oneTrack(x,fallbackUrl){
  const url=validUrl(x?.permalink_url||fallbackUrl||"");
  if(!url||typeof x?.title!=="string"||!x.title.trim())return null;
  return {id:x.id?String(x.id):null,url,title:x.title.trim(),artist:String(x.metadata_artist||x.user?.username||x.author_name||"SoundCloud Upload").trim(),artwork:typeof x.artwork_url==="string"&&x.artwork_url.startsWith("https://")?x.artwork_url:"",uploader:String(x.user?.username||x.author_name||"").trim()};
}
async function oembedTrack(url){
  const endpoint="https://soundcloud.com/oembed?format=json&url="+encodeURIComponent(url);
  let r=await fetch(endpoint,{mode:"cors"});
  if(!r.ok)throw Error("SoundCloud oEmbed: HTTP "+r.status);
  let j=await r.json();
  if(!j||!j.title)throw Error("Keine Track-Metadaten");
  return oneTrack({title:j.title,author_name:j.author_name,artwork_url:j.thumbnail_url},url);
}
function widgetReady(){
  if(window.SC?.Widget)return Promise.resolve(window.SC.Widget);
  if(widgetLoader)return widgetLoader;
  widgetLoader=new Promise((resolve,reject)=>{
    let script=document.createElement("script");script.src="https://w.soundcloud.com/player/api.js";script.async=true;
    let timer=setTimeout(()=>reject(Error("SoundCloud-Player konnte nicht geladen werden.")),12000);
    script.onload=()=>{clearTimeout(timer);if(window.SC?.Widget)resolve(window.SC.Widget);else reject(Error("SoundCloud Widget API fehlt."))};
    script.onerror=()=>{clearTimeout(timer);reject(Error("SoundCloud Widget API nicht erreichbar."))};
    document.head.append(script);
  }).catch(err=>{widgetLoader=null;throw err});
  return widgetLoader;
}
async function widgetTracks(url){
  const widgetFactory=await widgetReady();
  let frame=document.createElement("iframe");
  frame.src="https://w.soundcloud.com/player/?url="+encodeURIComponent(url)+"&color=%231ed760&auto_play=false&show_artwork=false&visual=false";
  frame.title="SoundCloud Quelle importieren";frame.allow="autoplay";frame.style.cssText="width:100%;height:116px;border:0;border-radius:12px";
  let host=el("scImportPreview");host.replaceChildren(frame);
  return await new Promise((resolve,reject)=>{
    let done=false;
    const finish=(error,data)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(data)};
    const timer=setTimeout(()=>finish(Error("Der Player hat nicht geantwortet. Bei gesperrten oder privaten Uploads kann der Import fehlschlagen.")),15000);
    try{
      const w=widgetFactory(frame);
      w.bind(window.SC.Widget.Events.READY,()=>{w.getSounds(sounds=>{
        if(!Array.isArray(sounds)||!sounds.length){finish(Error("Keine öffentlich einlesbaren Tracks in der Quelle."));return}
        const mapped=sounds.slice(0,500).map(sound=>oneTrack(sound)).filter(Boolean);
        if(!mapped.length){finish(Error("SoundCloud hat keine verwendbaren Track-Links geliefert."));return}
        finish(null,mapped);
      })});
      w.bind(window.SC.Widget.Events.ERROR,()=>finish(Error("SoundCloud-Player meldet einen Fehler.")));
    }catch(e){finish(e)}
  })
}
async function importSource(raw){
  const url=validUrl(raw);
  if(!url)throw Error("Kein vollständiger SoundCloud-Link. Verwende https://soundcloud.com/artist/track oder /sets/playlist.");
  const parts=new URL(url).pathname.split("/").filter(Boolean);
  let received=[];
  if(parts.length===2&&!["sets","likes","reposts","tracks","popular-tracks","albums"].includes(parts[1].toLowerCase())){
    try{let t=await oembedTrack(url);if(t)received=[t]}catch(e){received=await widgetTracks(url)}
  }else{
    received=await widgetTracks(url);
  }
  const known=new Set(tracks.map(key)),unique=new Set(),added=[];
  for(const t of received){
    const k=key(t);
    if(unique.has(k)||known.has(k))continue;
    unique.add(k);known.add(k);added.push(t)
  }
  if(added.length){
    tracks.push(...added);
  }
  const idx=sources.findIndex(s=>s.url===url);
  const record={url,lastImportedAt:Date.now(),count:received.length};
  if(idx>=0)sources[idx]=record;else sources.push(record);
  putAll();
  return {added:added.length,found:received.length};
}
function exportJson(filename,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const u=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)
}
function renderList(id,items,create){
  const root=el(id);root.replaceChildren();
  if(!items.length){let x=document.createElement("p");x.textContent="Noch keine Einträge.";root.append(x);return}
  const frag=document.createDocumentFragment();
  for(const item of items)frag.append(create(item));
  root.append(frag);
}
function trackRow(t,canRemove){
  const div=document.createElement("div");div.className="sc-list-row";
  const main=document.createElement("div");
  const strong=document.createElement("strong");strong.textContent=t.title;
  const sub=document.createElement("small");sub.textContent=t.artist;
  main.append(strong,sub);
  const link=document.createElement("a");link.href=t.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Anhören";
  div.append(main,link);
  if(canRemove){let btn=document.createElement("button");btn.className="secondary";btn.textContent="Entfernen";btn.onclick=()=>{
    if(!confirm("Diesen Track aus deiner SoundCloud-Sammlung entfernen? Der Verlauf bleibt erhalten."))return;
    tracks=tracks.filter(x=>key(x)!==key(t));putAll();render()
  };div.append(btn)}
  return div
}
function render(){
  let heard=new Set(history.map(key));
  let remaining=tracks.filter(t=>!heard.has(key(t))).length;
  el("scMetrics").replaceChildren();
  for(const [number,label] of [[tracks.length,"Songs in Sammlung"],[remaining,"Noch nicht gezogen"],[history.length,"Shuffles"],[new Set(tracks.map(t=>norm(t.artist))).size,"Uploader/Artists"],[sources.length,"Importierte Quellen"]]){
    let box=document.createElement("div");box.className="sc-metric";
    let big=document.createElement("b");big.textContent=number.toLocaleString("de-CH");let small=document.createElement("small");small.textContent=label;
    box.append(big,small);el("scMetrics").append(box)
  }
  const filter=norm(el("scFilter").value);
  let matches=tracks.filter(t=>norm(t.artist+" "+t.title).includes(filter));
  el("scLibraryCount").textContent=matches.length+" von "+tracks.length+" Songs";
  renderList("scLibrary",matches.slice(-80).reverse(),t=>trackRow(t,true));
  renderList("scHistory",history.slice(-60).reverse(),t=>trackRow(t,false));
  renderList("scSources",sources.slice().reverse(),s=>{
    const row=document.createElement("div");row.className="sc-list-row";
    const name=document.createElement("div");
    let a=document.createElement("a");a.href=s.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=s.url.length>67?s.url.slice(0,64)+"…":s.url;
    let label=document.createElement("small");label.textContent=(s.count||0)+" Track(s) · "+new Date(s.lastImportedAt).toLocaleDateString("de-CH");
    name.append(a,label);
    let again=document.createElement("button");again.className="secondary";again.textContent="Aktualisieren";again.disabled=importing;
    again.onclick=async()=>{if(importing)return;importing=true;again.disabled=true;status("Prüfe Quelle…");try{const r=await importSource(s.url);status(r.added+" neue Songs, "+r.found+" gefunden.")}catch(e){status(e.message)}finally{importing=false;render()}};
    row.append(name,again);return row
  });
}
function selectTrack(){
  if(!tracks.length){status("Füge zuerst öffentliche SoundCloud-Tracks oder Playlists hinzu.");return}
  const heard=new Set(history.map(key));
  let pending=tracks.filter(t=>!heard.has(key(t)));
  if(!pending.length){status("Alle gespeicherten Songs wurden bereits gezogen. Importiere neue Tracks; deine Wiederholungssperre bleibt aktiv.");return}
  const recent=new Set(history.slice(-5).map(t=>norm(t.artist)));
  let candidates=pending.filter(t=>!recent.has(norm(t.artist)));
  if(!candidates.length)candidates=pending;
  const users=[...new Set(candidates.map(t=>norm(t.artist)))];
  const chosenUser=sample(users),chosen=sample(candidates.filter(t=>norm(t.artist)===chosenUser));
  history.push({...chosen,drawnAt:Date.now()});
  try{putAll()}catch(e){history.pop();status("Dein Browserspeicher ist voll. Bitte zuerst ein Backup exportieren.");return}
  el("scCurrentArtist").textContent=chosen.artist;
  el("scCurrentTitle").textContent=chosen.title;
  el("scCurrentLink").href=chosen.url;el("scCurrentLink").hidden=false;
  const cover=el("scArtwork");cover.style.display=chosen.artwork?"block":"none";if(chosen.artwork)cover.src=chosen.artwork;
  const iframe=document.createElement("iframe");
  iframe.src="https://w.soundcloud.com/player/?url="+encodeURIComponent(chosen.url)+"&color=%231ed760&auto_play=false&show_user=true&show_artwork=true&visual=false";
  iframe.title="SoundCloud Player: "+chosen.title;iframe.allow="autoplay";
  iframe.style.cssText="width:100%;height:170px;border:0;border-radius:12px";
  el("scPlayer").replaceChildren(iframe);
  status("SoundCloud-Song gefunden. "+history.length+" insgesamt gezogen.");
  render()
}
async function batchImport(){
  if(importing)return;
  const lines=el("scInput").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const urls=[...new Set(lines)];
  if(!urls.length){status("Füge zuerst einen oder mehrere SoundCloud-Links ein.");return}
  if(urls.length>25){status("Bitte höchstens 25 Links pro Import eingeben.");return}
  importing=true;el("scImport").disabled=true;let total=0,errors=[];
  try{
    for(let i=0;i<urls.length;i++){
      status("Importiere "+(i+1)+"/"+urls.length+" · "+total+" Songs hinzugefügt …");
      try{let r=await importSource(urls[i]);total+=r.added}
      catch(e){errors.push((i+1)+": "+e.message)}
      render();
    }
    status(total+" neue Songs hinzugefügt. "+(urls.length-errors.length)+" Quellen gelesen."+(errors.length?" Fehler: "+errors.slice(0,2).join(" | "):""));
    if(!errors.length)el("scInput").value="";
  }finally{importing=false;el("scImport").disabled=false;render()}
}
function restoreData(obj){
  if(!obj||obj.kind!=="random-spotify-soundcloud"||obj.version!==1||!Array.isArray(obj.tracks)||!Array.isArray(obj.history))throw Error("Das ist keine gültige SoundCloud-Sicherung.");
  if(obj.tracks.length>30000||obj.history.length>30000)throw Error("Die Sicherungsdatei ist zu gross.");
  const sanitize=t=>{const url=validUrl(t?.url||"");if(!url||typeof t?.title!=="string"||!t.title.trim()||typeof t?.artist!=="string")return null;return {id:t.id?String(t.id):null,url,title:t.title.slice(0,500),artist:t.artist.slice(0,250),uploader:String(t.uploader||""),artwork:String(t.artwork||""),...(Number.isFinite(t.drawnAt)?{drawnAt:t.drawnAt}:{})}};
  let newTracks=obj.tracks.map(sanitize),newHistory=obj.history.map(sanitize);
  if(newTracks.includes(null)||newHistory.includes(null))throw Error("Ungültige Song-Einträge in der Sicherung.");
  let existingTracks=new Set(tracks.map(key)),existingHistory=new Set(history.map(key));let added=0,recovered=0;
  for(const t of newTracks)if(!existingTracks.has(key(t))){existingTracks.add(key(t));tracks.push(t);added++}
  for(const t of newHistory)if(!existingHistory.has(key(t))){existingHistory.add(key(t));history.unshift(t);recovered++}
  for(const x of Array.isArray(obj.sources)?obj.sources:[]){let url=validUrl(x.url||"");if(url&&!sources.some(s=>s.url===url))sources.push({url,count:Number(x.count)||0,lastImportedAt:Number(x.lastImportedAt)||Date.now()})}
  putAll();render();return {added,recovered}
}
el("scImport").onclick=batchImport;el("scShuffle").onclick=selectTrack;
el("scFilter").oninput=render;
el("scSearchBtn").onclick=()=>{const name=el("scSearch").value.trim();if(name)window.open("https://soundcloud.com/search?q="+encodeURIComponent(name),"_blank","noopener")};
el("scSearchArtistBtn").onclick=()=>{const name=el("scSearch").value.trim();if(name)window.open("https://soundcloud.com/search/people?q="+encodeURIComponent(name),"_blank","noopener")};
el("scSaveBackup").onclick=()=>exportJson("soundcloud-discovery-backup.json",{kind:"random-spotify-soundcloud",version:1,tracks,history,sources,exportedAt:new Date().toISOString()});
el("scRestoreBackup").onchange=async()=>{const input=el("scRestoreBackup");if(!input.files?.[0])return;try{let obj=JSON.parse(await input.files[0].text()),result=restoreData(obj);status(result.added+" Songs und "+result.recovered+" Verlaufs-Einträge ergänzt; keine vorhandenen Daten überschrieben.")}catch(e){status("Backup-Import fehlgeschlagen: "+e.message)}finally{input.value=""}};
el("scSearchList").replaceChildren(...artists.map(name=>{let o=document.createElement("option");o.value=name;return o}));
render();
})();
