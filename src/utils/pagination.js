export const parsePagination = (query, { defaultLimit = 12, maxLimit = 50, defaultPage = 1 } = {}) => {
    const page = Math.max(parseInt(query.page) || defaultPage, 1);
    const limit = Math.min(Math.max(parseInt(query.limit) || defaultLimit, 1), maxLimit);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};
