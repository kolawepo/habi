export default function BottomNav({ tab, setTab }) {
  return (
    <nav className="bottomNav">
      <button
        className={tab === "home" ? "active" : ""}
        onClick={() => setTab("home")}
      >
        🏠<span>Home</span>
      </button>

      <button
        className={tab === "friends" ? "active" : ""}
        onClick={() => setTab("friends")}
      >
        👥<span>Friends</span>
      </button>

      <button className="plusButton" onClick={() => setTab("upload")}>
        +
      </button>

      <button
        className={tab === "streaks" ? "active" : ""}
        onClick={() => setTab("streaks")}
      >
        🔥<span>Streaks</span>
      </button>

      <button
        className={tab === "messages" ? "active" : ""}
        onClick={() => setTab("messages")}
      >
        💬<span>Messages</span>
      </button>

      <button
        className={tab === "profile" ? "active" : ""}
        onClick={() => setTab("profile")}
      >
        👤<span>Profile</span>
      </button>
    </nav>
  );
}