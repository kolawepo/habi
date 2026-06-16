import { useEffect, useState } from "react";
import Page from "../components/Page";
import { BIBI } from "../data/appData";
import { BADGE_DEFS } from "../data/badges";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function Streaks({ streak, myPosts, unlockedBadges = [] }) {
  const today         = new Date().getDay();
  const adjustedToday = today === 0 ? 6 : today - 1;

  // Each badge is unlocked if Firestore says so OR the real-time condition is met
  const isUnlocked = (id) => {
    if (unlockedBadges.includes(id)) return true;
    // Real-time fallback for streak/post conditions (shows immediately, Firestore catches up async)
    const progress = (myPosts || []).filter(p => p.postType !== "tutorial");
    switch (id) {
      case "First Post":   return progress.length >= 1;
      case "First Friend": return false; // needs friends data — rely on Firestore
      case "7-Day":        return streak >= 7;
      case "Consistent":   return streak >= 3;
      case "Top Learner":  return streak >= 14;
      case "Dedicated":    return progress.length >= 7;
      case "Skill Master": return streak >= 30;
      case "Elite Learner":return streak >= 60;
      case "100-Day":      return streak >= 100;
      case "Video Pro":    return (myPosts || []).some(p => p.mediaType?.startsWith("video") && p.postType !== "tutorial");
      case "Teacher":      return (myPosts || []).some(p => p.postType === "tutorial" && p.mediaType?.startsWith("video"));
      case "Popular":      return (myPosts || []).some(p => (p.likedBy?.length ?? 0) >= 10);
      default:             return false;
    }
  };

  const [showBibi, setShowBibi] = useState(false);

  useEffect(() => {
    const celebrated = JSON.parse(localStorage.getItem("celebratedBadges") || "[]");
    const newOnes    = unlockedBadges.filter(id => !celebrated.includes(id));
    if (newOnes.length === 0) return;

    setShowBibi(true);
    localStorage.setItem("celebratedBadges", JSON.stringify([...celebrated, ...newOnes]));
    const t = setTimeout(() => setShowBibi(false), 2800);
    return () => clearTimeout(t);
  }, [unlockedBadges.join(",")]); // eslint-disable-line

  const postedToday = (myPosts || []).some(p => {
    const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
    return d.toDateString() === new Date().toDateString();
  });

  return (
    <Page title="Streaks">
      {showBibi && (
        <div className="unlockBibiToast">
          <img src={BIBI.excited} alt="Bibi celebrating" />
          <p>New badge unlocked! 🎉</p>
        </div>
      )}

      <div className="streakCard">
        <div className="streakFlame">🔥</div>
        <div className="streakNumber">{streak}</div>
        <div className="streakLabel">day streak</div>
        <div className="weekRow">
          {DAYS.map((day, i) => (
            <span key={i} className={i === adjustedToday ? "done" : ""}>{day}</span>
          ))}
        </div>
      </div>

      <p className="streakMotivation">
        {postedToday
          ? "Great job! Streak secured for today 🔥"
          : streak === 0
            ? "Post something today to start your streak!"
            : "Post today to keep your streak going!"}
      </p>

      <div className="badgeGrid">
        {BADGE_DEFS.map(badge => {
          const unlocked = isUnlocked(badge.id);
          return (
            <div key={badge.id} className={`badgeCard${unlocked ? " unlockedBadge" : " lockedBadge"}`}>
              <span>{badge.emoji}</span>
              <h3>{badge.id}</h3>
              {unlocked
                ? <small>Unlocked 🎉</small>
                : <small>🔒 {badge.requirement}</small>}
            </div>
          );
        })}
      </div>
    </Page>
  );
}
