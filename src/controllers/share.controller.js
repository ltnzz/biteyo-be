import { db } from '../db/index.js';
import { bites, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const escapeHtml = (value = '') =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const snippet = (text = '', max = 160) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

/**
 * Halaman preview untuk link share (WhatsApp/X/dll).
 * Crawler membaca meta OG dari sini; manusia langsung dialihkan ke app.
 * Publik: tidak lewat protect middleware.
 */
export const sharePreview = async (req, res) => {
    try {
        const appUrl = process.env.CLIENT_URL || 'https://www.biteyo.my.id';
        const targetUrl = `${appUrl}/bites/${encodeURIComponent(req.params.id)}`;

        let title = 'BiteYo — Social Food Discovery';
        let description = 'Temukan rekomendasi makanan terbaik di sekitarmu.';
        let image = null;

        const [row] = await db
            .select({
                foodName: bites.foodName,
                review: bites.review,
                photoUrl: bites.photoUrl,
                username: users.username,
            })
            .from(bites)
            .leftJoin(users, eq(bites.userId, users.id))
            .where(eq(bites.id, req.params.id))
            .limit(1);

        if (row) {
            title = `${row.foodName}${row.username ? ` oleh @${row.username}` : ''}`;
            description =
                snippet(row.review) ||
                `Lihat review ${row.foodName} di BiteYo.`;
            image = row.photoUrl || null;
        } else {
            logger.info('Share preview: bite not found', {
                reqId: req.id,
                biteId: req.params.id,
            });
        }

        // Nilai sudah di-escape sebelum masuk template HTML
        const safeTitle = escapeHtml(title);
        const safeDescription = escapeHtml(description);

        res.status(200).send(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<meta property="og:type" content="article">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ''}
<meta property="og:url" content="${targetUrl}">
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta http-equiv="refresh" content="0;url=${targetUrl}">
<link rel="canonical" href="${targetUrl}">
</head>
<body>
<p>Mengalihkan ke BiteYo… <a href="${targetUrl}">Buka di sini</a></p>
<script>window.location.replace(${JSON.stringify(targetUrl)});</script>
</body>
</html>`);
    } catch (error) {
        logger.error('Share preview error:', error);

        const appUrl = process.env.CLIENT_URL || 'https://www.biteyo.my.id';
        res.redirect(302, appUrl);
    }
};
