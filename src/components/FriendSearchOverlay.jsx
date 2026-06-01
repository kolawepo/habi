import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function FriendSearchOverlay({
  onClose,
  friends,
  currentUser,
  handleSendFriendRequest,
  handleCancelFriendRequest,
}) {
  const [query, setQuery]           = useState("");
  const [allUsers, setAllUsers]     = useState([]);
  const [results, setResults]       = useState([]);
  const [pendingIds, setPendingIds] = useState(new Set());
  const inputRef = useRef(null);

  // Fetch all users once on open, then focus the input
  useEffect(() => {
    getDocs(collection(db, "users")).then((snap) => {
      const users = snap.docs
        .filter((d) => d.id !== currentUser?.uid)
        .map((d) => ({ uid: d.id, ...d.data() }));
      setAllUsers(users);
    });
  }, []); // eslint-disable-line

  // Auto-focus after mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Live filter with 250 ms debounce
  useEffect(() => {
    const clean = query.trim().replace(/^@/, "").toLowerCase();
    const t = setTimeout(() => {
      if (!clean) { setResults([]); return; }
      setResults(
        allUsers.filter((u) =>
          (u.username  || "").toLowerCase().includes(clean) ||
          (u.firstName || "").toLowerCase().includes(clean) ||
          (u.lastName  || "").toLowerCase().includes(clean) ||
          (u.name      || "").toLowerCase().includes(clean)
        )
      );
    }, 250);
    return () => clearTimeout(t);
  }, [query, allUsers]);

  function getStatus(user) {
    if (friends.includes(user.uid)) return "friends";
    if (pendingIds.has(user.uid) || (user.friendRequests || []).includes(currentUser?.uid))
      return "requested";
    return "none";
  }

  const content = (
    <div className="spOverlay">
      {/* Header */}
      <div className="spHeader">
        <button className="spBack" onClick={onClose}>←</button>

        <div className="spInputWrap">
          <svg className="spSearchIcon" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>

          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            className="spInput"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or @username"
          />

          {query.length > 0 && (
            <button className="spClear" onClick={() => { setQuery(""); inputRef.current?.focus(); }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="spResults">
        {query.length > 0 && results.length === 0 && (
          <p className="spEmpty">No users found for "{query}"</p>
        )}

        {query.length === 0 && (
          <p className="spHint">Start typing to find people</p>
        )}

        {results.map((user) => {
          const s = getStatus(user);
          return (
            <div key={user.uid} className="spRow">
              <div className="spAvatar">
                {user.profilePhotoUrl
                  ? <img src={user.profilePhotoUrl} alt="" />
                  : (user.username || user.name || "?").charAt(0).toUpperCase()}
              </div>

              <div className="spUserInfo">
                <p className="spName">
                  {user.firstName || user.name?.split(" ")[0] || user.username}
                </p>
                <p className="spHandle">@{user.username}</p>
              </div>

              <div className="spAction">
                {s === "friends" ? (
                  <span className="spTagFriends">Friends</span>
                ) : s === "requested" ? (
                  <button
                    className="spTagRequested"
                    onClick={async () => {
                      await handleCancelFriendRequest(user.uid);
                      setPendingIds((p) => { const n = new Set(p); n.delete(user.uid); return n; });
                    }}
                  >
                    Requested
                  </button>
                ) : (
                  <button
                    className="spAddBtn"
                    onClick={async () => {
                      await handleSendFriendRequest(user.uid);
                      setPendingIds((p) => new Set([...p, user.uid]));
                    }}
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
