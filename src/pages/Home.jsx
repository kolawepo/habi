import { useEffect, useState, useRef } from "react";
import { flushSync } from "react-dom";
import { skillEmoji } from "../utils/emojis";
import ShareModal from "../components/ShareModal";

// ── YouTube helpers ────────────────────────────────────────────────────────────

// mute=1 so the player can autoplay before the user has gestured
function ytSrc(videoId) {
  return (
    `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1` +
    `&playsinline=1&rel=0&loop=1&playlist=${videoId}&enablejsapi=1`
  );
}

// no mute — used after the user has unlocked audio via a tap gesture
function ytSrcSound(videoId) {
  return (
    `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1` +
    `&playsinline=1&rel=0&loop=1&playlist=${videoId}&enablejsapi=1`
  );
}

const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

function ytCmd(iframe, fn, args = []) {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func: fn, args }),
    "https://www.youtube.com"
  );
}

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

  const [muted,         setMuted]         = useState(false);
  const [soundUnlocked, setSoundUnlocked] = useState(!isMobile);
  const [searchQuery,   setSearchQuery]   = useState("");

  const feedEl           = useRef(null);
  const slideRefs        = useRef([]);
  const iframeRefs       = useRef({});
  const readySet         = useRef(new Set());
  const obsRef           = useRef(null);
  const memCache         = useRef({});
  const feedRef          = useRef([]);
  const pauseIndRefs     = useRef({});  // videoId → DOM element for pause indicator
  const progressBarRef   = useRef(null);
  const progressFillRef  = useRef(null);
  const durationRef      = useRef(0);
  const currentTimeRef   = useRef(0);
  const lastUpdateRef    = useRef(0);
  const isPlayingRef     = useRef(false);
  const animFrameRef     = useRef(null);

  const activeIdxRef = useRef(0); activeIdxRef.current = activeIndex;
  const mutedRef     = useRef(muted); mutedRef.current   = muted;

  const YT_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

  // ── Progress helpers ───────────────────────────────────────────────────────

  function startProgressLoop() {
    if (animFrameRef.current) return;
    function tick() {
      if (!isPlayingRef.current) { animFrameRef.current = null; return; }
      if (durationRef.current > 0 && progressFillRef.current) {
        const elapsed = (Date.now() - lastUpdateRef.current) / 1000;
        const t = Math.min(durationRef.current, currentTimeRef.current + elapsed);
        progressFillRef.current.style.width = `${(t / durationRef.current) * 100}%`;
      }
      animFrameRef.current = requestAnimationFrame(tick);
    }
    animFrameRef.current = requestAnimationFrame(tick);
  }

  function stopProgressLoop() {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
  }

  function seekToPosition(clientX) {
    if (!progressBarRef.current || durationRef.current <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const t = frac * durationRef.current;
    const item = feedRef.current[activeIdxRef.current];
    if (item?._type === "youtube") ytCmd(iframeRefs.current[item.videoId], "seekTo", [t, true]);
    currentTimeRef.current = t;
    lastUpdateRef.current  = Date.now();
    if (progressFillRef.current) progressFillRef.current.style.width = `${frac * 100}%`;
  }

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

  const rawFeed = [
    ...allPosts
      .filter(p => p.postType === "tutorial" && p.skill === activeSkill)
      .slice(0, 20)
      .map(p => ({ ...p, _type: "post" })),
    ...(ytBySkill[activeSkill] || []).map(v => ({ ...v, _type: "youtube" })),
  ];
  const q = searchQuery.trim().toLowerCase();
  const feed = q
    ? rawFeed.filter(item =>
        (item.title || item.caption || "").toLowerCase().includes(q) ||
        (item.creator || item.username || "").toLowerCase().includes(q)
      )
    : rawFeed;
  feedRef.current = feed;

  // ── Reset on skill or search change ───────────────────────────────────────

  useEffect(() => {
    setActiveIndex(0);
    feedEl.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [searchQuery]); // eslint-disable-line

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

  // ── When active index changes, play it if the iframe is already ready ─────
  // (usually onReady fires after mount and handles it; this covers fast swipes
  //  where the iframe was pre-mounted from a previous render cycle)

  useEffect(() => {
    stopProgressLoop();
    isPlayingRef.current  = false;
    currentTimeRef.current = 0;
    lastUpdateRef.current  = 0;
    durationRef.current    = 0;
    if (progressFillRef.current) progressFillRef.current.style.width = '0%';
    const item = feedRef.current[activeIndex];
    if (!item || item._type !== "youtube") return;
    const f = iframeRefs.current[item.videoId];
    if (f && readySet.current.has(item.videoId)) {
      if (mutedRef.current) ytCmd(f, "mute");
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
        const active = feedRef.current[activeIdxRef.current];
        if (active?._type === "youtube" && active.videoId === vid) {
          if (mutedRef.current) ytCmd(iframeRefs.current[vid], "mute");
          ytCmd(iframeRefs.current[vid], "playVideo");
        } else {
          ytCmd(iframeRefs.current[vid], "pauseVideo");
        }
      }

      if (d.event === "infoDelivery" && d.info) {
        if (d.info.duration)          durationRef.current    = d.info.duration;
        if (d.info.currentTime != null) {
          currentTimeRef.current = d.info.currentTime;
          lastUpdateRef.current  = Date.now();
        }
      }

      if (d.event === "onStateChange") {
        const ind = pauseIndRefs.current[vid];
        if (d.info === 1) {                    // playing
          if (ind) ind.style.display = "none";
          isPlayingRef.current = true;
          startProgressLoop();
        } else if (d.info === 2) {             // paused
          if (ind) ind.style.display = "flex";
          isPlayingRef.current = false;
          stopProgressLoop();
        }
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => () => stopProgressLoop(), []);

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
      {/* Fixed overlay header */}
      <div className="feedHeader">
        {firstName && <p className="feedHeaderTitle">For {firstName}</p>}
        <div className="feedSearchBar">
          <span>🔍</span>
          <input
            type="text"
            placeholder={`Search ${activeSkill} videos…`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="feedSearchClear" onClick={() => setSearchQuery("")}>✕</button>
          )}
        </div>
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
      <div className="tiktokFeed" ref={feedEl}>
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
                      className="tiktokSlideMedia"
                      src={soundUnlocked ? ytSrcSound(item.videoId) : ytSrc(item.videoId)}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                    <div
                      className="iframeClickBlocker"
                      onClick={() => {
                        const f = iframeRefs.current[item.videoId];
                        if (isPlayingRef.current) ytCmd(f, "pauseVideo");
                        else ytCmd(f, "playVideo");
                      }}
                    />
                  </>
                ) : (
                  <img src={item.thumbnail} className="tiktokSlideMedia" alt={item.title} />
                )
              ) : item.mediaType?.startsWith("video") ? (
                <video src={item.mediaUrl} className="tiktokSlideMedia" loop muted playsInline autoPlay />
              ) : (
                <img src={item.mediaUrl} className="tiktokSlideMedia" alt={item.caption} />
              )}

              {isYt && !isFailed && isActive && (
                <div
                  className="pausedPlayIndicator"
                  ref={el => { if (el) pauseIndRefs.current[item.videoId] = el; else delete pauseIndRefs.current[item.videoId]; }}
                  style={{ display: "none", pointerEvents: "none" }}
                >
                  ⏸
                </div>
              )}


              {isYt && !isFailed && isActive && (
                <div
                  className="ytProgressBar"
                  ref={progressBarRef}
                  onPointerDown={e => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    seekToPosition(e.clientX);
                  }}
                  onPointerMove={e => {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) seekToPosition(e.clientX);
                  }}
                >
                  <div className="ytProgressFill" ref={progressFillRef} />
                </div>
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

      {!soundUnlocked && feed[activeIndex]?._type === "youtube" && !failed.has(feed[activeIndex]?.videoId) && (
        <button
          className="tapForSoundBtn"
          onClick={() => flushSync(() => setSoundUnlocked(true))}
        >
          Tap for sound 🔊
        </button>
      )}

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
