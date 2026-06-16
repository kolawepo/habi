import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import ShareModal from "../components/ShareModal";

function timeAgo(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  if (diff < 60000)    return "now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function postDate(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  const days = diff / 86400000;
  if (days < 1)  return `${Math.floor(diff / 3600000) || 1}h ago`;
  if (days < 7)  return `${Math.floor(days)} day${Math.floor(days) === 1 ? "" : "s"} ago`;
  const opts = { month: "long", day: "numeric" };
  if (date.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return date.toLocaleDateString("en-US", opts);
}

function notifIcon(type) {
  if (type === "friend_request")  return "👋";
  if (type === "friend_accepted") return "🤝";
  if (type === "new_post")        return "📸";
  if (type === "post_like")       return "❤️";
  return "🔔";
}

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
    try { await copyText(INVITE_TEXT); setToast(true); setTimeout(() => setToast(false), 2500); } catch {}
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
  currentUser,
  username,
  handleLikePost,
  likedPosts,
  onShareToFriend,
}) {
  const [friendRequestProfiles, setFriendRequestProfiles] = useState([]);
  const [friendProfiles,        setFriendProfiles]        = useState([]);
  const [selectedFriend,        setSelectedFriend]        = useState(null);
  const [showRequests,          setShowRequests]          = useState(false);
  const [toast,                 setToast]                 = useState(false);

  // inline comments
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [postComments,   setPostComments]   = useState([]);
  const [newComment,     setNewComment]     = useState("");
  const [replyingToId,   setReplyingToId]   = useState(null);
  const [replyText,      setReplyText]      = useState("");
  const [deletingId,     setDeletingId]     = useState(null);

  // share
  const [shareMenuPost, setShareMenuPost] = useState(null); // post with share options open
  const [sharePickPost, setSharePickPost] = useState(null); // post for in-app friend picker

  const longPressRef = useRef(null);

  // ── Load friend request profiles ──────────────────────────────────────────
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

  // ── Load friend profiles ──────────────────────────────────────────────────
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

  // ── Comments subscription (all comments including replies) ────────────────
  useEffect(() => {
    if (!expandedPostId) { setPostComments([]); return; }
    const q = query(collection(db, "comments"), where("postId", "==", expandedPostId));
    return onSnapshot(q, (snap) => {
      setPostComments(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
      );
    });
  }, [expandedPostId]);

  const progressPosts = friendPosts.filter((p) => p.postType !== "tutorial");

  const selectedPosts = selectedFriend
    ? allPosts.filter((p) => p.userId === selectedFriend.uid)
    : [];

  const unreadNotifCount = notifications.filter((n) => !n.read).length;
  const unreadCount = unreadNotifCount + friendRequestProfiles.length;

  async function markAsRead() {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, "notifications", n.id), { read: true, readAt: serverTimestamp() });
    });
    await batch.commit();
  }

  async function submitComment(postId) {
    if (!newComment.trim() || !currentUser) return;
    const post = progressPosts.find(p => p.id === postId);
    await addDoc(collection(db, "comments"), {
      postId,
      postOwnerId: post?.userId,
      userId: currentUser.uid,
      username,
      text: newComment.trim(),
      createdAt: serverTimestamp(),
    });
    setNewComment("");
  }

  async function submitReply(parentCommentId, postId) {
    if (!replyText.trim() || !currentUser) return;
    const post = progressPosts.find(p => p.id === postId);
    await addDoc(collection(db, "comments"), {
      postId,
      parentCommentId,
      postOwnerId: post?.userId,
      userId: currentUser.uid,
      username,
      text: replyText.trim(),
      createdAt: serverTimestamp(),
    });
    setReplyText("");
    setReplyingToId(null);
  }

  async function removeComment(commentId) {
    // also delete any replies to this comment
    const replies = postComments.filter(c => c.parentCommentId === commentId);
    const batch = writeBatch(db);
    replies.forEach(r => batch.delete(doc(db, "comments", r.id)));
    batch.delete(doc(db, "comments", commentId));
    await batch.commit();
    setDeletingId(null);
  }

  function startLongPress(commentId, isOwn) {
    if (!isOwn) return;
    longPressRef.current = setTimeout(() => setDeletingId(commentId), 480);
  }
  function cancelLongPress() {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  }

  function doExternalShare(post) {
    const url = INVITE_URL;
    const text = `@${post.username}${post.caption ? `: ${post.caption}` : ""} — on Habi`;
    if (navigator.share) {
      navigator.share({ title: "Habi", text, url }).catch(e => {
        if (e.name !== "AbortError") { copyText(`${text}\n${url}`); setToast(true); setTimeout(() => setToast(false), 2500); }
      });
    } else {
      copyText(`${text}\n${url}`).then(() => { setToast(true); setTimeout(() => setToast(false), 2500); }).catch(() => {});
    }
  }

  function sendToFriend(friendUid) {
    if (!sharePickPost) return;
    onShareToFriend?.(friendUid, {
      postId: sharePickPost.id,
      postCaption: sharePickPost.caption,
      postMediaUrl: sharePickPost.mediaUrl,
      postMediaType: sharePickPost.mediaType,
      postUsername: sharePickPost.username,
      postSkill: sharePickPost.skill,
    });
    setSharePickPost(null);
  }

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
                <button className="fnAccept" onClick={() => { handleAcceptFriendRequest(req.uid); setShowRequests(false); }}>Accept</button>
                <button className="fnDecline" onClick={() => handleDeclineFriendRequest(req.uid)}>Decline</button>
              </div>
            </div>
          ))
        )}
        <h3 className="fnSectionLabel">Activity</h3>
        {notifications.length === 0 ? (
          <p className="fnEmpty">No activity yet.</p>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className={`fnActivityCard${n.read ? "" : " fnActivityUnread"}`}>
              <div className="fnActivityAvatar">
                {n.senderProfilePhotoUrl
                  ? <img src={n.senderProfilePhotoUrl} alt="" />
                  : <span>{(n.senderUsername || "?").charAt(0).toUpperCase()}</span>}
                <span className="fnActivityIcon">{notifIcon(n.type)}</span>
              </div>
              <div className="fnActivityBody">
                <p className="fnActivityText">{n.text}</p>
                <p className="fnActivityTime">{timeAgo(n.createdAt)}</p>
              </div>
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
      <div className="friendsTopBar">
        <h1 className="friendsTitle">Friends</h1>
        <button className="friendsBellBtn" onClick={() => { setShowRequests(true); markAsRead(); }}>
          🔔
          {unreadCount > 0 && <span className="friendsBellBadge">{unreadCount}</span>}
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

        {/* Feed */}
        {progressPosts.length === 0 ? (
          friends.length > 0 && <p className="igEmptyFeed">Your friends haven't posted yet 👀</p>
        ) : (
          <div className="igFeed">
            {progressPosts.map((post) => {
              const isLiked   = post.likes?.includes(currentUser?.uid) || likedPosts?.includes(post.id);
              const likeCount = post.likes?.length ?? 0;
              const poster    = friendProfiles.find((f) => f.uid === post.userId);
              const expanded  = expandedPostId === post.id;

              // split flat comment list into roots + replies (only when this post is expanded)
              const rootComments = expanded
                ? postComments.filter(c => !c.parentCommentId)
                : [];
              const repliesFor = (parentId) =>
                postComments.filter(c => c.parentCommentId === parentId);

              return (
                <div key={post.id} className="igPost">
                  {/* Header */}
                  <div className="igPostHeader">
                    <button className="igPostAvatarBtn" onClick={() => poster && setSelectedFriend(poster)}>
                      <div className="igPostAvatar">
                        {post.profilePhotoUrl
                          ? <img src={post.profilePhotoUrl} alt="" />
                          : <span>{(post.username || "?").charAt(0).toUpperCase()}</span>}
                      </div>
                    </button>
                    <div className="igPostUser">
                      <p className="igPostUsername">@{post.username}</p>
                    </div>
                  </div>

                  {/* Media */}
                  {post.mediaType?.startsWith("video") ? (
                    <video src={post.mediaUrl} className="igPostMedia" controls playsInline />
                  ) : (
                    <img src={post.mediaUrl} alt="post" className="igPostMedia" />
                  )}

                  {/* Actions */}
                  <div className="igPostActions">
                    <button
                      className={`igLikeBtn${isLiked ? " igLikeActive" : ""}`}
                      onClick={() => handleLikePost?.(post)}
                      aria-label="Like"
                    >
                      {isLiked ? "❤️" : "🤍"}
                    </button>
                    <button
                      className={`igMsgBtn${expanded ? " igMsgActive" : ""}`}
                      onClick={() => {
                        setExpandedPostId(expanded ? null : post.id);
                        setNewComment("");
                        setReplyingToId(null);
                        setDeletingId(null);
                      }}
                      aria-label="Comments"
                    >
                      💬
                    </button>
                    <button
                      className="igMsgBtn"
                      onClick={() => setShareMenuPost(post)}
                      aria-label="Share"
                    >
                      ↗
                    </button>
                  </div>

                  {/* Footer */}
                  <div className="igPostFooter">
                    {!poster?.hideLikeCount && likeCount > 0 && (
                      <p className="igLikeCount">{likeCount} {likeCount === 1 ? "like" : "likes"}</p>
                    )}
                    {post.caption && (
                      <p className="igCaption">
                        <span className="igCaptionUser">@{post.username}</span>{" "}{post.caption}
                      </p>
                    )}
                    {post.createdAt && (
                      <p className="igPostDate">{postDate(post.createdAt)}</p>
                    )}
                  </div>

                  {/* Inline comments */}
                  {expanded && (
                    <div className="igComments" onClick={() => setDeletingId(null)}>
                      {rootComments.length === 0 ? (
                        <p className="igCommentsEmpty">No comments yet</p>
                      ) : (
                        rootComments.map(c => {
                          const isOwn      = c.userId === currentUser?.uid;
                          const isDeleting = deletingId === c.id;
                          const replies    = repliesFor(c.id);

                          return (
                            <div key={c.id} className="igCommentThread">
                              {/* Root comment */}
                              <div
                                className={`igComment${isDeleting ? " igCommentDeleting" : ""}`}
                                onTouchStart={() => startLongPress(c.id, isOwn)}
                                onTouchEnd={cancelLongPress}
                                onTouchMove={cancelLongPress}
                                onContextMenu={e => { if (isOwn) { e.preventDefault(); setDeletingId(c.id); } }}
                                onClick={e => e.stopPropagation()}
                              >
                                <div className="igCommentMain">
                                  <span className="igCommentUser">@{c.username}</span>
                                  <span className="igCommentText">{c.text}</span>
                                </div>
                                <div className="igCommentMeta">
                                  {isDeleting && isOwn ? (
                                    <button
                                      className="igCommentDel"
                                      onClick={e => { e.stopPropagation(); removeComment(c.id); }}
                                    >
                                      Delete
                                    </button>
                                  ) : (
                                    <button
                                      className="igCommentReplyBtn"
                                      onClick={e => {
                                        e.stopPropagation();
                                        setReplyingToId(replyingToId === c.id ? null : c.id);
                                        setReplyText("");
                                        setDeletingId(null);
                                      }}
                                    >
                                      Reply
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Threaded replies */}
                              {replies.map(r => {
                                const rOwn      = r.userId === currentUser?.uid;
                                const rDeleting = deletingId === r.id;
                                return (
                                  <div
                                    key={r.id}
                                    className={`igReply${rDeleting ? " igCommentDeleting" : ""}`}
                                    onTouchStart={() => startLongPress(r.id, rOwn)}
                                    onTouchEnd={cancelLongPress}
                                    onTouchMove={cancelLongPress}
                                    onContextMenu={e => { if (rOwn) { e.preventDefault(); setDeletingId(r.id); } }}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <div className="igCommentMain">
                                      <span className="igCommentUser">@{r.username}</span>
                                      <span className="igCommentText">{r.text}</span>
                                    </div>
                                    {rDeleting && rOwn && (
                                      <div className="igCommentMeta">
                                        <button
                                          className="igCommentDel"
                                          onClick={e => { e.stopPropagation(); removeComment(r.id); }}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Reply input */}
                              {replyingToId === c.id && (
                                <div className="igReplyBar">
                                  <input
                                    className="igCommentInput"
                                    value={replyText}
                                    autoFocus
                                    onChange={e => setReplyText(e.target.value)}
                                    placeholder={`Reply to @${c.username}…`}
                                    onKeyDown={e => { if (e.key === "Enter") submitReply(c.id, post.id); }}
                                  />
                                  <button
                                    className="igCommentSend"
                                    onClick={() => submitReply(c.id, post.id)}
                                    disabled={!replyText.trim()}
                                  >↑</button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}

                      {/* New top-level comment */}
                      <div className="igCommentBar">
                        <input
                          className="igCommentInput"
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          placeholder="Add a comment…"
                          onKeyDown={e => { if (e.key === "Enter") submitComment(post.id); }}
                        />
                        <button
                          className="igCommentSend"
                          onClick={() => submitComment(post.id)}
                          disabled={!newComment.trim()}
                        >↑</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Invite card */}
        <button className="fpInviteCard" onClick={() => shareInvite(setToast)}>
          <p>Invite Friends</p>
          <p className="fpInviteSub">Share Habi and learn together →</p>
        </button>
      </div>

      {notifPortal}
      {profilePortal}

      {/* Share options menu */}
      {shareMenuPost && createPortal(
        <div className="igShareOverlay" onClick={() => setShareMenuPost(null)}>
          <div className="igShareSheet" onClick={e => e.stopPropagation()}>
            <p className="igShareTitle">Share post</p>
            <button
              className="igShareOption"
              onClick={() => {
                setSharePickPost(shareMenuPost);
                setShareMenuPost(null);
              }}
            >
              <span className="igShareOptionIcon">👥</span>
              <span>Share to Friends</span>
              <span className="igShareOptionHint">Send as a message</span>
            </button>
            <button
              className="igShareOption"
              onClick={() => {
                doExternalShare(shareMenuPost);
                setShareMenuPost(null);
              }}
            >
              <span className="igShareOptionIcon">↗</span>
              <span>Share externally</span>
              <span className="igShareOptionHint">Share outside of Habi</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* In-app friend picker */}
      {sharePickPost && (
        <ShareModal
          friends={friends}
          videoTitle={`@${sharePickPost.username}: ${sharePickPost.caption || "Shared post"}`}
          onSend={sendToFriend}
          onClose={() => setSharePickPost(null)}
        />
      )}

      {toast && createPortal(
        <div className="fpToast">Link copied!</div>,
        document.body
      )}
    </div>
  );
}
