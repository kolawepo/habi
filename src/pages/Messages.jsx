import { useEffect, useState } from "react";
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
} from "firebase/firestore";
import { db } from "../firebase";
import { sendPushNotification } from "../utils/notify";
import Page from "../components/Page";

export default function Messages({ currentUser, username }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [profiles, setProfiles] = useState({});

  useEffect(() => {
    if (!currentUser) return;
    console.log("[Messages] subscribing to dms for uid:", currentUser.uid);
    const q = query(
      collection(db, "dms"),
      where("participants", "array-contains", currentUser.uid)
    );
    return onSnapshot(
      q,
      (snap) => {
        console.log("[Messages] dms snapshot — docs:", snap.docs.length);
        const convos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        convos.sort(
          (a, b) =>
            (b.lastMessageAt?.seconds ?? 0) - (a.lastMessageAt?.seconds ?? 0)
        );
        setConversations(convos);
      },
      (err) => console.error("[Messages] dms query failed:", err.code, err.message)
    );
  }, [currentUser]);

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
      if (Object.keys(result).length > 0) {
        setProfiles((prev) => ({ ...prev, ...result }));
      }
    }

    if (conversations.length > 0 && currentUser) load();
  }, [conversations, currentUser]);

  useEffect(() => {
    if (!selectedConvo) return;
    console.log("[Messages] subscribing to thread:", selectedConvo.id);
    const q = query(
      collection(db, "dms", selectedConvo.id, "messages"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(
      q,
      (snap) => {
        console.log("[Messages] thread snapshot — messages:", snap.docs.length);
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("[Messages] thread query failed:", err.code, err.message)
    );
  }, [selectedConvo]);

  async function sendText() {
    if (!text.trim() || !selectedConvo || !currentUser) return;
    const trimmed = text.trim();
    const convoRef = doc(db, "dms", selectedConvo.id);
    await setDoc(
      convoRef,
      { lastMessage: trimmed, lastMessageAt: serverTimestamp() },
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
        "/?tab=messages"
      );
    }

    setText("");
  }

  if (selectedConvo) {
    const otherUid = selectedConvo.participants.find(
      (uid) => uid !== currentUser?.uid
    );
    const other = profiles[otherUid] || {};

    return (
      <div className="page dmThreadPage">
        <div className="dmHeader">
          <button
            className="dmBackButton"
            onClick={() => setSelectedConvo(null)}
          >
            ←
          </button>
          <div className="dmHeaderAvatar friendAvatar">
            {other.profilePhotoUrl ? (
              <img src={other.profilePhotoUrl} alt="profile" />
            ) : (
              other.username?.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="dmHeaderName">
              {other.firstName || other.name?.split(" ")[0] || other.username}
            </p>
            <p className="dmHeaderUsername">@{other.username}</p>
          </div>
        </div>

        <div className="messageThread">
          {messages.length === 0 && (
            <div className="emptyVideoState" style={{ marginTop: 20 }}>
              No messages yet. Say hi!
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.uid;
            return (
              <div
                key={msg.id}
                className={`messageBubble ${isMe ? "myMessage" : "theirMessage"}`}
              >
                {msg.videoId && (
                  <a
                    className="sharedVideoPreview"
                    href={`https://www.youtube.com/watch?v=${msg.videoId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img src={msg.videoThumbnail} alt={msg.videoTitle} />
                    <div className="sharedVideoInfo">
                      {msg.videoSkill && <small>{msg.videoSkill}</small>}
                      <p>{msg.videoTitle}</p>
                      <span>Watch on YouTube →</span>
                    </div>
                  </a>
                )}
                {msg.text ? <p>{msg.text}</p> : null}
              </div>
            );
          })}
        </div>

        <div className="dmInputBar">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Send a message..."
            onKeyDown={(e) => {
              if (e.key === "Enter") sendText();
            }}
          />
          <button onClick={sendText}>Send</button>
        </div>
      </div>
    );
  }

  return (
    <Page title="Messages">
      {conversations.length === 0 ? (
        <div className="emptyVideoState">
          No messages yet. Share a video to start a chat.
        </div>
      ) : (
        <div className="conversationList">
          {conversations.map((convo) => {
            const otherUid = convo.participants.find(
              (uid) => uid !== currentUser?.uid
            );
            const other = profiles[otherUid] || {};
            return (
              <button
                key={convo.id}
                className="conversationRow"
                onClick={() => setSelectedConvo(convo)}
              >
                <div className="friendAvatar">
                  {other.profilePhotoUrl ? (
                    <img src={other.profilePhotoUrl} alt="profile" />
                  ) : (
                    other.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="convoInfo">
                  <p className="convoName">
                    {other.firstName ||
                      other.name?.split(" ")[0] ||
                      other.username}
                  </p>
                  <p className="convoLast">{convo.lastMessage}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Page>
  );
}
