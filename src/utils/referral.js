import { collection, doc, getDocs, increment, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";

const SUFFIX_CHARS = "23456789abcdefghjkmnpqrstuvwxyz"; // no 0/1/i/l/o — avoids visual ambiguity

function randomSuffix(length) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)];
  }
  return out;
}

// "kehinde" -> "kehinde7f". Retries with a longer suffix on collision.
export async function generateUniqueReferralCode(username) {
  const base = (username || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "user";

  for (let attempt = 0; attempt < 8; attempt++) {
    const suffixLength = attempt < 5 ? 2 : 4;
    const candidate = `${base}${randomSuffix(suffixLength)}`;
    const existing = await getDocs(query(collection(db, "users"), where("referralCode", "==", candidate)));
    if (existing.empty) return candidate;
  }

  return `${base}${randomSuffix(8)}`; // last resort, effectively never hit
}

export async function findReferrerByCode(code) {
  const clean = code?.trim().toLowerCase();
  if (!clean) return null;

  const snap = await getDocs(query(collection(db, "users"), where("referralCode", "==", clean)));
  return snap.empty ? null : { uid: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function creditReferral(referrerUid) {
  await updateDoc(doc(db, "users", referrerUid), { referralCount: increment(1) });
}
