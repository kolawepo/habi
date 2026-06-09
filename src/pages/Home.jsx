import { useEffect, useState, useRef } from "react";
import { skillEmoji } from "../utils/emojis";
import ShareModal from "../components/ShareModal";

// ── YouTube helpers ────────────────────────────────────────────────────────────

// mute=1 so the player can autoplay before the user has gestured
function ytSrc(videoId) {
  return (
    `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&modestbranding=1` +
    `&playsinline=1&rel=0&loop=1&playlist=${videoId}&enablejsapi=1`
  );
}

function ytSrcSound(videoId) {
  return (
    `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1` +
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

// ── Position persistence ───────────────────────────────────────────────────────

const LS_SKILL_KEY = "habi_lastSkill";
const lsIdxKey = s => `habi_idx_${s}`;

function readSavedIdx(skill) {
  const v = parseInt(localStorage.getItem(lsIdxKey(skill)), 10);
  return isNaN(v) ? null : v;
}
function writeSavedIdx(skill, idx) {
  try { localStorage.setItem(lsIdxKey(skill), String(idx)); } catch {}
}
function pickStartIdx(skill, feedLen) {
  if (!feedLen) return 0;
  const saved = readSavedIdx(skill);
  if (saved !== null && saved < feedLen) return saved;
  return feedLen > 1 ? Math.floor(Math.random() * feedLen) : 0;
}


// ── Component ──────────────────────────────────────────────────────────────────

export default function Home({
  firstName, skills, allPosts,
  likedVideos, setLikedVideos, savedVideos, setSavedVideos,
  friends, onShareToFriend, addMoreSkills, removeSkill,
}) {
  const [activeSkill, setActiveSkill] = useState(() => {
    try { return localStorage.getItem(LS_SKILL_KEY) || (skills[0] || ""); }
    catch { return skills[0] || ""; }
  });
  const [ytBySkill,   setYtBySkill]   = useState({});
  const [loading,     setLoading]     = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failed,      setFailed]      = useState(new Set());
  const [shareTarget, setShareTarget] = useState(null);

  const [muted,           setMuted]           = useState(false);
  const [searchQuery,     setSearchQuery]     = useState("");
  const [showSkillsSheet, setShowSkillsSheet] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [vidDuration,   setVidDuration]   = useState(0);
  const [vidCurrentTime,setVidCurrentTime]= useState(0);

  const feedEl           = useRef(null);
  const slideRefs        = useRef([]);
  const iframeRefs       = useRef({});
  const readySet         = useRef(new Set());
  const obsRef           = useRef(null);
  const memCache         = useRef({});
  const feedRef          = useRef([]);
  const isDraggingRef          = useRef(false);
  const isPausedRef            = useRef(false);
  const pendingSkillRestoreRef = useRef(false);

  const activeIdxRef = useRef(0); activeIdxRef.current = activeIndex;
  const mutedRef     = useRef(muted); mutedRef.current   = muted;

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

  async function fetchSearchQuery(queryString, cx) {
    if (!YT_KEY) return [];
    const q = encodeURIComponent(queryString);
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
      try { data = await fetch(url).then(r => r.json()); } catch { break; }
      if (data.error || cx.current) break;
      pageToken = data.nextPageToken || null;

      const batch = (data.items || [])
        .filter(i => i.id?.videoId && !seen.has(i.id.videoId))
        .map(i => { seen.add(i.id.videoId); return {
          videoId: i.id.videoId, title: i.snippet.title,
          creator: i.snippet.channelTitle, skill: activeSkill,
          thumbnail: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url,
          _type: "youtube",
        }; });
      fetched += batch.length;
      if (!batch.length) break;
      if (cx.current) return null;
      confirmed.push(...batch);
      if (!pageToken) break;
    }
    if (cx.current) return null;
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
    if (skills.length && !skills.includes(activeSkill)) {
      const saved = localStorage.getItem(LS_SKILL_KEY);
      setActiveSkill((saved && skills.includes(saved)) ? saved : skills[0]);
    }
  }, [skills]); // eslint-disable-line

  // Search: fetch YouTube results for the typed query (debounced 500 ms)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) { setSearchResults([]); setSearchLoading(false); return; }

    const cx = { current: false };
    setSearchLoading(true);
    setSearchResults([]);

    const timer = setTimeout(() => {
      fetchSearchQuery(`${activeSkill} ${trimmed}`, cx)
        .then(v => { if (!cx.current) setSearchResults(v || []); })
        .catch(() => {})
        .finally(() => { if (!cx.current) setSearchLoading(false); });
    }, 500);

    return () => { cx.current = true; clearTimeout(timer); };
  }, [searchQuery, activeSkill]); // eslint-disable-line

  // ── Feed ──────────────────────────────────────────────────────────────────

  const rawFeed = [
    ...allPosts
      .filter(p => p.postType === "tutorial" && p.skill === activeSkill)
      .slice(0, 20)
      .map(p => ({ ...p, _type: "post" })),
    ...(ytBySkill[activeSkill] || []).map(v => ({ ...v, _type: "youtube" })),
  ];
  const trimmedSearch = searchQuery.trim();
  const feed = trimmedSearch ? searchResults : rawFeed;
  feedRef.current = feed;

  // ── Save active skill ────────────────────────────────────────────────────

  useEffect(() => {
    if (activeSkill) try { localStorage.setItem(LS_SKILL_KEY, activeSkill); } catch {}
  }, [activeSkill]);

  // ── Skill change: restore saved position or pick random ──────────────────

  useEffect(() => {
    const feedLen = feedRef.current.length;
    if (feedLen > 0) {
      const idx = pickStartIdx(activeSkill, feedLen);
      setActiveIndex(idx);
      feedEl.current?.scrollTo({ top: idx * (feedEl.current?.clientHeight || innerHeight), behavior: "instant" });
      pendingSkillRestoreRef.current = false;
    } else {
      // Feed not cached yet — mark to restore once it loads
      setActiveIndex(0);
      feedEl.current?.scrollTo({ top: 0, behavior: "instant" });
      pendingSkillRestoreRef.current = true;
    }
  }, [activeSkill]); // eslint-disable-line

  // ── Feed loaded async: apply deferred restore ────────────────────────────

  useEffect(() => {
    if (!pendingSkillRestoreRef.current) return;
    const feedLen = feedRef.current.length;
    if (!feedLen) return;
    const idx = pickStartIdx(activeSkill, feedLen);
    setActiveIndex(idx);
    feedEl.current?.scrollTo({ top: idx * (feedEl.current?.clientHeight || innerHeight), behavior: "instant" });
    pendingSkillRestoreRef.current = false;
  }, [ytBySkill]); // eslint-disable-line

  // ── Search change: scroll to top when entering; restore when clearing ────

  useEffect(() => {
    if (searchQuery.trim()) {
      setActiveIndex(0);
      feedEl.current?.scrollTo({ top: 0, behavior: "instant" });
    } else {
      const feedLen = feedRef.current.length;
      const idx = pickStartIdx(activeSkill, feedLen);
      setActiveIndex(idx);
      feedEl.current?.scrollTo({ top: idx * (feedEl.current?.clientHeight || innerHeight), behavior: "instant" });
    }
  }, [searchQuery]); // eslint-disable-line

  // ── Save video index per skill (not during search) ───────────────────────

  useEffect(() => {
    if (!activeSkill || searchQuery.trim() || !feedRef.current.length) return;
    writeSavedIdx(activeSkill, activeIndex);
  }, [activeIndex]); // eslint-disable-line

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
    setVidCurrentTime(0);
    setVidDuration(0);
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

      if (d.event === "onStateChange") {
        if (d.info === 1) isPausedRef.current = false; // playing
        if (d.info === 2) isPausedRef.current = true;  // paused
      }

      if (d.event === "infoDelivery" && d.info) {
        if (d.info.duration)              setVidDuration(d.info.duration);
        if (d.info.currentTime != null && !isDraggingRef.current)
          setVidCurrentTime(d.info.currentTime);
      }

    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // ── Play/pause toggle (desktop click overlay) ─────────────────────────────

  function togglePlayPause(videoId) {
    const f = iframeRefs.current[videoId];
    if (isPausedRef.current) {
      ytCmd(f, "playVideo");
      isPausedRef.current = false;
    } else {
      ytCmd(f, "pauseVideo");
      isPausedRef.current = true;
    }
  }

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

  const emptyMsg = !skills.length
    ? "Add skills to see videos"
    : searchLoading
      ? "Searching…"
      : trimmedSearch
        ? `No results for "${trimmedSearch}"`
        : loading
          ? "Loading…"
          : `No ${activeSkill} videos yet.`;

  return (
    <>
      {/* Fixed overlay header — always rendered so search bar stays visible */}
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
          {(addMoreSkills || removeSkill) && (
            <button className="editSkillsBtn" onClick={() => setShowSkillsSheet(true)}>⚙ Skills</button>
          )}
        </div>
      </div>

      {feed.length === 0 ? (
        <div className="feedEmptyState">{emptyMsg}</div>
      ) : (
      /* Full-screen snap feed */
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
                      src={ytSrcSound(item.videoId)}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                    {!isMobile && (
                      <div
                        style={{ position: "absolute", inset: 0, zIndex: 1, cursor: "pointer" }}
                        onClick={() => togglePlayPause(item.videoId)}
                      />
                    )}
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
                <input
                  type="range"
                  className="ytSeekBar"
                  min={0}
                  max={vidDuration || 100}
                  step={0.1}
                  value={vidCurrentTime}
                  onChange={e => {
                    const t = parseFloat(e.target.value);
                    setVidCurrentTime(t);
                    ytCmd(iframeRefs.current[item.videoId], "seekTo", [t, true]);
                  }}
                  onPointerDown={() => { isDraggingRef.current = true; }}
                  onPointerUp={()   => { isDraggingRef.current = false; }}
                />
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
      )}

      {shareTarget && (
        <ShareModal
          friends={friends}
          videoTitle={shareTarget.title}
          onSend={uid => onShareToFriend(uid, shareTarget)}
          onClose={() => setShareTarget(null)}
        />
      )}

      {showSkillsSheet && (
        <>
          <div className="skillsSheetOverlay" onClick={() => setShowSkillsSheet(false)} />
          <div className="skillsSheet">
            <div className="skillsSheetHandle" />
            <p className="skillsSheetTitle">My Skills</p>
            <ul className="skillsSheetList">
              {skills.map(s => (
                <li key={s} className="skillsSheetItem">
                  <span>{skillEmoji(s)} {s}</span>
                  {skills.length > 1 && removeSkill && (
                    <button
                      className="skillsSheetRemoveBtn"
                      onClick={() => { removeSkill(s); if (skills.length <= 2) setShowSkillsSheet(false); }}
                    >✕</button>
                  )}
                </li>
              ))}
            </ul>
            {addMoreSkills && (
              <button
                className="skillsSheetAddBtn"
                onClick={() => { setShowSkillsSheet(false); addMoreSkills(); }}
              >+ Add New Skill</button>
            )}
          </div>
        </>
      )}
    </>
  );
}
