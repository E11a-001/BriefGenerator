import { Router } from 'express';
import {
  CONTENT_TYPE_CONFIG,
  FUNNEL_STAGE_CAMPAIGN_GOALS,
  PAYMENT_SCHEDULE_CONFIG,
  normalizeVideoFormat
} from '../../shared/config.js';

export function createSaveBriefHandler(db) {
  return async function saveBrief(req, res, next) {
    try {
      const payload = req.body;
      const strategy = CONTENT_TYPE_CONFIG[payload.contentType] || {};
      const resolvedCampaignGoal = payload.campaignGoal || strategy.campaign_goal || FUNNEL_STAGE_CAMPAIGN_GOALS[strategy.funnelStage] || '';
      const resolvedPaymentTerms = PAYMENT_SCHEDULE_CONFIG[payload.paymentScheduleType] || payload.paymentTerms || '';
      const resolvedPrimaryKpi = payload.primaryKpi || '';
      const resolvedCta = payload.cta || '';

      const { rows } = await db.query(
        `
        insert into briefs (
          id, koc_id, template_id, campaign_preset_id, compensation, currency, payment_method, payment_terms,
          payment_schedule_type,
          script_approval_required, script_revision_rounds, video_revision_rounds, script_review_notes,
          script_deadline, draft_deadline, publish_deadline, campaign_goal, content_type, primary_kpi, primary_audience,
          posting_retention_period, post_publish_edit_rule, category_exclusivity_window, other_sponsor_mention_rule, video_format, video_duration, language, trending_hook_topics, trending_hook_angle, tracking_link,
          promo_code, license, license_duration, license_region, cover_poster_url, cover_poster_note, cta, notes
        ) values (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29,
          $30, $31, $32, $33, $34, $35, $36, $37, $38
        )
        on conflict (koc_id) do update set
          template_id = excluded.template_id,
          campaign_preset_id = excluded.campaign_preset_id,
          compensation = excluded.compensation,
          currency = excluded.currency,
          payment_method = excluded.payment_method,
          payment_terms = excluded.payment_terms,
          payment_schedule_type = excluded.payment_schedule_type,
          script_approval_required = excluded.script_approval_required,
          script_revision_rounds = excluded.script_revision_rounds,
          video_revision_rounds = excluded.video_revision_rounds,
          script_review_notes = excluded.script_review_notes,
          script_deadline = excluded.script_deadline,
          draft_deadline = excluded.draft_deadline,
          publish_deadline = excluded.publish_deadline,
          campaign_goal = excluded.campaign_goal,
          content_type = excluded.content_type,
          primary_kpi = excluded.primary_kpi,
          primary_audience = excluded.primary_audience,
          posting_retention_period = excluded.posting_retention_period,
          post_publish_edit_rule = excluded.post_publish_edit_rule,
          category_exclusivity_window = excluded.category_exclusivity_window,
          other_sponsor_mention_rule = excluded.other_sponsor_mention_rule,
          video_format = excluded.video_format,
          video_duration = excluded.video_duration,
          language = excluded.language,
          trending_hook_topics = excluded.trending_hook_topics,
          trending_hook_angle = excluded.trending_hook_angle,
          tracking_link = excluded.tracking_link,
          promo_code = excluded.promo_code,
          license = excluded.license,
          license_duration = excluded.license_duration,
          license_region = excluded.license_region,
          cover_poster_url = excluded.cover_poster_url,
          cover_poster_note = excluded.cover_poster_note,
          cta = excluded.cta,
          notes = excluded.notes,
          updated_at = now()
        returning *
        `,
        [
          `brief_${req.params.kocId}`,
          req.params.kocId,
          payload.templateId || 'global',
          payload.campaignPresetId || '',
          payload.compensation || '',
          payload.currency || 'USD',
          payload.paymentMethod || '',
          resolvedPaymentTerms,
          payload.paymentScheduleType || '',
          payload.scriptApprovalRequired || 'Yes',
          payload.scriptRevisionRounds || '',
          payload.videoRevisionRounds || '',
          payload.scriptReviewNotes || '',
          payload.scriptDeadline || '',
          payload.draftDeadline || '',
          payload.publishDeadline || '',
          resolvedCampaignGoal,
          payload.contentType || '',
          resolvedPrimaryKpi,
          payload.primaryAudience || '',
          payload.postingRetentionPeriod || '',
          payload.postPublishEditRule || '',
          payload.categoryExclusivityWindow || '',
          payload.otherSponsorMentionRule || '',
          normalizeVideoFormat(payload.videoFormat),
          payload.videoDuration || '',
          payload.language || '',
          payload.trendingHookTopics || '',
          payload.trendingHookAngle || '',
          payload.trackingLink || '',
          payload.promoCode || '',
          payload.license || '',
          payload.licenseDuration || '',
          payload.licenseRegion || '',
          payload.coverPosterUrl || '',
          payload.coverPosterNote || '',
          resolvedCta,
          payload.notes || ''
        ]
      );

      res.json(rows[0]);
    } catch (error) {
      next(error);
    }
  };
}

export function createBriefRoutes(db) {
  const router = Router();

  router.get('/:kocId', async (req, res, next) => {
    try {
      const { rows } = await db.query(
        'select * from briefs where koc_id = $1 limit 1',
        [req.params.kocId]
      );
      res.json(rows[0] || null);
    } catch (error) {
      next(error);
    }
  });

  router.put('/:kocId', createSaveBriefHandler(db));

  return router;
}
