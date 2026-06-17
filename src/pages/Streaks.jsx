import { useEffect, useRef, useState } from "react";
import { BADGE_DEFS } from "../data/badges";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

function formatUnlockDate(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function Streaks({ streak, myPosts, unlockedBadges = [], newlyUnlockedBadges = [] }) {
  const today         = new Date().getDay();
  const adjustedToday = today === 0 ? 6 : today - 1;

  const isUnlocked = (id) => {
    if (unlockedBadges.includes(id)) return true;
    const progress = (myPosts || []).filter(p => p.postType !== "tutorial");
    switch (id) {
      case "First Post":    return progress.length >= 1;
      case "First Friend":  return false;
      case "7-Day":         return streak >= 7;
      case "Consistent":    return streak >= 3;
      case "Top Learner":   return streak >= 14;
      case "Dedicated":     return progress.length >= 7;
      case "Skill Master":  return streak >= 30;
      case "Elite Learner": return streak >= 60;
      case "100-Day":       return streak >= 100;
      case "Video Pro":     return (myPosts || []).some(p => p.mediaType?.startsWith("video") && p.postType !== "tutorial");
      case "Teacher":       return (myPosts || []).some(p => p.postType === "tutorial" && p.mediaType?.startsWith("video"));
      case "Popular":       return (myPosts || []).some(p => (p.likedBy?.length ?? 0) >= 10);
      default:              return false;
    }
  };

  const [showNewBadge, setShowNewBadge] = useState(false);
  const [flippedBadge, setFlippedBadge] = useState(null);
  const bannerTimer = useRef(null);

  useEffect(() => {
    if (!newlyUnlockedBadges.length) return;

    const unlockDates = JSON.parse(localStorage.getItem("badgeUnlockDates") || "{}");
    newlyUnlockedBadges.forEach(id => { if (!unlockDates[id]) unlockDates[id] = Date.now(); });
    localStorage.setItem("badgeUnlockDates", JSON.stringify(unlockDates));

    setShowNewBadge(true);
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setShowNewBadge(false), 3000);
    return () => clearTimeout(bannerTimer.current);
  }, [newlyUnlockedBadges]); // eslint-disable-line

  const postedToday = (myPosts || []).some(p => {
    const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
    return d.toDateString() === new Date().toDateString();
  });

  const unlockDates = JSON.parse(localStorage.getItem("badgeUnlockDates") || "{}");

  function toggleFlip(badgeId) {
    setFlippedBadge(prev => (prev === badgeId ? null : badgeId));
  }

  return (
    <div className="streaksPage" onClick={() => setFlippedBadge(null)}>
      <div className="streakCard" onClick={e => e.stopPropagation()}>
        <div className="streakFlame">🔥</div>
        <div className="streakNumber">{streak}</div>
        <div className="streakLabel">day streak</div>
        <div className="weekRow">
          {DAYS.map((day, i) => (
            <span key={i} className={i === adjustedToday ? "done" : ""}>{day}</span>
          ))}
        </div>
        {showNewBadge && (
          <div className="streakNewBanner">🎉 New badge unlocked!</div>
        )}
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
          const flipped  = flippedBadge === badge.id;
          return (
            <div
              key={badge.id}
              className={`badgeCard${unlocked ? " unlockedBadge" : " lockedBadge"}${flipped ? " flipped" : ""}`}
              onClick={e => { e.stopPropagation(); if (unlocked) toggleFlip(badge.id); }}
            >
              <div className="badgeCardInner">
                <div className="badgeFront">
                  <span>{badge.emoji}</span>
                  <h3>{badge.id}</h3>
                  {unlocked
                    ? <small>Unlocked 🎉</small>
                    : <small>🔒 {badge.requirement}</small>}
                </div>
                <div className="badgeBack">
                  <span className="badgeBackEmoji">{badge.emoji}</span>
                  <p className="badgeBackReq">{badge.requirement}</p>
                  {unlockDates[badge.id] && (
                    <p className="badgeBackDate">{formatUnlockDate(unlockDates[badge.id])}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
