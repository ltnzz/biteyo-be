import admin from 'firebase-admin';
import fs from 'fs';

const parseServiceAccount = () => {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(
            process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        );

        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(
                /\\n/g,
                '\n'
            );
        }

        return serviceAccount;
    }

    const serviceAccountPath =
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        './firebase-service-account.json';

    if (!fs.existsSync(serviceAccountPath)) {
        return null;
    }

    return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
};

let messaging = null;

try {
    if (!admin.apps.length) {
        const serviceAccount = parseServiceAccount();

        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        } else {
            admin.initializeApp();
        }
    }

    messaging = admin.messaging();
} catch (error) {
    console.warn('Firebase Admin is not configured:', error.message);
}

export const getMessaging = () => messaging;
