import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';

function sanitizeFileName(fileName = '') {
  const normalized = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '-');
  return normalized || 'cover-poster.png';
}

function parseImageDataUrl(dataUrl = '') {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Image upload must be a valid base64 data URL.');
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  };
}

function normalizePresetPayload(payload = {}) {
  return {
    name: String(payload.name || '').trim(),
    trending_hook_topics: String(payload.trendingHookTopics || payload.trending_hook_topics || '').trim(),
    trending_hook_angle: String(payload.trendingHookAngle || payload.trending_hook_angle || '').trim(),
    cover_poster_url: String(payload.coverPosterUrl || payload.cover_poster_url || '').trim(),
    cover_poster_note: String(payload.coverPosterNote || payload.cover_poster_note || '').trim()
  };
}

async function findPresetById(db, id) {
  const { rows } = await db.query('select * from campaign_presets order by created_at desc');
  return rows.find(row => row.id === id) || null;
}

export function createCampaignPresetsRoutes(db, options = {}) {
  const router = Router();
  const uploadsDir = options.uploadsDir;

  router.get('/', async (_req, res, next) => {
    try {
      const { rows } = await db.query('select * from campaign_presets order by created_at desc');
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const preset = normalizePresetPayload(req.body);
      if (!preset.name) {
        return res.status(400).json({ error: 'Preset name is required' });
      }

      const id = `preset_${Date.now()}`;
      const { rows } = await db.query(
        `
        insert into campaign_presets (
          id, name, trending_hook_topics, trending_hook_angle, cover_poster_url, cover_poster_note
        ) values ($1, $2, $3, $4, $5, $6)
        returning *
        `,
        [id, preset.name, preset.trending_hook_topics, preset.trending_hook_angle, preset.cover_poster_url, preset.cover_poster_note]
      );

      res.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const preset = normalizePresetPayload(req.body);
      if (!preset.name) {
        return res.status(400).json({ error: 'Preset name is required' });
      }

      const { rows } = await db.query(
        `
        update campaign_presets set
          name = $1,
          trending_hook_topics = $2,
          trending_hook_angle = $3,
          cover_poster_url = $4,
          cover_poster_note = $5,
          updated_at = now()
        where id = $6
        returning *
        `,
        [preset.name, preset.trending_hook_topics, preset.trending_hook_angle, preset.cover_poster_url, preset.cover_poster_note, req.params.id]
      );

      if (!rows[0]) {
        return res.status(404).json({ error: 'Preset not found' });
      }

      res.json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/poster', async (req, res, next) => {
    try {
      const preset = await findPresetById(db, req.params.id);
      if (!preset) {
        return res.status(404).json({ error: 'Preset not found' });
      }
      if (!uploadsDir) {
        throw new Error('Uploads directory is not configured.');
      }

      const safeFileName = sanitizeFileName(req.body.fileName);
      const { buffer } = parseImageDataUrl(req.body.dataUrl);
      const relativeDir = path.join('campaign-presets', req.params.id);
      const absoluteDir = path.join(uploadsDir, relativeDir);
      const storedFileName = `${req.params.id}-${safeFileName}`;
      const absolutePath = path.join(absoluteDir, storedFileName);
      const fileUrl = `/${path.posix.join('uploads', 'campaign-presets', req.params.id, storedFileName)}`;

      await fs.mkdir(absoluteDir, { recursive: true });
      await fs.writeFile(absolutePath, buffer);

      const { rows } = await db.query(
        `
        update campaign_presets set
          name = $1,
          trending_hook_topics = $2,
          trending_hook_angle = $3,
          cover_poster_url = $4,
          cover_poster_note = $5,
          updated_at = now()
        where id = $6
        returning *
        `,
        [
          preset.name,
          preset.trending_hook_topics || '',
          preset.trending_hook_angle || '',
          fileUrl,
          preset.cover_poster_note || '',
          req.params.id
        ]
      );

      res.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await db.query('delete from campaign_presets where id = $1', [req.params.id]);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
