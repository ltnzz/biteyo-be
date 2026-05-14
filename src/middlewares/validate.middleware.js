export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body || {});

    if (!result.success) {
        console.log(result.error);

        return res.status(400).json({
            errors: result.error.issues,
        });
    }

    req.body = result.data;

    next();
};
