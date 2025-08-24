-- Create checklist tables for job preparation feature
-- This script adds the database tables needed for persistent checklist functionality

-- Job checklists table
CREATE TABLE IF NOT EXISTS job_checklists (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id),
    name TEXT NOT NULL DEFAULT 'Job Preparation Checklist',
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general', -- sheets, hardware, rods, general
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Checklist items table
CREATE TABLE IF NOT EXISTS checklist_items (
    id SERIAL PRIMARY KEY,
    checklist_id INTEGER REFERENCES job_checklists(id) NOT NULL,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    completed_by INTEGER REFERENCES users(id),
    order_index INTEGER DEFAULT 0, -- For custom ordering
    priority TEXT DEFAULT 'normal', -- low, normal, high, critical
    due_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- G-Code files table (future-ready architecture)
CREATE TABLE IF NOT EXISTS gcode_files (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id),
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER, -- in bytes
    checksum TEXT, -- MD5 or SHA256 hash
    status TEXT DEFAULT 'uploaded', -- uploaded, validated, approved, rejected
    validation_results JSONB, -- JSON object with validation details
    validated_at TIMESTAMP,
    validated_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    approved_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- G-Code validation rules table (future extensibility)
CREATE TABLE IF NOT EXISTS gcode_validation_rules (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL, -- syntax, safety, toolpath, material
    rule_config JSONB NOT NULL, -- JSON configuration for the rule
    is_active BOOLEAN DEFAULT true,
    severity TEXT DEFAULT 'warning', -- info, warning, error, critical
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_job_checklists_job_id ON job_checklists(job_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_completed ON checklist_items(completed);
CREATE INDEX IF NOT EXISTS idx_gcode_files_job_id ON gcode_files(job_id);
CREATE INDEX IF NOT EXISTS idx_gcode_files_status ON gcode_files(status);

-- Insert default checklist for existing jobs (optional)
-- This creates a default checklist for any existing jobs that don't have one
INSERT INTO job_checklists (job_id, name, category, created_at)
SELECT id, 'Job Preparation Checklist', 'general', NOW()
FROM jobs
WHERE id NOT IN (SELECT DISTINCT job_id FROM job_checklists WHERE job_id IS NOT NULL);

-- Insert some default checklist items for demonstration
INSERT INTO checklist_items (checklist_id, text, priority, order_index)
SELECT jc.id, item.text, item.priority, item.order_index
FROM job_checklists jc
CROSS JOIN (
    VALUES
    ('Verify material specifications', 'high', 1),
    ('Check tool calibration', 'high', 2),
    ('Confirm safety equipment', 'critical', 3),
    ('Review G-Code file', 'normal', 4),
    ('Test run setup', 'normal', 5)
) AS item(text, priority, order_index)
WHERE jc.category = 'general'
AND NOT EXISTS (
    SELECT 1 FROM checklist_items ci WHERE ci.checklist_id = jc.id
);
