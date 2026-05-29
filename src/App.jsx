import { useEffect, useState } from "react";
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

import { BIBI, themes, goals } from "./data/appData";

export default function App() {
  const [screen, setScreen] = useState("splash");
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [tab, setTab] = useState("home");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const name = `${firstName} ${lastName}`.trim();
  const [username, setUsername] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [selectedThemes, setSelectedThemes] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectedGoal, setSelectedGoal] = useState("");

  const [authMode, setAuthMode] = useState("login");

  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);

  const [posts, setPosts] = useState([]);
const [friends, setFriends] = useState([]);
const [friendRequests, setFriendRequests] = useState([]);
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

const [streak, setStreak] = useState(0);

  const [sharedVideos, setSharedVideos] = useState([]);

  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [skillTheme, setSkillTheme] = useState(null);
  const [skillSection, setSkillSection] = useState(null);

  const finalSkills = [...new Set(selectedSkills)];

  if (finalSkills.length === 0) {
    finalSkills.push("Braiding");
  }

  const myPosts = posts.filter((post) => post.userId === currentUser?.uid);
  const friendFeedPosts = posts.filter((post) =>
  friends.includes(post.userId)
);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);

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
          setFriends(userData.friends || []);
          setFriendRequests(userData.friendRequests || []);

          setLikedVideos(userData.likedVideos || []);
          setSavedVideos(userData.savedVideos || []);

          setScreen("main");
        } else {
          setScreen("splash");
        }
      } else {
        setCurrentUser(null);
        setScreen("splash");
      }

      setAuthChecked(true);
    });

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

  const userRef = doc(db, "users", currentUser.uid);

  const unsubscribe = onSnapshot(userRef, (snapshot) => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    setFriends(data.friends || []);
    setFriendRequests(data.friendRequests || []);
    setStreak(data.streak || 0);
    setProfilePhotoUrl(data.profilePhotoUrl || "");
  });

  return () => unsubscribe();
}, [currentUser]);

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

  function removeSkill(skillToRemove) {
    setSelectedSkills((prev) => prev.filter((skill) => skill !== skillToRemove));
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

  async function handleCreatePost() {
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

      const skill = finalSkills[0] || "Skill";

      await addDoc(collection(db, "posts"), {
  userId: currentUser.uid,
  name,
  firstName,
  username,
        skill,
        caption: caption || "Practiced today!",
        mediaUrl,
        mediaType: uploadFile.type,
        filePath,
        createdAt: serverTimestamp(),
      });

      const today = new Date().toDateString();

const userRef = doc(db, "users", currentUser.uid);

const userSnap = await getDoc(userRef);

const userData = userSnap.data();

const lastPostDate = userData?.lastPostDate;

let updatedStreak = userData?.streak || 0;

if (lastPostDate !== today) {
  updatedStreak += 1;

  await updateDoc(userRef, {
    streak: updatedStreak,
    lastPostDate: today,
  });

  setStreak(updatedStreak);
}
      setUploadFile(null);
      setUploadPreview(null);
      setCaption("");
      setTab("profile");
    } catch (error) {
      alert(error.message);
    } finally {
      setPosting(false);
    }
  }

  async function handleDeletePost(post) {
    if (!currentUser || post.userId !== currentUser.uid) return;

    const confirmDelete = window.confirm("Delete this upload?");
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
  if (!currentUser || friendUid === currentUser.uid) return;

  console.log("Sending request to:", friendUid);
  console.log("From user:", currentUser.uid);

  const friendRef = doc(db, "users", friendUid);

  await updateDoc(friendRef, {
    friendRequests: arrayUnion(currentUser.uid),
  });

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

  setFriends((prev) => [...new Set([...prev, requesterUid])]);
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
    return null;
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
        <OnboardingScreen
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
          </div>
        </OnboardingScreen>
      )}

      {screen === "skills" && (
        <OnboardingScreen
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
        </OnboardingScreen>
      )}

      {screen === "goal" && (
        <OnboardingScreen
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
        </OnboardingScreen>
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
          />
      )}
    </div>
  );
}

function Splash({ onNext, onLogin }) {
  return (
    <section className="screen splash">
      <div className="brandBlock">
        <h1>Habi</h1>
        <p>LEARN • GROW • SHARE</p>
      </div>

      <div className="splashHero">
        <img src={BIBI.happy} alt="Bibi" className="splashBibi" />

        <div className="speechBubble">
          <div className="bubbleTail" />
          <h2>Hi! I’m Bibi</h2>
          <p>Let’s build your next skill together.</p>
        </div>
      </div>

      <div className="splashActions">
        <button className="primaryButton" onClick={onNext}>
          Let’s Start
        </button>

        <button className="loginLink" onClick={onLogin}>
          Already have an account? <span>Log in</span>
        </button>
      </div>
    </section>
  );
}

function OnboardingScreen({
  step,
  bibi,
  title,
  children,
  onBack,
  onNext,
  canContinue,
}) {
  return (
    <section className="screen onboarding">
      <TopBar step={step} onBack={onBack} />

      <div className="mascotWrap">
        <img src={bibi} alt="Bibi" className="onboardingBibi" />
      </div>

      <div className="card questionCard">
        <h1>{title}</h1>

        <div className="questionContent">{children}</div>
      </div>

      <div className="bottomAction">
        <button
          className="primaryButton"
          disabled={!canContinue}
          onClick={onNext}
        >
          Continue
        </button>
      </div>
    </section>
  );
}

function AuthScreen({
  authMode,
  setAuthMode,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  username,
  setUsername,
  selectedThemes,
  selectedSkills,
  selectedGoal,
  setSelectedThemes,
  setSelectedSkills,
  setSelectedGoal,
  setStreak,
  onBack,
  onEnter,
  startCreateAccountFlow,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAuth() {
    setAuthMessage("");
    setLoading(true);

    try {
      if (authMode === "create") {
        if (!firstName || !lastName || !username || !email || !password) {
          setAuthMessage("Please fill out all fields.");
          setLoading(false);
          return;
        }

        const cleanUsername = username.replace("@", "").toLowerCase();

const usernameQuery = query(
  collection(db, "users"),
  where("username", "==", cleanUsername)
);

const usernameSnapshot = await getDocs(usernameQuery);

if (!usernameSnapshot.empty) {
  setAuthMessage("Username already taken.");
  setLoading(false);
  return;
}

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          firstName: firstName.trim(),
lastName: lastName.trim(),
name: `${firstName.trim()} ${lastName.trim()}`,
nameSearch: firstName.trim().toLowerCase(),
fullNameSearch: `${firstName.trim()} ${lastName.trim()}`.toLowerCase(),
          username: cleanUsername,
          likedVideos: [],
          savedVideos: [],
          email,
          selectedThemes,
          selectedSkills: [...new Set(selectedSkills)],
          selectedGoal,
          streak: 0,
          lastPostDate: "",
          friends: [],
          friendRequests: [],
usernameLastChanged: null,
previousUsernames: [],
createdAt: new Date(),
        });

        setUsername(cleanUsername);
        setStreak(0);
        onEnter();
        return;
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();

        setFirstName(userData.firstName || userData.name?.split(" ")[0] || "");
        setLastName(userData.lastName || userData.name?.split(" ").slice(1).join(" ") || "");
        setUsername(userData.username || "");
        setSelectedThemes(userData.selectedThemes || []);
        setSelectedSkills(userData.selectedSkills || []);
        setSelectedGoal(userData.selectedGoal || "");
        setStreak(userData.streak || 0);

        onEnter();
      } else {
        setAuthMessage("Account profile was not found.");
      }
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="screen authScreen">
      <button className="authBackButton" onClick={onBack}>
        ←
      </button>

      <div className="card authCard">
        <h1>{authMode === "create" ? "Create Account" : "Welcome"}</h1>

        <div className="authTabs">
          <button
            className={authMode === "create" ? "active" : ""}
            onClick={startCreateAccountFlow}
          >
            Create
          </button>

          <button
            className={authMode === "login" ? "active" : ""}
            onClick={() => {
              setAuthMode("login");
              setAuthMessage("");
            }}
          >
            Log In
          </button>
        </div>

        {authMode === "create" && (
          <>
            <input
  value={firstName}
  onChange={(e) => setFirstName(e.target.value)}
  placeholder="First name"
/>

<input
  value={lastName}
  onChange={(e) => setLastName(e.target.value)}
  placeholder="Last name"
/>

            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
            />
          </>
        )}

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
        />

        {authMessage && <p className="authMessage">{authMessage}</p>}

        <button className="primaryButton" onClick={handleAuth} disabled={loading}>
          {loading
            ? "Please wait..."
            : authMode === "create"
            ? "Create account"
            : "Log in"}
        </button>

        <button
          className="textButton"
          onClick={() => {
            if (authMode === "login") {
              startCreateAccountFlow();
            } else {
              setAuthMode("login");
            }

            setAuthMessage("");
          }}
        >
          {authMode === "create"
            ? "Already have an account? Log in"
            : "Need an account? Create one"}
        </button>
      </div>
    </section>
  );
}

function MainApp({
  tab,
  setTab,
  name,
  firstName,
  username,
  skills,
  streak,
  uploadPreview,
  uploadFile,
  handleUpload,
  caption,
  setCaption,
  handleCreatePost,
  posting,
  addMoreSkills,
  removeSkill,
  onSignOut,
  friendPosts,
  friends,
  handleSendFriendRequest,
  handleCancelFriendRequest,
  friendRequests,
  handleAcceptFriendRequest,
  handleDeclineFriendRequest,
  handleRemoveFriend,
  currentUser,
  myPosts,
  handleDeletePost,
  likedVideos,
  setLikedVideos,
  savedVideos,
  setSavedVideos,
  sharedVideos,
  setSharedVideos,
  profilePhotoUrl,
  setProfilePhotoUrl,
  allPosts,
}) {
  return (
    <section className="mainApp">
      <div className="mainContent">
        {tab === "home" && (
         <Home
  name={name}
  firstName={firstName}
  skills={skills}
  addMoreSkills={addMoreSkills}
  removeSkill={removeSkill}
  likedVideos={likedVideos}
  setLikedVideos={setLikedVideos}
  savedVideos={savedVideos}
  setSavedVideos={setSavedVideos}
  sharedVideos={sharedVideos}
  setSharedVideos={setSharedVideos}

  friends={friends}
  profilePhotoUrl={profilePhotoUrl}
  setProfilePhotoUrl={setProfilePhotoUrl}
/>
        )}

        {tab === "friends" && (
  <Friends
    friendPosts={friendPosts}
    allPosts={allPosts}
    friends={friends}
    handleSendFriendRequest={handleSendFriendRequest}
    handleCancelFriendRequest={handleCancelFriendRequest}
friendRequests={friendRequests}
handleAcceptFriendRequest={handleAcceptFriendRequest}
handleDeclineFriendRequest={handleDeclineFriendRequest}
    handleRemoveFriend={handleRemoveFriend}
    currentUser={currentUser}
  />
)}

        {tab === "upload" && (
          <Upload
            uploadPreview={uploadPreview}
            uploadFile={uploadFile}
            handleUpload={handleUpload}
            caption={caption}
            setCaption={setCaption}
            handleCreatePost={handleCreatePost}
            posting={posting}
          />
        )}

        {tab === "streaks" && <Streaks streak={streak} />}

        {tab === "profile" && (
          <Profile
            username={username}
            skills={skills}
            likedVideos={likedVideos}
            savedVideos={savedVideos}
            onSignOut={onSignOut}
            myPosts={myPosts}
            handleDeletePost={handleDeletePost}
            profilePhotoUrl={profilePhotoUrl}
            setProfilePhotoUrl={setProfilePhotoUrl}
          />
        )}
      </div>

      <BottomNav tab={tab} setTab={setTab} />
    </section>
  );
}

function Page({ title, children }) {
  return (
    <div className="page">
      <h1 className="pageTitle">{title}</h1>
      {children}
    </div>
  );
}

function Home({
  name,
  firstName,
  skills,
  addMoreSkills,
  removeSkill,

  likedVideos,
  setLikedVideos,

  savedVideos,
  setSavedVideos,

  sharedVideos,
  setSharedVideos,

  friends,
}) {
  const [search, setSearch] = useState("");
  const [activeSkill, setActiveSkill] = useState(skills[0] || "Braiding");
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [videoError, setVideoError] = useState("");

  const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

  useEffect(() => {
    if (!skills.includes(activeSkill)) {
      setActiveSkill(skills[0] || "Braiding");
    }
  }, [skills, activeSkill]);

  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (!YOUTUBE_API_KEY) {
        setVideos([]);
        setVideoError("Add your YouTube API key in .env to load videos.");
        return;
      }

      setLoading(true);
      setVideoError("");
      setPlayingVideoId(null);

      try {
        const searchText = search.trim();

        const query = searchText
          ? `${activeSkill} ${searchText} tutorial`
          : `${activeSkill} beginner tutorial`;

        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&videoSyndicated=true&maxResults=25&q=${encodeURIComponent(
          query
        )}&key=${YOUTUBE_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
          setVideos([]);
          setVideoError("Could not load videos.");
          return;
        }

        const seen = new Set();

        const cleanVideos =
          data.items
            ?.map((item) => ({
              id: item.id.videoId,
              title: item.snippet.title,
              creator: item.snippet.channelTitle,
              thumbnail:
                item.snippet.thumbnails?.high?.url ||
                item.snippet.thumbnails?.medium?.url,
            }))
            .filter((video) => {
              if (!video.id || seen.has(video.id)) return false;
              seen.add(video.id);
              return true;
            }) || [];

        setVideos(cleanVideos);

        if (cleanVideos.length === 0) {
          setVideoError("No videos found. Try another search.");
        }
      } catch (error) {
        setVideos([]);
        setVideoError("Could not load videos.");
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [activeSkill, search, YOUTUBE_API_KEY]);

  return (
    <Page title={`For ${firstName|| "You"}`}>
      <div className="searchWrapper">
        <span>🔍</span>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${activeSkill} videos...`}
        />
      </div>

      <div className="skillTabs">
        {skills.map((skill) => (
          <div
            key={skill}
            className={
              activeSkill === skill
                ? "skillTab activeSkillTab removableSkillTab"
                : "skillTab removableSkillTab"
            }
          >
            <button
              className="skillTabInner"
              onClick={() => {
                setActiveSkill(skill);
                setPlayingVideoId(null);
              }}
            >
              {skillEmoji(skill)} {skill}
            </button>

            <button
              className="removeSkillButton"
              onClick={() => {
                removeSkill(skill);

                if (activeSkill === skill) {
                  const remainingSkills = skills.filter((item) => item !== skill);
                  setActiveSkill(remainingSkills[0] || "Braiding");
                }
              }}
            >
              ×
            </button>
          </div>
        ))}

        <button className="skillTab addSkillTab" onClick={addMoreSkills}>
          + Add Skill
        </button>
      </div>

      {loading && <div className="emptyVideoState">Loading videos...</div>}

      {!loading && videoError && (
        <div className="emptyVideoState">{videoError}</div>
      )}

      {!loading && videos.length > 0 && (
        <div className="tiktokVideoFeed">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              skill={activeSkill}
              title={video.title}
              creator={video.creator}
              thumbnail={video.thumbnail}
              videoId={video.id}
              isPlaying={playingVideoId === video.id}
              onPlay={() => setPlayingVideoId(video.id)}
              likedVideos={likedVideos}
setLikedVideos={setLikedVideos}

savedVideos={savedVideos}
setSavedVideos={setSavedVideos}

sharedVideos={sharedVideos}
setSharedVideos={setSharedVideos}

friends={friends}
            />
          ))}
        </div>
      )}
    </Page>
  );
}

function VideoCard({
  skill,
  title,
  creator,
  thumbnail,
  videoId,
  isPlaying,
  onPlay,
  likedVideos,
setLikedVideos,

savedVideos,
setSavedVideos,

sharedVideos,
setSharedVideos,

friends,
}) {
  const liked = likedVideos.some(
  (video) => video.videoId === videoId
);

const saved = savedVideos.some(
  (video) => video.videoId === videoId
);

  return (
    <article className="tiktokVideoCard">
      {!isPlaying ? (
        <div
          className="fakeTikTokPlayer"
          style={{
            backgroundImage: `url(${thumbnail})`,
          }}
        >
          <div className="fakePlayerOverlay" />

          <button className="bigPlayButton" onClick={onPlay}>
            ▶
          </button>

          <div className="tiktokVideoInfo">
            <small>{skill}</small>
            <h2>{title}</h2>
            <p>{creator}</p>
          </div>
        </div>
      ) : (
        <div className="youtubeWrapper">
          <iframe
            className="tiktokVideoFrame"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&playsinline=1&rel=0`}
            title={title}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}

      <div className="tiktokVideoActions">
        <button
          className={liked ? "activeVideoAction" : ""}
          onClick={() => {
  if (liked) {
    setLikedVideos((prev) =>
      prev.filter((v) => v.videoId !== videoId)
    );
  } else {
    setLikedVideos((prev) => [
      ...prev,
      {
        videoId,
        title,
        creator,
        thumbnail,
        skill,
      },
    ]);
  }
}}
        >
          ❤️
        </button>

        <button
          className={saved ? "activeVideoAction" : ""}
          onClick={() => {
  if (saved) {
    setSavedVideos((prev) =>
      prev.filter((v) => v.videoId !== videoId)
    );
  } else {
    setSavedVideos((prev) => [
      ...prev,
      {
        videoId,
        title,
        creator,
        thumbnail,
        skill,
      },
    ]);
  }
}}
        >
          🔖
        </button>

        <button
  onClick={() => {
    alert(
      friends.length > 0
        ? "Friend sharing UI coming next ✨"
        : "Add friends first to share videos."
    );
  }}
>
  📤
</button>
      </div>
    </article>
  );
}

function Friends({
  friendPosts,
  allPosts,
  friends,
  handleSendFriendRequest,
  handleCancelFriendRequest,
  friendRequests,
  handleAcceptFriendRequest,
  handleDeclineFriendRequest,
  currentUser,
}) {
  const [searchUsername, setSearchUsername] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [friendRequestProfiles, setFriendRequestProfiles] = useState([]);
  const [friendProfiles, setFriendProfiles] = useState([]);
  const [selectedFriendProfile, setSelectedFriendProfile] = useState(null);
  const [showRequests, setShowRequests] = useState(false);

  useEffect(() => {
    async function loadFriendRequests() {
      const filteredRequests = friendRequests.filter(
        (uid) => !friends.includes(uid)
      );

      if (filteredRequests.length === 0) {
        setFriendRequestProfiles([]);
        return;
      }

      const profiles = await Promise.all(
        filteredRequests.map(async (uid) => {
          const userSnap = await getDoc(doc(db, "users", uid));
          if (!userSnap.exists()) return null;

          return { uid, ...userSnap.data() };
        })
      );

      setFriendRequestProfiles(profiles.filter(Boolean));
    }

    loadFriendRequests();
  }, [friendRequests, friends]);

  useEffect(() => {
    async function loadFriends() {
      if (friends.length === 0) {
        setFriendProfiles([]);
        return;
      }

      const profiles = await Promise.all(
        friends.map(async (uid) => {
          const userSnap = await getDoc(doc(db, "users", uid));
          if (!userSnap.exists()) return null;

          return { uid, ...userSnap.data() };
        })
      );

      setFriendProfiles(profiles.filter(Boolean));
    }

    loadFriends();
  }, [friends]);

  async function searchUsers() {
    const cleanSearch = searchUsername.trim().replace("@", "").toLowerCase();

    if (!cleanSearch) return;

    const usersRef = collection(db, "users");
    const allUsersSnapshot = await getDocs(usersRef);

    const matchedUser = allUsersSnapshot.docs.find((docItem) => {
      const data = docItem.data();

      const username = (data.username || "").toLowerCase();
      const firstName = (data.firstName || "").toLowerCase();
      const lastName = (data.lastName || "").toLowerCase();
      const fullName = (data.name || "").toLowerCase();

      return (
        username.includes(cleanSearch) ||
        firstName.includes(cleanSearch) ||
        lastName.includes(cleanSearch) ||
        fullName.includes(cleanSearch)
      );
    });

    if (matchedUser && matchedUser.id !== currentUser?.uid) {
      setSearchResult({
        uid: matchedUser.id,
        ...matchedUser.data(),
      });

      return;
    }

    setSearchResult(null);
    alert("User not found.");
  }

  const selectedFriendPosts = selectedFriendProfile
    ? allPosts.filter((post) => post.userId === selectedFriendProfile.uid)
    : [];

  return (
    <Page title="Friends">
      <div className="friendSearchCard">

        


    <div className="friendSearchTopRow">
  <input
    value={searchUsername}
    onChange={(e) => setSearchUsername(e.target.value)}
    placeholder="name or @username"
    className="friendSearchInput"
  />

  <button
    className="friendBellButton"
    onClick={() => setShowRequests(true)}
  >
    🔔
    {friendRequestProfiles.length > 0 && (
      <span className="friendBellBadge">
        {friendRequestProfiles.length}
      </span>
    )}
  </button>
</div>

<button className="primaryButton" onClick={searchUsers}>
          Search
        </button>


        {searchResult && (
          <div className="friendResultCard">
            <div className="friendTopRow">
              <div className="friendAvatar">
                {searchResult.profilePhotoUrl ? (
                  <img src={searchResult.profilePhotoUrl} alt="profile" />
                ) : (
                  searchResult.username?.charAt(0).toUpperCase()
                )}
              </div>

              <div className="friendUserInfo">
                <h2 className="friendName">
                  {searchResult.firstName || searchResult.name?.split(" ")[0]}
                </h2>
                <p className="friendUsername">@{searchResult.username}</p>
              </div>
            </div>

            {friends.includes(searchResult.uid) ? (
              <button className="removeFriendButton">Already Friends</button>
            ) : searchResult.friendRequests?.includes(currentUser?.uid) ? (
              <button
                className="disabledFriendButton"
                onClick={async () => {
                  await handleCancelFriendRequest(searchResult.uid);

                  setSearchResult((prev) => ({
                    ...prev,
                    friendRequests: (prev.friendRequests || []).filter(
                      (id) => id !== currentUser.uid
                    ),
                  }));
                }}
              >
                Cancel Request
              </button>
            ) : (
              <button
                className="primaryButton"
                onClick={async () => {
                  await handleSendFriendRequest(searchResult.uid);

                  setSearchResult((prev) => ({
                    ...prev,
                    friendRequests: [
                      ...(prev.friendRequests || []),
                      currentUser.uid,
                    ],
                  }));
                }}
              >
                Add Friend
              </button>
            )}
          </div>
        )}
      </div>

      {friendPosts.length === 0 && (
  <div className="emptyFriendFeed">
    <h3>No friend uploads yet</h3>
  </div>
)}
      <div className="videoFeed">
        {friendPosts.map((post) => (
          <div className="videoCard friendPostCard" key={post.id}>
            {post.mediaType?.startsWith("video") ? (
              <video src={post.mediaUrl} className="friendPostImage" controls />
            ) : (
              <img
                src={post.mediaUrl}
                alt="friend upload"
                className="friendPostImage"
              />
            )}

            <div className="videoOverlay friendPostOverlay">
              <div className="videoText friendPostText">
                <div className="friendTopRow">
                  <div className="friendAvatar">
                    {post.username?.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <h2>{post.firstName || post.name?.split(" ")[0]}</h2>
                    <p>@{post.username}</p>
                  </div>
                </div>

                <small>{post.skill} • progress upload</small>
                <p>{post.caption}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

{friendProfiles.length > 0 && (
        <div className="friendListSection">
          

          <div className="friendListGrid">
            {friendProfiles.map((friend) => (
              <button
                key={friend.uid}
                className="friendProfileButton"
                onClick={() => setSelectedFriendProfile(friend)}
              >
                <div className="friendAvatar">
                  {friend.profilePhotoUrl ? (
                    <img src={friend.profilePhotoUrl} alt="profile" />
                  ) : (
                    friend.username?.charAt(0).toUpperCase()
                  )}
                </div>

                <span>@{friend.username}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showRequests && (
        <div className="friendRequestModal">
          <div className="friendRequestSheet">
            <button
              className="closeFriendProfile"
              onClick={() => setShowRequests(false)}
            >
              ✕
            </button>

            <h2 className="requestsTitle">Friend Requests</h2>

            {friendRequestProfiles.length === 0 ? (
              <div className="emptyVideoState">
                No friend requests right now.
              </div>
            ) : (
              friendRequestProfiles.map((request) => (
                <div key={request.uid} className="friendRequestCard">
                  <div className="friendTopRow">
                    <div className="friendAvatar">
                      {request.profilePhotoUrl ? (
                        <img src={request.profilePhotoUrl} alt="profile" />
                      ) : (
                        request.username?.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="friendUserInfo">
                      <h2 className="friendName">
                        {request.firstName || request.name?.split(" ")[0]}
                      </h2>
                      <p className="friendUsername">@{request.username}</p>
                    </div>
                  </div>

                  <p className="requestNotificationText">
                    {request.firstName || request.name?.split(" ")[0]} sent you
                    a friend request.
                  </p>

                  <div className="requestButtons">
                    <button
                      className="acceptButton"
                      onClick={() => {
                        handleAcceptFriendRequest(request.uid);
                        setShowRequests(false);
                      }}
                    >
                      Accept
                    </button>

                    <button
                      className="declineButton"
                      onClick={() => handleDeclineFriendRequest(request.uid)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {selectedFriendProfile && (
        <div className="friendProfileModal">
          <div className="friendProfileSheet">
            <button
              className="closeFriendProfile"
              onClick={() => setSelectedFriendProfile(null)}
            >
              ✕
            </button>

            <div className="largeFriendAvatar">
              {selectedFriendProfile.profilePhotoUrl ? (
                <img src={selectedFriendProfile.profilePhotoUrl} alt="profile" />
              ) : (
                selectedFriendProfile.username?.charAt(0).toUpperCase()
              )}
            </div>

            <h2>{selectedFriendProfile.name}</h2>
            <p>@{selectedFriendProfile.username}</p>

            <div className="friendProfileStats">
              <div>
                <b>{selectedFriendPosts.length}</b>
                <span>Posts</span>
              </div>

              <div>
                <b>{selectedFriendProfile.streak || 0}</b>
                <span>Streak</span>
              </div>
            </div>

            <p className="friendProfileSkills">
              Learning:{" "}
              {selectedFriendProfile.selectedSkills?.join(", ") ||
                "No skills yet"}
            </p>

            <div className="friendUploadGrid">
              {selectedFriendPosts.length === 0 ? (
                <div className="emptyVideoState">No uploads yet.</div>
              ) : (
                selectedFriendPosts.map((post) => (
                  <div className="friendMiniUpload" key={post.id}>
                    {post.mediaType?.startsWith("video") ? (
                      <video src={post.mediaUrl} />
                    ) : (
                      <img src={post.mediaUrl} alt="upload" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

function Upload({
  uploadPreview,
  uploadFile,
  handleUpload,
  caption,
  setCaption,
  handleCreatePost,
  posting,
}) {
  return (
    <Page title="Upload">
      <label className="uploadBox">
        <input
  type="file"
  accept="image/*,video/*,.mov,.mp4,.m4v,.avi,.webm"
  onChange={handleUpload}
/>

        {uploadPreview ? (
          uploadFile?.type?.startsWith("video") ? (
            <video src={uploadPreview} controls />
          ) : (
            <img src={uploadPreview} alt="upload preview" />
          )
        ) : (
          <div>
            <span>＋</span>
            <p>Upload photo or video</p>
          </div>
        )}
      </label>

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="What did you practice today?"
      />

      <button
        className="primaryButton"
        onClick={handleCreatePost}
        disabled={posting}
      >
        {posting ? "Posting..." : "Post Progress"}
      </button>
    </Page>
  );
}

function Streaks({ streak }) {
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

function Profile({
  username,
  skills,
  onSignOut,
  myPosts,
  handleDeletePost,
  likedVideos,
  savedVideos,
  profilePhotoUrl,
  setProfilePhotoUrl,
}) {
  const [selectedUpload, setSelectedUpload] = useState(null);

  const [commentText, setCommentText] = useState("");

  const [localComments, setLocalComments] = useState({});

  useEffect(() => {
  if (!selectedUpload) return;

  const commentsQuery = query(
  collection(db, "comments"),
  where("postId", "==", selectedUpload.id)
);

  const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
    const comments = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
      replies: [],
    }));

    setLocalComments((prev) => ({
      ...prev,
      [selectedUpload.id]: comments,
    }));
  });

  return () => unsubscribe();
}, [selectedUpload]);

  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");

  const [hideBottomPanel, setHideBottomPanel] = useState(false);

  const [showComments, setShowComments] = useState(false);

  const [profileSection, setProfileSection] = useState("uploads");
  const [showSettings, setShowSettings] = useState(false);
const [newUsername, setNewUsername] = useState("");
const [changingUsername, setChangingUsername] = useState(false);

  async function addLocalComment(postId) {
  if (!commentText.trim()) return;

  try {
    await addDoc(collection(db, "comments"), {
      postId,
      username,
      text: commentText,
      createdAt: serverTimestamp(),
    });

    setCommentText("");
  } catch (error) {
    alert(error.message);
  }
}

  function addReply(postId, commentId) {
    if (!replyText.trim()) return;

    setLocalComments((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).map((comment) => {
        if (comment.id === commentId) {
          return {
            ...comment,
            replies: [
              ...(comment.replies || []),
              {
                id: Date.now(),
                username,
                text: replyText,
              },
            ],
          };
        }

        return comment;
      }),
    }));

    setReplyText("");
    setReplyingTo(null);
  }

  function deleteComment(postId, commentId) {
    setLocalComments((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).filter(
        (comment) => comment.id !== commentId
      ),
    }));
  }

  function deleteReply(postId, commentId, replyId) {
    setLocalComments((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).map((comment) => {
        if (comment.id === commentId) {
          return {
            ...comment,
            replies: (comment.replies || []).filter(
              (reply) => reply.id !== replyId
            ),
          };
        }

        return comment;
      }),
    }));
  }

  async function handleProfilePhoto(e) {
    const file = e.target.files?.[0];

  if (!file || !auth.currentUser) return;

  try {
    const filePath = `profilePhotos/${auth.currentUser.uid}/${Date.now()}-${file.name}`;
    const fileRef = ref(storage, filePath);

    await uploadBytes(fileRef, file);

    const photoUrl = await getDownloadURL(fileRef);

    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      profilePhotoUrl: photoUrl,
    });

    setProfilePhotoUrl(photoUrl);
  } catch (error) {
    alert(error.message);
  }
}

async function changeUsername() {
  if (!newUsername.trim()) {
    alert("Enter a new username.");
    return;
  }

  const cleanUsername = newUsername.replace("@", "").toLowerCase();

  const userRef = doc(db, "users", auth.currentUser.uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();

  if (userData.usernameLastChanged) {
    const lastChanged = userData.usernameLastChanged.toDate
      ? userData.usernameLastChanged.toDate()
      : new Date(userData.usernameLastChanged);

    const daysPassed =
      (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);

    if (daysPassed < 30) {
      const daysLeft = Math.ceil(30 - daysPassed);
      alert(`You can change your username again in ${daysLeft} days.`);
      return;
    }
  }

  const usernameQuery = query(
    collection(db, "users"),
    where("username", "==", cleanUsername)
  );

  const usernameSnapshot = await getDocs(usernameQuery);

  if (!usernameSnapshot.empty) {
    alert("Username already taken.");
    return;
  }

  setChangingUsername(true);

  try {
    await updateDoc(userRef, {
      username: cleanUsername,
      usernameLastChanged: serverTimestamp(),
      previousUsernames: arrayUnion(userData.username),
    });

    setNewUsername("");
    alert("Username updated!");
  } catch (error) {
    alert(error.message);
  } finally {
    setChangingUsername(false);
  }
}
  return (
    <Page title="Profile">
      <div className="card profileCard">
        <label className="profileAvatar">
  {profilePhotoUrl ? (
    <img src={profilePhotoUrl} alt="Profile" />
  ) : (
    <span>{username ? username.charAt(0).toUpperCase() : "H"}</span>
  )}

  <input
    type="file"
    accept="image/*"
    hidden
    onChange={handleProfilePhoto}
  />
</label>

        <h2 className="profileUsername">@{username}</h2>
        <button
  className="settingsButton"
  onClick={() => setShowSettings(true)}
>
  ⚙️ Settings
</button>

        <p className="profileSkills">
          Learning: {skills.join(", ")}
        </p>

        <div className="profileStats">

  <div>
    <b>{myPosts.length}</b>
    <span>Posts</span>
  </div>

  <div>
    <b>{likedVideos.length}</b>
    <span>Likes</span>
  </div>

  <div>
    <b>{savedVideos.length}</b>
    <span>Saved</span>
  </div>

</div>

        
        <div className="profileSections">

  <button
    className={
      profileSection === "uploads"
        ? "activeProfileSection"
        : ""
    }
    onClick={() => setProfileSection("uploads")}
  >
    Posts
  </button>

  <button
    className={
      profileSection === "likes"
        ? "activeProfileSection"
        : ""
    }
    onClick={() => setProfileSection("likes")}
  >
    Likes
  </button>

  <button
    className={
      profileSection === "saved"
        ? "activeProfileSection"
        : ""
    }
    onClick={() => setProfileSection("saved")}
  >
    Saved
  </button>

</div>
      </div>

      <div className="card uploadsCard">
        <h2 className="uploadsTitle">
  {profileSection === "uploads"
    ? "My Uploads"
    : profileSection === "likes"
    ? "Liked Videos"
    : "Saved Videos"}
</h2>

        {myPosts.length === 0 && (
          <div className="emptyVideoState">
            Your uploaded progress will appear here.
          </div>
        )}

        <div className="uploadGrid">

  {profileSection === "uploads" &&
    myPosts.map((post) => (
      <div
        className="uploadItemCard"
        key={post.id}
      >
        <button
          className="uploadItem"
          onClick={() => {
            setSelectedUpload(post);
            setHideBottomPanel(false);
            setShowComments(false);
          }}
        >
          {post.mediaType?.startsWith("video") ? (
            <video src={post.mediaUrl} />
          ) : (
            <img
              src={post.mediaUrl}
              alt="upload"
            />
          )}
        </button>

        <button
          className="deleteUploadButton"
          onClick={() => handleDeletePost(post)}
        >
          Delete
        </button>
      </div>
    ))}

  {profileSection === "likes" &&
    likedVideos.map((video) => (
      <div
        className="uploadItemCard"
        key={video.videoId}
      >
        <button
          className="uploadItem"
          onClick={() =>
            window.open(
              `https://www.youtube.com/watch?v=${video.videoId}`,
              "_blank"
            )
          }
        >
          <img
            src={video.thumbnail}
            alt={video.title}
          />
        </button>
      </div>
    ))}

  {profileSection === "saved" &&
    savedVideos.map((video) => (
      <div
        className="uploadItemCard"
        key={video.videoId}
      >
        <button
          className="uploadItem"
          onClick={() =>
            window.open(
              `https://www.youtube.com/watch?v=${video.videoId}`,
              "_blank"
            )
          }
        >
          <img
            src={video.thumbnail}
            alt={video.title}
          />
        </button>
      </div>
    ))}

</div>
      </div>
{showSettings && (
  <div className="settingsModal">
    <div className="settingsSheet">
      <div className="settingsHeader">
        <h2>Settings</h2>

        <button onClick={() => setShowSettings(false)}>
          ✕
        </button>
      </div>

      <div className="usernameChangeBox">
        <input
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          placeholder="New username"
        />

        <button onClick={changeUsername} disabled={changingUsername}>
          {changingUsername ? "Changing..." : "Change Username"}
        </button>
      </div>

      <button className="settingsSignOutButton" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  </div>
)}
      {selectedUpload && (
        <div className="uploadModal">

          <div
            className={
              hideBottomPanel
                ? "socialViewer socialViewerExpanded"
                : "socialViewer"
            }
          >

            <div className="socialHeader">

              <button
                className="backViewerButton"
                onClick={() => {
                  setSelectedUpload(null);
                  setHideBottomPanel(false);
                  setShowComments(false);
                }}
              >
                ←
              </button>

              <div className="socialHeaderUser">
                <div className="friendAvatar">
                  {selectedUpload.username
                    ? selectedUpload.username
                        .charAt(0)
                        .toUpperCase()
                    : "H"}
                </div>

                <div>
                  <h3>{selectedUpload.name}</h3>

                  <p>
                    @{selectedUpload.username}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={
                hideBottomPanel
                  ? "socialMediaWrapper expandedMedia"
                  : "socialMediaWrapper"
              }
            >
              {selectedUpload.mediaType?.startsWith(
                "video"
              ) ? (
                <video
                  src={selectedUpload.mediaUrl}
                  controls
                  autoPlay
                  className="socialFullscreenMedia"
                />
              ) : (
                <img
                  src={selectedUpload.mediaUrl}
                  alt="post"
                  className="socialFullscreenMedia"
                />
              )}
            </div>

{hideBottomPanel && (
  <button
    className="showPanelButton"
    onClick={() => setHideBottomPanel(false)}
  >
    ↑
  </button>
)}

            <div
              className={
                hideBottomPanel
                  ? "socialBottomPanel hiddenBottomPanel"
                  : "socialBottomPanel"
              }
            >

              <div className="socialActionsRow">

                <div className="leftSocialActions">

                  <button
                    className={
                      false
                        ? "socialAction activeSocialAction"
                        : "socialAction"
                    }
                  
                  >
                    ❤️
                  </button>

                  <button
                    className={
                      showComments
                        ? "socialAction activeSocialAction"
                        : "socialAction"
                    }
                    onClick={() =>
                      setShowComments(!showComments)
                    }
                  >
                    💬
                  </button>
                </div>

                <div className="rightSocialActions">

                  <button
                    className={
                      false
                        ? "socialAction activeSocialAction"
                        : "socialAction"
                    }
                    
                  >
                    🔖
                  </button>

                  <button
                    className="socialAction"
                    onClick={() =>
                      setHideBottomPanel(
                        !hideBottomPanel
                      )
                    }
                  >
                    {hideBottomPanel ? "⌄" : "✕"}
                  </button>

                </div>
              </div>

              <div className="socialCaptionBlock">
                <p>
                  <strong>
                    @{selectedUpload.username}
                  </strong>{" "}
                  {selectedUpload.caption}
                </p>

                <small>
                  {selectedUpload.skill} •
                  Progress Upload
                </small>
              </div>

              {showComments && (
                <>
                  <div className="commentsWrapper">

                    {(localComments[
                      selectedUpload.id
                    ] || []).map((comment) => (
                      <div
                        className="commentBubble"
                        key={comment.id}
                      >

                        <div className="commentTop">

                          <strong>
                            @{comment.username}
                          </strong>

                          <button
                            className="deleteCommentButton"
                            onClick={() =>
                              deleteComment(
                                selectedUpload.id,
                                comment.id
                              )
                            }
                          >
                            ✕
                          </button>
                        </div>

                        <p>{comment.text}</p>

                        <button
                          className="replyButton"
                          onClick={() =>
                            setReplyingTo(comment.id)
                          }
                        >
                          Reply
                        </button>

                        {replyingTo === comment.id && (
                          <div className="replyInputBar">

                            <input
                              value={replyText}
                              onChange={(e) =>
                                setReplyText(
                                  e.target.value
                                )
                              }
                              placeholder={`Reply to @${comment.username}...`}
                            />

                            <button
                              onClick={() =>
                                addReply(
                                  selectedUpload.id,
                                  comment.id
                                )
                              }
                            >
                              Reply
                            </button>
                          </div>
                        )}

                        {(comment.replies || []).map(
                          (reply) => (
                            <div
                              className="replyBubble"
                              key={reply.id}
                            >

                              <div className="commentTop">

                                <strong>
                                  @{reply.username}
                                </strong>

                                <button
                                  className="deleteCommentButton"
                                  onClick={() =>
                                    deleteReply(
                                      selectedUpload.id,
                                      comment.id,
                                      reply.id
                                    )
                                  }
                                >
                                  ✕
                                </button>
                              </div>

                              <p>{reply.text}</p>
                            </div>
                          )
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="commentInputBar">

                    <input
                      value={commentText}
                      onChange={(e) =>
                        setCommentText(e.target.value)
                      }
                      placeholder="Add a comment..."
                    />

                    <button
                      onClick={() =>
                        addLocalComment(
                          selectedUpload.id
                        )
                      }
                    >
                      Post
                    </button>

                  </div>
                </>
              )}

              <button
                className="deleteUploadButton"
                onClick={() => {
                  handleDeletePost(
                    selectedUpload
                  );

                  setSelectedUpload(null);
                }}
              >
                Delete Upload
              </button>

            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

function TopBar({ step, onBack }) {
  return (
    <div className="topBar">
      <button onClick={onBack}>←</button>
      <span>{step}</span>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
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
        className={tab === "profile" ? "active" : ""}
        onClick={() => setTab("profile")}
      >
        👤<span>Profile</span>
      </button>
    </nav>
  );
}

function goalEmoji(goal) {
  if (goal.includes("fun")) return "🌟";
  if (goal.includes("business")) return "💼";
  if (goal.includes("confidence")) return "✨";
  if (goal.includes("community")) return "❤️";

  return "📈";
}

function sectionEmoji(section) {
  const map = {
    Hair: "💇🏾‍♀️",
    Face: "💄",
    Coding: "💻",
    Design: "🎨",
    Visual: "📸",
    Handmade: "🧶",
    Training: "🏋️",
    Wellness: "🧘",
    Style: "👗",
    Create: "🧵",
    Cooking: "🍳",
    Content: "🎥",
  };

  return map[section] || "✨";
}

function skillEmoji(skill) {
  const map = {
    Braiding: "💇🏾‍♀️",
    "Wig Installs": "💇🏾‍♀️",
    "Natural Hair": "🌀",
    Makeup: "💄",
    Lashes: "👁️",
    Skincare: "🧴",
    Frontend: "💻",
    Python: "🐍",
    "App Building": "📱",
    "UI/UX": "🎨",
    "Web Design": "🖥️",
    "AI Tools": "🤖",
    Photography: "📸",
    "Video Editing": "🎬",
    "Graphic Design": "🖼️",
    Crochet: "🧶",
    Drawing: "✏️",
    Painting: "🎨",
    "Gym Routine": "🏋️",
    "Glute Growth": "🍑",
    Pilates: "🧘",
    Stretching: "🤸",
    Running: "🏃",
    Yoga: "🧘",
    Styling: "👗",
    "Outfit Planning": "👚",
    Thrifting: "🛍️",
    Sewing: "🧵",
    "Fashion Content": "📸",
    "Meal Prep": "🍱",
    Baking: "🧁",
    "Healthy Meals": "🥗",
    "Recipe Videos": "🎥",
    "Food Photography": "🍳",
  };

  return map[skill] || "✨";
}

