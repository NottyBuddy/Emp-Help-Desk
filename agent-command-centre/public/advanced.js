/* Advanced enablement modules: simulator, leaderboard and coaching */
var simCaseIndex=0,simLastResult=null;
var simCases=[
 {name:'Price objection',level:'HARD',persona:'You are a cautious homeowner. You have received a lower quotation from a local fabricator and believe all uPVC windows are the same.',opening:'Your price is much higher than the local fabricator. Why should I pay more?',push:'I still think you are just charging for the brand. Can you give me a discount right now?'},
 {name:'Unserviceable location',level:'HARD',persona:'You are a customer located outside the direct installation network. You want a firm commitment before sharing details.',opening:'Your company does not install in my city. Why are you calling me then?',push:'Do not transfer me around. Tell me exactly who will install and when.'},
 {name:'Already shortlisted competitor',level:'EXPERT',persona:'You have already shortlisted another supplier. You challenge vague product claims and want evidence.',opening:'I have almost finalised another company. What is actually different about your offer?',push:'You are making general claims. What exactly should I compare in both quotations?'},
 {name:'Early-stage project',level:'MEDIUM',persona:'Your construction is at brickwork stage. You do not want a site visit immediately.',opening:'Construction will take another four months. Why should I discuss windows now?',push:'I do not want repeated calls. What will you note and when will you contact me again?'},
 {name:'Technical suitability',level:'EXPERT',persona:'You have a large opening and want a specific technical recommendation. You test whether the agent makes unsupported promises.',opening:'Can you confirm that a sliding system will work for my 12-foot opening?',push:'I need a yes or no now. Can you guarantee it will be suitable?'}
];
function advEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function advToast(s){const e=document.querySelector('#toast');if(e){e.textContent=s;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2300);}}
async function advGet(view){const r=await fetch('/api/insights'+(view?'?view='+view:''));const j=await r.json();if(!r.ok)throw Error(j.error||'Could not load insights');return j;}
function simulationPage(){
 const s=simCases[simCaseIndex];
 return '<div class="section-head"><div><h3>Live customer role-play</h3><p>You are the IndiFrame salesperson. The AI customer challenges your response and escalates the objection.</p></div></div>'+
 '<div class="two-col"><div class="panel"><span class="tag">CUSTOMER PERSONA · '+s.level+'</span><h3 style="margin-top:12px">'+s.name+'</h3><p class="muted" style="font-size:12px;line-height:1.7">'+s.persona+'</p><div class="alert" style="margin-top:14px"><b>Customer says</b>'+s.opening+'</div><div class="form-actions"><button class="btn ghost" id="newSim">New customer scenario</button></div></div><div class="panel"><h3>Simulation rules</h3><div class="rule-list"><div class="rule"><i>01</i> Acknowledge the concern without arguing.</div><div class="rule"><i>02</i> Ask a relevant clarifying question.</div><div class="rule"><i>03</i> Explain only approved product or process information.</div><div class="rule"><i>04</i> Agree a specific next step without making unsupported promises.</div></div></div></div>'+
 '<div class="panel" style="margin-top:14px"><h3>Your response as salesperson</h3><textarea class="field" id="simAnswer" style="width:100%;min-height:145px" placeholder="Type exactly what you would say to the customer..."></textarea><div class="form-actions"><button class="btn primary" id="evaluateSim">Evaluate my response</button></div><div id="simResult">'+(simLastResult||'')+'</div></div>';
}
async function leaderboardPage(){
 try{
  const d=await advGet('leaderboard'),rows=d.rows||[];
  const max=(k)=>Math.max(1,...rows.map(x=>Number(x[k]||0)));
  const ranked=rows.map(x=>{const score=(Number(x.connect_rate||0)/Math.max(1,max('connect_rate'))*30)+(Number(x.qualified||0)/max('qualified')*30)+(Number(x.consultations||0)/max('consultations')*25)+(Number(x.productive_actions||0)/max('productive_actions')*15);return {...x,score};}).sort((a,b)=>b.score-a.score);
  return '<div class="section-head"><div><h3>Daily performance leaderboard</h3><p>Today’s ranking from manager-entered daily KPI records · refreshed on page load</p></div></div><div class="tip">RANKING MODEL · Connect rate 30% · Qualified leads 30% · Site consultations 25% · Productivity actions 15%. Productivity actions = follow-ups completed + CRM updates + WhatsApp shares. This is a comparative score, not a quality or revenue measure.</div>'+
  '<div class="table-wrap" style="margin-top:14px"><table class="data-table"><thead><tr><th>Rank</th><th>Agent</th><th>Connect rate</th><th>Qualified</th><th>Consultations</th><th>Productivity actions</th><th>Score / 100</th></tr></thead><tbody>'+
  (ranked.map((x,i)=>'<tr><td><b>#'+(i+1)+'</b></td><td>'+advEsc(x.display_name||x.email)+'</td><td>'+Number(x.connect_rate||0).toFixed(1)+'%</td><td>'+x.qualified+'</td><td>'+x.consultations+'</td><td>'+x.productive_actions+'</td><td><b>'+x.score.toFixed(1)+'</b></td></tr>').join('')||'<tr><td colspan="7" class="empty">No agent KPI data is available yet. Ask the manager to enter daily figures.</td></tr>')+
  '</tbody></table></div><p class="muted" style="font-size:10px;margin-top:10px">Agents can see their own ranking data only; managers can see the full active team. Connect rate = connected calls ÷ inbound and outbound attempts.</p>';
 }catch(e){return '<div class="alert"><b>Leaderboard unavailable</b>'+advEsc(e.message)+'</div>';}
}
async function coachingPage(){
 try{
  const d=await advGet(),rows=d.rows||[];
  const cards=rows.map(x=>{
   const tips=[];
   if(Number(x.attempts)>0&&Number(x.connect_rate)<25)tips.push('Connect rate is below 25%. Practise opening, permission checks and varied callback slots.');
   if(Number(x.connected)>0&&Number(x.qualified)/Number(x.connected)<.30)tips.push('Qualification conversion is below 30%. Revisit the six discovery questions and need identification.');
   if(Number(x.qualified)>0&&Number(x.consultations)/Number(x.qualified)<.20)tips.push('Consultation conversion is below 20%. Practise summarising requirements and asking for a clear next step.');
   if(x.quiz_score!==null&&Number(x.quiz_score)<80)tips.push('Quiz average is below 80%. Review the knowledge bank and repeat the weekly quiz.');
   if(x.quiz_score===null)tips.push('No quiz history found. Complete the weekly knowledge quiz to establish a learning baseline.');
   if(!tips.length)tips.push('No threshold-based gap detected. Continue practising objections and maintain consistent CRM closure.');
   return '<article class="script-card"><div class="script-top"><h3>'+advEsc(x.display_name||x.email)+'</h3><span class="tag">'+(x.quiz_score===null?'QUIZ NOT TAKEN':'QUIZ '+Number(x.quiz_score).toFixed(0)+'%')+'</span></div><div class="grid stats" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:12px"><div class="stat"><small>CONNECT RATE</small><strong style="font-size:19px">'+Number(x.connect_rate||0).toFixed(1)+'%</strong></div><div class="stat"><small>QUALIFIED LEADS</small><strong style="font-size:19px">'+x.qualified+'</strong></div><div class="stat"><small>CONSULTATIONS</small><strong style="font-size:19px">'+x.consultations+'</strong></div></div><div class="rule-list" style="margin-top:12px">'+tips.map(t=>'<div class="rule"><i>✦</i>'+t+'</div>').join('')+'</div></article>';
  }).join('');
  return '<div class="section-head"><div><h3>Individual coaching recommendations</h3><p>Recommendations generated from each agent’s last 30 days of KPI data and recorded quiz scores.</p></div></div><div class="tip">COACHING LOGIC · The centre flags measurable gaps and suggests practice topics. It does not automatically change an agent’s KPI or performance rating.</div><div class="script-list" style="margin-top:14px">'+(cards||'<div class="empty">No active agent KPI records are available yet.</div>')+'</div>';
 }catch(e){return '<div class="alert"><b>Coaching data unavailable</b>'+advEsc(e.message)+'</div>';}
}
function wireAdvanced(){
 const next=document.querySelector('#newSim');if(next)next.onclick=()=>{simCaseIndex=(simCaseIndex+1)%simCases.length;simLastResult=null;document.querySelector('#content').innerHTML=simulationPage();wireAdvanced();};
 const evalBtn=document.querySelector('#evaluateSim');if(evalBtn)evalBtn.onclick=()=>{
  const answer=(document.querySelector('#simAnswer')?.value||'').trim();if(answer.length<15){advToast('Enter a complete customer response first.');return;}
  const a=answer.toLowerCase(),s=simCases[simCaseIndex];
  const checks=[
   ['Empathy & acknowledgement',/(understand|understood|appreciate|certainly|i can see|samajh|ardham)/i.test(a),25],
   ['Clarification & discovery',/(may i|could you|which|what|how|when|location|requirement|opening|site|kya|kaun|kab)/i.test(a),25],
   ['Accurate explanation',/(specification|reinforcement|gasket|installation|consultation|measurement|sales|technical|confirm|verify|compare|quotation)/i.test(a),25],
   ['Clear next step',/(schedule|arrange|callback|call you|site visit|consultation|share|whatsapp|date|time|team will|connect)/i.test(a),25]
  ];
  const score=checks.reduce((n,c)=>n+(c[1]?c[2]:0),0);
  const feedback=checks.map(c=>'<div class="rule"><i>'+(c[1]?'✓':'!')+'</i><b>'+c[0]+'</b> · '+(c[1]?'Demonstrated':'Needs improvement')+'</div>').join('');
  const follow=s.push;
  simLastResult='<div style="border-top:1px solid #2b3a50;margin-top:16px;padding-top:15px"><div class="hero-tag">SIMULATION SCORE</div><div class="kpi-big" style="font-size:38px;margin:8px 0">'+score+' / 100</div><div class="rule-list">'+feedback+'</div><div class="alert" style="margin-top:14px"><b>AI customer follow-up challenge</b>'+follow+'</div><p class="muted" style="font-size:10px;margin-top:10px">Automated practice feedback is based on response signals and the scenario rubric. A manager should review performance before using it for formal QA or appraisal.</p></div>';
  const box=document.querySelector('#simResult');if(box)box.innerHTML=simLastResult;
 };
}