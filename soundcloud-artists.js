/* SoundCloud Artist Library / SoundCloud Shuffle — no private API keys */
(()=>{
"use strict";
const E=id=>document.getElementById(id);
const normal=s=>String(s||"").normalize("NFKC").trim().toLowerCase();
const json=(key,defaultValue)=>{try{return JSON.parse(localStorage.getItem(key))??defaultValue}catch{return defaultValue}};
const extra=[
"22 Pooruhn","Suckrball","HUNNAKAY","tazparis","killjae","UNDRCVR","Dragnutz","Holdmedown","1babybirdnest","Krby","Saiah","Jaeychino","Slump Audios","cashjunko","wildkarduno","Xang","slaq","takeyogat","osogyn","Ibeenhip","ccryden","wages","klarify","CuntSniffer","yiru","KnifeFightKyoto","suban","yrsci","80gawd","zombycare","percosits","islurwhenitalk","kynlary","brodiebased","MajinBlxxdy","xokimono","elibanss","Xoly","yivyno","xxffcyuvcui","taiketsu","Skyte","zaya!","slayr","deffici1e",
"2hollis","8485","aldn","Autumn!","Black Kray","Cartier God","DC The Don","Dom Corleo","Feng","Ghost Mountain","Hackle","Hardrock","Izaya Tiji","Jane Remover","Kankan","Lancey Foux","Luci4","Marjorie -W.C. Sinclair","Rx Papi","Rxk Nephew","Sematary","Sickboyrari","Skaiwater","Slump6s","Snow Strippers","star boy","Thaiboy Digital","Thouxanbanfauni","Turnabout","UnoTheActivist","Weiland","Yung Fazo",
"wifiskeleton","glosuka","zatru","bleood","kllhhr","viss"
];
const seed=[...(typeof artists!=="undefined"&&Array.isArray(artists)?artists:[]),...extra,...scLibrary.map(t=>t.artist)];
const uniqueNames=items=>[...new Map(items.filter(x=>typeof x==="string").map(x=>x.trim()).filter(Boolean).map(x=>[normal(x),x])).values()];
let aNames=Array.isArray(json("scArtistNamesV1",null))?uniqueNames(json("scArtistNamesV1",[])):uniqueNames(seed);
let profiles=json("scArtistProfilesV1",{}),links=json("scArtistTrackMapV1",{}),checks=json("scArtistChecksV1",{});
if(!profiles||typeof profiles!=="object"||Array.isArray(profiles))profiles={};
if(!links||typeof links!=="object"||Array.isArray(links))links={};
if(!checks||typeof checks!=="object"||Array.isArray(checks))checks={};
let limit=55,editing=null,importing=false;
function persist(){localStorage.setItem("scArtistNamesV1",JSON.stringify(aNames));localStorage.setItem("scArtistProfilesV1",JSON.stringify(profiles));localStorage.setItem("scArtistTrackMapV1",JSON.stringify(links));localStorage.setItem("scArtistChecksV1",JSON.stringify(checks))}
function profileURL(s){
  try{const u=new URL(s.trim());if(u.protocol!=="https:"||!["soundcloud.com","www.soundcloud.com","m.soundcloud.com"].includes(u.hostname))return null;
  const parts=u.pathname.split("/").filter(Boolean);
  if(parts.length!==1||["search","discover","stream","you","upload","charts","stations","premium","pro","settings","terms-of-use","pages"].includes(parts[0].toLowerCase()))return null;
  return "https://soundcloud.com/"+parts[0];
  }catch{return null}
}
function display(s){E("scArtistMessage").textContent=s}
function trackKeys(name){const known=new Set(links[normal(name)]||[]);const k=normal(name);return scLibrary.filter(t=>known.has(scKey(t))||normal(t.artist)===k||normal(t.source)===k)}
function unplayed(name){return trackKeys(name).filter(t=>!scIsPlayed(t))}
function ready(name){return unplayed(name).length>0||!!profiles[normal(name)]}
function moreInfo(){
  const total=aNames.length,mapped=aNames.filter(n=>profiles[normal(n)]).length,songs=aNames.filter(n=>trackKeys(n).length).length,untested=total-mapped;
  E("scArtistSummary").textContent=total.toLocaleString("de-CH")+" Artists · "+mapped+" Profil-Links · "+songs+" mit gespeicherten Tracks · "+untested+" ohne Profil-Link";
  E("scArtistCount").textContent=total.toLocaleString("de-CH")+" Artists";
}
function addMany(raw){
  const names=uniqueNames(raw.split(/\r?\n/).flatMap(line=>line.split(";")));
  let existing=new Set(aNames.map(normal)),added=0;
  for(const n of names){if(existing.has(normal(n)))continue;existing.add(normal(n));aNames.push(n);added++}
  if(added)persist();
  renderArtists();
  return {added,skipped:names.length-added}
}
function editProfile(name){
  editing=name;
  E("scEditingName").textContent=name;
  E("scProfileInput").value=profiles[normal(name)]||"";
  E("scProfileEditor").hidden=false;
  E("scProfileResult").textContent="Ein SoundCloud-Profil enthält die öffentlichen Uploads dieses Accounts. Reuploads und Leaks können zusätzlich aus Playlists kommen.";
}
function closeEditor(){editing=null;E("scProfileEditor").hidden=true}
function artistRow(name){
  const row=document.createElement("div");row.className="sc-artist-row";
  const left=document.createElement("div");left.className="sc-artist-name";let title=document.createElement("strong");title.textContent=name;
  const count=trackKeys(name).length,link=profiles[normal(name)];
  const subtitle=document.createElement("small");subtitle.textContent=count+" Songs in Library · "+(link?"Profil verknüpft":"Profil offen");left.append(title,subtitle);
  const controls=document.createElement("div");controls.className="sc-artist-buttons";
  const profile=document.createElement("button");profile.className="secondary";profile.textContent=link?"Profil ändern":"Profil";
  profile.onclick=()=>editProfile(name);
  const go=document.createElement("button");go.className="secondary";go.textContent="Suchen";go.onclick=()=>window.open("https://soundcloud.com/search/people?q="+encodeURIComponent(name),"_blank","noopener");
  const remove=document.createElement("button");remove.className="secondary sc-small-button";remove.textContent="×";remove.title="Artist aus der SoundCloud-Liste entfernen";remove.onclick=()=>{if(!confirm(name+" aus der SoundCloud-Artist-Liste entfernen? Gespeicherte Songs und Verlauf bleiben bestehen."))return;aNames=aNames.filter(n=>normal(n)!==normal(name));persist();renderArtists()};
  controls.append(profile,go,remove);row.append(left,controls);return row;
}
function renderArtists(){
  const filter=normal(E("scArtistSearch").value),state=E("scArtistState").value;
  const names=aNames.filter(n=>normal(n).includes(filter)&&(state==="all"|| (state==="linked"?!!profiles[normal(n)]:state==="withtracks"?trackKeys(n).length>0:!profiles[normal(n)])));
  E("scArtistMatches").textContent=names.length+" von "+aNames.length+" Artists";
  const root=E("scArtistRows");root.replaceChildren();
  for(const n of names.slice(0,limit))root.append(artistRow(n));
  E("scArtistMore").hidden=names.length<=limit;
  E("scArtistMore").textContent="Weitere anzeigen ("+(names.length-limit)+")";
  moreInfo();
}
async function loadProfile(name){
  const k=normal(name),url=profiles[k];
  if(!url)throw Error("Kein SoundCloud-Profil für "+name+" hinterlegt.");
  if(importing)throw Error("Es läuft bereits ein Import.");
  importing=true;
  let btn=E("scProfileImport"),old=btn.disabled;
  btn.disabled=true;
  try{
    display("Lade öffentliche Tracks von "+name+" …");
    const raw=await scWidgetTracks(url);
    const list=raw.map(scTrack).filter(Boolean);
    if(!list.length)throw Error("SoundCloud hat über das Widget keine Tracklinks zurückgegeben.");
    let previous=new Set(scLibrary.map(scKey)),mapped=new Set(links[k]||[]),added=0,mapping=0;
    for(const t of list){
      if(!previous.has(scKey(t))){scLibrary.push(t);previous.add(scKey(t));added++}
      if(!mapped.has(scKey(t))){mapped.add(scKey(t));mapping++}
    }
    links[k]=[...mapped];checks[k]={at:Date.now(),success:true,count:list.length};
    scSave();persist();scRender();renderArtists();
    return {added,mapping,total:list.length};
  }catch(err){checks[k]={at:Date.now(),success:false,error:err.message};persist();throw err}
  finally{importing=false;btn.disabled=old}
}
function currentTitle(name,t){return t.title}
function setSong(name,t){
  const recorded={...t,source:name,drawnAt:Date.now()};
  scHistory.push(recorded);
  try{scSave()}catch(e){scHistory.pop();display("Browserspeicher voll! Exportiere bitte ein Backup.");return false}
  E("scNowArtist").textContent=name+" · "+t.artist;
  E("scNowTitle").textContent=currentTitle(name,t);
  E("scOpen").href=t.url;E("scOpen").hidden=false;
  E("scPlayer").hidden=false;
  E("scPlayer").src="https://w.soundcloud.com/player/?"+new URLSearchParams({url:t.url,auto_play:"false",hide_related:"true",color:"#1ed760"});
  scStatus("scRollStatus","Song gezogen · "+name+" · keine Wiederholungen.");
  scRender();renderArtists();return true;
}
function offerLink(name){
  E("scMissingArtist").hidden=false;E("scMissingArtistName").textContent=name;
  E("scMissingArtistText").textContent="Für diesen Artist liegen noch keine neuen Tracks vor. Profil verknüpfen, öffentliche Uploads importieren oder einen anderen Artist ziehen.";
  E("scMissingSearch").href="https://soundcloud.com/search/people?q="+encodeURIComponent(name);
  E("scMissingProfile").onclick=()=>{editProfile(name);E("scProfileInput").focus();E("scProfileEditor").scrollIntoView({behavior:"smooth",block:"nearest"})};
}
async function drawArtist(){
  E("scMissingArtist").hidden=true;
  const mode=E("scPickMode").value;
  const recent=new Set(scHistory.slice(-10).map(t=>normal(t.source||t.artist)));
  let candidates=aNames.filter(name=>mode!=="playable"||unplayed(name).length>0);
  let filtered=candidates.filter(name=>!recent.has(normal(name)));
  if(filtered.length)candidates=filtered;
  if(!candidates.length){scStatus("scRollStatus","Noch keine spielbaren Artists gefunden. Verknüpfe Profile oder importiere öffentliche Songs.");return}
  const name=candidates[Math.floor(Math.random()*candidates.length)];
  const playable=unplayed(name);
  if(playable.length){
    const t=playable[Math.floor(Math.random()*playable.length)];
    setSong(name,t);return
  }
  if(profiles[normal(name)]&&mode!=="playable"){
    E("scRoll").disabled=true;
    scStatus("scRollStatus","Importiere Songs für "+name+" …");
    try{await loadProfile(name);const tracks=unplayed(name);if(tracks.length){setSong(name,tracks[Math.floor(Math.random()*tracks.length)]);return}}
    catch(err){scStatus("scRollStatus",name+": "+err.message)}
    finally{E("scRoll").disabled=false}
  }
  offerLink(name);
  scStatus("scRollStatus","Noch keine verfügbaren Tracks für "+name+". Du kannst direkt das passende Profil verknüpfen.");
}
function downloadFile(name,data){
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
 const u=URL.createObjectURL(blob),a=document.createElement("a");a.download=name;a.href=u;a.click();setTimeout(()=>URL.revokeObjectURL(u),1800)
}
E("scBulkAdd").onclick=()=>{const res=addMany(E("scBulkNames").value);display(res.added+" Artists hinzugefügt; "+res.skipped+" bereits vorhanden.");if(res.added)E("scBulkNames").value=""};
E("scArtistSearch").oninput=()=>{limit=55;renderArtists()};
E("scArtistState").onchange=()=>{limit=55;renderArtists()};
E("scArtistMore").onclick=()=>{limit+=55;renderArtists()};
E("scImportSpotifyNames").onclick=()=>{const res=addMany(artists.join("\n"));display(res.added+" neue Artists aus Spotify übernommen; "+res.skipped+" bereits vorhanden.")};
E("scProfileClose").onclick=closeEditor;
E("scProfileFind").onclick=()=>{if(editing)window.open("https://soundcloud.com/search/people?q="+encodeURIComponent(editing),"_blank","noopener")};
E("scProfileSave").onclick=()=>{
  if(!editing)return;
  const value=profileURL(E("scProfileInput").value);
  if(!value){E("scProfileResult").textContent="Bitte einen SoundCloud-Profillink eingeben, z. B. https://soundcloud.com/artist";return}
  profiles[normal(editing)]=value;delete checks[normal(editing)];persist();E("scProfileResult").textContent="Profil gespeichert. Klicke auf „Tracks laden“, um die öffentlichen Uploads einzulesen.";renderArtists();
};
E("scProfileImport").onclick=async()=>{
  if(!editing)return;
  const name=editing;
  try{const res=await loadProfile(name);E("scProfileResult").textContent=res.total+" Titel aus dem Player gelesen, "+res.added+" neue Library-Songs und "+res.mapping+" diesem Artist zugeordnet.";display(name+": "+res.added+" neue Songs gefunden.")}catch(e){E("scProfileResult").textContent="Import fehlgeschlagen: "+e.message+". Eventuell unterstützt der SoundCloud-Player dieses Profil nicht oder es sind keine öffentlichen Songs verfügbar."}
};
E("scProfileRemove").onclick=()=>{if(!editing)return;delete profiles[normal(editing)];delete checks[normal(editing)];persist();E("scProfileInput").value="";E("scProfileResult").textContent="Profilverknüpfung entfernt. Bereits gespeicherte Songs und Verlauf bleiben.";renderArtists()};
E("scPickMode").onchange=()=>{E("scMissingArtist").hidden=true};
E("scRoll").onclick=drawArtist;
const oldSaveBackup=E("scBackup").onclick;
E("scBackup").onclick=()=>downloadFile("random-soundcloud-backup.json",{type:"soundcloud-v1",tracks:scLibrary,history:scHistory,artists:aNames,profiles,artistTrackKeys:links,checks,exportedAt:new Date().toISOString()});
E("scRestore").onchange=async()=>{
 const input=E("scRestore"),file=input.files?.[0];if(!file)return;
 try{let data=JSON.parse(await file.text());
 if(data.type!=="soundcloud-v1"||!Array.isArray(data.tracks)||!Array.isArray(data.history)||data.tracks.length>50000||data.history.length>50000)throw Error("Ungültige SoundCloud-Backupdatei.");
 if(!confirm("SoundCloud-Backup zusammenführen? Vorhandene Songs, Verlauf und Artists bleiben erhalten."))return;
 const tmap=new Map(scLibrary.map(t=>[scKey(t),t]));
 for(const raw of data.tracks){const t=scTrack(raw);if(t&&!tmap.has(scKey(t)))tmap.set(scKey(t),t)}
 const hmap=new Map(scHistory.map(t=>[scKey(t),t]));
 for(const raw of data.history){const t=scTrack(raw);if(t&&!hmap.has(scKey(t)))hmap.set(scKey(t),{...t,...(Number.isFinite(raw.drawnAt)?{drawnAt:raw.drawnAt}:{}) ,...(typeof raw.source==="string"?{source:raw.source}:{})})}
 let before=aNames.length;
 aNames=uniqueNames([...aNames,...(Array.isArray(data.artists)?data.artists:[])]);
 if(data.profiles&&typeof data.profiles==="object")for(const [k,v] of Object.entries(data.profiles)){const url=profileURL(v);if(url&&!profiles[k])profiles[k]=url}
 if(data.artistTrackKeys&&typeof data.artistTrackKeys==="object")for(const [k,arr] of Object.entries(data.artistTrackKeys)){if(!Array.isArray(arr))continue;links[k]=[...new Set([...(links[k]||[]),...arr.filter(x=>typeof x==="string")])]}
 scLibrary=[...tmap.values()];scHistory=[...hmap.values()];
 scSave();persist();scRender();renderArtists();
 display("Backup übernommen. "+(aNames.length-before)+" neue Artists ergänzt; Spotify-Daten unverändert.");
 }catch(e){display("Backup-Import fehlgeschlagen: "+e.message)}
 finally{input.value=""}
};
persist();renderArtists();
})();