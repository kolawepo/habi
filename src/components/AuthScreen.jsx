import { useState } from "react";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

import { auth, db } from "../firebase";
export default function AuthScreen({
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