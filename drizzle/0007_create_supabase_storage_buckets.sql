insert into storage.buckets (id, name, public)
values
    ('avatars', 'avatars', true),
    ('banners', 'banners', true),
    ('bite-photos', 'bite-photos', true)
on conflict (id) do update set public = excluded.public;
--> statement-breakpoint
drop policy if exists "Public can read avatars" on storage.objects;
--> statement-breakpoint
create policy "Public can read avatars"
on storage.objects
for select
to public
using (bucket_id = 'avatars');
--> statement-breakpoint
drop policy if exists "Public can read banners" on storage.objects;
--> statement-breakpoint
create policy "Public can read banners"
on storage.objects
for select
to public
using (bucket_id = 'banners');
--> statement-breakpoint
drop policy if exists "Public can read bite photos" on storage.objects;
--> statement-breakpoint
create policy "Public can read bite photos"
on storage.objects
for select
to public
using (bucket_id = 'bite-photos');
