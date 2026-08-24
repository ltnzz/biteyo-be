import { logger } from '../utils/logger.js';

// Cache LRU sederhana: TTL 5 menit per entry + batas ukuran total
// agar memory tidak tumbuh tanpa batas.
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

const cache = new Map();

const cacheGet = (key) => {
    const entry = cache.get(key);

    if (!entry) return undefined;

    if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
        cache.delete(key);
        return undefined;
    }

    // refresh posisi (paling baru dipakai) untuk eviksi LRU
    cache.delete(key);
    cache.set(key, entry);

    return entry.value;
};

const cacheSet = (key, value) => {
    if (cache.size >= CACHE_MAX_ENTRIES) {
        // Map mempertahankan urutan insert -> key pertama = paling lama tak dipakai
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
    }

    cache.set(key, { value, createdAt: Date.now() });
};

export const searchLocation = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) return res.json([]);

        const key = q.toLowerCase().trim();
        const cached = cacheGet(key);

        if (cached) return res.json(cached);

        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'bite-app (email@gmail.com)',
            },
            signal: AbortSignal.timeout(5000),
        });

        const data = await response.json();

        const result = data.map((item) => ({
            placeId: item.place_id,
            name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
        }));

        cacheSet(key, result);

        return res.json(result);
    } catch (err) {
        if (err?.name === 'TimeoutError') {
            logger.warn('Nominatim request timeout', { query: req.query.q });
            return res.status(504).json({ message: 'Location service timeout' });
        }

        logger.error(err.message, err);
        return res.status(500).json({ message: 'Server error' });
    }
};
