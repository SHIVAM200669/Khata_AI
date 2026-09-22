import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Initialize Firebase Admin SDK.
 * 
 * In production, set FIREBASE_SERVICE_ACCOUNT_PATH to the path of your
 * service account JSON file, or set GOOGLE_APPLICATION_CREDENTIALS env var.
 * 
 * For development without a service account, we use the project ID
 * from environment variables with application default credentials.
 */
let firebaseApp;
let auth;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    // Use explicit service account file
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[Firebase Admin] Initialized with service account file.');
  } else if (process.env.FIREBASE_PROJECT_ID) {
    // Use project ID with application default credentials
    firebaseApp = admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    console.log('[Firebase Admin] Initialized with project ID:', process.env.FIREBASE_PROJECT_ID);
  } else {
    // Fallback: try default initialization
    firebaseApp = admin.initializeApp();
    console.log('[Firebase Admin] Initialized with default credentials.');
  }

  auth = getAuth(firebaseApp);
} catch (err) {
  console.error('[Firebase Admin] Initialization error:', err.message);
  console.warn('[Firebase Admin] Firebase token verification will not work until Firebase Admin is properly configured.');
}

export { admin, firebaseApp, auth, getAuth };
export default admin;

