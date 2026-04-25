-- ============================================
-- ProposalPilot Migration 010: SAM.gov Opportunities (raw sync)
-- Global table for SAM.gov opportunity data — not workspace-scoped.
-- The existing `opportunities` table is workspace-scoped for scored/tracked opps.
-- This table is the raw feed that gets synced from the SAM.gov API.
-- ============================================

CREATE TABLE IF NOT EXISTS public.sam_opportunities (
  -- Internal PK
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SAM.gov identifiers
  notice_id TEXT NOT NULL UNIQUE,                    -- SAM's internal UUID string
  solicitation_number TEXT,                          -- e.g. W912EF26QA013
  title TEXT NOT NULL,

  -- Agency hierarchy
  full_parent_path_name TEXT,                        -- e.g. "DEPT OF DEFENSE.DEPT OF THE ARMY..."
  full_parent_path_code TEXT,                        -- e.g. "021.2100.USACE.NWD.NWW.W912EF"
  organization_type TEXT,                            -- e.g. "OFFICE"

  -- Dates
  posted_date DATE,
  response_deadline TIMESTAMPTZ,
  archive_date DATE,

  -- Classification
  type TEXT,                                         -- e.g. "Solicitation"
  base_type TEXT,                                    -- e.g. "Solicitation"
  archive_type TEXT,                                 -- e.g. "autocustom"

  -- NAICS / PSC
  naics_code TEXT,                                   -- primary NAICS
  naics_codes TEXT[] DEFAULT '{}',                   -- all NAICS codes
  classification_code TEXT,                          -- PSC code e.g. "F105"

  -- Set-aside
  type_of_set_aside TEXT,                            -- e.g. "SBA"
  type_of_set_aside_description TEXT,                -- e.g. "Total Small Business Set-Aside (FAR 19.5)"

  -- Status
  active TEXT DEFAULT 'Yes',                         -- "Yes" / "No"

  -- Award info (null until awarded)
  award JSONB,

  -- Contact
  point_of_contact JSONB DEFAULT '[]',               -- array of contacts

  -- Description URL (SAM stores descriptions at a separate endpoint)
  description_url TEXT,

  -- Location
  office_address JSONB,                              -- {zipcode, city, countryCode, state}
  place_of_performance JSONB,                        -- {streetAddress, city, state, zip}

  -- Links
  ui_link TEXT,                                      -- direct link to sam.gov listing
  additional_info_link TEXT,
  resource_links JSONB,

  -- Full raw JSON for anything we don't break out
  raw_data JSONB DEFAULT '{}',

  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_sam_opps_notice_id ON public.sam_opportunities(notice_id);
CREATE INDEX idx_sam_opps_solicitation ON public.sam_opportunities(solicitation_number);
CREATE INDEX idx_sam_opps_naics ON public.sam_opportunities(naics_code);
CREATE INDEX idx_sam_opps_posted ON public.sam_opportunities(posted_date DESC);
CREATE INDEX idx_sam_opps_deadline ON public.sam_opportunities(response_deadline);
CREATE INDEX idx_sam_opps_active ON public.sam_opportunities(active);
CREATE INDEX idx_sam_opps_set_aside ON public.sam_opportunities(type_of_set_aside);
CREATE INDEX idx_sam_opps_type ON public.sam_opportunities(type);

-- GIN index on naics_codes array for @> containment queries
CREATE INDEX idx_sam_opps_naics_arr ON public.sam_opportunities USING GIN (naics_codes);

-- ============================================
-- RLS — disabled for this table.
-- This is public government data, not user-specific.
-- Access control happens at the application layer.
-- ============================================
ALTER TABLE public.sam_opportunities ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read (public data)
CREATE POLICY "sam_opportunities_read" ON public.sam_opportunities
  FOR SELECT USING (true);

-- Only service_role can insert/update/delete (server-side sync scripts)
CREATE POLICY "sam_opportunities_write" ON public.sam_opportunities
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sam_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
