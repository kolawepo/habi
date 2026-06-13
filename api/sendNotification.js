import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return res.status(503).json({ error: "FCM not configured" });
  }

  const { recipientUid, title, body = "", link = "/" } = req.body ?? {};
  if (!recipientUid || !title) {
    return res.status(400).json({ error: "recipientUid and title are required" });
  }

  try {
    const app      = getAdminApp();
    const db       = getFirestore(app);
    const msg      = getMessaging(app);

    const snap  = await db.doc(`users/${recipientUid}`).get();
    const token = snap.data()?.fcmToken;

    if (!token) {
      return res.status(200).json({ sent: false, reason: "no fcmToken on user" });
    }

    // Data-only message — no top-level `notification` key.
    // This prevents the browser from auto-displaying a notification while our
    // service worker's onBackgroundMessage also calls showNotification (duplicates).
    await msg.send({
      token,
      webpush: {
        data: { title, body, link },
      },
    });

    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error("FCM send error:", err);
    return res.status(500).json({ error: err.message });
  }
}
