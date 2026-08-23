import { sql } from 'drizzle-orm';

/**
 * Single source of truth untuk rumus viral score.
 * CATATAN: bobot ini harus tetap sinkron dengan functional index
 * bites_viral_score_* di drizzle/0011_optimize_backend_queries.sql.
 * Jika bobot berubah, index tersebut harus dibuat ulang.
 */
export const VIRAL_WEIGHTS = {
    views: 1,
    likes: 3,
    comments: 5,
};

export const VIRAL_SCORE_THRESHOLD = 20;

export const calculateViralScore = ({
    viewsCount = 0,
    likesCount = 0,
    commentsCount = 0,
}) =>
    Number(viewsCount || 0) * VIRAL_WEIGHTS.views +
    Number(likesCount || 0) * VIRAL_WEIGHTS.likes +
    Number(commentsCount || 0) * VIRAL_WEIGHTS.comments;

export const isTrendingScore = (viralScore) =>
    viralScore >= VIRAL_SCORE_THRESHOLD;

export const getViralScoreSqlExpr = (viewsCol, likesCol, commentsCol) =>
    sql`(${viewsCol} * ${sql.raw(String(VIRAL_WEIGHTS.views))} + ${likesCol} * ${sql.raw(String(VIRAL_WEIGHTS.likes))} + ${commentsCol} * ${sql.raw(String(VIRAL_WEIGHTS.comments))})::int`;

export const getTrendingStatusSqlExpr = (
    viewsCol,
    likesCol,
    commentsCol
) =>
    sql`${getViralScoreSqlExpr(viewsCol, likesCol, commentsCol)} >= ${sql.raw(String(VIRAL_SCORE_THRESHOLD))}`;
