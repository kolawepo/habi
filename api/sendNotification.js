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

    await msg.send({
      token,
      notification: { title, body },
      data: { link },
      webpush: {
        notification: {
          icon: "https://habi-sepia.vercel.app/bibi.png",
          badge: "https://habi-sepia.vercel.app/favicon.svg",
        },
        fcm_options: { link: `https://habi-sepia.vercel.app${link}` },
      },
    });

    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error("FCM send error:", err);
    return res.status(500).json({ error: err.message });
  }
}
