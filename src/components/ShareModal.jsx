import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function ShareModal({ friends, videoTitle, onSend, onClose }) {
  const [profiles, setProfiles] = useState([]);
  const [sentToUid, setSentToUid] = useState(null);

  useEffect(() => {
    async function load() {
      if (!friends.length) return;
      const loaded = await Promise.all(
        friends.map(async (uid) => {
          const snap = await getDoc(doc(db, "users", uid));
          return snap.exists() ? { uid, ...snap.data() } : null;
        })
      );
      setProfiles(loaded.filter(Boolean));
    }
    load();
  }, [friends]);

  function handleSend(uid) {
    setSentToUid(uid);
    onSend(uid);
    setTimeout(onClose, 1000);
  }

  return (
    <div className="shareOverlay" onClick={onClose}>
      <div className="shareSheet" onClick={(e) => e.stopPropagation()}>
        <button className="closeFriendProfile" onClick={onClose}>
          ✕
        </button>

        <h2 className="shareTitle">Send to a friend</h2>

        {videoTitle && (
          <p className="shareVideoLabel">{videoTitle}</p>
        )}

        {sentToUid ? (
          <div className="sentConfirmation">Sent!</div>
        ) : profiles.length === 0 ? (
          <div className="emptyVideoState" style={{ marginTop: 20 }}>
            {friends.length === 0
              ? "Add friends first to share videos."
              : "Loading..."}
          </div>
        ) : (
          <div className="shareFriendList">
            {profiles.map((friend) => (
              <button
                key={friend.uid}
                className="shareFriendRow"
                onClick={() => handleSend(friend.uid)}
              >
                <div className="friendAvatar">
                  {friend.profilePhotoUrl ? (
                    <img src={friend.profilePhotoUrl} alt="profile" />
                  ) : (
                    friend.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="shareFriendInfo">
                  <p className="friendName">
                    {friend.firstName || friend.name?.split(" ")[0]}
                  </p>
                  <p className="friendUsername">@{friend.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
