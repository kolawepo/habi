import { useEffect, useRef, useState } from "react";
import "./App.css";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  limit,
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import { auth, db, storage } from "./firebase";

import { useFCM } from "./hooks/useFCM";
import { sendPushNotification } from "./utils/notify";

import { BIBI, themes, goals } from "./data/appData";

import {
  goalEmoji,
  sectionEmoji,
  skillEmoji,
} from "./utils/emojis";

import Splash from "./components/Splash";
import Onboarding from "./components/Onboarding";
import AuthScreen from "./components/AuthScreen";
import MainApp from "./components/MainApp";
import IOSInstallPrompt from "./components/IOSInstallPrompt";
import { checkBadges } from "./utils/checkBadges";
import { creditReferral } from "./utils/referral";


export default function App() {
  const [screen, setScreen] = useState("splash");
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("habi_darkMode") === "true");

  const [tab, setTab] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("tab") || "home";
  });

  const [openMessageUid, setOpenMessageUid] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("tab") === "messages" ? (p.get("uid") || null) : null;
  });

  const [referralCode, setReferralCode] = useState("");
  const [referralCount, setReferralCount] = useState(0);

  // Captured once on first render so authMode's initial value can react to it.
  const [referralCodeFromUrl] = useState(() => {
    const match = window.location.pathname.match(/^\/r\/([A-Za-z0-9_-]+)$/);
    return match ? match[1].toLowerCase() : null;
  });
  // True when this load originated from a /r/{code} link, so the auth-state effect
  // below sends a logged-out visitor straight into onboarding (same as "Get Started")
  // instead of the splash screen.
  const referralLandingRef = useRef(!!referralCodeFromUrl);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const name = `${firstName} ${lastName}`.trim();
  const [username, setUsername] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [selectedThemes, setSelectedThemes] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectedGoal, setSelectedGoal] = useState("");

  const [authMode, setAuthMode] = useState(() => (referralCodeFromUrl ? "create" : "login"));

  useEffect(() => {
    if (!referralCodeFromUrl) return;
    localStorage.setItem("habi_referral_code", referralCodeFromUrl);
    window.history.replaceState({}, "", "/");
  }, [referralCodeFromUrl]);

  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);

  const [posts, setPosts] = useState([]);
const [friends, setFriends] = useState([]);
const [friendRequests, setFriendRequests] = useState([]);
const [notifications, setNotifications] = useState([]);
const [likedVideos, setLikedVideos] = useState(() => {
  const saved = localStorage.getItem("likedVideos");
  return saved ? JSON.parse(saved) : [];
});

const [savedVideos, setSavedVideos] = useState(() => {
  const saved = localStorage.getItem("savedVideos");
  return saved ? JSON.parse(saved) : [];
});


useEffect(() => {
  localStorage.setItem(
    "likedVideos",
    JSON.stringify(likedVideos)
  );
}, [likedVideos]);


useEffect(() => {
  localStorage.setItem(
    "savedVideos",
    JSON.stringify(savedVideos)
  );
}, [savedVideos]);

useEffect(() => {
  if (!currentUser) return;

  updateDoc(doc(db, "users", currentUser.uid), {
    likedVideos,
  });
}, [likedVideos, currentUser]);

useEffect(() => {
  if (!currentUser) return;

  updateDoc(doc(db, "users", currentUser.uid), {
    savedVideos,
  });
}, [savedVideos, currentUser]);

// Apply dark/light theme to <html>
useEffect(() => {
  document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  localStorage.setItem("habi_darkMode", darkMode);
}, [darkMode]);

function toggleDarkMode() {
  const next = !darkMode;
  setDarkMode(next);
  if (currentUser) {
    updateDoc(doc(db, "users", currentUser.uid), { darkMode: next }).catch(() => {});
  }
}

async function toggleHideLikeCount() {
  const next = !hideLikeCount;
  setHideLikeCount(next);
  if (currentUser) {
    await updateDoc(doc(db, "users", currentUser.uid), { hideLikeCount: next });
  }
}

// Presence: stamp lastSeen on open and every time the tab comes back to foreground
useEffect(() => {
  if (!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  const ping = () => updateDoc(userRef, { lastSeen: serverTimestamp() }).catch(() => {});
  ping();
  const onVisible = () => { if (document.visibilityState === "visible") ping(); };
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}, [currentUser]); // eslint-disable-line

const [streak,              setStreak]              = useState(0);
  const [lastPostDate,        setLastPostDate]        = useState(null);
  const [unlockedBadges,      setUnlockedBadges]      = useState([]);
  const [newlyUnlockedBadges, setNewlyUnlockedBadges] = useState([]);

  const [likedPosts,     setLikedPosts]     = useState([]);
  const [hideLikeCount,  setHideLikeCount]  = useState(false);

  const [sharedVideos, setSharedVideos] = useState([]);

  // FCM: request permission, save token, handle foreground messages
  function handleNotificationTabSwitch(link) {
    const params = new URLSearchParams(link.split("?")[1] || "");
    const t = params.get("tab");
    const uid = params.get("uid");
    if (t) setTab(t);
    if (uid) setOpenMessageUid(uid);
  }
  useFCM(currentUser, handleNotificationTabSwitch);

  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [skillTheme, setSkillTheme] = useState(null);
  const [skillSection, setSkillSection] = useState(null);

  const finalSkills = [...new Set(selectedSkills)];

  const myPosts = posts.filter(
    (post) => post.userId === currentUser?.uid && post.postType !== "tutorial"
  );
  const myLikedPosts = posts.filter((post) => post.likedBy?.includes(currentUser?.uid));
  const friendFeedPosts = posts.filter((post) =>
  friends.includes(post.userId)
);

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(
    auth,
    async (user) => {
      try {
        if (user) {
          setCurrentUser(user);
          // A referral code can only ever apply at signup, so it's stale once we know
          // the visitor already has an account.
          localStorage.removeItem("habi_referral_code");

          const userDoc = await getDoc(doc(db, "users", user.uid));

          if (userDoc.exists()) {
            const userData = userDoc.data();

            setFirstName(userData.firstName || userData.name?.split(" ")[0] || "");
            setLastName(userData.lastName || userData.name?.split(" ").slice(1).join(" ") || "");
            setUsername(userData.username || "");
            setProfilePhotoUrl(userData.profilePhotoUrl || "");
            setSelectedThemes(userData.selectedThemes || []);
            setSelectedSkills(userData.selectedSkills || []);
            setSelectedGoal(userData.selectedGoal || "");
            setStreak(userData.streak || 0);
            setLastPostDate(userData.lastPostDate || null);
            setUnlockedBadges(userData.unlockedBadges || []);
            setFriends(userData.friends || []);
            setFriendRequests(userData.friendRequests || []);
            setLikedVideos(userData.likedVideos || []);
            setSavedVideos(userData.savedVideos || []);
            if (userData.darkMode !== undefined) setDarkMode(userData.darkMode);
            setHideLikeCount(userData.hideLikeCount || false);
            setReferralCode(userData.referralCode || "");
            setReferralCount(userData.referralCount || 0);

            setScreen("main");
          } else {
            setScreen("splash");
          }
        } else {
          setCurrentUser(null);
          setScreen(referralLandingRef.current ? "interests" : "splash");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setCurrentUser(null);
        setScreen(referralLandingRef.current ? "auth" : "splash");
      } finally {
        setAuthChecked(true);
      }
    }
  );

  return () => unsubscribe();
}, []);

  useEffect(() => {
    if (!currentUser) return;

    const postsQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postData = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      setPosts(postData);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
  if (!currentUser) return;

  const notificationsQuery = query(
  collection(db, "notifications"),
  where("userId", "==", currentUser.uid),
  orderBy("createdAt", "desc")
);

  const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
    const notificationData = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));

    setNotifications(notificationData);
  });

  return () => unsubscribe();
}, [currentUser]);

  useEffect(() => {
  if (!currentUser) return;

  const userRef = doc(db, "users", currentUser.uid);

  const unsubscribe = onSnapshot(userRef, (snapshot) => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    setFriends(data.friends || []);
    setFriendRequests(data.friendRequests || []);
    setStreak(data.streak || 0);
    setLastPostDate(data.lastPostDate || null);
    setUnlockedBadges(data.unlockedBadges || []);
    setProfilePhotoUrl(data.profilePhotoUrl || "");
    setUsername(data.username || "");
    setSelectedSkills(data.selectedSkills || []);
    setHideLikeCount(data.hideLikeCount || false);
    setReferralCount(data.referralCount || 0);
  });

  return () => unsubscribe();
}, [currentUser]);

  // ── Auto-check badges whenever streak, posts, or friends change ────────────
  const badgeCheckKey = `${streak}:${posts.length}:${friends.length}`;
  const lastBadgeKey  = useRef("");
  useEffect(() => {
    if (!currentUser || badgeCheckKey === lastBadgeKey.current) return;
    lastBadgeKey.current = badgeCheckKey;
    checkBadges({ currentUser, myPosts, friends, streak, unlockedBadges })
      .then(newOnes => {
        if (newOnes.length > 0) {
          setUnlockedBadges(prev => [...new Set([...prev, ...newOnes])]);
          setNewlyUnlockedBadges(newOnes);
        }
      })
      .catch(() => {});
  }); // eslint-disable-line

  // ── Real-time streak freshness check (runs on Home/Streaks load) ───────────
  function checkStreakFreshness(uid, lpDate, currentStreak) {
    if (!uid || !lpDate || currentStreak === 0) return; // nothing to reset

    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString();

    if (lpDate === today || lpDate === yesterday) return; // still valid — don't touch

    setStreak(0);
    updateDoc(doc(db, "users", uid), { streak: 0 }).catch(() => {});
  }

  useEffect(() => {
    if (tab !== "home" && tab !== "streaks") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkStreakFreshness(currentUser?.uid, lastPostDate, streak);
  }, [tab, currentUser, lastPostDate, streak]);

  function toggleTheme(themeName) {
    setSelectedThemes((prev) =>
      prev.includes(themeName)
        ? prev.filter((item) => item !== themeName)
        : [...prev, themeName]
    );
  }

  function toggleSkill(skill) {
    setSelectedSkills((prev) =>
      prev.includes(skill)
        ? prev.filter((item) => item !== skill)
        : [...prev, skill]
    );
  }

  async function removeSkill(skillToRemove) {
    const updated = selectedSkills.filter((skill) => skill !== skillToRemove);
    setSelectedSkills(updated);
    if (currentUser) {
      await updateDoc(doc(db, "users", currentUser.uid), { selectedSkills: updated });
    }
  }

  function handleUpload(e) {
  const file = e.target.files?.[0];

  if (!file) return;

  const maxSize = 200 * 1024 * 1024; // 200MB

  if (file.size > maxSize) {
    alert(
      "Video is too large. Try uploading a shorter or lower quality video."
    );
    return;
  }

  setUploadFile(file);

  setUploadPreview(URL.createObjectURL(file));
}

  async function handleCreatePost(postType = "progress", tutorialSkill = null) {
    if (!currentUser) return;

    if (!uploadFile) {
      alert("Please choose a photo or video first.");
      return;
    }

    setPosting(true);

    try {
      const filePath = `posts/${currentUser.uid}/${Date.now()}-${uploadFile.name}`;
      const fileRef = ref(storage, filePath);

      await uploadBytes(fileRef, uploadFile);

      const mediaUrl = await getDownloadURL(fileRef);

      const skill =
        postType === "tutorial" && tutorialSkill
          ? tutorialSkill
          : finalSkills[0] || "Skill";

      const defaultCaption =
        postType === "tutorial" ? "Watch and learn!" : "Practiced today!";

      const postRef = await addDoc(collection(db, "posts"), {
        userId: currentUser.uid,
        name,
        firstName,
        username,
        skill,
        caption: caption || defaultCaption,
        mediaUrl,
        mediaType: uploadFile.type,
        filePath,
        postType,
        createdAt: serverTimestamp(),
      });

      if (postType !== "tutorial") {
        const notificationText = `${firstName || username} posted new progress in ${skill}`;
        for (const friendId of friends) {
          await addDoc(collection(db, "notifications"), {
            userId: friendId,
            senderUsername: username,
            senderName: firstName || username,
            senderProfilePhotoUrl: profilePhotoUrl || "",
            type: "new_post",
            text: notificationText,
            postId: postRef.id,
            createdAt: serverTimestamp(),
            read: false,
          });
          sendPushNotification(
            friendId,
            `${firstName || username} posted`,
            notificationText,
            "/?tab=friends"
          );
        }
      }

      const now       = new Date();
      const today     = now.toDateString();
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString();
      const userRef   = doc(db, "users", currentUser.uid);
      const userSnap  = await getDoc(userRef);
      const userData  = userSnap.data();
      const lastPostDate = userData?.lastPostDate;
      let updatedStreak  = userData?.streak || 0;

      // Credit the referrer on the referred user's first post, not at signup —
      // this is gated by referralCredited (set false at signup) so it only fires once.
      if (userData?.referredBy && !userData?.referralCredited) {
        await creditReferral(userData.referredBy);
        await updateDoc(userRef, { referralCredited: true });
      }

      if (lastPostDate === today) {
        // Already posted today — streak unchanged
      } else {
        if (lastPostDate === yesterday) {
          updatedStreak += 1;   // consecutive day → extend
        } else {
          updatedStreak = 1;    // gap > 1 day (or first post) → reset
        }
        await updateDoc(userRef, { streak: updatedStreak, lastPostDate: today });
        setStreak(updatedStreak);

        const MILESTONES = [7, 14, 30, 100];
        if (MILESTONES.includes(updatedStreak)) {
          sendPushNotification(
            currentUser.uid,
            `🔥 ${updatedStreak}-day streak!`,
            "You're on a roll — keep going!",
            "/?tab=streaks"
          );
        }
      }

      setUploadFile(null);
      setUploadPreview(null);
      setCaption("");
      setTab(postType === "tutorial" ? "home" : "profile");

      // Badge check after posting — don't await, runs in background
      checkBadges({ currentUser, myPosts, friends, streak: updatedStreak, unlockedBadges })
        .then(newOnes => {
          if (newOnes.length > 0) {
            setUnlockedBadges(prev => [...new Set([...prev, ...newOnes])]);
            setNewlyUnlockedBadges(newOnes);
          }
        })
        .catch(() => {});
    } catch (error) {
      alert(error.message);
    } finally {
      setPosting(false);
    }
  }

  async function handleDeletePost(post) {
    if (!currentUser || post.userId !== currentUser.uid) return;

    const confirmDelete = window.confirm("Delete this post?");
    if (!confirmDelete) return;

    try {
      if (post.filePath) {
        await deleteObject(ref(storage, post.filePath));
      }

      await deleteDoc(doc(db, "posts", post.id));
    } catch (error) {
      alert(error.message);
    }
  }

  function startCreateAccountFlow() {
    setFirstName("");
    setLastName("");
    setUsername("");
    setAuthMode("create");
    setScreen("splash");
  }

  function addMoreSkills() {
    setIsAddingSkill(true);
    setSkillTheme(null);
    setSkillSection(null);
    setScreen("skills");
  }

  function leaveSkillFlow() {
    setSkillTheme(null);
    setSkillSection(null);

    if (isAddingSkill) {
      setIsAddingSkill(false);
      setScreen("main");
    } else {
      setScreen("interests");
    }
  }

 async function continueSkillFlow() {
  if (!skillTheme || !skillSection) return;

  setSkillTheme(null);
  setSkillSection(null);

  if (isAddingSkill) {
    const updatedSkills = [...new Set(selectedSkills)];

        console.log("Current selectedSkills:", selectedSkills);

    console.log("Saving to Firestore:", updatedSkills);

    if (currentUser) {
  await updateDoc(doc(db, "users", currentUser.uid), {
    selectedSkills: updatedSkills,
  });

  for (const friendId of friends) {
  await addDoc(collection(db, "notifications"), {
    userId: friendId,
    type: "new_skill",
    text: `${username} started learning ${updatedSkills.at(-1)}`,
    createdAt: serverTimestamp(),
    read: false,
  });
}

  console.log("Firestore update complete");

  const freshUser = await getDoc(
    doc(db, "users", currentUser.uid)
  );

  console.log(
    "Firestore selectedSkills:",
    freshUser.data().selectedSkills
  );
}

    setIsAddingSkill(false);
    setScreen("main");
  } else {
    setScreen("goal");
  }
}

async function handleSendFriendRequest(friendUid) {
  console.log("FRIEND REQUEST CLICKED");
  if (!currentUser || friendUid === currentUser.uid) return;

  console.log("Sending request to:", friendUid);
  console.log("From user:", currentUser.uid);

  const friendRef = doc(db, "users", friendUid);

  await updateDoc(friendRef, {
    friendRequests: arrayUnion(currentUser.uid),
  });

  const currentUserSnap = await getDoc(
  doc(db, "users", currentUser.uid)
);

const currentUserData = currentUserSnap.data();

await addDoc(collection(db, "notifications"), {
  userId: friendUid,
  senderUsername: currentUserData.username,
  senderName: currentUserData.firstName || currentUserData.username,
  senderProfilePhotoUrl: currentUserData.profilePhotoUrl || "",
  type: "friend_request",
  text: `${currentUserData.firstName || currentUserData.username} sent you a friend request`,
  createdAt: serverTimestamp(),
  read: false,
});

  sendPushNotification(
    friendUid,
    "New friend request",
    `${currentUserData.firstName || currentUserData.username} sent you a friend request`,
    "/?tab=friends"
  );

  console.log("Friend request saved in Firestore");

  alert("Friend request sent!");
}

async function handleCancelFriendRequest(friendUid) {
  if (!currentUser) return;

  const friendRef = doc(db, "users", friendUid);

  await updateDoc(friendRef, {
    friendRequests: arrayRemove(currentUser.uid),
  });
}

async function handleAcceptFriendRequest(requesterUid) {
  if (!currentUser) return;

  const currentUserRef = doc(db, "users", currentUser.uid);
  const requesterRef = doc(db, "users", requesterUid);

  await updateDoc(currentUserRef, {
    friends: arrayUnion(requesterUid),
    friendRequests: arrayRemove(requesterUid),
  });

  await updateDoc(requesterRef, {
    friends: arrayUnion(currentUser.uid),
  });

  await addDoc(collection(db, "notifications"), {
    userId: requesterUid,
    senderUsername: username,
    senderName: firstName || username,
    senderProfilePhotoUrl: profilePhotoUrl || "",
    type: "friend_accepted",
    text: `${firstName || username} accepted your friend request`,
    createdAt: serverTimestamp(),
    read: false,
  });

  sendPushNotification(
    requesterUid,
    "Friend request accepted",
    `${firstName || username} accepted your friend request`,
    "/?tab=friends"
  );

  setFriends((prev) => {
    const updated = [...new Set([...prev, requesterUid])];
    checkBadges({ currentUser, myPosts, friends: updated, streak, unlockedBadges })
      .then(newOnes => {
        if (newOnes.length > 0) {
          setUnlockedBadges(p => [...new Set([...p, ...newOnes])]);
          setNewlyUnlockedBadges(newOnes);
        }
      })
      .catch(() => {});
    return updated;
  });
  setFriendRequests((prev) => prev.filter((id) => id !== requesterUid));
}

async function handleDeclineFriendRequest(requesterUid) {
  if (!currentUser) return;

  const currentUserRef = doc(db, "users", currentUser.uid);

  await updateDoc(currentUserRef, {
    friendRequests: arrayRemove(requesterUid),
  });
  setFriendRequests((prev) => prev.filter((id) => id !== requesterUid));
}

async function handleRemoveFriend
(friendUid) {
  if (!currentUser) return;

  const userRef = doc(db, "users", currentUser.uid);

  await updateDoc(userRef, {
    friends: arrayRemove(friendUid),
  });

  setFriends((prev) => prev.filter((id) => id !== friendUid));
}

  async function handleSendDM(recipientUid, videoData) {
    if (!currentUser) return;

    const participants = [currentUser.uid, recipientUid].sort();
    const conversationId = participants.join("_");
    const isPostShare = Boolean(videoData.postId);
    const lastMessage = isPostShare
      ? `Shared a post from @${videoData.postUsername || videoData.username}`
      : `Shared: ${videoData.title}`;

    await setDoc(
      doc(db, "dms", conversationId),
      {
        participants,
        lastMessage,
        lastMessageAt: serverTimestamp(),
      },
      { merge: true }
    );

    const message = {
      senderId: currentUser.uid,
      senderUsername: username,
      text: "",
      createdAt: serverTimestamp(),
    };

    if (isPostShare) {
      Object.assign(message, {
        postId: videoData.postId,
        postCaption: videoData.postCaption || videoData.caption || "",
        postMediaUrl: videoData.postMediaUrl || videoData.mediaUrl,
        postMediaType: videoData.postMediaType || videoData.mediaType,
        postUsername: videoData.postUsername || videoData.username,
        postSkill: videoData.postSkill || videoData.skill,
      });
    } else {
      Object.assign(message, {
        videoId: videoData.videoId,
        videoTitle: videoData.title,
        videoThumbnail: videoData.thumbnail,
        videoSkill: videoData.skill,
      });
    }

    await addDoc(collection(db, "dms", conversationId, "messages"), message);

    sendPushNotification(
      recipientUid,
      `${username} sent you ${isPostShare ? "a post" : "a video"}`,
      isPostShare ? (videoData.postCaption || videoData.caption || "Shared a post") : videoData.title,
      `/?tab=messages&uid=${currentUser.uid}`
    );
  }

  async function handleLikePost(post) {
    if (!currentUser || post.userId === currentUser.uid) return;
    const isLiked = post.likedBy?.includes(currentUser.uid) || likedPosts.includes(post.id);

    setLikedPosts((prev) =>
      isLiked ? prev.filter((id) => id !== post.id) : [...new Set([...prev, post.id])]
    );

    await updateDoc(doc(db, "posts", post.id), {
      likedBy: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
    });

    if (isLiked) return;

    await addDoc(collection(db, "notifications"), {
      userId: post.userId,
      senderUsername: username,
      type: "post_like",
      text: `${username} liked your post`,
      postId: post.id,
      createdAt: serverTimestamp(),
      read: false,
    });

    sendPushNotification(
      post.userId,
      "New like 💜",
      `${username} liked your post`,
      "/?tab=friends"
    );
  }

  async function handleSignOut() {
    await signOut(auth);

    setCurrentUser(null);
    setFirstName("");
    setLastName("");
    setUsername("");
    setSelectedThemes([]);
    setSelectedSkills([]);
    setSelectedGoal("");
    setPosts([]);
    setUploadFile(null);
    setUploadPreview(null);
    setCaption("");
    setTab("home");
    setAuthMode("login");
    setScreen("splash");
    setLikedVideos([]);
    setSavedVideos([]);
  }

 if (!authChecked) {
  return <p>Loading Habi...</p>;
}

  return (
  <div className="appShell">
      {screen === "splash" && (
        <Splash
          onNext={() => {
            setAuthMode("create");
            setFirstName("");
            setLastName("");
            setUsername("");
            setSelectedThemes([]);
            setSelectedSkills([]);
            setSelectedGoal("");
            setSkillTheme(null);
            setSkillSection(null);
            setIsAddingSkill(false);
            setScreen("interests");
          }}
          onLogin={() => {
            setAuthMode("login");
            setScreen("auth");
          }}
        />
      )}

      {screen === "interests" && (
        <Onboarding
          step="1/3"
          bibi={BIBI.interest}
          title="What are your interests?"
          onBack={() => {
            setSelectedThemes([]);
            setSelectedSkills([]);
            setSelectedGoal("");
            setSkillTheme(null);
            setSkillSection(null);
            setIsAddingSkill(false);
            setScreen("splash");
          }}
          onNext={() => {
            setSkillTheme(null);
            setSkillSection(null);
            setScreen("skills");
          }}
          canContinue={selectedThemes.length > 0}
        >
          <div className="themeGrid">
            {themes.map((theme) => (
              <button
                key={theme.name}
                className={
                  selectedThemes.includes(theme.name)
                    ? "themeCard isSelected"
                    : "themeCard"
                }
                onClick={() => toggleTheme(theme.name)}
              >
                <span>{theme.emoji}</span>
                <strong>{theme.name}</strong>
              </button>
            ))}
            {screen !== "splash" &&
  screen !== "interests" &&
  screen !== "skills" &&
  screen !== "goal" &&
  screen !== "auth" &&
  screen !== "main" && (
    <p>Unknown screen: {screen}</p>
)}
          </div>
        </Onboarding>
      )}

      {screen === "skills" && (
        <Onboarding
          step={isAddingSkill ? "Add Skills" : "2/3"}
          bibi={BIBI.excited}
          title={
            !skillTheme
              ? "Choose a theme"
              : !skillSection
              ? "Choose a section"
              : "What would you like to learn?"
          }
          onBack={() => {
            if (skillSection) {
              setSkillSection(null);
            } else if (skillTheme) {
              setSkillTheme(null);
            } else {
              leaveSkillFlow();
            }
          }}
          onNext={continueSkillFlow}
          canContinue={selectedSkills.length > 0 && !!skillTheme && !!skillSection}
        >
          {!skillTheme && (
            <div className="themeGrid">
              {(isAddingSkill
                ? themes
                : themes.filter((theme) => selectedThemes.includes(theme.name))
              ).map((theme) => (
                <button
                  key={theme.name}
                  className={
                    skillTheme?.name === theme.name
                      ? "themeCard isSelected"
                      : "themeCard"
                  }
                  onClick={() => {
                    setSkillTheme(theme);

                    if (!selectedThemes.includes(theme.name)) {
                      setSelectedThemes((prev) => [...prev, theme.name]);
                    }
                  }}
                >
                  <span>{theme.emoji}</span>
                  <strong>{theme.name}</strong>
                </button>
              ))}
            </div>
          )}

          {skillTheme && !skillSection && (
            <div className="optionList">
              {Object.keys(skillTheme.sections).map((section) => (
                <button
                  key={section}
                  className="option"
                  onClick={() => setSkillSection(section)}
                >
                  <span>{sectionEmoji(section)}</span>
                  <strong>{section}</strong>
                </button>
              ))}
            </div>
          )}

          {skillTheme && skillSection && (
            <div className="skillGroups">
              <div className="skillGroup">
                <div className="themeHeader">
                  <span>{skillTheme.emoji}</span>
                  <h3>{skillTheme.name}</h3>
                </div>

                <div className="skillSection">
                  <p className="sectionTitle">{skillSection}</p>

                  <div className="skillPills">
                    {skillTheme.sections[skillSection].map((skill) => (
                      <button
                        key={skill}
                        className={
                          selectedSkills.includes(skill)
                            ? "skillPill isSelected"
                            : "skillPill"
                        }
                        onClick={() => toggleSkill(skill)}
                      >
                        {skillEmoji(skill)} {skill}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Onboarding>
      )}

      {screen === "goal" && (
        <Onboarding
          step="3/3"
          bibi={BIBI.motivational}
          title="What’s your goal?"
          onBack={() => setScreen("skills")}
          onNext={() => {
            setAuthMode("create");
            setFirstName("");
            setLastName("");
            setUsername("");
            setScreen("auth");
          }}
          canContinue={selectedGoal}
        >
          <div className="optionList">
            {goals.map((goal) => (
              <button
                key={goal}
                className={selectedGoal === goal ? "option isSelected" : "option"}
                onClick={() => setSelectedGoal(goal)}
              >
                <span>{goalEmoji(goal)}</span>
                <strong>{goal}</strong>
              </button>
            ))}
          </div>
        </Onboarding>
      )}

      {screen === "auth" && (
        <AuthScreen
          authMode={authMode}
          setAuthMode={setAuthMode}
          firstName={firstName}
          setFirstName={setFirstName}
          lastName={lastName}
          setLastName={setLastName}
          username={username}
          setUsername={setUsername}
          selectedThemes={selectedThemes}
          selectedSkills={selectedSkills}
          selectedGoal={selectedGoal}
          setSelectedThemes={setSelectedThemes}
          setSelectedSkills={setSelectedSkills}
          setSelectedGoal={setSelectedGoal}
          setStreak={setStreak}
          onBack={() => setScreen("splash")}
          onEnter={() => setScreen("main")}
          startCreateAccountFlow={startCreateAccountFlow}
        />
      )}

      {screen === "main" && (
        <MainApp
          tab={tab}
          setTab={setTab}
          name={name}
          firstName={firstName}
          username={username}
          skills={finalSkills}
          streak={streak}
          uploadPreview={uploadPreview}
          uploadFile={uploadFile}
          handleUpload={handleUpload}
          caption={caption}
          setCaption={setCaption}
          handleCreatePost={handleCreatePost}
          posting={posting}
          addMoreSkills={addMoreSkills}
          removeSkill={removeSkill}
          onSignOut={handleSignOut}
          friendPosts={friendFeedPosts}
          friends={friends}
          handleSendFriendRequest={handleSendFriendRequest}
          handleCancelFriendRequest={handleCancelFriendRequest}
          friendRequests={friendRequests}
          handleAcceptFriendRequest={handleAcceptFriendRequest}
          handleDeclineFriendRequest={handleDeclineFriendRequest}
          handleRemoveFriend={handleRemoveFriend}
          currentUser={currentUser}
          myPosts={myPosts}
          myLikedPosts={myLikedPosts}
          handleDeletePost={handleDeletePost}
          setLikedVideos={setLikedVideos}
          likedVideos={likedVideos}
          savedVideos={savedVideos}
          setSavedVideos={setSavedVideos}
          sharedVideos={sharedVideos}
          setSharedVideos={setSharedVideos}
          profilePhotoUrl={profilePhotoUrl}
          setProfilePhotoUrl={setProfilePhotoUrl}
          allPosts={posts}
          notifications={notifications}
          onShareToFriend={handleSendDM}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          handleLikePost={handleLikePost}
          likedPosts={likedPosts}
          hideLikeCount={hideLikeCount}
          onToggleHideLikeCount={toggleHideLikeCount}
          openMessageUid={openMessageUid}
          onClearOpenUid={() => setOpenMessageUid(null)}
          unlockedBadges={unlockedBadges}
          newlyUnlockedBadges={newlyUnlockedBadges}
          referralCode={referralCode}
          referralCount={referralCount}
          />
      )}

      {screen === "main" && <IOSInstallPrompt />}
    </div>
  );
}

