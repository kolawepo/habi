import { useEffect, useState } from "react";
import Page from "../components/Page";
import VideoCard from "../components/VideoCard";
import { skillEmoji } from "../utils/emojis";
export default function Home({
  name,
  firstName,
  username,
  currentUser,
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
  onShareToFriend,
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
  username={username}
  currentUser={currentUser}
  onShareToFriend={onShareToFriend}
/>
          ))}
        </div>
      )}
    </Page>
  );
}

