import path from 'node:path';
import { supabaseAdmin } from '../config/supabase.js';

const bucketByField = {
    photo: 'bite-photos',
    image: 'bite-photos',
    avatar: 'avatars',
    profileImage: 'avatars',
    banner: 'banners',
    bannerImage: 'banners',
    cover: 'banners',
};

const getSafeFileName = (originalname) => {
    const parsed = path.parse(originalname);
    const base = parsed.name
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return `${base || 'upload'}${parsed.ext.toLowerCase()}`;
};

export const uploadFileToStorage = async ({ file, userId }) => {
    const bucket = bucketByField[file.fieldname] || 'misc';
    const objectPath = `${userId}/${Date.now()}-${getSafeFileName(
        file.originalname
    )}`;

    const { error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(objectPath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });

    if (error) {
        throw error;
    }

    const { data } = supabaseAdmin.storage
        .from(bucket)
        .getPublicUrl(objectPath);

    return {
        bucket,
        objectPath,
        publicUrl: data.publicUrl,
    };
};

export const getStorageObjectFromPublicUrl = (publicUrl) => {
    if (!publicUrl || !process.env.SUPABASE_URL) {
        return null;
    }

    try {
        const url = new URL(publicUrl);
        const expectedOrigin = new URL(process.env.SUPABASE_URL).origin;
        const marker = '/storage/v1/object/public/';

        if (url.origin !== expectedOrigin) {
            return null;
        }

        const markerIndex = url.pathname.indexOf(marker);

        if (markerIndex === -1) {
            return null;
        }

        const objectPath = decodeURIComponent(
            url.pathname.slice(markerIndex + marker.length)
        );
        const [bucket, ...pathParts] = objectPath.split('/');

        if (!bucket || pathParts.length === 0) {
            return null;
        }

        return {
            bucket,
            objectPath: pathParts.join('/'),
        };
    } catch {
        return null;
    }
};

export const deleteStorageObject = async (publicUrl) => {
    const storageObject = getStorageObjectFromPublicUrl(publicUrl);

    if (!storageObject) {
        return false;
    }

    const { error } = await supabaseAdmin.storage
        .from(storageObject.bucket)
        .remove([storageObject.objectPath]);

    if (error) {
        throw error;
    }

    return true;
};
