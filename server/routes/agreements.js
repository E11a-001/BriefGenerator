import { Router } from 'express';

export function createSaveAgreementHandler(db) {
  return async function saveAgreement(req, res, next) {
    try {
      const payload = req.body || {};
      const { rows } = await db.query(
        `
        insert into agreements (id, koc_id, template_version, field_values_json)
        values ($1, $2, $3, $4::jsonb)
        on conflict (koc_id) do update set
          template_version = excluded.template_version,
          field_values_json = excluded.field_values_json,
          updated_at = now()
        returning *
        `,
        [
          `agreement_${req.params.kocId}`,
          req.params.kocId,
          payload.templateVersion || 'agreement_v1',
          JSON.stringify(payload.fields || {})
        ]
      );

      res.json(rows[0]);
    } catch (error) {
      next(error);
    }
  };
}

export function createAgreementRoutes(db) {
  const router = Router();

  router.get('/:kocId', async (req, res, next) => {
    try {
      const { rows } = await db.query(
        'select * from agreements where koc_id = $1 limit 1',
        [req.params.kocId]
      );
      res.json(rows[0] || null);
    } catch (error) {
      next(error);
    }
  });

  router.put('/:kocId', createSaveAgreementHandler(db));

  return router;
}
