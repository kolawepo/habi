import { useState } from "react";
import Page from "../components/Page";
import { skillEmoji } from "../utils/emojis";

export default function Upload({
  uploadPreview,
  uploadFile,
  handleUpload,
  caption,
  setCaption,
  handleCreatePost,
  posting,
  skills,
}) {
  const [postType, setPostType] = useState(null);
  const [tutorialSkill, setTutorialSkill] = useState(skills[0] || "");

  if (!postType) {
    return (
      <Page title="Upload">
        <div className="postTypeGrid">
          <button
            className="postTypeCard progressCard"
            onClick={() => setPostType("progress")}
          >
            <span className="postTypeEmoji">📸</span>
            <h3>Share Progress</h3>
            <p>Show your practice. Saved to your profile.</p>
          </button>

          <button
            className="postTypeCard tutorialCard"
            onClick={() => setPostType("tutorial")}
          >
            <span className="postTypeEmoji">🎬</span>
            <h3>Teach a Skill</h3>
            <p>Share your knowledge. Goes to the main feed.</p>
          </button>
        </div>
      </Page>
    );
  }

  const isProgress = postType === "progress";

  return (
    <Page title={isProgress ? "Share Progress" : "Teach a Skill"}>
      <button className="changePostTypeButton" onClick={() => setPostType(null)}>
        ← Change type
      </button>

      {/* Skill picker — tutorial only */}
      {!isProgress && (
        <div className="tutorialSkillPicker">
          <p className="tutorialSkillLabel">Which skill is this tutorial for?</p>
          <div className="skillPills">
            {skills.map((skill) => (
              <button
                key={skill}
                type="button"
                className={`skillPill${tutorialSkill === skill ? " isSelected" : ""}`}
                onClick={() => setTutorialSkill(skill)}
              >
                {skillEmoji(skill)} {skill}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="uploadBox">
        <input
          type="file"
          accept={isProgress ? "image/*,video/*,.mov,.mp4,.m4v,.avi,.webm" : "video/*,.mov,.mp4,.m4v,.avi,.webm"}
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
            <p>{isProgress ? "Upload photo or video" : "Upload tutorial video"}</p>
          </div>
        )}
      </label>

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder={
          isProgress
            ? "What did you practice today?"
            : "What will viewers learn? Describe your tutorial."
        }
      />

      <button
        className={`primaryButton${isProgress ? "" : " tutorialPostButton"}`}
        onClick={() => handleCreatePost(postType, isProgress ? null : tutorialSkill)}
        disabled={posting || (!isProgress && !tutorialSkill)}
      >
        {posting ? "Posting…" : isProgress ? "Post Progress" : "Post Tutorial"}
      </button>
    </Page>
  );
}
