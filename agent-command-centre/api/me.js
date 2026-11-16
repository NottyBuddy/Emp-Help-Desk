import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET','POST'];
export default async function(req,res){
 const u=req.user;
 let q=await db.query('SELECT user_id,email,display_name,role,active FROM agent_profiles WHERE user_id=$1',[u.id]);
 if(!q.rows.length){
  const n=await db.query('SELECT COUNT(*)::int AS n FROM agent_profiles');
  const role=n.rows[0].n===0?'manager':'agent';
  await db.query('INSERT INTO agent_profiles(user_id,email,display_name,role) VALUES($1,lower($2),$3,$4) ON CONFLICT(user_id) DO NOTHING',[u.id,u.email||'',u.name||'',role]);
  q=await db.query('SELECT user_id,email,display_name,role,active FROM agent_profiles WHERE user_id=$1',[u.id]);
 }
 if(req.method==='POST'){
  const name=String((req.body||{}).display_name||'').trim().slice(0,80);
  if(!name)return res.status(400).json({error:'Enter a display name.'});
  await db.query('UPDATE agent_profiles SET display_name=$2 WHERE user_id=$1',[u.id,name]);
  q=await db.query('SELECT user_id,email,display_name,role,active FROM agent_profiles WHERE user_id=$1',[u.id]);
 }
 res.json({profile:q.rows[0]});
}