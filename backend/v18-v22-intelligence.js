/* NEXORA UNIVERSITY OS — V18-V22 CORE INTELLIGENCE
   V18 Student 360
   V19 Skill Intelligence
   V20 Employer Intelligence 2
   V21 Placement Readiness
   V22 Outcome Intelligence
*/
module.exports = function installV18V22(app, db) {

  db.exec(`
    CREATE TABLE IF NOT EXISTS v18_student_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL UNIQUE,
      target_role TEXT,
      target_industry TEXT,
      career_status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS v19_skill_intelligence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      demand_level REAL DEFAULT 0,
      market_demand REAL DEFAULT 0,
      curriculum_coverage REAL DEFAULT 0,
      placement_relevance REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS v20_employer_intelligence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id INTEGER NOT NULL,
      employer_id INTEGER NOT NULL,
      hiring_demand REAL DEFAULT 0,
      active_roles INTEGER DEFAULT 0,
      required_skills INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS v21_readiness_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      employer_id INTEGER,
      readiness_score REAL DEFAULT 0,
      skill_gap_count INTEGER DEFAULT 0,
      academic_score REAL DEFAULT 0,
      skill_score REAL DEFAULT 0,
      placement_score REAL DEFAULT 0,
      calculated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS v22_outcome_intelligence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id INTEGER NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      outcome_type TEXT NOT NULL,
      outcome_value REAL DEFAULT 0,
      evidence_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_v18_student
      ON v18_student_profiles(institution_id,student_id);
    CREATE INDEX IF NOT EXISTS idx_v19_skill
      ON v19_skill_intelligence(institution_id,skill_id);
    CREATE INDEX IF NOT EXISTS idx_v20_employer
      ON v20_employer_intelligence(institution_id,employer_id);
    CREATE INDEX IF NOT EXISTS idx_v21_readiness
      ON v21_readiness_analysis(institution_id,student_id);
    CREATE INDEX IF NOT EXISTS idx_v22_outcome
      ON v22_outcome_intelligence(institution_id,entity_type,entity_id);
  `);

  /* V18 — STUDENT 360 */
  app.get('/api/v18/student-360/:institutionId', (req,res)=>{
    try {
      const iid=Number(req.params.institutionId);
      const rows=db.prepare(`
        SELECT s.id,s.name,s.enrollment_no,s.email,
          sp.target_role,sp.target_industry,
          COUNT(DISTINCT e.id) AS enrolments,
          COUNT(DISTINCT lp.id) AS learning_records,
          COUNT(DISTINCT ar.id) AS assessments,
          COUNT(DISTINCT ss.id) AS skills,
          COUNT(DISTINCT se.id) AS evidence
        FROM students s
        LEFT JOIN v18_student_profiles sp ON sp.student_id=s.id
        LEFT JOIN v13_enrolments e ON e.student_id=s.id
        LEFT JOIN v13_learning_progress lp ON lp.student_id=s.id
        LEFT JOIN v13_assessment_results ar ON ar.student_id=s.id
        LEFT JOIN student_skills ss ON ss.student_id=s.id
        LEFT JOIN skill_evidence se ON se.student_skill_id=ss.id
        GROUP BY s.id
        ORDER BY s.name
      `).all();
      res.json({success:true,version:'V18',module:'Student 360',students:rows});
    } catch(e){ res.status(500).json({success:false,error:e.message}); }
  });

  /* V19 — SKILL INTELLIGENCE */
  app.get('/api/v19/skill-intelligence/:institutionId',(req,res)=>{
    try {
      const iid=Number(req.params.institutionId);
      const rows=db.prepare(`
        SELECT sk.id,sk.name,sk.category,
          COUNT(DISTINCT ss.student_id) AS students,
          COALESCE(AVG(ss.level),0) AS average_level,
          COUNT(DISTINCT se.id) AS evidence
        FROM skills sk
        LEFT JOIN student_skills ss ON ss.skill_id=sk.id
        LEFT JOIN skill_evidence se ON se.student_skill_id=ss.id
        GROUP BY sk.id
        ORDER BY sk.name
      `).all();
      res.json({success:true,version:'V19',module:'Skill Intelligence',skills:rows});
    } catch(e){ res.status(500).json({success:false,error:e.message}); }
  });

  /* V20 — EMPLOYER INTELLIGENCE 2 */
  app.get('/api/v20/employer-intelligence/:institutionId',(req,res)=>{
    try {
      const iid=Number(req.params.institutionId);
      const rows=db.prepare(`
        SELECT e.id,e.name,e.industry,e.location,e.website,
          COUNT(DISTINCT jr.id) AS job_roles,
          COUNT(DISTINCT js.id) AS skill_requirements,
          COUNT(DISTINCT a.id) AS applications,
          COUNT(DISTINCT ho.id) AS hiring_outcomes
        FROM v15_employers e
        LEFT JOIN v14_job_roles jr ON jr.company=e.name
        LEFT JOIN v14_job_skills js ON js.job_id=jr.id
        LEFT JOIN v14_applications a ON a.job_id=jr.id
        LEFT JOIN v15_hiring_outcomes ho ON ho.employer_id=e.id
        WHERE e.institution_id=?
        GROUP BY e.id
        ORDER BY e.name
      `).all(iid);
      res.json({success:true,version:'V20',module:'Employer Intelligence 2',employers:rows});
    } catch(e){ res.status(500).json({success:false,error:e.message}); }
  });

  /* V21 — PLACEMENT READINESS */
  app.get('/api/v21/readiness/:institutionId',(req,res)=>{
    try {
      const iid=Number(req.params.institutionId);
      const rows=db.prepare(`
        SELECT s.id,s.name,s.enrollment_no,
          COUNT(DISTINCT ss.id) AS skill_count,
          COALESCE(AVG(ss.level),0) AS skill_score,
          COUNT(DISTINCT se.id) AS evidence_count,
          COALESCE(AVG(ar.percentage),0) AS academic_score
        FROM students s
        LEFT JOIN student_skills ss ON ss.student_id=s.id
        LEFT JOIN skill_evidence se ON se.student_skill_id=ss.id
        LEFT JOIN v13_assessment_results ar ON ar.student_id=s.id
        GROUP BY s.id
        ORDER BY skill_score DESC
      `).all();
      const readiness=rows.map(r=>({
        ...r,
        readiness_score:Number(
          Math.min(100,
            (Number(r.skill_score)||0)*0.45 +
            (Number(r.academic_score)||0)*0.35 +
            Math.min(20,(Number(r.evidence_count)||0)*2)
          ).toFixed(2)
        )
      }));
      res.json({success:true,version:'V21',module:'Placement Readiness',students:readiness});
    } catch(e){ res.status(500).json({success:false,error:e.message}); }
  });

  /* V22 — OUTCOME INTELLIGENCE */
  app.get('/api/v22/outcome-intelligence/:institutionId',(req,res)=>{
    try {
      const iid=Number(req.params.institutionId);
      const r=db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM students) AS students,
          (SELECT COUNT(*) FROM v13_assessments) AS assessments,
          (SELECT COUNT(*) FROM v13_assessment_results) AS assessment_results,
          (SELECT COUNT(*) FROM student_skills) AS student_skills,
          (SELECT COUNT(*) FROM skill_evidence) AS skill_evidence,
          (SELECT COUNT(*) FROM v14_applications) AS applications,
          (SELECT COUNT(*) FROM v15_hiring_outcomes) AS hiring_outcomes
      `).get();
      res.json({
        success:true,
        version:'V22',
        module:'Outcome Intelligence',
        outcome:{
          academic_activity:r.assessment_results,
          skill_evidence:r.skill_evidence,
          placement_activity:r.applications,
          placement_outcomes:r.hiring_outcomes,
          students:r.students,
          assessments:r.assessments,
          student_skills:r.student_skills
        }
      });
    } catch(e){ res.status(500).json({success:false,error:e.message}); }
  });

  /* Combined future status */
  app.get('/api/v18-v22/status',(req,res)=>{
    try {
      const count=t=>db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
      res.json({
        success:true,
        status:'ACTIVE',
        modules:{
          V18:'Student 360 Intelligence',
          V19:'Skill Intelligence',
          V20:'Employer Intelligence 2.0',
          V21:'Placement Readiness',
          V22:'Outcome Intelligence'
        },
        counts:{
          student_profiles:count('v18_student_profiles'),
          skill_intelligence:count('v19_skill_intelligence'),
          employer_intelligence:count('v20_employer_intelligence'),
          readiness_analysis:count('v21_readiness_analysis'),
          outcome_intelligence:count('v22_outcome_intelligence')
        }
      });
    } catch(e){ res.status(500).json({success:false,error:e.message}); }
  });
};
