// seed.js — Biteyo Database Seeder
// Jalankan: node seed.js
// Pastikan .env sudah ada dengan DATABASE_URL yang benar
//
// Struktur foto lokal yang diharapkan (taruh di folder /public/images/):
//   avatars/   → avatar1.jpg, avatar2.jpg, ... avatar5.jpg
//   bites/     → bite1.jpg, bite2.jpg, ... bite10.jpg

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import {
    users,
    follows,
    bites,
    likes,
    comments,
    saved,
    notifications,
} from './db/schema.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ─── HELPER ──────────────────────────────────────────────────────────────────

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

const DEFAULT_AVATAR_URL = '/images/avatars/profile1.jpg';
const DEFAULT_BITE_PHOTO_URL = '/images/bites/foto1.jpg';

const userData = [
    {
        username: 'foodie_jakarta',
        email: 'foodie@example.com',
        password: 'password123',
        bio: 'Jakarta food explorer 🍜 | Suka nyobain tempat makan baru',
        avatarUrl: DEFAULT_AVATAR_URL,
    },
    {
        username: 'makan_terus',
        email: 'makan@example.com',
        password: 'password123',
        bio: 'Kalau ada waktu kosong, pasti lagi makan 😄',
        avatarUrl: DEFAULT_AVATAR_URL,
    },
    {
        username: 'si_kulineran',
        email: 'kulineran@example.com',
        password: 'password123',
        bio: 'Street food enthusiast | Selatan Jakarta 🌶️',
        avatarUrl: DEFAULT_AVATAR_URL,
    },
    {
        username: 'review_jujur',
        email: 'review@example.com',
        password: 'password123',
        bio: 'Review jujur tanpa endorse. Kalau enak, bilang enak.',
        avatarUrl: DEFAULT_AVATAR_URL,
    },
    {
        username: 'hidden_gem_hunter',
        email: 'hunter@example.com',
        password: 'password123',
        bio: 'Spesialis nyari tempat makan tersembunyi di Jakarta 🕵️',
        avatarUrl: DEFAULT_AVATAR_URL,
    },
];

const biteData = [
    {
        foodName: 'Nasi Goreng Kambing Kebon Sirih',
        locationName: 'Nasi Goreng Bang Dul',
        locationAddress: 'Jl. Kebon Sirih No. 12, Jakarta Pusat',
        latitude: '-6.18505',
        longitude: '106.83013',
        placeId: 'place_kebon_sirih_001',
        review: 'Nasi gorengnya juara! Daging kambingnya empuk dan bumbunya meresap banget. Wajib coba kalau lagi di Kebon Sirih.',
        rating: 5,
        photoUrl: DEFAULT_BITE_PHOTO_URL,
        category: 'street_food',
        isTrending: true,
    },
    {
        foodName: 'Soto Betawi Ragunan',
        locationName: 'Warung Soto Pak Narto',
        locationAddress: 'Jl. Ragunan No. 45, Jakarta Selatan',
        latitude: '-6.31200',
        longitude: '106.82100',
        placeId: 'place_ragunan_001',
        review: 'Kuah santannya gurih dan kental. Dagingnya banyak dan lembut. Harga juga sangat terjangkau buat porsi segitu.',
        rating: 5,
        photoUrl: DEFAULT_BITE_PHOTO_URL,
        category: 'street_food',
        isTrending: true,
    },
    {
        foodName: 'Croissant Butter Almond',
        locationName: 'Kafe Roti & Senja',
        locationAddress: 'Jl. Kemang Raya No. 8, Jakarta Selatan',
        latitude: '-6.26100',
        longitude: '106.81300',
        placeId: 'place_kemang_cafe_001',
        review: 'Croissantnya flaky banget dan aromanya harum. Kopinya juga enak. Tempat yang nyaman buat nugas atau WFH.',
        rating: 4,
        photoUrl: DEFAULT_BITE_PHOTO_URL,
        category: 'cafe',
        isTrending: false,
    },
    {
        foodName: 'Wagyu Steak Set',
        locationName: 'Marugame Dining',
        locationAddress: 'Grand Indonesia, Jakarta Pusat',
        latitude: '-6.19550',
        longitude: '106.82100',
        placeId: 'place_grand_indo_001',
        review: 'Worth it buat special occasion. Wagyu-nya dimasak perfectly medium rare. Sausnya juga nggak berlebihan. Service top.',
        rating: 5,
        photoUrl: DEFAULT_BITE_PHOTO_URL,
        category: 'fine_dining',
        isTrending: false,
    },
    {
        foodName: 'Boba Brown Sugar Fresh Milk',
        locationName: 'Tiger Sugar Senayan City',
        locationAddress: 'Senayan City Lt. 1, Jakarta Selatan',
        latitude: '-6.22800',
        longitude: '106.80000',
        placeId: 'place_senayan_boba_001',
        review: 'Tiger stripe-nya aesthetic banget. Rasanya pas, nggak terlalu manis. Pearl-nya kenyal dan enak.',
        rating: 4,
        photoUrl: DEFAULT_BITE_PHOTO_URL,
        category: 'dessert',
        isTrending: true,
    },
    {
        foodName: 'Mie Ayam Bakso Viral TikTok',
        locationName: 'Mie Ayam Pak Kumis',
        locationAddress: 'Jl. Fatmawati Raya No. 88, Jakarta Selatan',
        latitude: '-6.27800',
        longitude: '106.79500',
        placeId: 'place_fatmawati_mie_001',
        review: 'Emang beneran viral dengan alasan yang jelas. Kuah kaldu-nya mantap, ayamnya banyak. Antriannya panjang tapi worth it.',
        rating: 5,
        photoUrl: DEFAULT_BITE_PHOTO_URL,
        category: 'viral',
        isTrending: true,
    },
    {
        foodName: 'Es Krim Artisan Matcha',
        locationName: 'Gelato Tersembunyi',
        locationAddress: 'Gang Sempit Blok M, Jakarta Selatan',
        latitude: '-6.24400',
        longitude: '106.79800',
        placeId: 'place_blokm_gelato_001',
        review: 'Hidden gem yang beneran tersembunyi di gang kecil. Matcha-nya authentic, nggak terlalu manis. Worth hunting!',
        rating: 5,
        photoUrl: DEFAULT_BITE_PHOTO_URL,
        category: 'hidden_gems',
        isTrending: false,
    },
    {
        foodName: 'Ayam Geprek Sambal Bawang',
        locationName: 'Geprek Bu Rum',
        locationAddress: 'Jl. Tebet Barat No. 22, Jakarta Selatan',
        latitude: '-6.23900',
        longitude: '106.84500',
        placeId: 'place_tebet_geprek_001',
        review: 'Ayamnya renyah, pedasnya nendang. Sambal bawangnya bikin nagih. Favorit sejak lama dan tetap konsisten.',
        rating: 4,
        photoUrl: DEFAULT_BITE_PHOTO_URL,
        category: 'street_food',
        isTrending: false,
    },
    {
        foodName: 'Pour Over Kopi Aceh Gayo',
        locationName: 'Kedai Kopi Tulus',
        locationAddress: 'Jl. Cipete Raya No. 5, Jakarta Selatan',
        latitude: '-6.26700',
        longitude: '106.80200',
        placeId: 'place_cipete_kopi_001',
        review: 'Biji kopinya pilihan dan fresh roast. Pour over-nya dibuat dengan teliti. Kalau kamu coffee snob, ini tempatnya.',
        rating: 5,
        photoUrl: DEFAULT_BITE_PHOTO_URL,
        category: 'cafe',
        isTrending: false,
    },
    {
        foodName: 'Tteokbokki Cheese Mozzarella',
        locationName: 'K-Street Food Senopati',
        locationAddress: 'Jl. Senopati No. 30, Jakarta Selatan',
        latitude: '-6.23300',
        longitude: '106.80700',
        placeId: 'place_senopati_korean_001',
        review: 'Viral di mana-mana dan emang enak! Tteok-nya kenyal, saus gochujangnya pas, cheese-nya meleleh sempurna.',
        rating: 4,
        photoUrl: DEFAULT_BITE_PHOTO_URL,
        category: 'viral',
        isTrending: true,
    },
];

const commentTexts = [
    'Wah ini enak banget ya! Udah lama mau nyobain.',
    'Setuju! Gue juga udah pernah ke sini, recommended banget.',
    'Rating 5 emang layak. Tempat ini underrated sih.',
    'Harganya gimana? Worth it nggak?',
    'Gue udah 3x ke sini dan nggak pernah kecewa.',
    'Foto-nya bikin lapar! Kapan-kapan mau cobain nih.',
    'Iya bener, lokasinya agak susah dicari tapi worth it.',
    'Udah masuk wishlist gue nih!',
    'Ini tuh emang salah satu favorit gue di Jakarta.',
    'Makasih reviewnya, langsung save buat weekend!',
];

// ─── SEED FUNCTION ───────────────────────────────────────────────────────────

async function seed() {
    console.log('🌱 Mulai seeding database Biteyo...\n');

    // 1. USERS
    console.log('👤 Inserting users...');
    const hashedUsers = await Promise.all(
        userData.map(async (u) => ({
            ...u,
            password: await bcrypt.hash(u.password, 10),
        }))
    );
    const insertedUsers = await db
        .insert(users)
        .values(hashedUsers)
        .returning();
    console.log(`   ✅ ${insertedUsers.length} users inserted`);

    const userIds = insertedUsers.map((u) => u.id);

    // 2. BITES
    console.log('🍜 Inserting bites...');
    const biteValues = biteData.map((b, i) => ({
        ...b,
        userId: userIds[i % userIds.length],
    }));
    const insertedBites = await db.insert(bites).values(biteValues).returning();
    console.log(`   ✅ ${insertedBites.length} bites inserted`);

    const biteIds = insertedBites.map((b) => b.id);

    // 3. FOLLOWS (setiap user follow 2-3 user lain)
    console.log('👥 Inserting follows...');
    const followValues = [];
    for (let i = 0; i < userIds.length; i++) {
        const others = userIds.filter((_, j) => j !== i);
        const toFollow = pickN(others, 2);
        for (const followingId of toFollow) {
            followValues.push({ followerId: userIds[i], followingId });
        }
    }
    const insertedFollows = await db
        .insert(follows)
        .values(followValues)
        .returning();
    console.log(`   ✅ ${insertedFollows.length} follows inserted`);

    // 4. LIKES (setiap user like 4-6 bites acak)
    console.log('❤️  Inserting likes...');
    const likeValues = [];
    const likeSet = new Set();
    for (const userId of userIds) {
        const toLike = pickN(biteIds, 5);
        for (const biteId of toLike) {
            const key = `${userId}-${biteId}`;
            if (!likeSet.has(key)) {
                likeSet.add(key);
                likeValues.push({ userId, biteId });
            }
        }
    }
    const insertedLikes = await db.insert(likes).values(likeValues).returning();
    console.log(`   ✅ ${insertedLikes.length} likes inserted`);

    // 5. COMMENTS (setiap user comment di 3 bites)
    console.log('💬 Inserting comments...');
    const commentValues = [];
    for (const userId of userIds) {
        const toComment = pickN(biteIds, 3);
        for (const biteId of toComment) {
            commentValues.push({
                userId,
                biteId,
                content: pick(commentTexts),
            });
        }
    }
    const insertedComments = await db
        .insert(comments)
        .values(commentValues)
        .returning();
    console.log(`   ✅ ${insertedComments.length} comments inserted`);

    // 6. SAVED (setiap user save 2-3 bites)
    console.log('🔖 Inserting saved...');
    const savedValues = [];
    const savedSet = new Set();
    for (const userId of userIds) {
        const toSave = pickN(biteIds, 3);
        for (const biteId of toSave) {
            const key = `${userId}-${biteId}`;
            if (!savedSet.has(key)) {
                savedSet.add(key);
                savedValues.push({ userId, biteId });
            }
        }
    }
    const insertedSaved = await db
        .insert(saved)
        .values(savedValues)
        .returning();
    console.log(`   ✅ ${insertedSaved.length} saved inserted`);

    // 7. NOTIFICATIONS
    console.log('🔔 Inserting notifications...');
    const notifValues = [];

    // Like notifications
    for (const like of insertedLikes.slice(0, 8)) {
        const bite = insertedBites.find((b) => b.id === like.biteId);
        if (bite && bite.userId !== like.userId) {
            notifValues.push({
                toUserId: bite.userId,
                fromUserId: like.userId,
                type: 'like',
                biteId: like.biteId,
                message: 'menyukai bite kamu',
                read: false,
            });
        }
    }

    // Comment notifications
    for (const comment of insertedComments.slice(0, 6)) {
        const bite = insertedBites.find((b) => b.id === comment.biteId);
        if (bite && bite.userId !== comment.userId) {
            notifValues.push({
                toUserId: bite.userId,
                fromUserId: comment.userId,
                type: 'comment',
                biteId: comment.biteId,
                message: 'mengomentari bite kamu',
                read: false,
            });
        }
    }

    // Follow notifications
    for (const follow of insertedFollows.slice(0, 5)) {
        notifValues.push({
            toUserId: follow.followingId,
            fromUserId: follow.followerId,
            type: 'follow',
            biteId: null,
            message: 'mulai mengikuti kamu',
            read: false,
        });
    }

    // Trending notifications
    const trendingBites = insertedBites.filter((b) => b.isTrending);
    for (const bite of trendingBites.slice(0, 3)) {
        notifValues.push({
            toUserId: bite.userId,
            fromUserId: null,
            type: 'trending',
            biteId: bite.id,
            message: `"${bite.foodName}" kamu sedang trending!`,
            read: false,
        });
    }

    const insertedNotifs = await db
        .insert(notifications)
        .values(notifValues)
        .returning();
    console.log(`   ✅ ${insertedNotifs.length} notifications inserted`);

    // ─── SUMMARY ──────────────────────────────────────────────────────────────
    console.log('\n✅ Seeding selesai! Summary:');
    console.log(`   👤 Users       : ${insertedUsers.length}`);
    console.log(`   🍜 Bites       : ${insertedBites.length}`);
    console.log(`   👥 Follows     : ${insertedFollows.length}`);
    console.log(`   ❤️  Likes       : ${insertedLikes.length}`);
    console.log(`   💬 Comments    : ${insertedComments.length}`);
    console.log(`   🔖 Saved       : ${insertedSaved.length}`);
    console.log(`   🔔 Notifs      : ${insertedNotifs.length}`);

    console.log('\n📋 Akun yang dibuat (semua password: password123):');
    insertedUsers.forEach((u) => {
        console.log(`   - ${u.username.padEnd(20)} | ${u.email}`);
    });

    await pool.end();
}

seed().catch((err) => {
    console.error('❌ Seeding gagal:', err);
    pool.end();
    process.exit(1);
});
