do $$
declare
    public_table text;
begin
    foreach public_table in array array[
        'users',
        'follows',
        'bites',
        'likes',
        'comments',
        'saved',
        'notifications',
        'fcm_tokens',
        'bite_mentions',
        'comment_mentions'
    ]
    loop
        execute format(
            'alter table public.%I enable row level security',
            public_table
        );
    end loop;
end
$$;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on table public.fcm_tokens from anon;
        revoke all on table public.users from anon;
        revoke all (
            id,
            username,
            email,
            password,
            bio,
            avatar_url,
            banner_url,
            created_at,
            updated_at
        ) on public.users from anon;
        grant select (
            id,
            username,
            bio,
            avatar_url,
            banner_url,
            created_at,
            updated_at
        ) on public.users to anon;
    end if;

    if exists (select 1 from pg_roles where rolname = 'authenticated') then
        revoke all on table public.fcm_tokens from authenticated;
        revoke all on table public.users from authenticated;
        revoke all (
            id,
            username,
            email,
            password,
            bio,
            avatar_url,
            banner_url,
            created_at,
            updated_at
        ) on public.users from authenticated;
        grant select (
            id,
            username,
            bio,
            avatar_url,
            banner_url,
            created_at,
            updated_at
        ) on public.users to authenticated;
    end if;
end
$$;
