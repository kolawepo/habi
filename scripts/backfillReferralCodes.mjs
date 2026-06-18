// One-off backfill: gives every existing user doc a referralCode if it doesn't have one.
// Run locally with: FIREBASE_SERVICE_ACCOUNT_JSON='<service-account-json>' node scripts/backfillReferralCodes.mjs
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const SUFFIX_CHARS = "23456789abcdefghjkmnpqrstuvwxyz";

function randomSuffix(length) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)];
  }
  return out;
}

async function generateUniqueReferralCode(db, username, taken) {
  const base = (username || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "user";

  for (let attempt = 0; attempt < 8; attempt++) {
    const suffixLength = attempt < 5 ? 2 : 4;
    const candidate = `${base}${randomSuffix(suffixLength)}`;
    if (taken.has(candidate)) continue;
    const existing = await db.collection("users").where("referralCode", "==", candidate).get();
    if (existing.empty) return candidate;
  }
  return `${base}${randomSuffix(8)}`;
}

async function main() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON before running this script.");
  }

  const app = initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
  });
  const db = getFirestore(app);

  const snap = await db.collection("users").get();
  const taken = new Set(
    snap.docs.map((d) => d.data().referralCode).filter(Boolean)
  );

  let updated = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.referralCode) continue;

    const code = await generateUniqueReferralCode(db, data.username, taken);
    taken.add(code);

    await docSnap.ref.update({
      referralCode: code,
      referralCount: data.referralCount ?? 0,
      referredBy: data.referredBy ?? null,
      referralCredited: data.referralCredited ?? true, // no referrer to credit, so treat as already settled
    });

    updated++;
    console.log(`${docSnap.id} -> ${code}`);
  }

  console.log(`Done. Backfilled ${updated} of ${snap.size} users.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
