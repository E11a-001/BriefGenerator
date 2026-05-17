import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveBriefHandler } from '../../server/routes/briefs.js';

async function invokeJsonRoute(handler, req = {}) {
  let statusCode = 200;
  let jsonBody;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      jsonBody = body;
      return this;
    },
    end() {
      return this;
    }
  };

  await handler(req, res, error => {
    throw error;
  });

  return { statusCode, jsonBody };
}

test('PUT /api/briefs/:kocId saves explicit brief payload', async () => {
  const calls = [];
  const db = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('insert into briefs')) {
        return {
          rows: [{ koc_id: 'koc_1', compensation: '$500', currency: 'USD' }]
        };
      }
      return { rows: [] };
    }
  };

  const handler = createSaveBriefHandler(db);

  const response = await invokeJsonRoute(handler, {
    params: { kocId: 'koc_1' },
    body: {
      templateId: 'global',
      campaignPresetId: 'preset_1',
      compensation: '$500',
      currency: 'USD',
      paymentMethod: 'PayPal',
      paymentScheduleType: 'split_50_script_50_live',
      scriptApprovalRequired: 'Yes',
      scriptRevisionRounds: '2 rounds',
      videoRevisionRounds: '1 round',
      scriptReviewNotes: 'Script must be approved before filming.',
      scriptDeadline: '2026-04-18',
      draftDeadline: '2026-04-20',
      publishDeadline: '2026-04-28',
      contentType: 'tutorial_how_to_video',
      videoDuration: '8-12 min',
      primaryKpi: 'Link clicks + Sign-ups',
      primaryAudience: 'Creators and operators looking for practical AI workflows',
      postingRetentionPeriod: '60 days',
      postPublishEditRule: 'No deletion, unlisting, or material edits without prior written approval during the retention period',
      categoryExclusivityWindow: '14 days before and 14 days after',
      otherSponsorMentionRule: 'No competing sponsor mention in the same content',
      videoFormat: 'Screen recording + voice-over',
      trendingHookTopics: 'DeepSeek, Grok 3',
      trendingHookAngle: 'Compare the trend with daily creator workflows.',
      trackingLink: 'https://moclaw.ai',
      promoCode: '',
      license: '',
      licenseDuration: '60 days',
      licenseRegion: 'Global',
      coverPosterUrl: 'https://example.com/poster.png',
      coverPosterNote: 'Use this as the thumbnail reference.',
      cta: 'Direct viewers to the link in description and mention the promo code in the outro.',
      notes: ''
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length > 0, true);
  assert.deepEqual(calls[0].params.slice(0, 23), [
    'brief_koc_1',
    'koc_1',
    'global',
    'preset_1',
    '$500',
    'USD',
    'PayPal',
    '50% of the total fee will be paid after the draft video is reviewed and approved. The remaining 50% will be paid after the video goes live and a valid invoice is received.',
    'split_50_script_50_live',
    'Yes',
    '2 rounds',
    '1 round',
    'Script must be approved before filming.',
    '2026-04-18',
    '2026-04-20',
    '2026-04-28',
    'Drive qualified consideration and sign-ups by walking viewers through a repeatable MoClaw workflow they can copy for themselves.',
    'tutorial_how_to_video',
    'Link clicks + Sign-ups',
    'Creators and operators looking for practical AI workflows',
    '60 days',
    'No deletion, unlisting, or material edits without prior written approval during the retention period',
    '14 days before and 14 days after'
  ]);
  assert.equal(calls[0].params[23], 'No competing sponsor mention in the same content');
  assert.equal(calls[0].params[18], 'Link clicks + Sign-ups');
  assert.equal(calls[0].params[27], 'DeepSeek, Grok 3');
  assert.equal(calls[0].params[28], 'Compare the trend with daily creator workflows.');
  assert.equal(calls[0].params[34], 'https://example.com/poster.png');
  assert.equal(calls[0].params[35], 'Use this as the thumbnail reference.');
  assert.equal(calls[0].params[36], 'Direct viewers to the link in description and mention the promo code in the outro.');
});

test('PUT /api/briefs/:kocId uses a distinct campaign goal for deep review content', async () => {
  const calls = [];
  const db = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return {
        rows: [{ koc_id: 'koc_4', campaign_goal: params[16] }]
      };
    }
  };

  const handler = createSaveBriefHandler(db);

  const response = await invokeJsonRoute(handler, {
    params: { kocId: 'koc_4' },
    body: {
      templateId: 'global',
      compensation: '$350',
      currency: 'USD',
      paymentMethod: 'PayPal',
      paymentScheduleType: 'split_50_script_50_live',
      contentType: 'deep_review_video'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length > 0, true);
  assert.equal(
    calls[0].params[16],
    'Drive qualified consideration by showing an honest before-and-after review of where MoClaw materially improves the workflow.'
  );
});

test('PUT /api/briefs/:kocId drops duration-only additional format specs', async () => {
  const calls = [];
  const db = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return {
        rows: [{ koc_id: 'koc_2', video_format: '' }]
      };
    }
  };

  const handler = createSaveBriefHandler(db);

  const response = await invokeJsonRoute(handler, {
    params: { kocId: 'koc_2' },
    body: {
      templateId: 'global',
      compensation: '$200',
      currency: 'USD',
      paymentMethod: 'Bank Transfer',
      paymentScheduleType: 'split_30_script_70_live',
      contentType: 'quick_demo_video',
      videoFormat: '8 min'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length > 0, true);
  assert.equal(calls[0].params[24], '');
});

test('PUT /api/briefs/:kocId saves video duration as a dedicated field', async () => {
  const calls = [];
  const db = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return {
        rows: [{ koc_id: 'koc_3', video_duration: '3-5 min' }]
      };
    }
  };

  const handler = createSaveBriefHandler(db);

  const response = await invokeJsonRoute(handler, {
    params: { kocId: 'koc_3' },
    body: {
      templateId: 'global',
      compensation: '$200',
      currency: 'USD',
      paymentMethod: 'Bank Transfer',
      paymentScheduleType: 'split_30_script_70_live',
      contentType: 'pain_point_story_video',
      videoDuration: '3-5 min',
      videoFormat: 'Talking head + screen recording'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length > 0, true);
  assert.equal(calls[0].params[25], '3-5 min');
});
