import multer from 'multer';
import { uploadFileToStorage } from '../utils/storage.js';

const multerUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    },
});

const uploadSupabaseFiles = async (req, _res, next) => {
    try {
        if (!req.files) {
            return next();
        }

        await Promise.all(
            Object.values(req.files)
                .flat()
                .map(async (file) => {
                    const uploaded = await uploadFileToStorage({
                        file,
                        userId: req.user.id,
                    });

                    file.path = uploaded.publicUrl;
                    file.storageBucket = uploaded.bucket;
                    file.storagePath = uploaded.objectPath;
                })
        );

        return next();
    } catch (error) {
        return next(error);
    }
};

export const upload = {
    fields: (fields) => [multerUpload.fields(fields), uploadSupabaseFiles],
};
