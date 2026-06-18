import { useEffect, useState } from "react";
import Page from "../components/Page";

import {
  doc,
  updateDoc,
  collection,
  addDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { auth, db, storage } from "../firebase";
import { copyText, shareLink } from "../utils/share";
export default function Profile({
  username,
  skills,
  onSignOut,
  darkMode,
  toggleDarkMode,
  myPosts,
  handleDeletePost,
  likedVideos,
  savedVideos,
  profilePhotoUrl,
  setProfilePhotoUrl,
  hideLikeCount,
  onToggleHideLikeCount,
  referralCode,
  referralCount,
}) {
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [showReferral, setShowReferral] = useState(false);
  const [referralToast, setReferralToast] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  const referralLink = referralCode ? `https://habi-sepia.vercel.app/r/${referralCode}` : "";

  function shareReferral() {
    if (!referralLink) return;
    shareLink(
      {
        title: "Habi",
        text: `Join me on Habi — use my link to sign up: ${referralLink}`,
        url: referralLink,
      },
      setReferralToast
    );
  }

  async function copyReferralLink() {
    if (!referralLink) return;
    await copyText(referralLink);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  }

  const [commentText, setCommentText] = useState("");

  const [localComments, setLocalComments] = useState({});

  useEffect(() => {
  if (!selectedUpload) return;

  const commentsQuery = query(
  collection(db, "comments"),
  where("postId", "==", selectedUpload.id)
);

  const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
    const allDocs = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));

    const comments = allDocs
      .filter((c) => !c.parentCommentId)
      .map((comment) => ({
        ...comment,
        replies: allDocs.filter((c) => c.parentCommentId === comment.id),
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

  const [showComments, setShowComments] = useState(false);
  const [showActionBar, setShowActionBar] = useState(true);

  const [profileSection, setProfileSection] = useState("uploads");
  const [showSettings, setShowSettings] = useState(false);
const [newUsername, setNewUsername] = useState("");
const [changingUsername, setChangingUsername] = useState(false);

  async function addLocalComment(postId) {
  if (!commentText.trim()) return;

  try {
    const docRef = await addDoc(collection(db, "comments"), {
      postId: postId,
      username: username,
      text: commentText.trim(),
      createdAt: serverTimestamp(),
    });

    console.log("Comment saved with ID:", docRef.id);
    setCommentText("");
  } catch (error) {
    console.error("Comment error:", error);
    alert(error.message);
  }
}



  async function addReply(postId, commentId) {
    if (!replyText.trim()) return;

    try {
      await addDoc(collection(db, "comments"), {
        postId,
        parentCommentId: commentId,
        username,
        text: replyText.trim(),
        createdAt: serverTimestamp(),
      });

      setReplyText("");
      setReplyingTo(null);
    } catch (error) {
      alert(error.message);
    }
  }

  async function deleteComment(commentId) {
    try {
      const repliesQuery = query(
        collection(db, "comments"),
        where("parentCommentId", "==", commentId)
      );
      const repliesSnapshot = await getDocs(repliesQuery);

      const batch = writeBatch(db);
      batch.delete(doc(db, "comments", commentId));
      repliesSnapshot.docs.forEach((replyDoc) => batch.delete(replyDoc.ref));
      await batch.commit();
    } catch (error) {
      alert(error.message);
    }
  }

  async function deleteReply(replyId) {
    try {
      await deleteDoc(doc(db, "comments", replyId));
    } catch (error) {
      alert(error.message);
    }
  }

  // Close modal when the post is deleted (myPosts snapshot fires without it)
  useEffect(() => {
    if (!selectedUpload) return;
    if (!myPosts.find(p => p.id === selectedUpload.id)) {
      setSelectedUpload(null);
      setShowComments(false);
    }
  }, [myPosts]); // eslint-disable-line

  async function toggleLike(post) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const isLiked = (post.likedBy || []).includes(uid);
    await updateDoc(doc(db, "posts", post.id), {
      likedBy: isLiked ? arrayRemove(uid) : arrayUnion(uid),
    });
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
    <div className="profilePage">
      <div className="card profileCard">
        {referralCode && (
          <button
            className="referralIcon"
            onClick={() => setShowReferral(true)}
            aria-label="Referral"
          >
            🎁
          </button>
        )}

        <button
          className="settingsGear"
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
        >
          ⚙️
        </button>

        <label className="profileAvatar">
          {profilePhotoUrl ? (
            <img src={profilePhotoUrl} alt="Profile" />
          ) : (
            <span>{username ? username.charAt(0).toUpperCase() : "H"}</span>
          )}
          <input type="file" accept="image/*" hidden onChange={handleProfilePhoto} />
        </label>

        <h2 className="profileUsername">@{username}</h2>

        {skills.length > 0 && (
          <div className="profileSkillPills">
            {skills.map(skill => (
              <span key={skill} className="profileSkillPill">{skill}</span>
            ))}
          </div>
        )}

        <div className="profileStats">

  <div>
    <b>{myPosts.length}</b>
    <span>Posts</span>
  </div>

  <div>
    <b>{myPosts.reduce((sum, p) => sum + (p.likedBy?.length || 0), 0)}</b>
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
            setShowComments(false);
            setShowActionBar(true);
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

      <div className="themeToggleRow">
        <span>{darkMode ? "Dark mode" : "Light mode"}</span>
        <button className="themeToggleBtn" onClick={toggleDarkMode}>
          {darkMode ? "☀️" : "🌙"}
        </button>
      </div>

      <div className="themeToggleRow">
        <span>Hide like count on my posts</span>
        <button
          className={`themeToggleBtn settingsToggle${hideLikeCount ? " settingsToggleOn" : ""}`}
          onClick={onToggleHideLikeCount}
        >
          {hideLikeCount ? "ON" : "OFF"}
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
{showReferral && (
  <div className="settingsModal" onClick={() => setShowReferral(false)}>
    <div className="settingsSheet" onClick={(e) => e.stopPropagation()}>
      <div className="settingsHeader">
        <h2>Invite Friends</h2>

        <button onClick={() => setShowReferral(false)}>
          ✕
        </button>
      </div>

      <div className="referralCodeBox">{referralCode}</div>

      <div className="referralLinkRow">
        <span className="referralLinkText">{referralLink}</span>
        <button className="referralCopyButton" onClick={copyReferralLink}>
          {referralCopied ? "Copied!" : "Copy"}
        </button>
      </div>

      <p className="referralCountText">
        {referralCount > 0
          ? `${referralCount} friend${referralCount === 1 ? "" : "s"} invited so far`
          : "No friends invited yet"}
      </p>

      <button className="primaryButton" onClick={shareReferral}>
        {referralToast ? "Link copied!" : "Share invite link"}
      </button>
    </div>
  </div>
)}
      {selectedUpload && (() => {
        const uid = auth.currentUser?.uid;
        const currentPost = myPosts.find(p => p.id === selectedUpload.id) || selectedUpload;
        const isLiked = (currentPost.likedBy || []).includes(uid);
        return (
        <div className="uploadModal">
          <div className={showActionBar ? "socialViewer" : "socialViewer socialViewerExpanded"}>

            <div className="socialHeader">
              <button
                className="backViewerButton"
                onClick={() => { setSelectedUpload(null); setShowComments(false); }}
              >
                ←
              </button>
              <div className="socialHeaderUser">
                <div className="friendAvatar">
                  {selectedUpload.username ? selectedUpload.username.charAt(0).toUpperCase() : "H"}
                </div>
                <div>
                  <h3>{selectedUpload.name}</h3>
                  <p>@{selectedUpload.username}</p>
                </div>
              </div>
            </div>

            <div className={showActionBar ? "socialMediaWrapper" : "socialMediaWrapper expandedMedia"}>
              {selectedUpload.mediaType?.startsWith("video") ? (
                <video src={selectedUpload.mediaUrl} controls autoPlay className="socialFullscreenMedia" />
              ) : (
                <img src={selectedUpload.mediaUrl} alt="post" className="socialFullscreenMedia" />
              )}

              {!showActionBar && (
                <button
                  className="showActionBarChevron"
                  onClick={() => setShowActionBar(true)}
                  aria-label="Show post details"
                >
                  ↑
                </button>
              )}
            </div>

            <div className={showActionBar ? "socialBottomPanel" : "socialBottomPanel hiddenBottomPanel"}>
              <div className="socialActionsRow">
                <div className="leftSocialActions">
                  <button
                    className={isLiked ? "socialAction activeSocialAction" : "socialAction"}
                    onClick={() => toggleLike(currentPost)}
                  >
                    {isLiked ? "❤️" : "🤍"}
                  </button>
                  <button
                    className={showComments ? "socialAction activeSocialAction" : "socialAction"}
                    onClick={() => setShowComments(!showComments)}
                  >
                    💬
                  </button>
                </div>
                <div className="rightSocialActions">
                  <button
                    className="socialAction"
                    onClick={() => setShowActionBar(false)}
                  >
                    ✕
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

                <button
                  className="postDeleteLink"
                  onClick={() => handleDeletePost(selectedUpload)}
                >
                  Delete post
                </button>
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
                            onClick={() => deleteComment(comment.id)}
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
                                  onClick={() => deleteReply(reply.id)}
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

            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
