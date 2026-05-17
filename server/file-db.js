import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_STATE = {
  kocs: [],
  use_cases: [],
  koc_use_cases: [],
  koc_audience_images: [],
  brief_templates: [],
  campaign_presets: [],
  briefs: [],
  agreements: [],
  invoices: []
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function now() {
  return new Date().toISOString();
}

function sortByTimestampDesc(rows, field = 'created_at') {
  return [...rows].sort((left, right) => String(right[field] || '').localeCompare(String(left[field] || '')));
}

function normalizeSql(sql = '') {
  return String(sql || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function withTimestamps(record, previous = null) {
  const timestamp = now();
  return {
    ...record,
    created_at: previous?.created_at || record.created_at || timestamp,
    updated_at: record.updated_at || timestamp
  };
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function createEmptyResult(rows = []) {
  return {
    rows,
    rowCount: rows.length
  };
}

function createDefaultKoc(record) {
  return withTimestamps({
    audience_profile_text: '',
    channel_url: '',
    draft_video_url: '',
    email: '',
    final_video_url: '',
    primary_use_case_id: '',
    script_value: '',
    status: 'draft',
    ...record
  });
}

function createDefaultUseCase(record) {
  return withTimestamps({
    description: '',
    opening_hook: '',
    expected_outcome: '',
    how_to_show_it: '',
    links_json: [],
    reference_materials_json: [],
    ai_context_json: {},
    must_show_elements: '',
    suggested_elements_json: [],
    problem: '',
    who_this_is_for: '',
    ...record
  });
}

function createDefaultTemplate(record) {
  return withTimestamps({
    name: 'Global Template',
    content: '',
    ...record
  });
}

function createDefaultCampaignPreset(record) {
  return withTimestamps({
    name: '',
    trending_hook_topics: '',
    trending_hook_angle: '',
    cover_poster_url: '',
    cover_poster_note: '',
    ...record
  });
}

function createDefaultBrief(record) {
  return withTimestamps({
    template_id: 'global',
    campaign_preset_id: '',
    compensation: '',
    currency: 'USD',
    payment_method: '',
    payment_terms: '',
    payment_schedule_type: '',
    script_approval_required: 'Yes',
    script_revision_rounds: '',
    video_revision_rounds: '',
    script_review_notes: '',
    script_deadline: '',
    draft_deadline: '',
    publish_deadline: '',
    campaign_goal: '',
    content_type: '',
    primary_kpi: '',
    primary_audience: '',
    posting_retention_period: '',
    post_publish_edit_rule: '',
    category_exclusivity_window: '',
    other_sponsor_mention_rule: '',
    video_format: '',
    video_duration: '',
    language: '',
    trending_hook_topics: '',
    trending_hook_angle: '',
    tracking_link: '',
    promo_code: '',
    license: '',
    license_duration: '',
    license_region: '',
    cover_poster_url: '',
    cover_poster_note: '',
    cta: '',
    notes: '',
    ...record
  });
}

function createDefaultDocument(record) {
  return withTimestamps({
    template_version: '',
    field_values_json: {},
    ...record
  });
}

function removeById(rows, id) {
  return rows.filter(row => row.id !== id);
}

export class FileDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = null;
    this.writeQueue = Promise.resolve();
  }

  async query(sql, params = []) {
    const state = await this.loadState();
    const result = this.execute(state, sql, params);
    if (result.changed) {
      await this.saveState(state);
    }
    return result.response;
  }

  async connect() {
    const state = await this.loadState();
    return new FileDatabaseClient(this, clone(state));
  }

  async loadState() {
    if (this.state) return this.state;

    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.state = {
        ...clone(DEFAULT_STATE),
        ...parsed,
        use_cases: ensureArray(parsed.use_cases).map(row => createDefaultUseCase(row))
      };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.state = clone(DEFAULT_STATE);
      await this.saveState(this.state);
    }

    return this.state;
  }

  async saveState(nextState) {
    this.state = nextState;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const payload = JSON.stringify(nextState, null, 2);
    this.writeQueue = this.writeQueue.then(() => fs.writeFile(this.filePath, payload));
    await this.writeQueue;
  }

  async replaceState(nextState) {
    await this.saveState(nextState);
  }

  execute(state, sql, params = []) {
    const normalized = normalizeSql(sql);

    if (normalized === 'begin' || normalized === 'commit' || normalized === 'rollback') {
      return { changed: false, response: createEmptyResult() };
    }

    if (normalized === 'select * from kocs order by created_at desc') {
      return { changed: false, response: createEmptyResult(sortByTimestampDesc(state.kocs)) };
    }

    if (normalized === 'select * from use_cases order by created_at desc') {
      return { changed: false, response: createEmptyResult(sortByTimestampDesc(state.use_cases)) };
    }

    if (normalized === 'select * from brief_templates order by updated_at desc limit 1') {
      return { changed: false, response: createEmptyResult(sortByTimestampDesc(state.brief_templates, 'updated_at').slice(0, 1)) };
    }

    if (normalized === 'select * from campaign_presets order by created_at desc') {
      return { changed: false, response: createEmptyResult(sortByTimestampDesc(state.campaign_presets)) };
    }

    if (normalized === 'select * from briefs order by created_at desc') {
      return { changed: false, response: createEmptyResult(sortByTimestampDesc(state.briefs)) };
    }

    if (normalized === 'select * from koc_use_cases') {
      return { changed: false, response: createEmptyResult(clone(state.koc_use_cases)) };
    }

    if (normalized === 'select * from koc_audience_images order by created_at desc') {
      return { changed: false, response: createEmptyResult(sortByTimestampDesc(state.koc_audience_images)) };
    }

    if (normalized === 'select * from koc_audience_images where id = $1 and koc_id = $2 limit 1') {
      const rows = state.koc_audience_images.filter(row => row.id === params[0] && row.koc_id === params[1]).slice(0, 1);
      return { changed: false, response: createEmptyResult(clone(rows)) };
    }

    if (normalized === 'select * from briefs where koc_id = $1 limit 1') {
      const rows = state.briefs.filter(row => row.koc_id === params[0]).slice(0, 1);
      return { changed: false, response: createEmptyResult(clone(rows)) };
    }

    if (normalized === 'select * from agreements where koc_id = $1 limit 1') {
      const rows = state.agreements.filter(row => row.koc_id === params[0]).slice(0, 1);
      return { changed: false, response: createEmptyResult(clone(rows)) };
    }

    if (normalized === 'select * from invoices where koc_id = $1 limit 1') {
      const rows = state.invoices.filter(row => row.koc_id === params[0]).slice(0, 1);
      return { changed: false, response: createEmptyResult(clone(rows)) };
    }

    if (normalized.startsWith('insert into kocs')) {
      const row = createDefaultKoc({
        id: params[0],
        name: params[1],
        platform: params[2],
        email: params[3],
        channel_url: params[4]
      });
      state.kocs.unshift(row);
      return { changed: true, response: createEmptyResult([clone(row)]) };
    }

    if (normalized.startsWith('update kocs set ')) {
      const match = normalized.match(/^update kocs set ([a-z_]+) = \$1, updated_at = now\(\) where id = \$2 returning \*$/);
      if (!match) {
        throw new Error(`Unsupported file-db query: ${sql}`);
      }

      const index = state.kocs.findIndex(row => row.id === params[1]);
      if (index === -1) {
        return { changed: false, response: createEmptyResult() };
      }

      state.kocs[index] = withTimestamps({
        ...state.kocs[index],
        [match[1]]: params[0]
      }, state.kocs[index]);
      return { changed: true, response: createEmptyResult([clone(state.kocs[index])]) };
    }

    if (normalized === 'delete from kocs where id = $1') {
      const id = params[0];
      state.kocs = removeById(state.kocs, id);
      state.briefs = state.briefs.filter(row => row.koc_id !== id);
      state.agreements = state.agreements.filter(row => row.koc_id !== id);
      state.invoices = state.invoices.filter(row => row.koc_id !== id);
      state.koc_use_cases = state.koc_use_cases.filter(row => row.koc_id !== id);
      state.koc_audience_images = state.koc_audience_images.filter(row => row.koc_id !== id);
      return { changed: true, response: createEmptyResult() };
    }

    if (normalized.startsWith('insert into koc_audience_images')) {
      const row = withTimestamps({
        id: params[0],
        koc_id: params[1],
        file_name: params[2],
        file_url: params[3]
      });
      state.koc_audience_images.unshift(row);
      return { changed: true, response: createEmptyResult([clone(row)]) };
    }

    if (normalized === 'delete from koc_audience_images where id = $1 and koc_id = $2') {
      state.koc_audience_images = state.koc_audience_images.filter(
        row => !(row.id === params[0] && row.koc_id === params[1])
      );
      return { changed: true, response: createEmptyResult() };
    }

    if (normalized === 'delete from koc_use_cases where koc_id = $1') {
      state.koc_use_cases = state.koc_use_cases.filter(row => row.koc_id !== params[0]);
      return { changed: true, response: createEmptyResult() };
    }

    if (normalized === 'insert into koc_use_cases (koc_id, use_case_id) values ($1, $2)') {
      const alreadyExists = state.koc_use_cases.some(
        row => row.koc_id === params[0] && row.use_case_id === params[1]
      );
      if (!alreadyExists) {
        state.koc_use_cases.push({
          koc_id: params[0],
          use_case_id: params[1]
        });
      }
      return { changed: !alreadyExists, response: createEmptyResult() };
    }

    if (normalized.startsWith('insert into use_cases')) {
      const row = createDefaultUseCase({
        id: params[0],
        title: params[1],
        description: params[2],
        opening_hook: params[3],
        who_this_is_for: params[4],
        problem: params[5],
        how_to_show_it: params[6],
        expected_outcome: params[7],
        must_show_elements: params[8],
        suggested_elements_json: JSON.parse(params[9] || '[]'),
        reference_materials_json: JSON.parse(params[10] || '[]'),
        ai_context_json: JSON.parse(params[11] || '{}'),
        links_json: JSON.parse(params[12] || '[]')
      });
      state.use_cases.unshift(row);
      return { changed: true, response: createEmptyResult([clone(row)]) };
    }

    if (normalized.startsWith('update use_cases set')) {
      const index = state.use_cases.findIndex(row => row.id === params[12]);
      if (index === -1) {
        return { changed: false, response: createEmptyResult() };
      }

      state.use_cases[index] = withTimestamps({
        ...state.use_cases[index],
        title: params[0],
        description: params[1],
        opening_hook: params[2],
        who_this_is_for: params[3],
        problem: params[4],
        how_to_show_it: params[5],
        expected_outcome: params[6],
        must_show_elements: params[7],
        suggested_elements_json: JSON.parse(params[8] || '[]'),
        reference_materials_json: JSON.parse(params[9] || '[]'),
        ai_context_json: JSON.parse(params[10] || '{}'),
        links_json: JSON.parse(params[11] || '[]')
      }, state.use_cases[index]);
      return { changed: true, response: createEmptyResult([clone(state.use_cases[index])]) };
    }

    if (normalized === 'delete from use_cases where id = $1') {
      const id = params[0];
      state.use_cases = removeById(state.use_cases, id);
      state.koc_use_cases = state.koc_use_cases.filter(row => row.use_case_id !== id);
      return { changed: true, response: createEmptyResult() };
    }

    if (normalized.startsWith('insert into brief_templates')) {
      const existingIndex = state.brief_templates.findIndex(row => row.id === 'global');
      const previous = existingIndex === -1 ? null : state.brief_templates[existingIndex];
      const row = createDefaultTemplate({
        id: 'global',
        name: params[0],
        content: params[1]
      });
      row.created_at = previous?.created_at || row.created_at;

      if (existingIndex === -1) {
        state.brief_templates.unshift(row);
      } else {
        state.brief_templates[existingIndex] = row;
      }

      return { changed: true, response: createEmptyResult([clone(row)]) };
    }

    if (normalized.startsWith('insert into campaign_presets')) {
      const existingIndex = state.campaign_presets.findIndex(row => row.id === params[0]);
      const previous = existingIndex === -1 ? null : state.campaign_presets[existingIndex];
      const row = createDefaultCampaignPreset({
        id: params[0],
        name: params[1],
        trending_hook_topics: params[2],
        trending_hook_angle: params[3],
        cover_poster_url: params[4],
        cover_poster_note: params[5]
      });
      row.created_at = previous?.created_at || row.created_at;

      if (existingIndex === -1) {
        state.campaign_presets.unshift(row);
      } else {
        state.campaign_presets[existingIndex] = row;
      }

      return { changed: true, response: createEmptyResult([clone(row)]) };
    }

    if (normalized.startsWith('update campaign_presets set')) {
      const index = state.campaign_presets.findIndex(row => row.id === params[5]);
      if (index === -1) {
        return { changed: false, response: createEmptyResult() };
      }

      state.campaign_presets[index] = withTimestamps({
        ...state.campaign_presets[index],
        name: params[0],
        trending_hook_topics: params[1],
        trending_hook_angle: params[2],
        cover_poster_url: params[3],
        cover_poster_note: params[4]
      }, state.campaign_presets[index]);

      return { changed: true, response: createEmptyResult([clone(state.campaign_presets[index])]) };
    }

    if (normalized === 'delete from campaign_presets where id = $1') {
      state.campaign_presets = removeById(state.campaign_presets, params[0]);
      return { changed: true, response: createEmptyResult() };
    }

    if (normalized.startsWith('insert into briefs')) {
      const existingIndex = state.briefs.findIndex(row => row.koc_id === params[1]);
      const previous = existingIndex === -1 ? null : state.briefs[existingIndex];
      const row = createDefaultBrief({
        id: params[0],
        koc_id: params[1],
        template_id: params[2],
        campaign_preset_id: params[3],
        compensation: params[4],
        currency: params[5],
        payment_method: params[6],
        payment_terms: params[7],
        payment_schedule_type: params[8],
        script_approval_required: params[9],
        script_revision_rounds: params[10],
        video_revision_rounds: params[11],
        script_review_notes: params[12],
        script_deadline: params[13],
        draft_deadline: params[14],
        publish_deadline: params[15],
        campaign_goal: params[16],
        content_type: params[17],
        primary_kpi: params[18],
        primary_audience: params[19],
        posting_retention_period: params[20],
        post_publish_edit_rule: params[21],
        category_exclusivity_window: params[22],
        other_sponsor_mention_rule: params[23],
        video_format: params[24],
        video_duration: params[25],
        language: params[26],
        trending_hook_topics: params[27],
        trending_hook_angle: params[28],
        tracking_link: params[29],
        promo_code: params[30],
        license: params[31],
        license_duration: params[32],
        license_region: params[33],
        cover_poster_url: params[34],
        cover_poster_note: params[35],
        cta: params[36],
        notes: params[37]
      });
      row.created_at = previous?.created_at || row.created_at;

      if (existingIndex === -1) {
        state.briefs.unshift(row);
      } else {
        state.briefs[existingIndex] = row;
      }

      return { changed: true, response: createEmptyResult([clone(row)]) };
    }

    if (normalized.startsWith('insert into agreements')) {
      const existingIndex = state.agreements.findIndex(row => row.koc_id === params[1]);
      const previous = existingIndex === -1 ? null : state.agreements[existingIndex];
      const row = createDefaultDocument({
        id: params[0],
        koc_id: params[1],
        template_version: params[2],
        field_values_json: JSON.parse(params[3] || '{}')
      });
      row.created_at = previous?.created_at || row.created_at;

      if (existingIndex === -1) {
        state.agreements.unshift(row);
      } else {
        state.agreements[existingIndex] = row;
      }

      return { changed: true, response: createEmptyResult([clone(row)]) };
    }

    if (normalized.startsWith('insert into invoices')) {
      const existingIndex = state.invoices.findIndex(row => row.koc_id === params[1]);
      const previous = existingIndex === -1 ? null : state.invoices[existingIndex];
      const row = createDefaultDocument({
        id: params[0],
        koc_id: params[1],
        template_version: params[2],
        field_values_json: JSON.parse(params[3] || '{}')
      });
      row.created_at = previous?.created_at || row.created_at;

      if (existingIndex === -1) {
        state.invoices.unshift(row);
      } else {
        state.invoices[existingIndex] = row;
      }

      return { changed: true, response: createEmptyResult([clone(row)]) };
    }

    throw new Error(`Unsupported file-db query: ${sql}`);
  }
}

class FileDatabaseClient {
  constructor(database, state) {
    this.database = database;
    this.state = state;
  }

  async query(sql, params = []) {
    const normalized = normalizeSql(sql);

    if (normalized === 'begin') {
      return createEmptyResult();
    }

    if (normalized === 'rollback') {
      const latest = await this.database.loadState();
      this.state = clone(latest);
      return createEmptyResult();
    }

    if (normalized === 'commit') {
      await this.database.replaceState(this.state);
      return createEmptyResult();
    }

    const result = this.database.execute(this.state, sql, params);
    return result.response;
  }

  release() {}
}
