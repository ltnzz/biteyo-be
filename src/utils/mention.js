import { or, sql } from 'drizzle-orm';

import { db } from '../db/index.js';
import {
    biteMentions,
    commentMentions,
    users,
} from '../db/schema.js';
import { sendPushToUser } from './push.notification.js';

const MENTION_REGEX = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,30})\b/g;
const MAX_MENTIONS_PER_SOURCE = 10;

export const extractMentionUsernames = (text = '') => {
    const usernames = [];
    const seen = new Set();

    for (const match of text.matchAll(MENTION_REGEX)) {
        const username = match[2];
        const key = username.toLowerCase();

        if (!seen.has(key)) {
            seen.add(key);
            usernames.push(username);
        }

        if (usernames.length >= MAX_MENTIONS_PER_SOURCE) {
            break;
        }
    }

    return usernames;
};

export const createMentionsFromText = async ({
    text,
    sourceType,
    sourceId,
    biteId,
    mentionedByUserId,
    actorUsername,
    biteFoodName,
    excludedUserIds = [],
}) => {
    const usernames = extractMentionUsernames(text);

    if (usernames.length === 0) {
        return [];
    }

    const mentionedUsers = await db
        .select({
            id: users.id,
            username: users.username,
            avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(
            or(
                ...usernames.map(
                    (username) =>
                        sql`lower(${users.username}) = ${username.toLowerCase()}`
                )
            )
        );

    const excludedIds = new Set([mentionedByUserId, ...excludedUserIds]);
    const mentionableUsers = mentionedUsers.filter(
        (user) => !excludedIds.has(user.id)
    );

    if (mentionableUsers.length === 0) {
        return [];
    }

    let insertedMentions;

    if (sourceType === 'bite') {
        insertedMentions = await db
            .insert(biteMentions)
            .values(
                mentionableUsers.map((user) => ({
                    biteId: sourceId,
                    mentionedUserId: user.id,
                    mentionedByUserId,
                }))
            )
            .onConflictDoNothing()
            .returning({ mentionedUserId: biteMentions.mentionedUserId });
    } else {
        insertedMentions = await db
            .insert(commentMentions)
            .values(
                mentionableUsers.map((user) => ({
                    commentId: sourceId,
                    biteId,
                    mentionedUserId: user.id,
                    mentionedByUserId,
                }))
            )
            .onConflictDoNothing()
            .returning({ mentionedUserId: commentMentions.mentionedUserId });
    }

    const insertedUserIds = new Set(
        insertedMentions.map((mention) => mention.mentionedUserId)
    );
    const newlyMentionedUsers = mentionableUsers.filter((user) =>
        insertedUserIds.has(user.id)
    );

    if (newlyMentionedUsers.length === 0) {
        return [];
    }

    const message =
        sourceType === 'bite'
            ? `${actorUsername || 'Someone'} mentioned you in a BiteYo post`
            : `${actorUsername || 'Someone'} mentioned you in a comment on ${biteFoodName || 'a post'}`;

    // Row notifikasi dibuat oleh DB trigger
    // (drizzle/0013_mention_notification_triggers.sql) — app hanya kirim push.
    await Promise.all(
        newlyMentionedUsers.map((user) =>
            sendPushToUser({
                userId: user.id,
                title: 'BiteYo',
                body: message,
                data: {
                    type: 'mention',
                    biteId,
                    fromUserId: mentionedByUserId,
                },
            }).catch((error) => {
                console.error('Mention push notification failed:', error);
            })
        )
    );

    return newlyMentionedUsers;
};
