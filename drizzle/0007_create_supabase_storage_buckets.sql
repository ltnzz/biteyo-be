-- Bucket storage Supabase + policy publik.
-- Hanya dieksekusi di lingkungan Supabase (skema storage tersedia).
do $storage_guard$
begin
    if to_regnamespace('storage') is null then
        raise notice 'skema storage tidak ditemukan, lewati bagian Supabase Storage';
        return;
    end if;

    insert into storage.buckets (id, name, public)
    values
        ('avatars', 'avatars', true),
        ('banners', 'banners', true),
        ('bite-photos', 'bite-photos', true)
    on conflict (id) do update set public = excluded.public;

    drop policy if exists "Public can read avatars" on storage.objects;
    create policy "Public can read avatars"
    on storage.objects
    for select
    to public
    using (bucket_id = 'avatars');

    drop policy if exists "Public can read banners" on storage.objects;
    create policy "Public can read banners"
    on storage.objects
    for select
    to public
    using (bucket_id = 'banners');

    drop policy if exists "Public can read bite photos" on storage.objects;
    create policy "Public can read bite photos"
    on storage.objects
    for select
    to public
    using (bucket_id = 'bite-photos');
end
$storage_guard$;
