import { Router } from 'express';

export function createTemplateRoutes(db) {
  const router = Router();

  router.put('/', async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `
        insert into brief_templates (id, name, content)
        values ('global', $1, $2)
        on conflict (id) do update set
          name = excluded.name,
          content = excluded.content,
          updated_at = now()
        returning *
        `,
        [req.body.name || 'Global Template', req.body.content || '']
      );
      res.json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
