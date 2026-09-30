/* NEXORA UNIVERSITY OS V41-V50 PRODUCTION FOUNDATION */
module.exports=function(app,db){

db.exec(`
CREATE TABLE IF NOT EXISTS v41_api_keys(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER,
 key_hash TEXT NOT NULL,
 name TEXT,
 status TEXT DEFAULT 'active',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v42_sessions(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER,
 institution_id INTEGER,
 token_hash TEXT,
 expires_at TEXT,
 status TEXT DEFAULT 'active',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v43_job_queue(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER,
 job_type TEXT NOT NULL,
 payload TEXT,
 status TEXT DEFAULT 'queued',
 attempts INTEGER DEFAULT 0,
 error TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 completed_at TEXT
);

CREATE TABLE IF NOT EXISTS v44_kpi_definitions(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 metric_key TEXT UNIQUE NOT NULL,
 name TEXT NOT NULL,
 formula TEXT,
 active INTEGER DEFAULT 1,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v45_export_jobs(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER,
 export_type TEXT NOT NULL,
 format TEXT NOT NULL,
 status TEXT DEFAULT 'queued',
 file_path TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 completed_at TEXT
);

CREATE TABLE IF NOT EXISTS v46_ai_actions(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER,
 user_id INTEGER,
 action TEXT NOT NULL,
 input TEXT,
 output TEXT,
 status TEXT DEFAULT 'completed',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v47_workflow_rules(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER,
 name TEXT NOT NULL,
 trigger_event TEXT NOT NULL,
 action_type TEXT NOT NULL,
 active INTEGER DEFAULT 1,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v48_backup_registry(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 backup_type TEXT NOT NULL,
 location TEXT,
 status TEXT DEFAULT 'created',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v49_system_metrics(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 component TEXT NOT NULL,
 metric TEXT NOT NULL,
 value REAL DEFAULT 0,
 recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v50_migrations(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 version TEXT UNIQUE NOT NULL,
 description TEXT,
 applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_v42_sessions ON v42_sessions(user_id,institution_id);
CREATE INDEX IF NOT EXISTS idx_v43_queue ON v43_job_queue(status,created_at);
CREATE INDEX IF NOT EXISTS idx_v45_exports ON v45_export_jobs(institution_id,status);
CREATE INDEX IF NOT EXISTS idx_v47_workflows ON v47_workflow_rules(institution_id,active);
CREATE INDEX IF NOT EXISTS idx_v49_metrics ON v49_system_metrics(component,metric);
`);

const versions=[
 ['V41','API KEY MANAGEMENT'],
 ['V42','SESSION MANAGEMENT'],
 ['V43','BACKGROUND JOB QUEUE'],
 ['V44','KPI DEFINITIONS'],
 ['V45','EXPORT PIPELINE'],
 ['V46','AI ACTION AUDIT'],
 ['V47','WORKFLOW AUTOMATION'],
 ['V48','BACKUP REGISTRY'],
 ['V49','SYSTEM METRICS'],
 ['V50','MIGRATION REGISTRY']
];

const ins=db.prepare(
 'INSERT OR IGNORE INTO v50_migrations(version,description) VALUES(?,?)'
);
const tx=db.transaction(()=>versions.forEach(v=>ins.run(v[0],v[1])));
tx();

/* V41 */
app.get('/api/v41/status',(req,res)=>{
 res.json({success:true,version:'V41',status:'ACTIVE',service:'API KEY MANAGEMENT'});
});

/* V42 */
app.get('/api/v42/sessions/:userId',(req,res)=>{
 try{
  res.json({success:true,sessions:db.prepare(
   'SELECT id,user_id,institution_id,expires_at,status,created_at FROM v42_sessions WHERE user_id=? ORDER BY id DESC'
  ).all(Number(req.params.userId))});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V43 */
app.post('/api/v43/jobs',(req,res)=>{
 try{
  const b=req.body||{};
  if(!b.jobType)return res.status(400).json({success:false,error:'jobType required'});
  const r=db.prepare(
   'INSERT INTO v43_job_queue(institution_id,job_type,payload) VALUES(?,?,?)'
  ).run(b.institutionId||null,b.jobType,b.payload?JSON.stringify(b.payload):null);
  res.status(201).json({success:true,id:r.lastInsertRowid,status:'queued'});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V44 */
app.get('/api/v44/kpi-definitions',(req,res)=>{
 res.json({success:true,definitions:db.prepare(
  'SELECT * FROM v44_kpi_definitions WHERE active=1 ORDER BY id'
 ).all()});
});

/* V45 */
app.post('/api/v45/export',(req,res)=>{
 try{
  const b=req.body||{};
  if(!b.exportType||!b.format)
   return res.status(400).json({success:false,error:'exportType and format required'});
  const r=db.prepare(
   'INSERT INTO v45_export_jobs(institution_id,export_type,format) VALUES(?,?,?)'
  ).run(b.institutionId||null,b.exportType,b.format);
  res.status(201).json({success:true,id:r.lastInsertRowid,status:'queued'});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V46 */
app.post('/api/v46/ai-action',(req,res)=>{
 try{
  const b=req.body||{};
  if(!b.action)return res.status(400).json({success:false,error:'action required'});
  const r=db.prepare(
   'INSERT INTO v46_ai_actions(institution_id,user_id,action,input,output,status) VALUES(?,?,?,?,?,?)'
  ).run(b.institutionId||null,b.userId||null,b.action,
        b.input?JSON.stringify(b.input):null,
        b.output?JSON.stringify(b.output):null,
        b.status||'completed');
  res.status(201).json({success:true,id:r.lastInsertRowid});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V47 */
app.get('/api/v47/workflows/:institutionId',(req,res)=>{
 try{
  res.json({success:true,rules:db.prepare(
   'SELECT * FROM v47_workflow_rules WHERE institution_id=? ORDER BY id DESC'
  ).all(Number(req.params.institutionId))});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V48 */
app.get('/api/v48/backups',(req,res)=>{
 res.json({success:true,backups:db.prepare(
  'SELECT * FROM v48_backup_registry ORDER BY id DESC'
 ).all()});
});

/* V49 */
app.get('/api/v49/system-metrics',(req,res)=>{
 res.json({success:true,metrics:db.prepare(
  'SELECT * FROM v49_system_metrics ORDER BY id DESC LIMIT 500'
 ).all()});
});

/* V50 */
app.get('/api/v50/migrations',(req,res)=>{
 res.json({success:true,migrations:db.prepare(
  'SELECT * FROM v50_migrations ORDER BY id'
 ).all()});
});

/* CONSOLIDATED */
app.get('/api/v41-v50/status',(req,res)=>{
 res.json({
  success:true,
  status:'ACTIVE',
  modules:Object.fromEntries(versions)
 });
});

};
