// One-off backfill: creates a usernames/{username} ledger doc for every
// existing user, so the new atomic signup transaction (which checks this
// ledger) can't collide with usernames that already exist.
// Run locally with: FIREBASE_SERVICE_ACCOUNT_JSON='<service-account-json>' node scripts/backfillUsernamesLedger.mjs
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

async function main() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON before running this script.");
  }

  const app = initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
  });
  const db = getFirestore(app);

  const usersSnap = await db.collection("users").get();

  let created = 0;
  for (const userDoc of usersSnap.docs) {
    const username = userDoc.data().username;
    if (!username) continue;

    const ledgerRef = db.collection("usernames").doc(username);
    const ledgerSnap = await ledgerRef.get();
    if (ledgerSnap.exists) {
      console.log(`${username} -> already in ledger (owner ${ledgerSnap.data().uid})`);
      continue;
    }

    await ledgerRef.set({ uid: userDoc.id, createdAt: FieldValue.serverTimestamp() });
    created++;
    console.log(`${username} -> reserved for ${userDoc.id}`);
  }

  console.log(`Done. Created ${created} of ${usersSnap.size} ledger entries.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
