import { db } from 'hatchable';
export const access='user';
export const methods=['GET','POST'];
async function profile(id){const q=await db.query('SELECT user_id,email,display_name,role,active FROM agent_profiles WHERE user_id=$1',[id]);return q.rows[0]||null;}
export default async function(req,res){
 const me=await profile(req.user.id);if(!me||!me.active)return res.status(403).json({error:'Account is inactive.'});
 if(req.method==='POST'){
  const b=req.body||{};const score=Math.max(0,Math.min(100,Number(b.score||0)));const total=Math.max(1,Math.min(50,Number(b.total||1)));
  if(!Number.isFinite(score)||!Number.isFinite(total))return res.status(400).json({error:'Invalid quiz score.'});
  await db.query('INSERT INTO quiz_attempts(user_id,quiz_date,score,total,answers) VALUES($1,CURRENT_DATE,$2,$3,$4::jsonb)',[me.user_id,score,total,JSON.stringify(Array.isArray(b.answers)?b.answers.slice(0,50):[])]);
  return res.json({ok:true});
 }
 const target=(me.role==='manager'||req.query.view==='leaderboard')?'%':me.user_id;
 const quizTarget=me.role==='manager'?'%':me.user_id;
 const dateFilter=req.query.view==='leaderboard'?'d.work_date=CURRENT_DATE':"d.work_date>=CURRENT_DATE-INTERVAL '29 days'";
 const k=await db.query(`SELECT p.user_id,p.display_name,p.email,COALESCE(SUM(d.outbound_attempts+d.inbound_calls),0)::int AS attempts,COALESCE(SUM(d.connected_calls),0)::int AS connected,COALESCE(SUM(d.qualified_leads),0)::int AS qualified,COALESCE(SUM(d.consultations_booked),0)::int AS consultations,COALESCE(SUM(d.followups_completed+d.crm_updated+d.whatsapp_shared),0)::int AS productive_actions,COALESCE(SUM(d.talk_time_minutes),0)::numeric AS talk_minutes FROM agent_profiles p LEFT JOIN daily_kpis d ON d.agent_user_id=p.user_id AND ${dateFilter} WHERE p.role='agent' AND p.active=true AND ($1='%' OR p.user_id=$1) GROUP BY p.user_id,p.display_name,p.email ORDER BY p.display_name`,[target]);
 const q=await db.query(`SELECT user_id,AVG(score::numeric/NULLIF(total,0))*100 AS avg_score,COUNT(*)::int AS quiz_count,MAX(quiz_date) AS last_quiz FROM quiz_attempts WHERE quiz_date>=CURRENT_DATE-INTERVAL '29 days' AND ($1='%' OR user_id=$1) GROUP BY user_id`,[quizTarget]);
 const quiz=Object.fromEntries(q.rows.map(x=>[x.user_id,x]));
 return res.json({role:me.role,rows:k.rows.map(x=>({...x,connect_rate:Number(x.attempts)?Number(x.connected)/Number(x.attempts)*100:0,quiz_score:quiz[x.user_id]?Number(quiz[x.user_id].avg_score):null,quiz_count:quiz[x.user_id]?.quiz_count||0,last_quiz:quiz[x.user_id]?.last_quiz||null}))});
}