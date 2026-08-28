const STATIC_ORIGINS = ['https://biteyo-fe.vercel.app', 'http://localhost:5173'];

const getDynamicOrigins = () => {
    const envOrigins = [
        process.env.CLIENT_URL,
        ...(process.env.CLIENT_URLS?.split(',') || []),
    ].filter(Boolean);
    return [...STATIC_ORIGINS, ...envOrigins];
};

export const allowedOrigins = new Set(getDynamicOrigins());

export const isAllowedOrigin = (origin) => {
    if (!origin) return false;
    // Re-evaluate dynamic env on each call to avoid drift if env changes after import
    const current = new Set(getDynamicOrigins());
    return current.has(origin);
};
