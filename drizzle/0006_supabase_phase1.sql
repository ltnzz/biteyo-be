-- Storage buckets used by the backend upload pipeline.
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

-- Realtime tables currently observed by the frontend.
do $$
declare
    realtime_table text;
begin
    foreach realtime_table in array array[
        'bites',
        'likes',
        'comments',
        'follows',
        'notifications'
    ]
    loop
        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = realtime_table
        ) then
            execute format(
                'alter publication supabase_realtime add table public.%I',
                realtime_table
            );
        end if;
    end loop;
end
$$;

-- Preserve full old rows for update/delete consumers.
alter table public.likes replica identity full;
alter table public.follows replica identity full;

create or replace function public.create_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    bite_owner_id uuid;
    actor_username varchar(30);
    bite_food_name varchar(64);
begin
    select b.user_id, b.food_name
    into bite_owner_id, bite_food_name
    from public.bites b
    where b.id = new.bite_id;

    if bite_owner_id is null or bite_owner_id = new.user_id then
        return new;
    end if;

    select u.username
    into actor_username
    from public.users u
    where u.id = new.user_id;

    insert into public.notifications (
        to_user_id,
        from_user_id,
        type,
        bite_id,
        message
    )
    values (
        bite_owner_id,
        new.user_id,
        'like',
        new.bite_id,
        coalesce(actor_username, 'Someone') || ' liked your ' ||
            bite_food_name || ' post'
    );

    return new;
end;
$$;

create or replace function public.create_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    bite_owner_id uuid;
    actor_username varchar(30);
    bite_food_name varchar(64);
begin
    select b.user_id, b.food_name
    into bite_owner_id, bite_food_name
    from public.bites b
    where b.id = new.bite_id;

    if bite_owner_id is null or bite_owner_id = new.user_id then
        return new;
    end if;

    select u.username
    into actor_username
    from public.users u
    where u.id = new.user_id;

    insert into public.notifications (
        to_user_id,
        from_user_id,
        type,
        bite_id,
        message
    )
    values (
        bite_owner_id,
        new.user_id,
        'comment',
        new.bite_id,
        coalesce(actor_username, 'Someone') || ' commented on your ' ||
            bite_food_name || ' post'
    );

    return new;
end;
$$;

create or replace function public.create_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    actor_username varchar(30);
begin
    if new.following_id = new.follower_id then
        return new;
    end if;

    select u.username
    into actor_username
    from public.users u
    where u.id = new.follower_id;

    insert into public.notifications (
        to_user_id,
        from_user_id,
        type,
        message
    )
    values (
        new.following_id,
        new.follower_id,
        'follow',
        coalesce(actor_username, 'Someone') || ' started following you'
    );

    return new;
end;
$$;

drop trigger if exists after_like_insert_create_notification on public.likes;
create trigger after_like_insert_create_notification
after insert on public.likes
for each row
execute function public.create_like_notification();

drop trigger if exists after_comment_insert_create_notification on public.comments;
create trigger after_comment_insert_create_notification
after insert on public.comments
for each row
execute function public.create_comment_notification();

drop trigger if exists after_follow_insert_create_notification on public.follows;
create trigger after_follow_insert_create_notification
after insert on public.follows
for each row
execute function public.create_follow_notification();
