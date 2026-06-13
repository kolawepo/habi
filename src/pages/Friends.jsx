import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Page from "../components/Page";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const INVITE_URL  = "https://habi-sepia.vercel.app";
const INVITE_TEXT = "Join me on Habi — the app for learning new skills! Sign up here: " + INVITE_URL;

// Works on HTTP (execCommand) and HTTPS (Clipboard API)
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for HTTP / older mobile browsers
    const el = Object.assign(document.createElement("textarea"), {
      value: text,
      style: "position:fixed;top:-9999px;left:-9999px;opacity:0",
    });
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

async function shareInvite(setToast) {
  console.log("[Habi] shareInvite called");
  console.log("[Habi] navigator.share:", typeof navigator.share);
  console.log("[Habi] navigator.clipboard:", typeof navigator.clipboard);

  try {
    if (navigator.share) {
      console.log("[Habi] Opening share sheet…");
      await navigator.share({ title: "Habi", text: INVITE_TEXT, url: INVITE_URL });
      console.log("[Habi] Shared successfully");
    } else {
      console.log("[Habi] No share API — copying to clipboard");
      await copyText(INVITE_TEXT);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    }
  } catch (err) {
    console.error("[Habi] shareInvite error:", err.name, err.message);
    if (err.name === "AbortError") {
      // User dismissed the share sheet — that's fine, do nothing
      return;
    }
    // Share failed for another reason — fall back to clipboard
    try {
      console.log("[Habi] Share failed, falling back to clipboard");
      await copyText(INVITE_TEXT);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    } catch (clipErr) {
      console.error("[Habi] Clipboard fallback failed:", clipErr.name, clipErr.message);
    }
  }
}

// Online = lastSeen within the last 5 minutes
function isOnline(lastSeen) {
  if (!lastSeen) return false;
  const ts = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  return Date.now() - ts.getTime() < 5 * 60 * 1000;
}

export default function Friends({
  friendPosts,
  allPosts,
  friends,
  notifications,
  friendRequests,
  handleAcceptFriendRequest,
  handleDeclineFriendRequest,
  setTab,
  currentUser,
  username,
  handleLikePost,
  likedPosts,
}) {
  const [friendRequestProfiles, setFriendRequestProfiles] = useState([]);
  const [friendProfiles,        setFriendProfiles]        = useState([]);
  const [selectedFriend,        setSelectedFriend]        = useState(null);
  const [showRequests,          setShowRequests]          = useState(false);
  const [toast,                 setToast]                 = useState(false);

  useEffect(() => {
    async function load() {
      const pending = friendRequests.filter((uid) => !friends.includes(uid));
      if (!pending.length) { setFriendRequestProfiles([]); return; }
      const profiles = await Promise.all(
        pending.map(async (uid) => {
          const snap = await getDoc(doc(db, "users", uid));
          return snap.exists() ? { uid, ...snap.data() } : null;
        })
      );
      setFriendRequestProfiles(profiles.filter(Boolean));
    }
    load();
  }, [friendRequests, friends]);

  useEffect(() => {
    async function load() {
      if (!friends.length) { setFriendProfiles([]); return; }
      const profiles = await Promise.all(
        friends.map(async (uid) => {
          const snap = await getDoc(doc(db, "users", uid));
          return snap.exists() ? { uid, ...snap.data() } : null;
        })
      );
      setFriendProfiles(profiles.filter(Boolean));
    }
    load();
  }, [friends]);

  const selectedPosts = selectedFriend
    ? allPosts.filter((p) => p.userId === selectedFriend.uid)
    : [];

  // ── Notifications portal ──────────────────────────────────────────────────
  const notifPortal = showRequests && createPortal(
    <div className="fnOverlay" onClick={() => setShowRequests(false)}>
      <div className="fnPanel" onClick={(e) => e.stopPropagation()}>
        <button className="fnClose" onClick={() => setShowRequests(false)}>✕</button>
        <h2 className="fnTitle">Notifications</h2>

        <h3 className="fnSectionLabel">Friend Requests</h3>
        {friendRequestProfiles.length === 0 ? (
          <p className="fnEmpty">No friend requests right now.</p>
        ) : (
          friendRequestProfiles.map((req) => (
            <div key={req.uid} className="fnRequestCard">
              <div className="fpAvatarWrap">
                <div className="fpAvatar">
                  {req.profilePhotoUrl
                    ? <img src={req.profilePhotoUrl} alt="" />
                    : (req.username || "?").charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="fnReqInfo">
                <p className="fnReqName">{req.firstName || req.name?.split(" ")[0]}</p>
                <p className="fnReqHandle">@{req.username}</p>
                <p className="fnReqSubtext">sent you a friend request</p>
              </div>
              <div className="fnReqBtns">
                <button className="fnAccept" onClick={() => { handleAcceptFriendRequest(req.uid); setShowRequests(false); }}>
                  Accept
                </button>
                <button className="fnDecline" onClick={() => handleDeclineFriendRequest(req.uid)}>
                  Decline
                </button>
              </div>
            </div>
          ))
        )}

        <h3 className="fnSectionLabel">Activity</h3>
        {notifications.length === 0 ? (
          <p className="fnEmpty">No activity yet.</p>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className="fnActivityCard">
              <p>{n.text}</p>
            </div>
          ))
        )}
      </div>
    </div>,
    document.body
  );

  // ── Friend profile modal portal ───────────────────────────────────────────
  const profilePortal = selectedFriend && createPortal(
    <div className="friendProfileModal" onClick={() => setSelectedFriend(null)}>
      <div className="friendProfileSheet" onClick={(e) => e.stopPropagation()}>
        <button className="closeFriendProfile" onClick={() => setSelectedFriend(null)}>✕</button>

        <div className="largeFriendAvatar">
          {selectedFriend.profilePhotoUrl
            ? <img src={selectedFriend.profilePhotoUrl} alt="profile" />
            : (selectedFriend.username || "?").charAt(0).toUpperCase()}
        </div>

        <h2>{selectedFriend.name || selectedFriend.firstName}</h2>
        <p>@{selectedFriend.username}</p>

        <div className="friendProfileStats">
          <div><b>{selectedPosts.length}</b><span>Posts</span></div>
          <div><b>{selectedFriend.streak || 0}</b><span>Streak</span></div>
        </div>

        <p className="friendProfileSkills">
          Learning: {selectedFriend.selectedSkills?.join(", ") || "No skills yet"}
        </p>

        <div className="friendUploadGrid">
          {selectedPosts.length === 0 ? (
            <div className="emptyVideoState">No uploads yet.</div>
          ) : (
            selectedPosts.map((post) => (
              <div className="friendMiniUpload" key={post.id}>
                {post.mediaType?.startsWith("video")
                  ? <video src={post.mediaUrl} />
                  : <img src={post.mediaUrl} alt="upload" />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Page title="Friends">
      {/* Bell */}
      <button className="friendBellButton friendsBellFloat" onClick={() => setShowRequests(true)}>
        🔔
        {notifications.length > 0 && (
          <span className="friendBellBadge">{notifications.length}</span>
        )}
      </button>

      {/* fpInner: flex column so invite card is pushed to bottom when content is short */}
      <div className="fpInner">
        <div className="fpScrollable">
          {/* ── Your Friends list ── */}
          <div className="fpSection">
            <h3 className="fpSectionTitle">
              Your Friends{friendProfiles.length > 0 ? ` (${friendProfiles.length})` : ""}
            </h3>

            {friendProfiles.length === 0 ? (
              <p className="fpEmpty">No friends yet — tap 🔍 to find people</p>
            ) : (
              <div className="fpFriendList">
                {friendProfiles.map((friend) => (
                  <div key={friend.uid} className="fpFriendRow">
                    <button className="fpAvatarWrap" onClick={() => setSelectedFriend(friend)}>
                      <div className="fpAvatar">
                        {friend.profilePhotoUrl
                          ? <img src={friend.profilePhotoUrl} alt="" />
                          : (friend.username || "?").charAt(0).toUpperCase()}
                      </div>
                      {isOnline(friend.lastSeen) && <span className="fpOnlineDot" />}
                    </button>

                    <button className="fpFriendInfo" onClick={() => setSelectedFriend(friend)}>
                      <p className="fpFriendName">
                        {friend.firstName || friend.name?.split(" ")[0] || friend.username}
                      </p>
                      <p className="fpFriendHandle">
                        @{friend.username}
                        {isOnline(friend.lastSeen)
                          ? <span className="fpOnlineLabel"> · Online</span>
                          : null}
                      </p>
                    </button>

                    <button className="fpMsgBtn" onClick={() => setTab("messages")}>
                      💬
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Friend Activity ── */}
          <div className="fpSection">
            <h3 className="fpSectionTitle">Friend Activity</h3>

            {friendPosts.length === 0 ? (
              <p className="fpEmpty">Your friends haven't posted yet 👀</p>
            ) : (
              <div className="fpActivityFeed">
                {friendPosts.map((post) => (
                  <div key={post.id} className="fpActivityCard">
                    <div className="fpActivityHeader">
                      <div className="fpAvatar fpActivityAvatar">
                        {post.profilePhotoUrl
                          ? <img src={post.profilePhotoUrl} alt="" />
                          : (post.username || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="fpFriendName">
                          {post.firstName || post.name?.split(" ")[0] || post.username}
                        </p>
                        <p className="fpFriendHandle">@{post.username} · {post.skill}</p>
                      </div>
                    </div>

                    {post.mediaType?.startsWith("video") ? (
                      <video src={post.mediaUrl} className="fpActivityMedia" controls playsInline />
                    ) : (
                      <img src={post.mediaUrl} alt="post" className="fpActivityMedia" />
                    )}

                    {post.caption && (
                      <p className="fpActivityCaption">{post.caption}</p>
                    )}

                    <div className="fpActivityActions">
                      <button
                        className={`fpLikeBtn${likedPosts?.includes(post.id) ? " fpLikeActive" : ""}`}
                        onClick={() => handleLikePost?.(post)}
                        disabled={likedPosts?.includes(post.id) || post.userId === currentUser?.uid}
                        aria-label="Like post"
                      >
                        {likedPosts?.includes(post.id) ? "💜" : "🤍"}
                        {post.likes?.length > 0 && (
                          <span className="fpLikeCount">{post.likes.length}</span>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Invite Friends — stays at bottom, after all content ── */}
        <button className="fpInviteCard" onClick={() => shareInvite(setToast)}>
          <p>Invite Friends</p>
          <p className="fpInviteSub">Share Habi and learn together →</p>
        </button>
      </div>

      {notifPortal}
      {profilePortal}

      {toast && createPortal(
        <div className="fpToast">Link copied!</div>,
        document.body
      )}
    </Page>
  );
}
