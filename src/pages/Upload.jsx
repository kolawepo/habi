import Page from "../components/Page";
export default function Upload({
  uploadPreview,
  uploadFile,
  handleUpload,
  caption,
  setCaption,
  handleCreatePost,
  posting,
}) {
  return (
    <Page title="Upload">
      <label className="uploadBox">
        <input
  type="file"
  accept="image/*,video/*,.mov,.mp4,.m4v,.avi,.webm"
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
            <p>Upload photo or video</p>
          </div>
        )}
      </label>

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="What did you practice today?"
      />

      <button
        className="primaryButton"
        onClick={handleCreatePost}
        disabled={posting}
      >
        {posting ? "Posting..." : "Post Progress"}
      </button>
    </Page>
  );
}