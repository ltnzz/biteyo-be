alter table public.bites
add column if not exists likes_count integer not null default 0,
add column if not exists comments_count integer not null default 0;

update public.bites b
set
    likes_count = coalesce(l.like_count, 0),
    comments_count = coalesce(c.comment_count, 0)
from (
    select bite_id, count(*)::integer as like_count
    from public.likes
    group by bite_id
) l
full join (
    select bite_id, count(*)::integer as comment_count
    from public.comments
    group by bite_id
) c on c.bite_id = l.bite_id
where b.id = coalesce(l.bite_id, c.bite_id);

create or replace function public.sync_bite_like_count()
returns trigger
language plpgsql
as $$
begin
    update public.bites
    set
        likes_count = (
            select count(*)::integer
            from public.likes
            where bite_id = coalesce(new.bite_id, old.bite_id)
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
        comments_count = (
            select count(*)::integer
            from public.comments
            where bite_id = coalesce(new.bite_id, old.bite_id)
        ),
        updated_at = now()
    where id = coalesce(new.bite_id, old.bite_id);

    return coalesce(new, old);
end;
$$;

drop trigger if exists after_like_change_sync_bite_count on public.likes;
create trigger after_like_change_sync_bite_count
after insert or delete on public.likes
for each row
execute function public.sync_bite_like_count();

drop trigger if exists after_comment_change_sync_bite_count on public.comments;
create trigger after_comment_change_sync_bite_count
after insert or delete on public.comments
for each row
execute function public.sync_bite_comment_count();
