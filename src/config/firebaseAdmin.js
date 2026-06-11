const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const keyPath = path.join(__dirname, "..", "..", "serviceAccountKey.json");

let serviceAccount = null;
if (fs.existsSync(keyPath)) {
  try {
    serviceAccount = require(keyPath);
  } catch (err) {
    console.error("Failed to load serviceAccountKey.json:", err.message);
  }
}

let isInitialized = false;

if (serviceAccount) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    isInitialized = true;
    console.log("Firebase Admin initialized using serviceAccountKey.json.");
  } catch (err) {
    console.error("Firebase Admin initialization failed with serviceAccountKey.json:", err.message);
  }
} else if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
    isInitialized = true;
    console.log("Firebase Admin initialized using environment variables.");
  } catch (err) {
    console.error("Firebase Admin initialization failed using environment variables:", err.message);
  }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(key),
    });
    isInitialized = true;
    console.log("Firebase Admin initialized using FIREBASE_SERVICE_ACCOUNT_KEY env variable.");
  } catch (err) {
    console.error("Firebase Admin initialization failed using FIREBASE_SERVICE_ACCOUNT_KEY:", err.message);
  }
}

if (!isInitialized) {
  console.warn(`
======================================================================
WARNING: Firebase Service Account credentials not found!
Firebase Admin SDK could not be initialized because 'serviceAccountKey.json'
is missing and alternative environment variables are not set.

To resolve this, please either:
1. Download your service account key from the Firebase Console
   (Project Settings > Service Accounts > Generate new private key)
   and save it as 'serviceAccountKey.json' at the project root.

2. Or set the following variables in your .env file:
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-client-email
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
======================================================================
  `);

  // Fallback stub so the server keeps booting in dev environments without credentials.
  // It decodes the JWT WITHOUT verifying the signature — never use this in production.
  const stubAdmin = {
    auth: () => ({
      verifyIdToken: async (firebaseToken) => {
        console.warn("Firebase Admin SDK not initialized. Decoding token without signature verification (dev only).");
        const decoded = jwt.decode(firebaseToken);
        if (!decoded) {
          throw new Error("Invalid token format");
        }
        return decoded;
      },
    }),
  };
  module.exports = stubAdmin;
} else {
  module.exports = admin;
}
