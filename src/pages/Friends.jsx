import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const INVITE_URL  = "https://habi-sepia.vercel.app";
const INVITE_TEXT = "Join me on Habi — the app for learning new skills! Sign up here: " + INVITE_URL;

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const el = Object.assign(document.createElement("textarea"), {
      value: text,
      style: "position:fixed;top:-9999px;left:-9999px;opacity:0",
    });
    document.body.appendChild(el);
    el.focus(); el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

async function shareInvite(setToast) {
  try {
    if (navigator.share) {
      await navigator.share({ title: "Habi", text: INVITE_TEXT, url: INVITE_URL });
    } else {
      await copyText(INVITE_TEXT);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    try {
      await copyText(INVITE_TEXT);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    } catch {}
  }
}

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

  // Progress posts only — no tutorials
  const progressPosts = friendPosts.filter((p) => p.postType !== "tutorial");

  const selectedPosts = selectedFriend
    ? allPosts.filter((p) => p.userId === selectedFriend.uid)
    : [];

  const unreadCount = notifications.length + friendRequestProfiles.length;

  // ── Notifications panel ───────────────────────────────────────────────────
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

  // ── Friend profile modal ──────────────────────────────────────────────────
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
          <div><b>{selectedPosts.filter(p => p.postType !== "tutorial").length}</b><span>Posts</span></div>
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
    <div className="friendsPage">
      {/* Top bar */}
      <div className="friendsTopBar">
        <h1 className="friendsTitle">Friends</h1>
        <button className="friendsBellBtn" onClick={() => setShowRequests(true)}>
          🔔
          {unreadCount > 0 && (
            <span className="friendsBellBadge">{unreadCount}</span>
          )}
        </button>
      </div>

      <div className="friendsScroll">
        {/* Stories row */}
        {friendProfiles.length > 0 ? (
          <div className="storiesRow">
            {friendProfiles.map((friend) => (
              <button key={friend.uid} className="storyItem" onClick={() => setSelectedFriend(friend)}>
                <div className="storyAvatarWrap">
                  <div className="storyAvatar">
                    {friend.profilePhotoUrl
                      ? <img src={friend.profilePhotoUrl} alt="" />
                      : <span>{(friend.username || "?").charAt(0).toUpperCase()}</span>}
                  </div>
                  {isOnline(friend.lastSeen) && <div className="storyOnlineDot" />}
                </div>
                <p className="storyUsername">
                  {friend.firstName || friend.name?.split(" ")[0] || friend.username}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="friendsEmptyHero">
            <p className="friendsEmptyText">No friends yet</p>
            <p className="friendsEmptyHint">Tap 🔍 to find people</p>
          </div>
        )}

        <div className="igDivider" />

        {/* Instagram-style feed */}
        {progressPosts.length === 0 ? (
          friends.length > 0 && (
            <p className="igEmptyFeed">Your friends haven't posted yet 👀</p>
          )
        ) : (
          <div className="igFeed">
            {progressPosts.map((post) => {
              const isLiked = likedPosts?.includes(post.id);
              const likeCount = post.likes?.length ?? 0;
              const poster = friendProfiles.find((f) => f.uid === post.userId);

              return (
                <div key={post.id} className="igPost">
                  {/* Header */}
                  <div className="igPostHeader">
                    <button
                      className="igPostAvatarBtn"
                      onClick={() => poster && setSelectedFriend(poster)}
                    >
                      <div className="igPostAvatar">
                        {post.profilePhotoUrl
                          ? <img src={post.profilePhotoUrl} alt="" />
                          : <span>{(post.username || "?").charAt(0).toUpperCase()}</span>}
                      </div>
                    </button>
                    <div className="igPostUser">
                      <p className="igPostUsername">
                        {post.firstName || post.name?.split(" ")[0] || post.username}
                      </p>
                      <p className="igPostSkill">{post.skill}</p>
                    </div>
                  </div>

                  {/* Media */}
                  {post.mediaType?.startsWith("video") ? (
                    <video
                      src={post.mediaUrl}
                      className="igPostMedia"
                      controls
                      playsInline
                    />
                  ) : (
                    <img src={post.mediaUrl} alt="post" className="igPostMedia" />
                  )}

                  {/* Actions */}
                  <div className="igPostActions">
                    <button
                      className={`igLikeBtn${isLiked ? " igLikeActive" : ""}`}
                      onClick={() => handleLikePost?.(post)}
                      disabled={isLiked || post.userId === currentUser?.uid}
                      aria-label="Like"
                    >
                      {isLiked ? "❤️" : "🤍"}
                    </button>
                    <button
                      className="igMsgBtn"
                      onClick={() => setTab("messages")}
                      aria-label="Message"
                    >
                      💬
                    </button>
                  </div>

                  {/* Footer */}
                  {(likeCount > 0 || post.caption) && (
                    <div className="igPostFooter">
                      {likeCount > 0 && (
                        <p className="igLikeCount">
                          {likeCount} {likeCount === 1 ? "like" : "likes"}
                        </p>
                      )}
                      {post.caption && (
                        <p className="igCaption">
                          <span className="igCaptionUser">@{post.username}</span>{" "}
                          {post.caption}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Invite card — bottom of feed */}
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
    </div>
  );
}
