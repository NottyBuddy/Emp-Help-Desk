import { db } from 'hatchable';
export const access='user';
export const methods=['GET','POST'];
async function profile(id){const q=await db.query('SELECT user_id,email,display_name,role,active FROM agent_profiles WHERE user_id=$1',[id]);return q.rows[0]||null;}
export default async function(req,res){
 const me=await profile(req.user.id); if(!me||!me.active)return res.status(403).json({error:'Account is inactive.'});
 if(req.method==='GET'){
  const target=me.role==='manager'&&req.query.agent?req.query.agent:me.user_id;
  const from=req.query.from||'2000-01-01'; const to=req.query.to||'2099-12-31';
  const q=await db.query('SELECT id,agent_user_id,work_date,calls_assigned,outbound_attempts,inbound_calls,connected_calls,qualified_leads,consultations_booked,whatsapp_shared,callbacks_scheduled,followups_completed,crm_updated,talk_time_minutes,notes,updated_at FROM daily_kpis WHERE agent_user_id=$1 AND work_date >= $2::date AND work_date <= $3::date ORDER BY work_date DESC',[target,from,to]);
  return res.json({entries:q.rows,profile:me});
 }
 if(me.role!=='manager')return res.status(403).json({error:'Only the manager can update KPI records.'});
 const b=req.body||{}; const target=String(b.agent_user_id||''); const d=String(b.work_date||'');
 const agent=await profile(target); if(!agent||agent.role!=='agent')return res.status(400).json({error:'Select an active agent account.'});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return res.status(400).json({error:'Enter a valid work date.'});
 const keys=['calls_assigned','outbound_attempts','inbound_calls','connected_calls','qualified_leads','consultations_booked','whatsapp_shared','callbacks_scheduled','followups_completed','crm_updated','talk_time_minutes'];
 const vals=keys.map(k=>Math.max(0,Number(b[k]||0))); if(vals.some(v=>!Number.isFinite(v)))return res.status(400).json({error:'KPI values must be numeric.'});
 const sql='INSERT INTO daily_kpis(agent_user_id,work_date,calls_assigned,outbound_attempts,inbound_calls,connected_calls,qualified_leads,consultations_booked,whatsapp_shared,callbacks_scheduled,followups_completed,crm_updated,talk_time_minutes,notes,updated_by) VALUES($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(agent_user_id,work_date) DO UPDATE SET calls_assigned=EXCLUDED.calls_assigned,outbound_attempts=EXCLUDED.outbound_attempts,inbound_calls=EXCLUDED.inbound_calls,connected_calls=EXCLUDED.connected_calls,qualified_leads=EXCLUDED.qualified_leads,consultations_booked=EXCLUDED.consultations_booked,whatsapp_shared=EXCLUDED.whatsapp_shared,callbacks_scheduled=EXCLUDED.callbacks_scheduled,followups_completed=EXCLUDED.followups_completed,crm_updated=EXCLUDED.crm_updated,talk_time_minutes=EXCLUDED.talk_time_minutes,notes=EXCLUDED.notes,updated_by=EXCLUDED.updated_by,updated_at=NOW() RETURNING id';
 const q=await db.query(sql,[target,d,...vals,String(b.notes||''),me.user_id]);res.json({ok:true,id:q.rows[0].id});
}