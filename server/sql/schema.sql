create table if not exists kocs (
  id text primary key,
  name text not null,
  platform text not null,
  email text not null default '',
  channel_url text not null default '',
  audience_profile_text text not null default '',
  primary_use_case_id text not null default '',
  status text not null,
  draft_video_url text not null default '',
  script_value text not null default '',
  final_video_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists kocs
  add column if not exists audience_profile_text text not null default '';
alter table if exists kocs
  add column if not exists primary_use_case_id text not null default '';

create table if not exists use_cases (
  id text primary key,
  title text not null,
  description text not null default '',
  opening_hook text not null default '',
  who_this_is_for text not null default '',
  problem text not null default '',
  how_to_show_it text not null default '',
  expected_outcome text not null default '',
  must_show_elements text not null default '',
  suggested_elements_json jsonb not null default '[]'::jsonb,
  reference_materials_json jsonb not null default '[]'::jsonb,
  ai_context_json jsonb not null default '{}'::jsonb,
  links_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists use_cases
  add column if not exists opening_hook text not null default '';
alter table if exists use_cases
  add column if not exists who_this_is_for text not null default '';
alter table if exists use_cases
  add column if not exists problem text not null default '';
alter table if exists use_cases
  add column if not exists how_to_show_it text not null default '';
alter table if exists use_cases
  add column if not exists expected_outcome text not null default '';
alter table if exists use_cases
  add column if not exists must_show_elements text not null default '';
alter table if exists use_cases
  add column if not exists suggested_elements_json jsonb not null default '[]'::jsonb;
alter table if exists use_cases
  add column if not exists reference_materials_json jsonb not null default '[]'::jsonb;
alter table if exists use_cases
  add column if not exists ai_context_json jsonb not null default '{}'::jsonb;

create table if not exists koc_use_cases (
  koc_id text not null references kocs(id) on delete cascade,
  use_case_id text not null references use_cases(id) on delete cascade,
  primary key (koc_id, use_case_id)
);

create table if not exists koc_audience_images (
  id text primary key,
  koc_id text not null references kocs(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists brief_templates (
  id text primary key,
  name text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_presets (
  id text primary key,
  name text not null,
  trending_hook_topics text not null default '',
  trending_hook_angle text not null default '',
  cover_poster_url text not null default '',
  cover_poster_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists briefs (
  id text primary key,
  koc_id text not null unique references kocs(id) on delete cascade,
  template_id text references brief_templates(id) on delete set null,
  campaign_preset_id text not null default '',
  compensation text not null default '',
  currency text not null default 'USD',
  payment_method text not null default '',
  payment_terms text not null default '',
  payment_schedule_type text not null default '',
  script_approval_required text not null default 'Yes',
  script_revision_rounds text not null default '',
  video_revision_rounds text not null default '',
  script_review_notes text not null default '',
  script_deadline text not null default '',
  draft_deadline text not null default '',
  publish_deadline text not null default '',
  campaign_goal text not null default '',
  content_type text not null default '',
  primary_kpi text not null default '',
  primary_audience text not null default '',
  posting_retention_period text not null default '',
  post_publish_edit_rule text not null default '',
  category_exclusivity_window text not null default '',
  other_sponsor_mention_rule text not null default '',
  video_format text not null default '',
  video_duration text not null default '',
  language text not null default '',
  trending_hook_topics text not null default '',
  trending_hook_angle text not null default '',
  tracking_link text not null default '',
  promo_code text not null default '',
  license text not null default '',
  license_duration text not null default '',
  license_region text not null default '',
  cover_poster_url text not null default '',
  cover_poster_note text not null default '',
  cta text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists briefs
  add column if not exists campaign_preset_id text not null default '';
alter table if exists briefs
  add column if not exists script_deadline text not null default '';
alter table if exists briefs
  add column if not exists campaign_goal text not null default '';
alter table if exists briefs
  add column if not exists payment_schedule_type text not null default '';
alter table if exists briefs
  add column if not exists payment_method text not null default '';
alter table if exists briefs
  add column if not exists content_type text not null default '';
alter table if exists briefs
  add column if not exists primary_kpi text not null default '';
alter table if exists briefs
  add column if not exists primary_audience text not null default '';
alter table if exists briefs
  add column if not exists posting_retention_period text not null default '';
alter table if exists briefs
  add column if not exists post_publish_edit_rule text not null default '';
alter table if exists briefs
  add column if not exists category_exclusivity_window text not null default '';
alter table if exists briefs
  add column if not exists other_sponsor_mention_rule text not null default '';
alter table if exists briefs
  add column if not exists license_duration text not null default '';
alter table if exists briefs
  add column if not exists license_region text not null default '';
alter table if exists briefs
  add column if not exists cta text not null default '';
alter table if exists briefs
  add column if not exists video_duration text not null default '';
alter table if exists briefs
  add column if not exists language text not null default '';
alter table if exists briefs
  add column if not exists trending_hook_topics text not null default '';
alter table if exists briefs
  add column if not exists trending_hook_angle text not null default '';
alter table if exists briefs
  add column if not exists cover_poster_url text not null default '';
alter table if exists briefs
  add column if not exists cover_poster_note text not null default '';

create table if not exists agreements (
  id text primary key,
  koc_id text not null unique references kocs(id) on delete cascade,
  template_version text not null,
  field_values_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoices (
  id text primary key,
  koc_id text not null unique references kocs(id) on delete cascade,
  template_version text not null,
  field_values_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
