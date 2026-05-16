import { Router } from 'express';
import { normalizeTemplateContent, normalizeVideoFormat } from '../../shared/config.js';

export function createBootstrapRoutes(db) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const [kocs, useCases, template, briefs, assignments, audienceImages, campaignPresets] = await Promise.all([
        db.query('select * from kocs order by created_at desc'),
        db.query('select * from use_cases order by created_at desc'),
        db.query('select * from brief_templates order by updated_at desc limit 1'),
        db.query('select * from briefs order by created_at desc'),
        db.query('select * from koc_use_cases'),
        db.query('select * from koc_audience_images order by created_at desc'),
        db.query('select * from campaign_presets order by created_at desc')
      ]);

      const useCaseIdsByKocId = assignments.rows.reduce((acc, row) => {
        if (!acc[row.koc_id]) acc[row.koc_id] = [];
        acc[row.koc_id].push(row.use_case_id);
        return acc;
      }, {});

      const audienceImagesByKocId = audienceImages.rows.reduce((acc, row) => {
        if (!acc[row.koc_id]) acc[row.koc_id] = [];
        acc[row.koc_id].push(row);
        return acc;
      }, {});

      const historyFields = ['tracking_link', 'license', 'notes'];
      const history = historyFields.reduce((acc, field) => {
        acc[field] = Array.from(
          new Set(
            briefs.rows
              .map(row => (row[field] || '').trim())
              .filter(Boolean)
          )
        ).slice(0, 20);
        return acc;
      }, {});

      const normalizedBriefs = briefs.rows.map(row => ({
        ...row,
        video_format: normalizeVideoFormat(row.video_format)
      }));

      res.json({
        kocs: kocs.rows.map(row => ({
          ...row,
          primary_use_case_id: row.primary_use_case_id || '',
          use_case_ids: useCaseIdsByKocId[row.id] || [],
          audience_images: audienceImagesByKocId[row.id] || []
        })),
        useCases: useCases.rows,
        template: template.rows[0]
          ? {
              ...template.rows[0],
              content: normalizeTemplateContent(template.rows[0].content)
            }
          : null,
        campaignPresets: campaignPresets.rows,
        briefs: normalizedBriefs,
        history
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
