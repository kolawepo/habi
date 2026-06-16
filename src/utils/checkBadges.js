import {
  collection, query, where, getDocs,
  updateDoc, doc, arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";

export async function checkBadges({ currentUser, myPosts, friends, streak, unlockedBadges }) {
  if (!currentUser) return [];

  const already = new Set(unlockedBadges || []);
  const newOnes = [];

  function gain(id, condition) {
    if (!already.has(id) && condition) newOnes.push(id);
  }

  const progressPosts = myPosts.filter(p => p.postType !== "tutorial");

  // ── Sync checks ─────────────────────────────────────────────────────────────
  gain("First Post",   progressPosts.length >= 1);
  gain("First Friend", friends.length >= 1);
  gain("7-Day",        streak >= 7);
  gain("Consistent",   streak >= 3);
  gain("Top Learner",  streak >= 14);
  gain("Dedicated",    progressPosts.length >= 7);
  gain("Skill Master", streak >= 30);
  gain("Elite Learner",streak >= 60);
  gain("100-Day",      streak >= 100);
  gain("Video Pro",    myPosts.some(p => p.mediaType?.startsWith("video") && p.postType !== "tutorial"));
  gain("Teacher",      myPosts.some(p => p.postType === "tutorial" && p.mediaType?.startsWith("video")));
  gain("Popular",      myPosts.some(p => (p.likedBy?.length ?? 0) >= 10));

  // ── Async: Community Star — received a comment from someone else ─────────
  if (!already.has("Community Star") && myPosts.length > 0) {
    try {
      const ids = myPosts.map(p => p.id).slice(0, 30);
      const snap = await getDocs(
        query(collection(db, "comments"), where("postId", "in", ids))
      );
      if (snap.docs.some(d => d.data().userId !== currentUser.uid)) {
        newOnes.push("Community Star");
      }
    } catch {}
  }

  // ── Async: Social Butterfly — made 10+ comments ──────────────────────────
  if (!already.has("Social Butterfly")) {
    try {
      const snap = await getDocs(
        query(collection(db, "comments"), where("userId", "==", currentUser.uid))
      );
      if (snap.size >= 10) newOnes.push("Social Butterfly");
    } catch {}
  }

  // ── Write new badges to Firestore ────────────────────────────────────────
  if (newOnes.length > 0) {
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        unlockedBadges: arrayUnion(...newOnes),
      });
    } catch {}
  }

  return newOnes;
}
