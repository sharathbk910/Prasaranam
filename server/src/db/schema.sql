-- ====================================================================
-- PRASARANAM: AI-Powered Project Knowledge-Handover System
-- Database Schema with Multi-Tenant Workspaces, Memberships and RLS
-- ====================================================================

CREATE TYPE clearance_level AS ENUM ('public', 'internal', 'confidential', 'restricted');
CREATE TYPE verification_status AS ENUM ('supported', 'corroborated', 'needs confirmation', 'conflicting', 'unknown');
CREATE TYPE handover_status AS ENUM ('draft', 'under_review', 'changes_requested', 'approved', 'shared');
CREATE TYPE source_type AS ENUM ('chat', 'email', 'doc', 'ticket', 'meeting_notes');
CREATE TYPE user_role AS ENUM ('admin', 'reviewer', 'member', 'guest');
CREATE TYPE membership_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Clearance weight helper
CREATE OR REPLACE FUNCTION clearance_weight(level clearance_level)
RETURNS integer AS $$
BEGIN
  RETURN CASE level
    WHEN 'public' THEN 1
    WHEN 'internal' THEN 2
    WHEN 'confidential' THEN 3
    WHEN 'restricted' THEN 4
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'member',
  clearance_level clearance_level NOT NULL DEFAULT 'internal',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Workspaces Table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  lead_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Memberships Table (user, project, workspace, role)
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role membership_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

-- 5. Sources and Imported Documents
CREATE TABLE IF NOT EXISTS source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type source_type NOT NULL,
  clearance_level clearance_level NOT NULL DEFAULT 'internal',
  author TEXT NOT NULL,
  imported_by UUID REFERENCES profiles(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 6. Document Passages
CREATE TABLE IF NOT EXISTS passages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  passage_index INTEGER NOT NULL,
  text_content TEXT NOT NULL,
  char_start INTEGER NOT NULL,
  char_end INTEGER NOT NULL,
  clearance_level clearance_level NOT NULL DEFAULT 'internal',
  search_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', text_content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS passages_search_idx ON passages USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS passages_source_idx ON passages(source_id);

-- 7. Handover Plans
CREATE TABLE IF NOT EXISTS handover_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  departing_user_id UUID NOT NULL REFERENCES profiles(id),
  recipient_user_id UUID NOT NULL REFERENCES profiles(id),
  reviewer_user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status handover_status NOT NULL DEFAULT 'draft',
  generated_with_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  reviewer_notes TEXT
);

-- 8. Handover Items
CREATE TABLE IF NOT EXISTS handover_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id UUID NOT NULL REFERENCES handover_plans(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  statement TEXT NOT NULL,
  verification_status verification_status NOT NULL DEFAULT 'needs confirmation',
  owner TEXT,
  is_owner_explicit BOOLEAN NOT NULL DEFAULT FALSE,
  is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  reviewer_status TEXT NOT NULL DEFAULT 'pending',
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Item Quotation Citations
CREATE TABLE IF NOT EXISTS item_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES handover_items(id) ON DELETE CASCADE,
  passage_id UUID NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  exact_match BOOLEAN NOT NULL DEFAULT FALSE,
  char_offset INTEGER
);

-- 10. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id UUID NOT NULL REFERENCES handover_plans(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES profiles(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details TEXT NOT NULL
);

-- ====================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- A user can read ONLY the workspaces and projects they are a member of!
-- ====================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users can view member profiles
CREATE POLICY profiles_select ON profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Workspaces RLS: A user can read ONLY workspaces they are a member of
CREATE POLICY workspaces_member_select ON workspaces
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM memberships WHERE memberships.workspace_id = workspaces.id AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY workspaces_insert ON workspaces
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Projects RLS: A user can read ONLY projects they are a member of
CREATE POLICY projects_member_select ON projects
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM memberships WHERE memberships.project_id = projects.id AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY projects_insert ON projects
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Memberships RLS: Users can view memberships for projects they belong to
CREATE POLICY memberships_select ON memberships
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM memberships m2 WHERE m2.project_id = memberships.project_id AND m2.user_id = auth.uid()
    )
  );

-- Sources RLS: Only accessible if user is project member AND has sufficient clearance
CREATE POLICY sources_clearance_select ON source_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships WHERE memberships.project_id = source_documents.project_id AND memberships.user_id = auth.uid()
    )
    AND
    clearance_weight((SELECT clearance_level FROM profiles WHERE id = auth.uid())) >= clearance_weight(clearance_level)
  );

-- Passages RLS: Only accessible if user is project member AND has sufficient clearance
CREATE POLICY passages_clearance_select ON passages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM source_documents s
      JOIN memberships m ON m.project_id = s.project_id
      WHERE s.id = passages.source_id AND m.user_id = auth.uid()
    )
    AND
    clearance_weight((SELECT clearance_level FROM profiles WHERE id = auth.uid())) >= clearance_weight(clearance_level)
  );
