import {
    pgTable,
    uuid,
    varchar,
    text,
    integer,
    timestamp,
    boolean,
    decimal,
    pgEnum,
    uniqueIndex,
    index,
} from 'drizzle-orm/pg-core';

import { generateBiteId } from '../utils/id.js';

export const BITE_CATEGORIES = [
    'street_food',
    'cafe',
    'fine_dining',
    'dessert',
    'viral',
    'hidden_gems',
];

export const categoryEnum = pgEnum('category', BITE_CATEGORIES);

export const notifTypeEnum = pgEnum('notif_type', [
    'like',
    'comment',
    'follow',
    'trending',
    'mention',
]);

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 64 }),
    username: varchar('username', { length: 30 }).notNull().unique(),
    email: varchar('email', { length: 64 }).notNull().unique(),
    password: varchar('password', { length: 64 }).notNull(),
    bio: varchar('bio', { length: 255 }),
    avatarUrl: text('avatar_url'),
    bannerUrl: text('banner_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    // JWT yang diterbitkan sebelum timestamp ini dianggap tidak valid
    // (di-set saat password direset/diganti)
    tokenValidAfter: timestamp('token_valid_after', { withTimezone: true }),
});

export const follows = pgTable(
    'follows',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        followerId: uuid('follower_id')
            .notNull()
            .references(() => users.id, {
                onDelete: 'cascade',
            }),
        followingId: uuid('following_id')
            .notNull()
            .references(() => users.id, {
                onDelete: 'cascade',
            }),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex('follows_follower_following_unique').on(
            table.followerId,
            table.followingId
        ),
        index('follows_follower_id_idx').on(table.followerId),
        index('follows_following_id_idx').on(table.followingId),
    ]
);

export const bites = pgTable(
    'bites',
    {
        id: varchar('id', { length: 36 })
            .primaryKey()
            .$defaultFn(() => generateBiteId()),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        foodName: varchar('food_name', { length: 64 }).notNull(),
        locationName: varchar('location_name', { length: 255 }).notNull(),
        locationAddress: text('location_address'),
        latitude: decimal('latitude', { precision: 10, scale: 8 }),
        longitude: decimal('longitude', { precision: 11, scale: 8 }),
        placeId: varchar('place_id', { length: 255 }),
        review: text('review'),
        rating: integer('rating').notNull(),
        photoUrl: text('photo_url').notNull(),
        category: categoryEnum('category').notNull(),
        viewsCount: integer('views_count').default(0).notNull(),
        likesCount: integer('likes_count').default(0).notNull(),
        commentsCount: integer('comments_count').default(0).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => [
        index('bites_created_at_idx').on(table.createdAt),
        index('bites_user_created_at_idx').on(table.userId, table.createdAt),
        index('bites_category_created_at_idx').on(
            table.category,
            table.createdAt
        ),
    ]
);

export const likes = pgTable(
    'likes',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, {
                onDelete: 'cascade',
            }),
        biteId: varchar('bite_id', { length: 36 })
            .notNull()
            .references(() => bites.id, {
                onDelete: 'cascade',
            }),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex('likes_user_bite_unique').on(table.userId, table.biteId),
        index('likes_bite_id_idx').on(table.biteId),
        index('likes_user_created_at_idx').on(table.userId, table.createdAt),
    ]
);

export const comments = pgTable(
    'comments',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, {
                onDelete: 'cascade',
            }),
        biteId: varchar('bite_id', { length: 36 })
            .notNull()
            .references(() => bites.id, {
                onDelete: 'cascade',
            }),
        content: text('content').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        index('comments_bite_created_at_idx').on(
            table.biteId,
            table.createdAt
        ),
        index('comments_user_id_idx').on(table.userId),
    ]
);

export const saved = pgTable(
    'saved',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, {
                onDelete: 'cascade',
            }),
        biteId: varchar('bite_id', { length: 36 })
            .notNull()
            .references(() => bites.id, {
                onDelete: 'cascade',
            }),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex('saved_user_bite_unique').on(table.userId, table.biteId),
        index('saved_bite_id_idx').on(table.biteId),
        index('saved_user_created_at_idx').on(table.userId, table.createdAt),
    ]
);

export const biteMentions = pgTable(
    'bite_mentions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        biteId: varchar('bite_id', { length: 36 })
            .notNull()
            .references(() => bites.id, {
                onDelete: 'cascade',
            }),
        mentionedUserId: uuid('mentioned_user_id')
            .notNull()
            .references(() => users.id, {
                onDelete: 'cascade',
            }),
        mentionedByUserId: uuid('mentioned_by_user_id')
            .notNull()
            .references(() => users.id, {
                onDelete: 'cascade',
            }),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex('bite_mentions_bite_user_unique').on(
            table.biteId,
            table.mentionedUserId
        ),
    ]
);

export const commentMentions = pgTable(
    'comment_mentions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        commentId: uuid('comment_id')
            .notNull()
            .references(() => comments.id, {
                onDelete: 'cascade',
            }),
        biteId: varchar('bite_id', { length: 36 })
            .notNull()
            .references(() => bites.id, {
                onDelete: 'cascade',
            }),
        mentionedUserId: uuid('mentioned_user_id')
            .notNull()
            .references(() => users.id, {
                onDelete: 'cascade',
            }),
        mentionedByUserId: uuid('mentioned_by_user_id')
            .notNull()
            .references(() => users.id, {
                onDelete: 'cascade',
            }),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex('comment_mentions_comment_user_unique').on(
            table.commentId,
            table.mentionedUserId
        ),
    ]
);

export const notifications = pgTable(
    'notifications',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        toUserId: uuid('to_user_id')
            .notNull()
            .references(() => users.id, {
                onDelete: 'cascade',
            }),
        fromUserId: uuid('from_user_id').references(() => users.id, {
            onDelete: 'set null',
        }),
        type: notifTypeEnum('type').notNull(),
        biteId: varchar('bite_id', { length: 36 }).references(() => bites.id, {
            onDelete: 'cascade',
        }),
        message: varchar('message', { length: 300 }),
        read: boolean('read').default(false).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        index('notifications_to_user_created_at_idx').on(
            table.toUserId,
            table.createdAt
        ),
    ]
);

export const fcmTokens = pgTable(
    'fcm_tokens',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, {
                onDelete: 'cascade',
            }),
        token: text('token').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex('fcm_tokens_token_unique').on(table.token),
        index('fcm_tokens_user_id_idx').on(table.userId),
    ]
);
