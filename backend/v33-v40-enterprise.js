/* NEXORA UNIVERSITY OS V33-V40 ENTERPRISE FOUNDATION */
module.exports=function(app,db){

db.exec(`
CREATE TABLE IF NOT EXISTS v33_security_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER,
 user_id INTEGER,
 action TEXT NOT NULL,
 resource TEXT,
 metadata TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v34_tenant_access(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 tenant_id INTEGER NOT NULL,
 user_id INTEGER,
 access_level TEXT DEFAULT 'viewer',
 status TEXT DEFAULT 'active',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v35_integration_jobs(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER,
 provider TEXT NOT NULL,
 job_type TEXT NOT NULL,
 status TEXT DEFAULT 'pending',
 records_processed INTEGER DEFAULT 0,
 last_run_at TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v36_kpi_metrics(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER,
 metric_key TEXT NOT NULL,
 metric_value REAL DEFAULT 0,
 period TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v37_reports(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER,
 report_type TEXT NOT NULL,
 title TEXT,
 format TEXT DEFAULT 'json',
 status TEXT DEFAULT 'ready',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v38_ai_sessions(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER,
 user_id INTEGER,
 query TEXT NOT NULL,
 response TEXT,
 model TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v39_notifications(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER,
 user_id INTEGER,
 notification_type TEXT NOT NULL,
 title TEXT NOT NULL,
 message TEXT,
 status TEXT DEFAULT 'pending',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v40_system_health(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 component TEXT NOT NULL,
 status TEXT NOT NULL,
 details TEXT,
 checked_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_v33_security ON v33_security_events(institution_id);
CREATE INDEX IF NOT EXISTS idx_v34_tenant ON v34_tenant_access(tenant_id,user_id);
CREATE INDEX IF NOT EXISTS idx_v35_jobs ON v35_integration_jobs(institution_id);
CREATE INDEX IF NOT EXISTS idx_v36_kpi ON v36_kpi_metrics(institution_id);
CREATE INDEX IF NOT EXISTS idx_v38_ai ON v38_ai_sessions(institution_id);
CREATE INDEX IF NOT EXISTS idx_v39_notifications ON v39_notifications(institution_id);
`);

const count=t=>{try{return db.prepare('SELECT COUNT(*) c FROM '+t).get().c||0}catch(e){return 0}};

/* V33 SECURITY */
app.post('/api/v33/security-event',(req,res)=>{
 try{
  const b=req.body||{};
  if(!b.action)return res.status(400).json({success:false,error:'action required'});
  const r=db.prepare(`
   INSERT INTO v33_security_events(institution_id,user_id,action,resource,metadata)
   VALUES(?,?,?,?,?)
  `).run(b.institutionId||null,b.userId||null,b.action,b.resource||null,
         b.metadata?JSON.stringify(b.metadata):null);
  res.status(201).json({success:true,id:r.lastInsertRowid});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V34 TENANT ISOLATION FOUNDATION */
app.get('/api/v34/tenant-access/:tenantId',(req,res)=>{
 try{
  res.json({success:true,records:db.prepare(
   'SELECT id,tenant_id,user_id,access_level,status,created_at FROM v34_tenant_access WHERE tenant_id=?'
  ).all(Number(req.params.tenantId))});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V35 INTEGRATION FRAMEWORK */
app.get('/api/v35/integrations/:institutionId',(req,res)=>{
 try{
  res.json({success:true,version:'V35',
   jobs:db.prepare(
    'SELECT * FROM v35_integration_jobs WHERE institution_id=? ORDER BY id DESC'
   ).all(Number(req.params.institutionId))});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V36 KPI ENGINE */
app.get('/api/v36/kpi/:institutionId',(req,res)=>{
 try{
  res.json({success:true,version:'V36',
   metrics:db.prepare(
    'SELECT * FROM v36_kpi_metrics WHERE institution_id=? ORDER BY id DESC'
   ).all(Number(req.params.institutionId))});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V37 REPORTS */
app.get('/api/v37/reports/:institutionId',(req,res)=>{
 try{
  res.json({success:true,version:'V37',
   reports:db.prepare(
    'SELECT * FROM v37_reports WHERE institution_id=? ORDER BY id DESC'
   ).all(Number(req.params.institutionId))});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V38 AI UNIVERSITY COPILOT FOUNDATION */
app.post('/api/v38/ai-session',(req,res)=>{
 try{
  const b=req.body||{};
  if(!b.query)return res.status(400).json({success:false,error:'query required'});
  const r=db.prepare(`
   INSERT INTO v38_ai_sessions(institution_id,user_id,query,response,model)
   VALUES(?,?,?,?,?)
  `).run(b.institutionId||null,b.userId||null,String(b.query),
         b.response||null,b.model||null);
  res.status(201).json({success:true,id:r.lastInsertRowid});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V39 NOTIFICATION ENGINE */
app.get('/api/v39/notifications/:institutionId',(req,res)=>{
 try{
  res.json({success:true,
   notifications:db.prepare(
    'SELECT * FROM v39_notifications WHERE institution_id=? ORDER BY id DESC LIMIT 500'
   ).all(Number(req.params.institutionId))});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V40 HEALTH / OBSERVABILITY */
app.get('/api/v40/health',(req,res)=>{
 try{
  db.prepare('SELECT 1').get();
  res.json({
   success:true,
   status:'HEALTHY',
   database:'ONLINE',
   timestamp:new Date().toISOString()
  });
 }catch(e){
  res.status(500).json({success:false,status:'DEGRADED',error:e.message});
 }
});

/* CONSOLIDATED */
app.get('/api/v33-v40/status',(req,res)=>{
 res.json({
  success:true,
  status:'ACTIVE',
  modules:{
   V33:'Production Security',
   V34:'Tenant Isolation',
   V35:'Integration Framework',
   V36:'Advanced KPI Engine',
   V37:'Reports & Exports',
   V38:'AI University Copilot',
   V39:'Notifications & Workflows',
   V40:'Monitoring & Health'
  }
 });
});

};
