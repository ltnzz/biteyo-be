-- Drop kolom bites.is_trending: tidak pernah dibaca oleh query mana pun.
-- Status trending kini selalu dihitung dari views/likes/comments
-- (lihat src/utils/viral.js dan functional index di 0011).

drop index if exists public.bites_is_trending_idx;

alter table public.bites
    drop column if exists is_trending;
