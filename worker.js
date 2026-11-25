// Employee Help Desk API — tenant-scoped, shared D1 backend.
// All data routes fail closed until HELP_DESK_ACCESS_KEY and WORKSPACE_ID are configured.
const ALLOWED_ORIGINS = new Set([
  "https://nottybuddy.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);
const COLLECTIONS = {
  requests: { table: "helpdesk_requests", fields: ["title","category","description","status","priority","requester_name","requester_email","assigned_to"] },
  articles: { table: "helpdesk_articles", fields: ["title","category","body","published"] },
  faqs: { table: "helpdesk_faqs", fields: ["title","body","published"] },
  guides: { table: "helpdesk_guides", fields: ["title","category","body","published"] },
  team: { table: "helpdesk_team", fields: ["name","role","email","department"] }
};
const headers = origin => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "null",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
});
const reply = (origin, data, status=200) => new Response(JSON.stringify(data), {status,headers:headers(origin)});
const clean = value => String(value ?? "").trim();
const validId = value => /^[a-f0-9-]{16,64}$/i.test(value || "");
function payloadFields(input, allowed) {
  const out = {};
  for (const key of allowed) if (Object.hasOwn(input,key)) {
    const value = input[key];
    if (typeof value === "string" && value.length > (key === "body" || key === "description" ? 20000 : 300)) throw new Error(key+" is too long");
    if (key === "published") out[key] = value ? 1 : 0;
    else out[key] = clean(value);
  }
  return out;
}
async function authorized(request, env) {
  const expected = env.HELP_DESK_ACCESS_KEY;
  const supplied = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i,"");
  if (!expected || !env.WORKSPACE_ID || !supplied || supplied.length !== expected.length) return false;
  const a = new TextEncoder().encode(supplied), b = new TextEncoder().encode(expected);
  let diff=0; for(let i=0;i<a.length;i++) diff |= a[i]^b[i];
  return diff===0;
}
async function route(request, env, url, origin) {
  if (url.pathname === "/" || url.pathname === "/api/health") return reply(origin,{ok:true,service:"Employee Help Desk API",mode:"shared-backend-gated",configured:Boolean(env.HELP_DESK_ACCESS_KEY && env.WORKSPACE_ID)});
  if (!await authorized(request,env)) return reply(origin,{error:"Workspace access is not configured or the access key is invalid."},401);
  if (!env.DB) return reply(origin,{error:"Database binding unavailable."},503);
  const workspace = clean(env.WORKSPACE_ID);
  if (url.pathname === "/api/overview" && request.method === "GET") {
    const [requests, articles, faqs, guides, team, notifications] = await Promise.all([
      env.DB.prepare("SELECT status, COUNT(*) AS count FROM helpdesk_requests WHERE workspace_id=? GROUP BY status").bind(workspace).all(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM helpdesk_articles WHERE workspace_id=? AND published=1").bind(workspace).first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM helpdesk_faqs WHERE workspace_id=? AND published=1").bind(workspace).first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM helpdesk_guides WHERE workspace_id=? AND published=1").bind(workspace).first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM helpdesk_team WHERE workspace_id=?").bind(workspace).first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM helpdesk_notifications WHERE workspace_id=? AND read_at IS NULL").bind(workspace).first()
    ]);
    return reply(origin,{requests:requests.results||[],articles:articles?.count||0,faqs:faqs?.count||0,guides:guides?.count||0,team:team?.count||0,unread_notifications:notifications?.count||0});
  }
  if (url.pathname === "/api/notifications" && request.method === "GET") {
    const result=await env.DB.prepare("SELECT id,title,message,kind,created_at,read_at FROM helpdesk_notifications WHERE workspace_id=? ORDER BY created_at DESC LIMIT 50").bind(workspace).all();
    return reply(origin,{items:result.results||[]});
  }
  const match=url.pathname.match(/^\/api\/(requests|articles|faqs|guides|team)(?:\/([a-f0-9-]+))?$/i);
  if (!match) return reply(origin,{error:"Not found"},404);
  const name=match[1].toLowerCase(), id=match[2], spec=COLLECTIONS[name], table=spec.table;
  if (id && !validId(id)) return reply(origin,{error:"Invalid record id"},400);
  if (request.method === "GET") {
    if (id) {
      const row=await env.DB.prepare("SELECT * FROM "+table+" WHERE workspace_id=? AND id=?").bind(workspace,id).first();
      return row?reply(origin,{item:row}):reply(origin,{error:"Not found"},404);
    }
    const result=await env.DB.prepare("SELECT * FROM "+table+" WHERE workspace_id=? ORDER BY created_at DESC LIMIT 200").bind(workspace).all();
    return reply(origin,{items:result.results||[]});
  }
  if (request.method === "POST" || request.method === "PATCH") {
    if (request.method==="PATCH" && !id) return reply(origin,{error:"Record id required"},400);
    let input; try { input=await request.json(); } catch { return reply(origin,{error:"Invalid JSON"},400); }
    if (!input || typeof input!=="object" || Array.isArray(input)) return reply(origin,{error:"Invalid request body"},400);
    let fields; try { fields=payloadFields(input,spec.fields); } catch(e) { return reply(origin,{error:e.message},400); }
    if (request.method==="POST") {
      for (const key of (name==="requests"?["title","description"]:name==="team"?["name"]:["title","body"])) if (!clean(fields[key])) return reply(origin,{error:key+" is required"},400);
      const newId=crypto.randomUUID(), now=new Date().toISOString();
      const defaults=name==="requests"?{status:"Open",priority:"Normal"}:{published:1};
      Object.assign(fields,defaults,fields);
      const keys=Object.keys(fields);
      await env.DB.prepare("INSERT INTO "+table+" (id,workspace_id,"+keys.join(",")+",created_at,updated_at) VALUES (?,?,"+keys.map(()=>"?").join(",")+",?,?)").bind(newId,workspace,...keys.map(k=>fields[k]),now,now).run();
      if(name==="requests") await env.DB.prepare("INSERT INTO helpdesk_notifications (id,workspace_id,title,message,kind,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),workspace,"New help request",fields.title,"request",now).run();
      return reply(origin,{item:{id:newId,workspace_id:workspace,...fields,created_at:now,updated_at:now}},201);
    }
    if (!Object.keys(fields).length) return reply(origin,{error:"No editable fields supplied"},400);
    const now=new Date().toISOString(), keys=Object.keys(fields);
    const result=await env.DB.prepare("UPDATE "+table+" SET "+keys.map(k=>k+"=?").join(",")+",updated_at=? WHERE workspace_id=? AND id=?").bind(...keys.map(k=>fields[k]),now,workspace,id).run();
    if (!result.meta?.changes) return reply(origin,{error:"Not found"},404);
    return reply(origin,{ok:true,id});
  }
  if (request.method==="DELETE") {
    if(!id) return reply(origin,{error:"Record id required"},400);
    const result=await env.DB.prepare("DELETE FROM "+table+" WHERE workspace_id=? AND id=?").bind(workspace,id).run();
    return result.meta?.changes?reply(origin,{ok:true}):reply(origin,{error:"Not found"},404);
  }
  return reply(origin,{error:"Method not allowed"},405);
}
export default {
  async fetch(request,env) {
    const origin=request.headers.get("Origin")||"";
    if(request.method==="OPTIONS") return new Response(null,{status:204,headers:headers(origin)});
    try { return await route(request,env,new URL(request.url),origin); }
    catch(error) { return reply(origin,{error:"Internal server error"},500); }
  }
};
