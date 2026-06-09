import { useEffect, useState, useRef } from "react";
import { skillEmoji } from "../utils/emojis";
import ShareModal from "../components/ShareModal";

// ── YouTube helpers ────────────────────────────────────────────────────────────

function ytSrc(videoId) {
  return (
    `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&modestbranding=1` +
    `&playsinline=1&rel=0&loop=1&playlist=${videoId}&enablejsapi=1`
  );
}

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
  friends, onShareToFriend, addMoreSkills, removeSkill,
}) {
  const [activeSkill,     setActiveSkill]     = useState(skills[0] || "");
  const [ytBySkill,       setYtBySkill]       = useState({});
  const [loading,         setLoading]         = useState(false);
  const [activeIndex,     setActiveIndex]     = useState(0);
  const [failed,          setFailed]          = useState(new Set());
  const [shareTarget,     setShareTarget]     = useState(null);
  const [showSkillsSheet, setShowSkillsSheet] = useState(false);

  const [muted, setMuted] = useState(false);

  const feedEl           = useRef(null);
  const slideRefs        = useRef([]);
  const iframeRefs       = useRef({});
  const readySet         = useRef(new Set());
  const thumbOverlayRefs = useRef({});
  const obsRef           = useRef(null);
  const memCache         = useRef({});
  const feedRef          = useRef([]);
  const pauseIndRefs     = useRef({});  // videoId → DOM element for pause indicator

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

  // ── First gesture → play active video (handles browsers that block unmuted autoplay) ──
  // Only mark as fired once a video iframe is actually found and commanded.
  // This prevents the skills sheet or early taps from consuming the gesture
  // before the iframe is mounted and ready.

  useEffect(() => {
    let fired = false;
    function onGesture() {
      if (fired) return;
      const item = feedRef.current[activeIdxRef.current];
      if (!item || item._type !== "youtube") return;
      const f = iframeRefs.current[item.videoId];
      if (!f) return;
      fired = true;
      if (!mutedRef.current) { ytCmd(f, "unMute"); ytCmd(f, "setVolume", [100]); }
      ytCmd(f, "playVideo");
    }
    document.addEventListener("touchstart", onGesture, { passive: true, capture: true });
    document.addEventListener("click", onGesture, { capture: true });
    return () => {
      document.removeEventListener("touchstart", onGesture, { capture: true });
      document.removeEventListener("click", onGesture, { capture: true });
    };
  }, []); // eslint-disable-line

  // ── When active index changes, play it if the iframe is already ready ─────
  // (usually onReady fires after mount and handles it; this covers fast swipes
  //  where the iframe was pre-mounted from a previous render cycle)

  useEffect(() => {
    const item = feedRef.current[activeIndex];
    if (!item || item._type !== "youtube") return;
    const f = iframeRefs.current[item.videoId];
    if (f && readySet.current.has(item.videoId)) {
      if (mutedRef.current) ytCmd(f, "mute");
      else { ytCmd(f, "unMute"); ytCmd(f, "setVolume", [100]); }
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
        if (thumbOverlayRefs.current[vid]) thumbOverlayRefs.current[vid].style.opacity = '0';
        const active = feedRef.current[activeIdxRef.current];
        if (active?._type === "youtube" && active.videoId === vid) {
          if (mutedRef.current) ytCmd(iframeRefs.current[vid], "mute");
          else { ytCmd(iframeRefs.current[vid], "unMute"); ytCmd(iframeRefs.current[vid], "setVolume", [100]); }
          ytCmd(iframeRefs.current[vid], "playVideo");
        } else {
          ytCmd(iframeRefs.current[vid], "pauseVideo");
        }
      }

      if (d.event === "onStateChange") {
        const ind = pauseIndRefs.current[vid];
        if (d.info === 1 && ind) ind.style.display = "none";       // playing
        else if (d.info === 2 && ind) ind.style.display = "flex";  // paused
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
            <button className="editSkillsBtn" onClick={() => setShowSkillsSheet(true)}>⚙ Skills</button>
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
                        else {
                          delete iframeRefs.current[item.videoId];
                          readySet.current.delete(item.videoId);
                          delete thumbOverlayRefs.current[item.videoId];
                        }
                      }}
                      className="tiktokSlideMedia"
                      src={ytSrc(item.videoId)}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                    <div
                      ref={el => {
                        if (el) thumbOverlayRefs.current[item.videoId] = el;
                        else delete thumbOverlayRefs.current[item.videoId];
                      }}
                      className="ytThumbOverlay"
                      style={{ backgroundImage: `url(https://img.youtube.com/vi/${item.videoId}/maxresdefault.jpg)` }}
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

      {showSkillsSheet && (
        <div className="skillsSheetOverlay" onClick={() => setShowSkillsSheet(false)}>
          <div className="skillsSheet" onClick={e => e.stopPropagation()}>
            <div className="skillsSheetHeader">
              <h2>Your Skills</h2>
              <button className="skillsSheetClose" onClick={() => setShowSkillsSheet(false)}>✕</button>
            </div>

            {skills.length === 0 ? (
              <p className="skillsSheetEmpty">No skills yet — add some below.</p>
            ) : (
              <div className="skillsSheetList">
                {skills.map(s => (
                  <div key={s} className="skillsSheetItem">
                    <span>{skillEmoji(s)} {s}</span>
                    <button
                      className="skillsSheetRemove"
                      onClick={() => {
                        removeSkill(s);
                        if (activeSkill === s) setActiveSkill(skills.find(x => x !== s) || "");
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            <button
              className="skillsSheetAdd"
              onClick={() => { setShowSkillsSheet(false); addMoreSkills(); }}
            >
              + Add New Skill
            </button>
          </div>
        </div>
      )}
    </>
  );
}
