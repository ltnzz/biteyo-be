import { createMentionsFromText } from './mention.js';
import { logger } from './logger.js';

/**
 * Wrapper aman untuk createMentionsFromText.
 * - Kegagalan push: non-fatal (ditangani di caller fire-and-forget)
 * - Kegagalan insert mention (DB/network): dianggap operational failure, return mentionsFailed:true
 */
export const safeCreateMentionsFromText = async (options) => {
    try {
        const mentions = await createMentionsFromText(options);
        return { mentions, mentionsFailed: false };
    } catch (error) {
        logger.error('Create mentions error:', error);
        return { mentions: [], mentionsFailed: true };
    }
};
