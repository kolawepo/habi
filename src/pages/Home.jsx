import { useEffect, useState, useRef } from "react";
import { skillEmoji } from "../utils/emojis";
import ShareModal from "../components/ShareModal";

// ── YouTube helpers ────────────────────────────────────────────────────────────

function ytCmd(iframe, fn, args = []) {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func: fn, args }),
    "https://www.youtube.com"
  );
}

const isMobile = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;

// ── Cache ──────────────────────────────────────────────────────────────────────

const TTL = 24 * 60 * 60 * 1000;

function loadCache(skill) {
  try {
    const { videos, ts } = JSON.parse(localStorage.getItem(`yt_${skill}`) || "{}");
    if (!videos?.length || Date.now() - ts > TTL) { localStorage.removeItem(`yt_${skill}`); return null; }
    return videos;
  } catch { return null; }
}

function saveCache(skill, videos) {
  try { localStorage.setItem(`yt_${skill}`, JSON.stringify({ videos, ts: Date.now() })); } catch {}
}


// ── Component ──────────────────────────────────────────────────────────────────

export default function Home({
  firstName, skills, allPosts,
  likedVideos, setLikedVideos, savedVideos, setSavedVideos,
  friends, onShareToFriend, addMoreSkills,
}) {
  const [activeSkill, setActiveSkill] = useState(skills[0] || "");
  const [ytBySkill,   setYtBySkill]   = useState({});
  const [loading,     setLoading]     = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failed,      setFailed]      = useState(new Set());
  const [shareTarget, setShareTarget] = useState(null);

  const [muted, setMuted] = useState(false);

  const feedEl           = useRef(null);
  const slideRefs        = useRef([]);
  const iframeRefs       = useRef({});
  const readySet         = useRef(new Set());
  const obsRef           = useRef(null);
  const memCache         = useRef({});
  const feedRef          = useRef([]);
  const soundUnlocked    = useRef(false);

  const activeIdxRef = useRef(0); activeIdxRef.current = activeIndex;
  const mutedRef     = useRef(muted); mutedRef.current   = muted;

  function ytSrc(videoId) {
    if (isMobile) {
      return (
        `https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1&modestbranding=1` +
        `&playsinline=1&rel=0&loop=1&playlist=${videoId}&enablejsapi=1&iv_load_policy=3`
      );
    }
    const startMuted = !soundUnlocked.current || mutedRef.current;
    return (
      `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${startMuted ? 1 : 0}&controls=1&modestbranding=1` +
      `&playsinline=1&rel=0&loop=1&playlist=${videoId}&enablejsapi=1&iv_load_policy=3`
    );
  }

  const YT_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  async function fetchSkill(skill, cx) {
    if (memCache.current[skill]?.length) return memCache.current[skill];
    const hit = loadCache(skill);
    if (hit) { memCache.current[skill] = hit; return hit; }

    if (!YT_KEY) return [];

    const q = encodeURIComponent(skill + " tutorial how to beginner");
    const confirmed = []; const seen = new Set();
    let pageToken = null; let fetched = 0;

    while (confirmed.length < 8 && fetched < 50) {
      if (cx.current) return null;
      const size = Math.min(25, 50 - fetched);
      let url =
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
        `&videoEmbeddable=true&videoSyndicated=true&relevanceLanguage=en&safeSearch=strict` +
        `&maxResults=${size}&q=${q}&key=${YT_KEY}`;
      if (pageToken) url += `&pageToken=${pageToken}`;

      let data;
      try {
        data = await fetch(url).then(r => r.json());
      } catch { break; }

      if (data.error || cx.current) break;
      pageToken = data.nextPageToken || null;

      const batch = (data.items || [])
        .filter(i => i.id?.videoId && !seen.has(i.id.videoId))
        .map(i => { seen.add(i.id.videoId); return {
          videoId: i.id.videoId, title: i.snippet.title,
          creator: i.snippet.channelTitle, skill,
          thumbnail: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url,
        }; });
      fetched += batch.length;
      if (!batch.length) break;

      let stats;
      try {
        stats = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.map(v => v.videoId).join(",")}&key=${YT_KEY}`
        ).then(r => r.json());
      } catch { break; }

      const views = Object.fromEntries(
        (stats.items || []).map(i => [i.id, parseInt(i.statistics?.viewCount || "0", 10)])
      );
      const popular = batch.filter(v => (views[v.videoId] || 0) >= 1000);

      if (cx.current) return null;
      confirmed.push(...popular);
      if (!pageToken) break;
    }

    if (cx.current) return null;
    if (confirmed.length) { memCache.current[skill] = confirmed; saveCache(skill, confirmed); }
    return confirmed;
  }

  // Load active skill
  useEffect(() => {
    if (!activeSkill) return;
    const cached = memCache.current[activeSkill]?.length
      ? memCache.current[activeSkill] : loadCache(activeSkill);
    if (cached) { memCache.current[activeSkill] = cached; setYtBySkill(p => ({ ...p, [activeSkill]: cached })); return; }
    const cx = { current: false };
    setLoading(true);
    fetchSkill(activeSkill, cx)
      .then(v => { if (!cx.current && v?.length) setYtBySkill(p => ({ ...p, [activeSkill]: v })); })
      .catch(() => {})
      .finally(() => { if (!cx.current) setLoading(false); });
    return () => { cx.current = true; };
  }, [activeSkill, YT_KEY]); // eslint-disable-line

  // Background-prefetch all skills
  useEffect(() => {
    if (!YT_KEY || !skills.length) return;
    const cx = { current: false };
    skills.forEach(s => fetchSkill(s, cx)
      .then(v => { if (!cx.current && v?.length) setYtBySkill(p => p[s]?.length ? p : { ...p, [s]: v }); })
      .catch(() => {}));
    return () => { cx.current = true; };
  }, [skills, YT_KEY]); // eslint-disable-line

  useEffect(() => {
    if (skills.length && !skills.includes(activeSkill)) setActiveSkill(skills[0]);
  }, [skills]); // eslint-disable-line

  // ── Feed ──────────────────────────────────────────────────────────────────

  const feed = [
    ...allPosts
      .filter(p => p.postType === "tutorial" && p.skill === activeSkill)
      .slice(0, 20)
      .map(p => ({ ...p, _type: "post" })),
    ...(ytBySkill[activeSkill] || []).map(v => ({ ...v, _type: "youtube" })),
  ];
  feedRef.current = feed;

  // ── Reset on skill change ──────────────────────────────────────────────────

  useEffect(() => {
    setActiveIndex(0);
    feedEl.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [activeSkill]);

  // ── IntersectionObserver ───────────────────────────────────────────────────

  useEffect(() => {
    obsRef.current = new IntersectionObserver(entries => {
      for (const e of entries)
        if (e.isIntersecting) {
          const i = parseInt(e.target.dataset.index, 10);
          if (!isNaN(i)) setActiveIndex(i);
        }
    }, { threshold: 0.6 });
    return () => obsRef.current?.disconnect();
  }, []);

  // ── First gesture → unlock sound for desktop autoplay ────────────────────

  useEffect(() => {
    if (isMobile) return;
    let fired = false;
    function onGesture() {
      if (fired) return;
      fired = true;
      soundUnlocked.current = true;
      const item = feedRef.current[activeIdxRef.current];
      if (item?._type === "youtube") {
        const f = iframeRefs.current[item.videoId];
        if (!mutedRef.current) { ytCmd(f, "unMute"); ytCmd(f, "setVolume", [100]); }
        ytCmd(f, "playVideo");
      }
    }
    document.addEventListener("click", onGesture);
    return () => document.removeEventListener("click", onGesture);
  }, []); // eslint-disable-line

  // ── Desktop: when active index changes, play if iframe already ready ──────

  useEffect(() => {
    if (isMobile) return;
    const item = feedRef.current[activeIndex];
    if (!item || item._type !== "youtube") return;
    const f = iframeRefs.current[item.videoId];
    if (f && readySet.current.has(item.videoId)) {
      ytCmd(f, "playVideo");
    }
  }, [activeIndex]); // eslint-disable-line

  // ── Auto-skip unembeddable ─────────────────────────────────────────────────

  useEffect(() => {
    const item = feedRef.current[activeIdxRef.current];
    if (!item || item._type !== "youtube" || !failed.has(item.videoId)) return;
    const next = activeIdxRef.current + 1;
    if (feedEl.current && next < feedRef.current.length)
      feedEl.current.scrollTo({ top: next * (feedEl.current.clientHeight || innerHeight), behavior: "instant" });
  }, [failed, activeIndex]); // eslint-disable-line

  // ── YouTube postMessage listener ───────────────────────────────────────────

  useEffect(() => {
    function onMsg(e) {
      if (e.origin !== "https://www.youtube.com") return;
      let d; try { d = JSON.parse(e.data); } catch { return; }
      const vid = Object.keys(iframeRefs.current).find(id => iframeRefs.current[id]?.contentWindow === e.source);
      if (!vid) return;

      if (d.event === "onError" && [100, 101, 150].includes(d.info))
        setFailed(p => new Set([...p, vid]));

      if (d.event === "onReady") {
        readySet.current.add(vid);
        if (!isMobile) {
          const active = feedRef.current[activeIdxRef.current];
          if (active?._type === "youtube" && active.videoId === vid) {
            if (soundUnlocked.current && !mutedRef.current) ytCmd(iframeRefs.current[vid], "setVolume", [100]);
            ytCmd(iframeRefs.current[vid], "playVideo");
          } else {
            ytCmd(iframeRefs.current[vid], "pauseVideo");
          }
        }
      }


    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // ── Mute toggle ────────────────────────────────────────────────────────────

  function toggleMute(e) {
    e.stopPropagation();
    const nowMuted = !muted;
    const item = feedRef.current[activeIdxRef.current];
    if (item?._type === "youtube") {
      const f = iframeRefs.current[item.videoId];
      nowMuted ? ytCmd(f, "mute") : (ytCmd(f, "unMute"), ytCmd(f, "setVolume", [100]));
    }
    setMuted(nowMuted);
  }

  // ── Like / save ────────────────────────────────────────────────────────────

  const isLiked = v => likedVideos.some(x => x.videoId === v.videoId);
  const isSaved = v => savedVideos.some(x => x.videoId === v.videoId);

  function toggleLike(v) {
    isLiked(v)
      ? setLikedVideos(p => p.filter(x => x.videoId !== v.videoId))
      : setLikedVideos(p => [...p, { videoId: v.videoId, title: v.title, creator: v.creator, thumbnail: v.thumbnail, skill: v.skill }]);
  }

  function toggleSave(v) {
    isSaved(v)
      ? setSavedVideos(p => p.filter(x => x.videoId !== v.videoId))
      : setSavedVideos(p => [...p, { videoId: v.videoId, title: v.title, creator: v.creator, thumbnail: v.thumbnail, skill: v.skill }]);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (feed.length === 0) {
    return (
      <div className="feedEmptyState">
        {!skills.length ? "Add skills to see videos" : loading ? "Loading…" : `No ${activeSkill} videos yet.`}
      </div>
    );
  }

  return (
    <>
      {/* Skill tabs pinned at top */}
      <div className="feedHeader">
        <div className="feedSkillTabsRow">
          <div className="feedSkillTabs">
            {skills.map(s => (
              <button
                key={s}
                className={`feedSkillTab${s === activeSkill ? " feedSkillTabActive" : ""}`}
                onClick={() => setActiveSkill(s)}
              >
                {skillEmoji(s)} {s}
              </button>
            ))}
          </div>
          {addMoreSkills && (
            <button className="editSkillsBtn" onClick={addMoreSkills}>+ Skills</button>
          )}
        </div>
      </div>

      {/* Full-screen snap feed */}
      <div className="tiktokFeed" ref={feedEl} tabIndex={-1} style={{ touchAction: "pan-y" }}>
        {feed.map((item, idx) => {
          const isYt     = item._type === "youtube";
          const isFailed = isYt && failed.has(item.videoId);
          const isActive = idx === activeIndex;

          return (
            <div
              key={item.id || item.videoId || idx}
              className="tiktokSlide"
              data-index={idx}
              ref={el => {
                const old = slideRefs.current[idx];
                if (old && old !== el) obsRef.current?.unobserve(old);
                slideRefs.current[idx] = el;
                if (el) obsRef.current?.observe(el);
              }}
              onTouchStart={() => {
                if (document.activeElement?.tagName === "IFRAME") {
                  document.activeElement.blur();
                }
                feedEl.current?.focus();
              }}
            >
              {/* Media */}
              {isYt ? (
                isFailed ? (
                  <img src={item.thumbnail} className="tiktokSlideMedia ytBlockedThumb" alt={item.title} />
                ) : isActive ? (
                  <>
                    <iframe
                      key={item.videoId}
                      ref={el => {
                        if (el) iframeRefs.current[item.videoId] = el;
                        else { delete iframeRefs.current[item.videoId]; readySet.current.delete(item.videoId); }
                      }}
                      className="tiktokSlideMedia tiktokYtFrame"
                      src={ytSrc(item.videoId)}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                    <div className="slideSwipeZone" />
                  </>
                ) : (
                  <img src={item.thumbnail} className="tiktokSlideMedia" alt={item.title} />
                )
              ) : item.mediaType?.startsWith("video") ? (
                <video src={item.mediaUrl} className="tiktokSlideMedia" loop muted playsInline autoPlay />
              ) : (
                <img src={item.mediaUrl} className="tiktokSlideMedia" alt={item.caption} />
              )}

              <div className="tiktokGradient" />
              <div className="tiktokTopGradient" />

              {isFailed && idx === activeIndex && (
                <div className="ytBlockedBanner">
                  <p>This video can't be embedded</p>
                  <a
                    href={`https://www.youtube.com/watch?v=${item.videoId}`}
                    target="_blank" rel="noreferrer"
                    className="watchOnYtButton"
                  >
                    Watch on YouTube ↗
                  </a>
                </div>
              )}

              {/* Title / creator */}
              <div className="tiktokSlideInfo">
                {item.skill && (
                  <span className="tiktokSkillTag">{skillEmoji(item.skill)} {item.skill}</span>
                )}
                {isYt ? (
                  <>
                    <p className="tiktokVideoTitle">{item.title}</p>
                    <p className="tiktokCreator">{item.creator}</p>
                  </>
                ) : (
                  <>
                    <p className="tiktokUsername">@{item.username}</p>
                    <p className="tiktokCaption">{item.caption}</p>
                  </>
                )}
              </div>

              {/* Side actions */}
              <div className="tiktokActions">
                {isYt && !isFailed && (
                  <>
                    <button
                      className={`tiktokActionBtn${isLiked(item) ? " tiktokActionActive" : ""}`}
                      onClick={e => { e.stopPropagation(); toggleLike(item); }}
                    >❤️</button>
                    <button
                      className={`tiktokActionBtn${isSaved(item) ? " tiktokActionActive" : ""}`}
                      onClick={e => { e.stopPropagation(); toggleSave(item); }}
                    >🔖</button>
                    <button
                      className="tiktokActionBtn"
                      onClick={e => {
                        e.stopPropagation();
                        if (!friends.length) { alert("Add friends to share videos."); return; }
                        setShareTarget({ videoId: item.videoId, title: item.title, creator: item.creator, thumbnail: item.thumbnail, skill: item.skill });
                      }}
                    >📤</button>
                  </>
                )}
                <button className="tiktokActionBtn" onClick={toggleMute}>
                  {muted ? "🔊" : "🔇"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {shareTarget && (
        <ShareModal
          friends={friends}
          videoTitle={shareTarget.title}
          onSend={uid => onShareToFriend(uid, shareTarget)}
          onClose={() => setShareTarget(null)}
        />
      )}
    </>
  );
}
