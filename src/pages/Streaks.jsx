import { useEffect, useRef, useState } from "react";
import { BADGE_DEFS } from "../data/badges";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

function formatUnlockDate(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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
  const [selectedBadge, setSelectedBadge] = useState(null);
  const bannerTimer = useRef(null);

  // Only show the in-card banner when a badge was JUST unlocked (from checkBadges result)
  useEffect(() => {
    if (!newlyUnlockedBadges.length) return;

    // Store unlock dates in localStorage
    const unlockDates = JSON.parse(localStorage.getItem("badgeUnlockDates") || "{}");
    newlyUnlockedBadges.forEach(id => {
      if (!unlockDates[id]) unlockDates[id] = Date.now();
    });
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

  return (
    <div className="streaksPage">
      <div className="streakCard">
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
          return (
            <div
              key={badge.id}
              className={`badgeCard${unlocked ? " unlockedBadge" : " lockedBadge"}`}
              onClick={() => unlocked && setSelectedBadge(badge)}
            >
              <span>{badge.emoji}</span>
              <h3>{badge.id}</h3>
              {unlocked
                ? <small>Unlocked 🎉</small>
                : <small>🔒 {badge.requirement}</small>}
            </div>
          );
        })}
      </div>

      {selectedBadge && (
        <div className="badgeDetailOverlay" onClick={() => setSelectedBadge(null)}>
          <div className="badgeDetailSheet" onClick={e => e.stopPropagation()}>
            <button className="badgeDetailClose" onClick={() => setSelectedBadge(null)}>✕</button>
            <div className="badgeDetailEmoji">{selectedBadge.emoji}</div>
            <h2 className="badgeDetailName">{selectedBadge.id}</h2>
            <p className="badgeDetailReq">{selectedBadge.requirement}</p>
            {unlockDates[selectedBadge.id] && (
              <p className="badgeDetailDate">Unlocked {formatUnlockDate(unlockDates[selectedBadge.id])}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
