export const isHttps = (req) => {
    return (
        req.secure ||
        req.protocol === 'https' ||
        (req.headers['x-forwarded-proto'] || '').includes('https')
    );
};

export const getTokenCookieOptions = (req) => ({
    httpOnly: true,
    secure: isHttps(req),
    sameSite: isHttps(req) ? 'none' : 'lax',
    path: '/',
});
