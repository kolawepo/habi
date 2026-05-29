import { useEffect, useState } from "react";
import Page from "../components/Page";
import { BIBI } from "../data/appData";
export default function Streaks({ streak }) {
  const days = ["M", "T", "W", "T", "F", "S", "S"];

  const today = new Date().getDay();

  /*
    0 = Sunday
    1 = Monday
    2 = Tuesday
    3 = Wednesday
    4 = Thursday
    5 = Friday
    6 = Saturday
  */

  const adjustedToday = today === 0 ? 6 : today - 1;

  const achievements = [
    {
      emoji: "🔥",
      title: "7-Day",
      locked: streak < 7,
      requirement: "Reach a 7 day streak",
    },
    {
      emoji: "⭐",
      title: "First Post",
      locked: streak < 1,
      requirement: "Post your first progress update",
    },
    {
      emoji: "🏆",
      title: "Top Learner",
      locked: streak < 14,
      requirement: "Reach a 14 day streak",
    },
    {
      emoji: "👑",
      title: "Community Star",
      locked: true,
      requirement: "Get comments from friends",
    },
    {
      emoji: "📚",
      title: "Skill Master",
      locked: streak < 30,
      requirement: "Reach a 30 day streak",
    },
    {
      emoji: "🚀",
      title: "100-Day",
      locked: streak < 100,
      requirement: "Reach a 100 day streak",
    },
    {
      emoji: "💬",
      title: "Social Butterfly",
      locked: true,
      requirement: "Comment and reply often",
    },
    {
      emoji: "💎",
      title: "Elite Learner",
      locked: streak < 60,
      requirement: "Reach a 60 day streak",
    },
    {
      emoji: "🎥",
      title: "Video Pro",
      locked: true,
      requirement: "Upload a video progress post",
    },
  ];

  const unlockedCount = achievements.filter(
    (item) => !item.locked
  ).length;

  const [showUnlockBibi, setShowUnlockBibi] = useState(false);

  const [lastShownUnlockCount, setLastShownUnlockCount] =
    useState(
      Number(
        localStorage.getItem(
          "lastShownUnlockCount"
        ) || 0
      )
    );

  useEffect(() => {
    if (unlockedCount > lastShownUnlockCount) {
      setShowUnlockBibi(true);

      localStorage.setItem(
        "lastShownUnlockCount",
        unlockedCount
      );

      setLastShownUnlockCount(unlockedCount);

      const timer = setTimeout(() => {
        setShowUnlockBibi(false);
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [unlockedCount, lastShownUnlockCount]);

  return (
    <Page title="Streaks">
      {showUnlockBibi && (
        <div className="unlockBibiWrap">
          <img
            src={BIBI.excited}
            alt="Bibi celebrating"
          />

          <p>New badge unlocked!</p>
        </div>
      )}

      <div className="streakCard">
        <h2>🔥</h2>

        <h1>{streak}</h1>

        <p>day streak</p>

        <div className="weekRow">
          {days.map((day, index) => (
            <span
              key={index}
              className={
                index === adjustedToday
                  ? "done"
                  : ""
              }
            >
              {day}
            </span>
          ))}
        </div>
      </div>

      <div className="badgeGrid">
        {achievements.map((achievement) => (
          <div
            key={achievement.title}
            className={
              achievement.locked
                ? "badgeCard lockedBadge"
                : "badgeCard unlockedBadge"
            }
          >
            <span>{achievement.emoji}</span>

            <h3>{achievement.title}</h3>

            {achievement.locked ? (
              <small>
                🔒 {achievement.requirement}
              </small>
            ) : (
              <small>Unlocked 🎉</small>
            )}
          </div>
        ))}
      </div>
    </Page>
  );
}