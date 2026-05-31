import Home from "../pages/Home";
import Friends from "../pages/Friends";
import Upload from "../pages/Upload";
import Streaks from "../pages/Streaks";
import Profile from "../pages/Profile";
import Messages from "../pages/Messages";
import BottomNav from "./BottomNav";

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
}) {
  return (
    <section className="mainApp">
      <div className="mainContent">
        {tab === "home" && (
  <Home
  name={name}
  firstName={firstName}
  username={username}
  currentUser={currentUser}
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
  onShareToFriend={onShareToFriend}
/>
        )}

        {tab === "friends" && (
  <Friends
    friendPosts={friendPosts}
    allPosts={allPosts}
    friends={friends}
    notifications={notifications}
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

        {tab === "messages" && (
          <Messages currentUser={currentUser} username={username} />
        )}

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

