// ============================================================
// Browser-side shared config (plain <script>, sets globals).
// CANONICAL SOURCE: shared/config.js — keep in sync!
// ============================================================

/* eslint-disable no-unused-vars */

var CONTENT_TYPE_CONFIG = {
  quick_demo_video: {
    label: 'Quick Demo Video',
    campaign_goal: 'Build awareness quickly by showing the most tangible MoClaw moment in a simple, creator-native workflow.',
    recommended_hook_direction: 'Magic Moment',
    funnel_stage: 'TOFU',
    funnelStage: 'TOFU',
    primary_kpi: 'Views + AVD',
    primaryKpi: 'Views + AVD',
    cta_type: 'Free-trial CTA',
    cta: 'Use the link below to explore MoClaw and see how it fits your workflow.',
    cta_copy: 'Use the link below to explore MoClaw and see how it fits your workflow.'
  },
  deep_review_video: {
    label: 'Deep Review Video',
    campaign_goal: 'Drive qualified consideration by showing an honest before-and-after review of where MoClaw materially improves the workflow.',
    recommended_hook_direction: 'Before/After + Data-driven',
    funnel_stage: 'MOFU -> BOFU',
    funnelStage: 'MOFU -> BOFU',
    primary_kpi: 'Engagement rate + Promo code usage',
    primaryKpi: 'Engagement rate + Promo code usage',
    cta_type: 'Scenario-fit CTA',
    cta: 'If this workflow fits your process, try MoClaw with the link below and use the promo code if one is provided.',
    cta_copy: 'If this workflow fits your process, try MoClaw with the link below and use the promo code if one is provided.'
  },
  pain_point_story_video: {
    label: 'Pain Point Story Video',
    campaign_goal: 'Move viewers from problem awareness into active consideration by showing a relatable workflow pain and how MoClaw reduces the friction.',
    recommended_hook_direction: 'POV scenario',
    funnel_stage: 'TOFU -> MOFU',
    funnelStage: 'TOFU -> MOFU',
    primary_kpi: 'Comment quality + Saves',
    primaryKpi: 'Comment quality + Saves',
    cta_type: 'Problem-solution CTA',
    cta: 'If you deal with the same problem, try MoClaw through the link below and see whether it improves your workflow.',
    cta_copy: 'If you deal with the same problem, try MoClaw through the link below and see whether it improves your workflow.'
  },
  tutorial_how_to_video: {
    label: 'Tutorial / How-to Video',
    campaign_goal: 'Drive qualified consideration and sign-ups by walking viewers through a repeatable MoClaw workflow they can copy for themselves.',
    recommended_hook_direction: 'Data-driven + Magic Moment',
    funnel_stage: 'MOFU -> BOFU',
    funnelStage: 'MOFU -> BOFU',
    primary_kpi: 'Link clicks + Sign-ups',
    primaryKpi: 'Link clicks + Sign-ups',
    cta_type: 'Guided sign-up CTA',
    cta: 'Use the link below to sign up for MoClaw and test this exact workflow yourself.',
    cta_copy: 'Use the link below to sign up for MoClaw and test this exact workflow yourself.'
  }
};

var FUNNEL_STAGE_CAMPAIGN_GOALS = {
  TOFU: 'Build awareness among relevant audiences by showing what MoClaw helps with in a simple, real-life workflow.',
  'TOFU -> MOFU': 'Move viewers from initial interest to active consideration by showing where MoClaw fits into a real workflow and why it is useful.',
  'MOFU -> BOFU': 'Drive qualified consideration and sign-ups by demonstrating a practical workflow where MoClaw clearly improves the outcome.'
};

var PAYMENT_SCHEDULE_CONFIG = {
  split_20_script_80_live: '20% of the total fee will be paid after the draft video is reviewed and approved. The remaining 80% will be paid after the video goes live and a valid invoice is received.',
  split_30_script_70_live: '30% of the total fee will be paid after the draft video is reviewed and approved. The remaining 70% will be paid after the video goes live and a valid invoice is received.',
  split_50_script_50_live: '50% of the total fee will be paid after the draft video is reviewed and approved. The remaining 50% will be paid after the video goes live and a valid invoice is received.'
};

var PAYMENT_SCHEDULE_LABELS = {
  split_20_script_80_live: '20 / 80 split (draft / live)',
  split_30_script_70_live: '30 / 70 split (draft / live)',
  split_50_script_50_live: '50 / 50 split (draft / live)'
};

function normalizeVideoFormat(value) {
  var text = String(value || '').trim();
  if (!text) return '';
  var compact = text.toLowerCase().replace(/\s+/g, '');
  return /^(\d+)(min|mins|minute|minutes)$/.test(compact) ? '' : text;
}

function normalizeTemplateContent(content) {
  return String(content || '')
    .replace(/\n- @MoClaw AI/g, '')
    .replace(/\n- #MoClaw AI/g, '');
}

function buildAgreementPaymentClause(paymentMethod, paymentScheduleType) {
  var lines = [];
  var scheduleClause = PAYMENT_SCHEDULE_CONFIG[paymentScheduleType || ''] || '';
  if (scheduleClause) lines.push(scheduleClause);
  if (paymentMethod) lines.push('Available payment method: ' + paymentMethod + '.');
  return lines.join(' ').trim();
}
