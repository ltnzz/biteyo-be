import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { uploadFileToStorage } from '../utils/storage.js';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_FILES_PER_REQUEST = 5;
const PROCESSED_IMAGE_MAX_DIMENSION = 1600;
const PROCESSED_IMAGE_QUALITY = 80;

const multerUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: MAX_FILES_PER_REQUEST,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    },
});

const processImageBuffer = async (file) => {
    const processed = await sharp(file.buffer)
        .rotate()
        .resize({
            width: PROCESSED_IMAGE_MAX_DIMENSION,
            height: PROCESSED_IMAGE_MAX_DIMENSION,
            fit: 'inside',
            withoutEnlargement: true,
        })
        .jpeg({ quality: PROCESSED_IMAGE_QUALITY })
        .toBuffer({ resolveWithObject: true });

    return { buffer: processed.data, mimetype: 'image/jpeg' };
};

export const uploadSupabaseFiles = async (req, _res, next) => {
    try {
        if (!req.files) {
            return next();
        }

        await Promise.all(
            Object.values(req.files)
                .flat()
                .map(async (file) => {
                    const { buffer, mimetype } = await processImageBuffer(
                        file
                    );

                    const uploaded = await uploadFileToStorage({
                        file: {
                            ...file,
                            buffer,
                            mimetype,
                            originalname: `${path.parse(file.originalname).name}.jpg`,
                        },
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

export const parseMultipart = (fields) => multerUpload.fields(fields);

export const upload = {
    fields: (fields) => [multerUpload.fields(fields), uploadSupabaseFiles],
    parse: parseMultipart,
    upload: uploadSupabaseFiles,
};
