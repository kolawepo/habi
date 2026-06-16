import { useEffect, useState } from "react";
import Page from "../components/Page";
import { BIBI } from "../data/appData";

const ACHIEVEMENTS = (streak) => [
  { emoji: "⭐", title: "First Post",      locked: streak < 1,   requirement: "Post your first progress update" },
  { emoji: "🔥", title: "7-Day",           locked: streak < 7,   requirement: "Reach a 7 day streak" },
  { emoji: "🏆", title: "Top Learner",     locked: streak < 14,  requirement: "Reach a 14 day streak" },
  { emoji: "👑", title: "Community Star",  locked: true,         requirement: "Get comments from friends" },
  { emoji: "📚", title: "Skill Master",    locked: streak < 30,  requirement: "Reach a 30 day streak" },
  { emoji: "💎", title: "Elite Learner",   locked: streak < 60,  requirement: "Reach a 60 day streak" },
  { emoji: "🚀", title: "100-Day",         locked: streak < 100, requirement: "Reach a 100 day streak" },
  { emoji: "💬", title: "Social Butterfly",locked: true,         requirement: "Comment and reply often" },
  { emoji: "🎥", title: "Video Pro",       locked: true,         requirement: "Upload a video progress post" },
];

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function Streaks({ streak, myPosts }) {
  const today        = new Date().getDay();
  const adjustedToday = today === 0 ? 6 : today - 1;

  const achievements   = ACHIEVEMENTS(streak);
  const unlockedTitles = achievements.filter(a => !a.locked).map(a => a.title);

  const [showBibi, setShowBibi] = useState(false);

  useEffect(() => {
    const celebrated = JSON.parse(localStorage.getItem("celebratedBadges") || "[]");
    const newOnes    = unlockedTitles.filter(t => !celebrated.includes(t));
    if (newOnes.length === 0) return;

    setShowBibi(true);
    localStorage.setItem("celebratedBadges", JSON.stringify([...celebrated, ...newOnes]));
    const t = setTimeout(() => setShowBibi(false), 2800);
    return () => clearTimeout(t);
  }, [streak]); // eslint-disable-line

  const postedToday = myPosts?.some(p => {
    const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
    return d.toDateString() === new Date().toDateString();
  });

  return (
    <Page title="Streaks">
      {/* Bibi celebration toast — only when a new badge was just unlocked */}
      {showBibi && (
        <div className="unlockBibiToast">
          <img src={BIBI.excited} alt="Bibi celebrating" />
          <p>New badge unlocked! 🎉</p>
        </div>
      )}

      {/* Hero streak card */}
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

      {/* Motivation line */}
      <p className="streakMotivation">
        {postedToday
          ? "Great job! Streak secured for today 🔥"
          : streak === 0
            ? "Post something today to start your streak!"
            : "Post today to keep your streak going!"}
      </p>

      {/* Badges */}
      <div className="badgeGrid">
        {achievements.map(a => (
          <div
            key={a.title}
            className={`badgeCard${a.locked ? " lockedBadge" : " unlockedBadge"}`}
          >
            <span>{a.emoji}</span>
            <h3>{a.title}</h3>
            {a.locked
              ? <small>🔒 {a.requirement}</small>
              : <small>Unlocked 🎉</small>}
          </div>
        ))}
      </div>
    </Page>
  );
}
