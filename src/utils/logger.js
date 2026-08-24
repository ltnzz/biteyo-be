/**
 * Logger JSON ringan tanpa dependency.
 * Format: {"ts":"...","level":"info","reqId":"...","msg":"...","meta":{...}}
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const minLevel =
    LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ??
    (process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug);

const serializeArgs = (args) =>
    args.map((arg) => {
        if (arg instanceof Error) {
            return {
                name: arg.name,
                message: arg.message,
                stack: process.env.NODE_ENV === 'production' ? undefined : arg.stack,
            };
        }
        return arg;
    });

const emit = (level, msg, metaArgs) => {
    if (LEVELS[level] < minLevel || !msg) return;

    const entry = {
        ts: new Date().toISOString(),
        level,
        msg: typeof msg === 'string' ? msg : JSON.stringify(msg),
    };

    if (metaArgs.length > 0) {
        entry.meta =
            metaArgs.length === 1 ? metaArgs[0] : serializeArgs(metaArgs);
    }

    const line = JSON.stringify(entry);

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
};

export const logger = {
    debug: (...args) => {
        const [msg, ...rest] = args;
        emit('debug', msg, rest);
    },
    info: (...args) => {
        const [msg, ...rest] = args;
        emit('info', msg, rest);
    },
    warn: (...args) => {
        const [msg, ...rest] = args;
        emit('warn', msg, rest);
    },
    error: (...args) => {
        const [msg, ...rest] = args;
        emit('error', msg, rest);
    },

    /** Logger terikat pada satu request (reqId ikut ke setiap baris). */
    child: (reqId) => ({
        debug: (...args) => {
            const [msg, ...rest] = args;
            emit('debug', msg, [{ reqId }, ...serializeArgs(rest)]);
        },
        info: (...args) => {
            const [msg, ...rest] = args;
            emit('info', msg, [{ reqId }, ...serializeArgs(rest)]);
        },
        warn: (...args) => {
            const [msg, ...rest] = args;
            emit('warn', msg, [{ reqId }, ...serializeArgs(rest)]);
        },
        error: (...args) => {
            const [msg, ...rest] = args;
            emit('error', msg, [{ reqId }, ...serializeArgs(rest)]);
        },
    }),
};
