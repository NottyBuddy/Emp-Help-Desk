import { db } from 'hatchable';
export const access='user';
export const methods=['GET','POST'];
export default async function(req,res){
 const meq=await db.query('SELECT user_id,role FROM agent_profiles WHERE user_id=$1',[req.user.id]);const me=meq.rows[0];if(!me||me.role!=='manager')return res.status(403).json({error:'Manager access required.'});
 if(req.method==='GET'){const q=await db.query("SELECT user_id,email,display_name,role,active,created_at FROM agent_profiles ORDER BY CASE WHEN role='manager' THEN 0 ELSE 1 END,display_name,email");return res.json({team:q.rows});}
 const b=req.body||{};const id=String(b.user_id||'');const name=String(b.display_name||'').trim();if(!id)return res.status(400).json({error:'Select a registered user.'});
 await db.query('UPDATE agent_profiles SET display_name=$2,active=$3 WHERE user_id=$1',[id,name,!!b.active]);
 res.json({ok:true});
}