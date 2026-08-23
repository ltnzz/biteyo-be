-- Invalidasi semua JWT lama saat password direset:
-- middleware auth menolak token yang iat-nya < token_valid_after.

alter table public.users
    add column if not exists token_valid_after timestamptz;
