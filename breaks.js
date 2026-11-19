const $=id=>document.getElementById(id),api=window.IndiFrameAPI;
let activeBreak=null,serverOffset=0,ticker=null,refreshTimer=null;
const esc=v=>String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function message(t,error=false){$("message").textContent=t;$("message").className="break-message"+(error?" error":"");}
function duration(sec){sec=Math.max(0,Math.floor(sec||0));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return [h,m,s].map(x=>String(x).padStart(2,"0")).join(":");}
function fmt(v){if(!v)return"—";const d=new Date(v);return isNaN(d)?v:d.toLocaleString();}
function renderOwn(){
 const on=!!activeBreak;
 $("breakStatus").textContent=on?("Active: "+activeBreak.break_type+" · Started "+fmt(activeBreak.started_at)):"Abhi koi active break nahi hai.";
 $("breakStatePill").textContent=on?"ON BREAK":"WORKING";$("breakStatePill").classList.toggle("is-active",on);
 $("startBreak").disabled=on;$("breakType").disabled=on;$("endBreak").disabled=!on;
 $("elapsed").textContent=on?duration((Date.now()+serverOffset-Date.parse(activeBreak.started_at))/1000):"00:00:00";
}
async function load(){
 try{
  const me=await api.apiRequest("/api/me"),u=me.user||me;
  
  document.body.classList.add("agent-mode");$("profile").textContent=(u.fullName||u.employeeId)+" · "+u.role;
  const breakData=await api.apiRequest("/api/hd/breaks/status");activeBreak=breakData.active;serverOffset=Date.parse(breakData.serverTime||new Date().toISOString())-Date.now();
  renderOwn();
 }catch(e){if(/session|login|unauthor/i.test(e.message)){api.clearToken();location.replace("index.html");return;}message(e.message,true);}
}
$("startBreak").onclick=async()=>{try{await api.apiRequest("/api/hd/breaks/start",{method:"POST",body:JSON.stringify({break_type:$("breakType").value})});message("Break start ho gaya.");await load();}catch(e){message(e.message,true);}};
$("endBreak").onclick=async()=>{try{const r=await api.apiRequest("/api/hd/breaks/end",{method:"POST"});message("Break end ho gaya. Duration: "+duration(r.durationSeconds));await load();}catch(e){message(e.message,true);}};
$("logoutBtn").onclick=()=>{api.clearToken();location.replace("index.html");};
document.addEventListener("DOMContentLoaded",()=>{load();ticker=setInterval(renderOwn,1000);refreshTimer=setInterval(load,30000);});
