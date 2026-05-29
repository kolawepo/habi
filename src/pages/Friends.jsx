import { useEffect, useState } from "react";
import Page from "../components/Page";

import {
  doc,
  getDoc,
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "../firebase";

export default function Friends({
  friendPosts,
  allPosts,
  friends,
  notifications,
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
    {notifications.length > 0 && (
  <span className="friendBellBadge">
    {notifications.length}
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
  <div className="notificationOverlay">
    <div className="notificationPanel">
      <button
        className="closeFriendProfile"
        onClick={() => setShowRequests(false)}
      >
        ✕
      </button>

      <h2 className="requestsTitle">Notifications</h2>

      <h3 className="notificationSectionTitle">Friend Requests</h3>

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
              {request.firstName || request.username} sent you a friend request.
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

      <h3 className="notificationSectionTitle">Activity</h3>

      {notifications.length === 0 ? (
        <div className="emptyVideoState">
          No activity yet.
        </div>
      ) : (
        notifications.map((notification) => (
          <div key={notification.id} className="activityCard">
            <p>{notification.text}</p>
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