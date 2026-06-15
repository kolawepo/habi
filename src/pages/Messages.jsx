import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";
import { sendPushNotification } from "../utils/notify";

function timeAgo(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  if (diff < 60000)    return "now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

export default function Messages({ currentUser, username, friends, openConvoWithUid, onClearOpenUid }) {
  const [conversations,  setConversations]  = useState([]);
  const [selectedConvo,  setSelectedConvo]  = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [text,           setText]           = useState("");
  const [profiles,       setProfiles]       = useState({});
  const [friendProfiles, setFriendProfiles] = useState([]);
  const [showCompose,    setShowCompose]    = useState(false);
  const [deletingMsgId,  setDeletingMsgId]  = useState(null);

  const threadRef      = useRef(null);
  const threadPageRef  = useRef(null);
  const sendingRef     = useRef(false);
  const longPressTimer = useRef(null);

  // ── Conversations list ────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "dms"),
      where("participants", "array-contains", currentUser.uid)
    );
    return onSnapshot(
      q,
      (snap) => {
        const convos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        convos.sort((a, b) => (b.lastMessageAt?.seconds ?? 0) - (a.lastMessageAt?.seconds ?? 0));
        setConversations(convos);
      },
      (err) => console.error("[Messages] dms query failed:", err.code, err.message)
    );
  }, [currentUser]);

  // ── Load profiles for conversation participants ───────────────────────────
  useEffect(() => {
    async function load() {
      const uids = [
        ...new Set(
          conversations.flatMap((c) =>
            c.participants.filter((uid) => uid !== currentUser?.uid)
          )
        ),
      ];
      const missing = uids.filter((uid) => !profiles[uid]);
      if (!missing.length) return;
      const result = {};
      await Promise.all(
        missing.map(async (uid) => {
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) result[uid] = snap.data();
        })
      );
      if (Object.keys(result).length > 0) setProfiles((prev) => ({ ...prev, ...result }));
    }
    if (conversations.length > 0 && currentUser) load();
  }, [conversations, currentUser]);

  // ── Load friend profiles for compose picker ───────────────────────────────
  useEffect(() => {
    if (!friends?.length) { setFriendProfiles([]); return; }
    async function load() {
      const result = {};
      await Promise.all(
        friends.map(async (uid) => {
          const cached = profiles[uid];
          if (cached) { result[uid] = cached; return; }
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) result[uid] = snap.data();
        })
      );
      setFriendProfiles(Object.entries(result).map(([uid, data]) => ({ uid, ...data })));
    }
    load();
  }, [friends, profiles]);

  // ── Active thread messages ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedConvo) return;
    const q = query(
      collection(db, "dms", selectedConvo.id, "messages"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(
      q,
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("[Messages] thread query failed:", err.code, err.message)
    );
  }, [selectedConvo]);

  // Auto-scroll thread to bottom
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages]);

  // ── iOS keyboard: shift the fixed input bar up when keyboard appears ────────
  useEffect(() => {
    if (!selectedConvo) return;
    const vv = window.visualViewport;
    if (!vv) return;
    function onResize() {
      const keyboardH = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const inputEl = document.querySelector(".dmInputRow");
      if (inputEl) {
        const safeArea = parseInt(
          getComputedStyle(document.documentElement).getPropertyValue("--sab") || "0"
        ) || 0;
        inputEl.style.bottom = keyboardH > 0
          ? `${keyboardH}px`
          : `calc(60px + env(safe-area-inset-bottom, 0px))`;
      }
    }
    vv.addEventListener("resize", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      const inputEl = document.querySelector(".dmInputRow");
      if (inputEl) inputEl.style.bottom = "";
    };
  }, [selectedConvo]);

  // ── Deep-link: open conversation when notified ───────────────────────────
  useEffect(() => {
    if (!openConvoWithUid || !currentUser || selectedConvo) return;
    openConvoWith(openConvoWithUid);
    onClearOpenUid?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openConvoWithUid, currentUser]);

  // ── Send a text message ───────────────────────────────────────────────────
  async function sendText() {
    if (!text.trim() || !selectedConvo || !currentUser || sendingRef.current) return;
    sendingRef.current = true;
    const trimmed = text.trim();
    setText("");
    const convoRef = doc(db, "dms", selectedConvo.id);
    await setDoc(
      convoRef,
      { participants: selectedConvo.participants, lastMessage: trimmed, lastMessageAt: serverTimestamp() },
      { merge: true }
    );
    await addDoc(collection(db, "dms", selectedConvo.id, "messages"), {
      senderId: currentUser.uid,
      senderUsername: username,
      text: trimmed,
      createdAt: serverTimestamp(),
    });
    const otherUid = selectedConvo.participants.find((uid) => uid !== currentUser.uid);
    if (otherUid) {
      sendPushNotification(
        otherUid,
        `${username} sent you a message`,
        trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed,
        `/?tab=messages&uid=${currentUser.uid}`
      );
    }
    sendingRef.current = false;
  }

  // ── Delete message for everyone (own messages) ────────────────────────────
  async function deleteMsgForAll(msgId) {
    setDeletingMsgId(null);
    await deleteDoc(doc(db, "dms", selectedConvo.id, "messages", msgId));
  }

  // ── Remove message just for me (received messages) ────────────────────────
  async function deleteMsgForMe(msgId) {
    setDeletingMsgId(null);
    await updateDoc(doc(db, "dms", selectedConvo.id, "messages", msgId), {
      hiddenFor: arrayUnion(currentUser.uid),
    });
  }

  // ── Long-press helpers ────────────────────────────────────────────────────
  function startLongPress(msgId) {
    longPressTimer.current = setTimeout(() => setDeletingMsgId(msgId), 480);
  }
  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  // ── Open or create a conversation ─────────────────────────────────────────
  function openConvoWith(friendUid) {
    setShowCompose(false);
    const participants = [currentUser.uid, friendUid].sort();
    const convoId = participants.join("_");
    const existing = conversations.find((c) => c.id === convoId);
    if (existing) {
      setSelectedConvo(existing);
    } else {
      setSelectedConvo({ id: convoId, participants, lastMessage: "", lastMessageAt: null });
    }
  }

  // ── Thread view ───────────────────────────────────────────────────────────
  if (selectedConvo) {
    const otherUid = selectedConvo.participants.find((uid) => uid !== currentUser?.uid);
    const other = profiles[otherUid] || friendProfiles.find((f) => f.uid === otherUid) || {};
    const visible = messages.filter(m => !m.hiddenFor?.includes(currentUser?.uid));

    return (
      <div className="dmThreadPage" ref={threadPageRef}>
        <div className="dmThreadHeader">
          <button
            className="dmBackBtn"
            onClick={() => { setSelectedConvo(null); setMessages([]); setDeletingMsgId(null); }}
          >
            ←
          </button>
          <div className="dmThreadAvatar">
            {other.profilePhotoUrl
              ? <img src={other.profilePhotoUrl} alt="" />
              : <span>{(other.username || "?").charAt(0).toUpperCase()}</span>}
          </div>
          <div className="dmThreadInfo">
            <p className="dmThreadName">
              {other.firstName || other.name?.split(" ")[0] || other.username}
            </p>
            <p className="dmThreadHandle">@{other.username}</p>
          </div>
        </div>

        <div
          className="dmThread"
          ref={threadRef}
          onClick={() => setDeletingMsgId(null)}
        >
          {visible.length === 0 && <div className="dmEmptyThread">Say hi! 👋</div>}

          {visible.map((msg) => {
            const isMe      = msg.senderId === currentUser?.uid;
            const isDeleting = deletingMsgId === msg.id;

            const longPressProps = {
              onTouchStart:   () => startLongPress(msg.id),
              onTouchEnd:     cancelLongPress,
              onTouchMove:    cancelLongPress,
              onContextMenu:  (e) => { e.preventDefault(); setDeletingMsgId(msg.id); },
              onClick:        (e) => e.stopPropagation(),
            };

            const deleteBar = isDeleting && (
              <div className="dmDeleteBar">
                {isMe ? (
                  <button className="dmDeleteBtn" onClick={(e) => { e.stopPropagation(); deleteMsgForAll(msg.id); }}>
                    Delete for everyone
                  </button>
                ) : (
                  <button className="dmDeleteBtn" onClick={(e) => { e.stopPropagation(); deleteMsgForMe(msg.id); }}>
                    Remove for me
                  </button>
                )}
              </div>
            );

            // ── Shared post: render as standalone mini-card ──────────────────
            if (msg.postId) {
              return (
                <div
                  key={msg.id}
                  className={`dmPostCard${isMe ? " dmPostCardMine" : ""}${isDeleting ? " dmMsgDeleting" : ""}`}
                  {...longPressProps}
                >
                  <div className="dmPostCardHeader">
                    <span className="dmPostCardUser">@{msg.postUsername}</span>
                    {msg.postSkill && <span className="dmPostCardSkill">{msg.postSkill}</span>}
                  </div>
                  {msg.postMediaType?.startsWith("video") ? (
                    <video className="dmPostCardMedia" src={msg.postMediaUrl} playsInline controls />
                  ) : (
                    <img className="dmPostCardMedia" src={msg.postMediaUrl} alt="" />
                  )}
                  {msg.postCaption && <p className="dmPostCardCaption">{msg.postCaption}</p>}
                  {deleteBar}
                </div>
              );
            }

            // ── Normal bubble (text or YouTube share) ────────────────────────
            return (
              <div
                key={msg.id}
                className={`dmBubble ${isMe ? "dmMine" : "dmTheirs"}${isDeleting ? " dmMsgDeleting" : ""}`}
                {...longPressProps}
              >
                {msg.videoId && (
                  <a
                    className="dmSharedVideo"
                    href={`https://www.youtube.com/watch?v=${msg.videoId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img src={msg.videoThumbnail} alt={msg.videoTitle} />
                    <div className="dmSharedVideoInfo">
                      {msg.videoSkill && <small>{msg.videoSkill}</small>}
                      <p>{msg.videoTitle}</p>
                      <span>Watch on YouTube →</span>
                    </div>
                  </a>
                )}
                {msg.text && <p>{msg.text}</p>}
                {deleteBar}
              </div>
            );
          })}
        </div>

        <div className="dmInputRow">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message…"
            onKeyDown={(e) => { if (e.key === "Enter") sendText(); }}
          />
          <button
            className="dmSendBtn"
            onClick={sendText}
            disabled={!text.trim()}
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>
    );
  }

  // ── Conversation list ─────────────────────────────────────────────────────
  return (
    <div className="dmListPage">
      <div className="dmListHeader">
        <h1 className="dmListTitle">Messages</h1>
        <button className="dmComposeBtn" onClick={() => setShowCompose(true)} aria-label="Compose">
          ✏️
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="dmListEmpty">
          <p>No messages yet</p>
          <p className="dmListEmptyHint">Tap ✏️ to start a conversation</p>
        </div>
      ) : (
        <div className="dmConvoList">
          {conversations.map((convo) => {
            const otherUid = convo.participants.find((uid) => uid !== currentUser?.uid);
            const other = profiles[otherUid] || {};
            return (
              <button
                key={convo.id}
                className="dmConvoRow"
                onClick={() => setSelectedConvo(convo)}
              >
                <div className="dmConvoAvatar">
                  {other.profilePhotoUrl
                    ? <img src={other.profilePhotoUrl} alt="" />
                    : <span>{(other.username || "?").charAt(0).toUpperCase()}</span>}
                </div>
                <div className="dmConvoInfo">
                  <div className="dmConvoTop">
                    <p className="dmConvoName">
                      {other.firstName || other.name?.split(" ")[0] || other.username}
                    </p>
                    <span className="dmConvoTime">{timeAgo(convo.lastMessageAt)}</span>
                  </div>
                  <p className="dmConvoLast">{convo.lastMessage}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showCompose && createPortal(
        <div className="dmComposeOverlay" onClick={() => setShowCompose(false)}>
          <div className="dmComposeSheet" onClick={(e) => e.stopPropagation()}>
            <div className="dmComposeHeader">
              <button className="dmComposeClose" onClick={() => setShowCompose(false)}>✕</button>
              <h2 className="dmComposeTitle">New Message</h2>
            </div>
            {friendProfiles.length === 0 ? (
              <p className="dmComposeEmpty">Add friends first to start a chat</p>
            ) : (
              <div className="dmComposeFriends">
                {friendProfiles.map((friend) => (
                  <button
                    key={friend.uid}
                    className="dmComposeFriend"
                    onClick={() => openConvoWith(friend.uid)}
                  >
                    <div className="dmComposeAvatar">
                      {friend.profilePhotoUrl
                        ? <img src={friend.profilePhotoUrl} alt="" />
                        : <span>{(friend.username || "?").charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="dmComposeFriendInfo">
                      <p className="dmComposeName">
                        {friend.firstName || friend.name?.split(" ")[0] || friend.username}
                      </p>
                      <p className="dmComposeHandle">@{friend.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
