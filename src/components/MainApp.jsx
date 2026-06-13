import { useState } from "react";
import Home from "../pages/Home";
import Friends from "../pages/Friends";
import Upload from "../pages/Upload";
import Streaks from "../pages/Streaks";
import Profile from "../pages/Profile";
import Messages from "../pages/Messages";
import BottomNav from "./BottomNav";
import FriendSearchOverlay from "./FriendSearchOverlay";

export default function MainApp({
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
  darkMode,
  toggleDarkMode,
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
  notifications,
  onShareToFriend,
  handleLikePost,
  likedPosts,
}) {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <section className="mainApp">
      <div className="mainContent">
        {tab === "home" && (
  <Home
  firstName={firstName}
  currentUser={currentUser}
  username={username}
  skills={skills}
  allPosts={allPosts}
  likedVideos={likedVideos}
  setLikedVideos={setLikedVideos}
  savedVideos={savedVideos}
  setSavedVideos={setSavedVideos}
  friends={friends}
  onShareToFriend={onShareToFriend}
  addMoreSkills={addMoreSkills}
  removeSkill={removeSkill}
/>
        )}

        {tab === "friends" && (
          <Friends
            friendPosts={friendPosts}
            allPosts={allPosts}
            friends={friends}
            notifications={notifications}
            friendRequests={friendRequests}
            handleAcceptFriendRequest={handleAcceptFriendRequest}
            handleDeclineFriendRequest={handleDeclineFriendRequest}
            setTab={setTab}
            currentUser={currentUser}
            username={username}
            handleLikePost={handleLikePost}
            likedPosts={likedPosts}
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
            skills={skills}
          />
        )}

        {tab === "streaks" && <Streaks streak={streak} />}

        {tab === "messages" && (
          <Messages currentUser={currentUser} username={username} friends={friends} />
        )}

        {tab === "profile" && (
          <Profile
            username={username}
            skills={skills}
            likedVideos={likedVideos}
            savedVideos={savedVideos}
            onSignOut={onSignOut}
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
            myPosts={myPosts}
            handleDeletePost={handleDeletePost}
            profilePhotoUrl={profilePhotoUrl}
            setProfilePhotoUrl={setProfilePhotoUrl}
          />
        )}
      </div>

      <BottomNav tab={tab} setTab={setTab} onOpenSearch={() => setShowSearch(true)} />

      {showSearch && (
        <FriendSearchOverlay
          onClose={() => setShowSearch(false)}
          friends={friends}
          currentUser={currentUser}
          handleSendFriendRequest={handleSendFriendRequest}
          handleCancelFriendRequest={handleCancelFriendRequest}
        />
      )}
    </section>
  );
}

