export default function VideoCard({
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
