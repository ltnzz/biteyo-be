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
} from 'drizzle-orm/pg-core';

export const categoryEnum = pgEnum('category', [
    'street_food',
    'cafe',
    'fine_dining',
    'dessert',
    'viral',
    'hidden_gems',
]);

export const notifTypeEnum = pgEnum('notif_type', [
    'like',
    'comment',
    'follow',
    'trending',
]);

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 30 }).notNull().unique(),
    email: varchar('email', { length: 64 }).notNull().unique(),
    password: varchar('password', { length: 64 }).notNull(),
    bio: varchar('bio', { length: 255 }),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const follows = pgTable('follows', {
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
});

export const bites = pgTable('bites', {
    id: uuid('id').primaryKey().defaultRandom(),
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
    isTrending: boolean('is_trending').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const likes = pgTable('likes', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, {
            onDelete: 'cascade',
        }),
    biteId: uuid('bite_id')
        .notNull()
        .references(() => bites.id, {
            onDelete: 'cascade',
        }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const comments = pgTable('comments', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, {
            onDelete: 'cascade',
        }),
    biteId: uuid('bite_id')
        .notNull()
        .references(() => bites.id, {
            onDelete: 'cascade',
        }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const saved = pgTable('saved', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, {
            onDelete: 'cascade',
        }),
    biteId: uuid('bite_id')
        .notNull()
        .references(() => bites.id, {
            onDelete: 'cascade',
        }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
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
    biteId: uuid('bite_id').references(() => bites.id, {
        onDelete: 'cascade',
    }),
    message: varchar('message', { length: 300 }),
    read: boolean('read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
