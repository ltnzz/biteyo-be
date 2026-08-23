-- Notifikasi mention kini dibuat oleh trigger DB (single source of truth),
-- konsisten dengan trigger like/comment/follow di 0006_supabase_phase1.sql.
-- App layer hanya mengirim push FCM setelah mention berhasil dibuat.

create or replace function public.create_mention_notification()
returns trigger
language plpgsql
as $$
declare
    actor_username varchar(30);
    food_name varchar(64);
    source_bite_id uuid;
    notif_message varchar(300);
begin
    -- jangan notifikasi diri sendiri
    if new.mentioned_by_user_id = new.mentioned_user_id then
        return new;
    end if;

    select u.username
    into actor_username
    from public.users u
    where u.id = new.mentioned_by_user_id;

    if tg_table_name = 'bite_mentions' then
        source_bite_id := new.bite_id;
        notif_message := coalesce(actor_username, 'Someone') || ' mentioned you in a BiteYo post';
    else
        select c.bite_id
        into source_bite_id
        from public.comments c
        where c.id = new.comment_id;

        select b.food_name
        into food_name
        from public.bites b
        where b.id = source_bite_id;

        notif_message := coalesce(actor_username, 'Someone') || ' mentioned you in a comment on ' || coalesce(food_name, 'a post');
    end if;

    insert into public.notifications (to_user_id, from_user_id, type, bite_id, message)
    values (new.mentioned_user_id, new.mentioned_by_user_id, 'mention', source_bite_id, notif_message);

    return new;
end;
$$;

drop trigger if exists after_bite_mention_insert_create_notification on public.bite_mentions;
create trigger after_bite_mention_insert_create_notification
after insert on public.bite_mentions
for each row
execute function public.create_mention_notification();

drop trigger if exists after_comment_mention_insert_create_notification on public.comment_mentions;
create trigger after_comment_mention_insert_create_notification
after insert on public.comment_mentions
for each row
execute function public.create_mention_notification();
