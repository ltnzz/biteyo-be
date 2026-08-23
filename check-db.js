import 'dotenv/config';
import { db } from './src/db/index.js';
import { users, bites, likes, comments } from './src/db/schema.js';
import { eq, desc } from 'drizzle-orm';

async function check() {
    console.log('--- Checking Bot User ---');
    const [bot] = await db.select().from(users).where(eq(users.username, 'biteyo_bot')).limit(1);
    console.log(bot ? `Found bot: @${bot.username} (ID: ${bot.id})` : 'Bot user not found!');

    console.log('\n--- Checking Latest Bite ---');
    const [latestBite] = await db.select().from(bites).orderBy(desc(bites.createdAt)).limit(1);
    if (latestBite) {
        console.log(`Latest Bite: "${latestBite.foodName}" (ID: ${latestBite.id})`);
        console.log(`Posted by user ID: ${latestBite.userId}`);
        console.log(`Likes count: ${latestBite.likesCount}, Comments count: ${latestBite.commentsCount}`);

        console.log('\n--- Checking Likes on Latest Bite ---');
        const biteLikes = await db.select().from(likes).where(eq(likes.biteId, latestBite.id));
        console.log(`Found ${biteLikes.length} likes in database for this bite.`);

        console.log('\n--- Checking Comments on Latest Bite ---');
        const biteComments = await db.select().from(comments).where(eq(comments.biteId, latestBite.id));
        biteComments.forEach((c, idx) => {
            console.log(`  ${idx + 1}. User ID ${c.userId}: "${c.content}"`);
        });
    } else {
        console.log('No bites found in database.');
    }
}

check().catch(console.error).finally(() => process.exit(0));
