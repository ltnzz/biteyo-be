import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { follows, users } from '../db/schema.js';
import { sendNotificationPush } from '../utils/notification.js';

export const getFollowStats = async ({ targetUserId, actorUserId }) => {
    const [[{ targetFollowersCount }], [{ actorFollowingCount }]] = await Promise.all([
        db.select({ targetFollowersCount: sql`count(*)::int` }).from(follows).where(eq(follows.followingId, targetUserId)),
        db.select({ actorFollowingCount: sql`count(*)::int` }).from(follows).where(eq(follows.followerId, actorUserId)),
    ]);
    return { targetFollowersCount, actorFollowingCount };
};

export const followUserService = async ({ targetUsername, currentUserId }) => {
    const [targetUser] = await db
        .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.username, targetUsername));

    if (!targetUser) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
    }
    if (targetUser.id === currentUserId) {
        const err = new Error('You cannot follow yourself');
        err.statusCode = 400;
        throw err;
    }

    const [follow] = await db
        .insert(follows)
        .values({ followerId: currentUserId, followingId: targetUser.id })
        .onConflictDoNothing({ target: [follows.followerId, follows.followingId] })
        .returning();

    if (!follow) {
        const followStats = await getFollowStats({ targetUserId: targetUser.id, actorUserId: currentUserId });
        return { alreadyFollowing: true, followStats };
    }

    const [actor] = await db.select({ username: users.username }).from(users).where(eq(users.id, currentUserId));

    // fire-and-forget (trigger DB creates notification row)
    sendNotificationPush({
        toUserId: targetUser.id,
        fromUserId: currentUserId,
        type: 'follow',
        message: `${actor?.username || 'Someone'} started following you`,
    }).catch(() => {});

    const followStats = await getFollowStats({ targetUserId: targetUser.id, actorUserId: currentUserId });
    return { follow, followStats, targetUser };
};

export const unfollowUserService = async ({ targetUsername, currentUserId }) => {
    const [targetUser] = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.username, targetUsername));

    if (!targetUser) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
    }
    if (targetUser.id === currentUserId) {
        const err = new Error('You cannot unfollow yourself');
        err.statusCode = 400;
        throw err;
    }

    const [deletedFollow] = await db
        .delete(follows)
        .where(and(eq(follows.followerId, currentUserId), eq(follows.followingId, targetUser.id)))
        .returning({ id: follows.id });

    const followStats = await getFollowStats({ targetUserId: targetUser.id, actorUserId: currentUserId });
    return { deletedFollow, followStats };
};
