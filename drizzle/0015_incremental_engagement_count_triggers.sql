-- Ganti trigger counter engagement dari COUNT(*) (full scan per write,
-- lihat 0008) menjadi increment/decrement atomik O(1).
-- greatest(0, ...) menjaga counter tetap >= 0 bila terjadi drift.

create or replace function public.sync_bite_like_count()
returns trigger
language plpgsql
as $$
begin
    update public.bites
    set
        likes_count = greatest(
            0,
            likes_count + case when TG_OP = 'INSERT' then 1 else -1 end
        ),
        updated_at = now()
    where id = coalesce(new.bite_id, old.bite_id);

    return coalesce(new, old);
end;
$$;

create or replace function public.sync_bite_comment_count()
returns trigger
language plpgsql
as $$
begin
    update public.bites
    set
        comments_count = greatest(
            0,
            comments_count + case when TG_OP = 'INSERT' then 1 else -1 end
        ),
        updated_at = now()
    where id = coalesce(new.bite_id, old.bite_id);

    return coalesce(new, old);
end;
$$;
