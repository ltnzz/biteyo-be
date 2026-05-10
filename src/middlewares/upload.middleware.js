import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

import cloudinary from '../config/cloudinary.js';

const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: 'biteyo',

        transformation: [
            {
                width: 1080,
                crop: 'limit',
                quality: 'auto',
                fetch_format: 'auto',
            },
        ],

        public_id: Date.now() + '-' + file.originalname,
    }),
});

export const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    },
});
