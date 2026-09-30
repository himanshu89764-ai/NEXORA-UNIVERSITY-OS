/* ============================================================
   NEXORA UNIVERSITY OS — V23-V32 ENTERPRISE FOUNDATION
   ============================================================ */
module.exports=function installV23V32(app,db){

db.exec(`
CREATE TABLE IF NOT EXISTS v23_executive_metrics(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER NOT NULL,
 metric_name TEXT NOT NULL,
 metric_value REAL DEFAULT 0,
 metric_unit TEXT,
 calculated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v24_hod_profiles(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER NOT NULL,
 department_id INTEGER NOT NULL,
 user_id INTEGER,
 name TEXT,
 email TEXT,
 status TEXT DEFAULT 'active',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v25_faculty_dashboard_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER NOT NULL,
 faculty_id INTEGER,
 event_type TEXT NOT NULL,
 event_value REAL DEFAULT 0,
 metadata TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v26_student_dashboard_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER NOT NULL,
 student_id INTEGER,
 event_type TEXT NOT NULL,
 event_value REAL DEFAULT 0,
 metadata TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v27_audit_evidence(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER NOT NULL,
 actor_user_id INTEGER,
 entity_type TEXT NOT NULL,
 entity_id INTEGER,
 action TEXT NOT NULL,
 evidence_type TEXT,
 evidence_ref TEXT,
 metadata TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v28_tenants(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 tenant_key TEXT UNIQUE NOT NULL,
 institution_id INTEGER,
 name TEXT NOT NULL,
 status TEXT DEFAULT 'active',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v29_roles(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 role_key TEXT UNIQUE NOT NULL,
 role_name TEXT NOT NULL,
 permissions TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v30_integrations(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER NOT NULL,
 provider TEXT NOT NULL,
 integration_type TEXT,
 endpoint TEXT,
 status TEXT DEFAULT 'configured',
 last_sync_at TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v31_ai_queries(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER,
 user_id INTEGER,
 query TEXT NOT NULL,
 response_summary TEXT,
 model TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v32_enterprise_config(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER,
 organization_name TEXT,
 plan TEXT DEFAULT 'enterprise',
 feature_flags TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_v23_exec ON v23_executive_metrics(institution_id);
CREATE INDEX IF NOT EXISTS idx_v24_hod ON v24_hod_profiles(institution_id,department_id);
CREATE INDEX IF NOT EXISTS idx_v27_audit ON v27_audit_evidence(institution_id,entity_type);
CREATE INDEX IF NOT EXISTS idx_v28_tenant ON v28_tenants(tenant_key);
CREATE INDEX IF NOT EXISTS idx_v30_integrations ON v30_integrations(institution_id);
CREATE INDEX IF NOT EXISTS idx_v31_ai ON v31_ai_queries(institution_id);
`);

function safeCount(table){
 try{return db.prepare('SELECT COUNT(*) AS c FROM '+table).get().c||0}catch(e){return 0}
}

/* V23 — EXECUTIVE INTELLIGENCE */
app.get('/api/v23/executive/:institutionId',(req,res)=>{
 try{
  const iid=Number(req.params.institutionId);
  const data={
   academic:{
    universities:safeCount('universities'),
    colleges:safeCount('colleges'),
    departments:safeCount('departments'),
    programs:safeCount('programs'),
    subjects:safeCount('subjects')
   },
   people:{
    students:safeCount('students'),
    faculty:safeCount('v17_faculty')
   },
   learning:{
    content:safeCount('v12_content'),
    assessments:safeCount('v13_assessments'),
    evidence:safeCount('v13_skill_evidence')
   },
   placement:{
    employers:safeCount('v15_employers'),
    jobs:safeCount('v14_job_roles'),
    applications:safeCount('v14_applications'),
    outcomes:safeCount('v15_hiring_outcomes')
   }
  };
  res.json({success:true,version:'V23',module:'Executive Intelligence',institutionId:iid,data});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V24 — HOD */
app.get('/api/v24/hod/:institutionId',(req,res)=>{
 try{
  const rows=db.prepare(`
   SELECT h.*,d.name AS department_name,
   COUNT(DISTINCT p.id) AS programs,
   COUNT(DISTINCT s.id) AS students
   FROM v24_hod_profiles h
   LEFT JOIN departments d ON d.id=h.department_id
   LEFT JOIN programs p ON p.department_id=d.id
   LEFT JOIN students s ON s.college_id IN
     (SELECT college_id FROM departments WHERE id=d.id)
   WHERE h.institution_id=?
   GROUP BY h.id
   ORDER BY h.name
  `).all(Number(req.params.institutionId));
  res.json({success:true,version:'V24',module:'HOD Intelligence',hod:rows});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V25 — FACULTY DASHBOARD */
app.get('/api/v25/faculty-dashboard/:institutionId',(req,res)=>{
 try{
  const iid=Number(req.params.institutionId);
  const faculty=db.prepare(`
   SELECT f.id,f.name,f.designation,f.status,
   COUNT(DISTINCT fs.subject_id) subjects,
   COALESCE(SUM(fs.hours_per_week),0) weekly_hours,
   COUNT(DISTINCT fe.id) evidence
   FROM v17_faculty f
   LEFT JOIN v17_faculty_subjects fs ON fs.faculty_id=f.id
   LEFT JOIN v17_faculty_evidence fe ON fe.faculty_id=f.id
   WHERE f.institution_id=?
   GROUP BY f.id
   ORDER BY f.name
  `).all(iid);
  res.json({success:true,version:'V25',module:'Faculty Dashboard',faculty});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V26 — STUDENT DASHBOARD */
app.get('/api/v26/student-dashboard/:institutionId',(req,res)=>{
 try{
  const rows=db.prepare(`
   SELECT s.id,s.name,s.enrollment_no,s.email,
   COUNT(DISTINCT ss.skill_id) skills,
   COUNT(DISTINCT lp.id) learning_records,
   COUNT(DISTINCT ar.id) assessments,
   COUNT(DISTINCT se.id) evidence
   FROM students s
   LEFT JOIN student_skills ss ON ss.student_id=s.id
   LEFT JOIN v13_learning_progress lp ON lp.student_id=s.id
   LEFT JOIN v13_assessment_results ar ON ar.student_id=s.id
   LEFT JOIN skill_evidence se ON se.student_skill_id=ss.id
   GROUP BY s.id
   ORDER BY s.name
  `).all();
  res.json({success:true,version:'V26',module:'Student Dashboard',students:rows});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V27 — AUDIT & EVIDENCE */
app.post('/api/v27/audit',(req,res)=>{
 try{
  const b=req.body||{};
  if(!b.institutionId||!b.entityType||!b.action)
   return res.status(400).json({success:false,error:'institutionId, entityType and action required'});
  const r=db.prepare(`
   INSERT INTO v27_audit_evidence
   (institution_id,actor_user_id,entity_type,entity_id,action,evidence_type,evidence_ref,metadata)
   VALUES(?,?,?,?,?,?,?,?)
  `).run(
   Number(b.institutionId),b.actorUserId||null,String(b.entityType),
   b.entityId||null,String(b.action),b.evidenceType||null,
   b.evidenceRef||null,b.metadata?JSON.stringify(b.metadata):null
  );
  res.status(201).json({success:true,auditId:r.lastInsertRowid});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

app.get('/api/v27/audit/:institutionId',(req,res)=>{
 try{
  const rows=db.prepare(`
   SELECT * FROM v27_audit_evidence
   WHERE institution_id=? ORDER BY id DESC LIMIT 500
  `).all(Number(req.params.institutionId));
  res.json({success:true,version:'V27',module:'Audit & Evidence',records:rows});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V28 — MULTI UNIVERSITY */
app.get('/api/v28/tenants',(req,res)=>{
 try{
  const rows=db.prepare(`
   SELECT * FROM v28_tenants ORDER BY name
  `).all();
  res.json({success:true,version:'V28',module:'Multi-University',tenants:rows});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

app.post('/api/v28/tenant',(req,res)=>{
 try{
  const b=req.body||{};
  if(!b.tenantKey||!b.name)
   return res.status(400).json({success:false,error:'tenantKey and name required'});
  const r=db.prepare(`
   INSERT INTO v28_tenants(tenant_key,institution_id,name)
   VALUES(?,?,?)
  `).run(b.tenantKey,b.institutionId||null,b.name);
  res.status(201).json({success:true,tenantId:r.lastInsertRowid});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V29 — RBAC FOUNDATION */
app.get('/api/v29/roles',(req,res)=>{
 try{
  res.json({success:true,version:'V29',module:'Security RBAC',
   roles:db.prepare('SELECT * FROM v29_roles ORDER BY role_name').all()});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V30 — INTEGRATIONS */
app.get('/api/v30/integrations/:institutionId',(req,res)=>{
 try{
  res.json({success:true,version:'V30',module:'Integration Layer',
   integrations:db.prepare(`
    SELECT * FROM v30_integrations WHERE institution_id=? ORDER BY provider
   `).all(Number(req.params.institutionId))});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V31 — AI INTELLIGENCE AUDIT TRAIL */
app.post('/api/v31/ai-query',(req,res)=>{
 try{
  const b=req.body||{};
  if(!b.query)return res.status(400).json({success:false,error:'query required'});
  const r=db.prepare(`
   INSERT INTO v31_ai_queries(institution_id,user_id,query,response_summary,model)
   VALUES(?,?,?,?,?)
  `).run(
   b.institutionId||null,b.userId||null,String(b.query),
   b.responseSummary||null,b.model||null
  );
  res.status(201).json({success:true,queryId:r.lastInsertRowid});
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V32 — ENTERPRISE */
app.get('/api/v32/enterprise/:institutionId',(req,res)=>{
 try{
  const iid=Number(req.params.institutionId);
  const config=db.prepare(`
   SELECT * FROM v32_enterprise_config WHERE institution_id=?
   ORDER BY id DESC LIMIT 1
  `).get(iid)||null;
  res.json({
   success:true,version:'V32',module:'Enterprise Platform',
   institutionId:iid,
   status:'READY',
   config,
   capabilities:[
    'Multi-University',
    'RBAC',
    'Audit & Evidence',
    'Integration APIs',
    'AI Intelligence',
    'Executive Intelligence',
    'Faculty Intelligence',
    'Student Intelligence',
    'Placement Intelligence'
   ]
  });
 }catch(e){res.status(500).json({success:false,error:e.message})}
});

/* V23-V32 consolidated status */
app.get('/api/v23-v32/status',(req,res)=>{
 res.json({
  success:true,
  status:'ACTIVE',
  modules:{
   V23:'Executive Intelligence',
   V24:'HOD Intelligence',
   V25:'Faculty Dashboard',
   V26:'Student Dashboard',
   V27:'Audit & Evidence',
   V28:'Multi-University',
   V29:'Security / RBAC',
   V30:'Integration Layer',
   V31:'AI Intelligence',
   V32:'Enterprise Platform'
  },
  message:'Enterprise foundation ready for real institutional onboarding.'
 });
});

};
