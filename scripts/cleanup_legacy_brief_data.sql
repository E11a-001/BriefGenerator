update brief_templates
set content = replace(
  replace(
    replace(content, E'\n- MoClaw', E'\n- Moclaw'),
    E'\n- @MoClaw AI',
    ''
  ),
  E'\n- #MoClaw AI',
  ''
)
where id = 'global';

update briefs
set video_format = ''
where lower(regexp_replace(coalesce(video_format, ''), '\s+', '', 'g')) ~ '^[0-9]+(min|mins|minute|minutes)$';
