create extension if not exists pg_trgm;

delete from public.likes l
using (
    select id
    from (
        select
            id,
            row_number() over (
                partition by user_id, bite_id
                order by created_at, id
            ) as duplicate_rank
        from public.likes
    ) ranked_likes
    where duplicate_rank > 1
) duplicates
where l.id = duplicates.id;

delete from public.saved s
using (
    select id
    from (
        select
            id,
            row_number() over (
                partition by user_id, bite_id
                order by created_at, id
            ) as duplicate_rank
        from public.saved
    ) ranked_saved
    where duplicate_rank > 1
) duplicates
where s.id = duplicates.id;

delete from public.follows f
using (
    select id
    from (
        select
            id,
            row_number() over (
                partition by follower_id, following_id
                order by created_at, id
            ) as duplicate_rank
        from public.follows
    ) ranked_follows
    where duplicate_rank > 1
) duplicates
where f.id = duplicates.id;

create unique index if not exists likes_user_bite_unique
on public.likes (user_id, bite_id);

create unique index if not exists saved_user_bite_unique
on public.saved (user_id, bite_id);

create unique index if not exists follows_follower_following_unique
on public.follows (follower_id, following_id);

create index if not exists bites_created_at_idx
on public.bites (created_at desc);

create index if not exists bites_user_created_at_idx
on public.bites (user_id, created_at desc);

create index if not exists bites_category_created_at_idx
on public.bites (category, created_at desc);

create index if not exists bites_viral_score_created_at_idx
on public.bites (
    ((views_count * 1 + likes_count * 3 + comments_count * 5)),
    created_at desc
);

create index if not exists bites_viral_score_desc_created_at_idx
on public.bites (
    ((views_count * 1 + likes_count * 3 + comments_count * 5)) desc,
    created_at desc
);

create index if not exists bites_food_name_trgm_idx
on public.bites using gin (food_name gin_trgm_ops);

create index if not exists bites_location_name_trgm_idx
on public.bites using gin (location_name gin_trgm_ops);

create index if not exists bites_review_trgm_idx
on public.bites using gin (review gin_trgm_ops);

create index if not exists likes_bite_id_idx
on public.likes (bite_id);

create index if not exists likes_user_created_at_idx
on public.likes (user_id, created_at desc);

create index if not exists comments_bite_created_at_idx
on public.comments (bite_id, created_at desc);

create index if not exists comments_user_id_idx
on public.comments (user_id);

create index if not exists saved_bite_id_idx
on public.saved (bite_id);

create index if not exists saved_user_created_at_idx
on public.saved (user_id, created_at desc);

create index if not exists follows_follower_id_idx
on public.follows (follower_id);

create index if not exists follows_following_id_idx
on public.follows (following_id);

create index if not exists notifications_to_user_created_at_idx
on public.notifications (to_user_id, created_at desc);

create index if not exists fcm_tokens_user_id_idx
on public.fcm_tokens (user_id);
