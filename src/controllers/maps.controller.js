const cache = new Map();

export const searchLocation = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) return res.json([]);

        const key = q.toLowerCase().trim();

        if (cache.has(key)) {
            return res.json(cache.get(key));
        }

        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'bite-app (email@gmail.com)',
            },
        });

        const data = await response.json();

        const result = data.map((item) => ({
            placeId: item.place_id,
            name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
        }));

        cache.set(key, result);

        setTimeout(() => cache.delete(key), 5 * 60 * 1000);

        return res.json(result);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
};
