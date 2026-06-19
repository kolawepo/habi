import { useRef, useState } from "react";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../firebase";
import { generateUniqueReferralCode, findReferrerByCode } from "../utils/referral";
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
  const [referralInput, setReferralInput] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  async function handleAuth() {
    // Synchronous guard against a double-tap firing this twice before the
    // `disabled` state from `loading` visually commits.
    if (submittingRef.current) return;
    submittingRef.current = true;

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

        // Manually-entered code wins over one carried in from a /r/{code} link,
        // in case someone clicked one friend's link but wants credit to go elsewhere.
        const urlReferralCode = localStorage.getItem("habi_referral_code") || "";
        const finalReferralCode = referralInput.trim() || urlReferralCode;
        const referrer = finalReferralCode ? await findReferrerByCode(finalReferralCode) : null;

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        const user = userCredential.user;

        // The Auth account already exists at this point. If anything below
        // fails, roll it back so the email isn't permanently stuck with no
        // profile (signing in afterward would otherwise be a dead end).
        try {
          const myReferralCode = await generateUniqueReferralCode(cleanUsername);

          // Atomically claim the username and create the profile together.
          // usernames/{username} acts as a uniqueness ledger keyed by the
          // username itself — Firestore's transaction engine guarantees that
          // if two signups race for the same name, only one read-of-empty can
          // win; the other is retried and sees the doc already taken.
          await runTransaction(db, async (transaction) => {
            const usernameRef = doc(db, "usernames", cleanUsername);
            const usernameSnap = await transaction.get(usernameRef);

            if (usernameSnap.exists()) {
              throw new Error("Username already taken.");
            }

            transaction.set(usernameRef, {
              uid: user.uid,
              createdAt: serverTimestamp(),
            });

            transaction.set(doc(db, "users", user.uid), {
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
              referralCode: myReferralCode,
              referredBy: referrer?.uid || null,
              referralCount: 0,
              // Credited once on the referred user's first post, not at signup —
              // see handleCreatePost in App.jsx.
              referralCredited: false,
            });
          });
        } catch (profileError) {
          await user.delete().catch(() => signOut(auth).catch(() => {}));
          throw new Error(profileError.message === "Username already taken."
            ? "Username already taken."
            : "Something went wrong setting up your account. Please try again.", { cause: profileError });
        }

        localStorage.removeItem("habi_referral_code");

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
        // Auth account exists but the profile write never completed (e.g. a
        // connection drop mid-signup). Clean up the orphan so this email is
        // free again, instead of leaving a permanent dead end.
        await user.delete().catch(() => signOut(auth).catch(() => {}));
        setAuthMessage("We couldn't find your profile — this can happen after a connection issue during signup. Please sign up again.");
        setAuthMode("create");
      }
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setLoading(false);
      submittingRef.current = false;
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

            <input
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value)}
              placeholder="Referral code (optional)"
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