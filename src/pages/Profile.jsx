import { useEffect, useState } from "react";
import Page from "../components/Page";

import {
  doc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { auth, db, storage } from "../firebase";
export default function Profile({
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
