import { useState } from "react";

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = window.navigator.standalone === true;

export default function IOSInstallPrompt() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("habi_ios_prompt_dismissed") === "1"
  );

  if (!isIOS || isStandalone || dismissed) return null;

  function dismiss() {
    localStorage.setItem("habi_ios_prompt_dismissed", "1");
    setDismissed(true);
  }

  return (
    <div className="iosPromptOverlay" onClick={dismiss}>
      <div className="iosPromptCard" onClick={(e) => e.stopPropagation()}>
        {/* App icon + heading */}
        <div className="iosPromptTop">
          <img src="/bibi.png" alt="habi" className="iosPromptAppIcon" />
          <div>
            <p className="iosPromptHeading">Add habi to your Home Screen</p>
            <p className="iosPromptSub">Required for push notifications</p>
          </div>
        </div>

        {/* Steps */}
        <div className="iosPromptSteps">
          <div className="iosPromptStep">
            <div className="iosPromptStepNum">1</div>
            <div className="iosPromptStepBody">
              <p className="iosPromptStepLabel">Tap the Share button</p>
              <div className="iosShareChip">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" transform="rotate(-90 12 12)"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                  <rect x="3" y="14" width="18" height="8" rx="2"/>
                </svg>
                <span>Share</span>
              </div>
            </div>
          </div>

          <div className="iosPromptStep">
            <div className="iosPromptStepNum">2</div>
            <div className="iosPromptStepBody">
              <p className="iosPromptStepLabel">Select</p>
              <div className="iosAddChip">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span>Add to Home Screen</span>
              </div>
            </div>
          </div>
        </div>

        <button className="iosPromptGotIt" onClick={dismiss}>Got it</button>
      </div>

      {/* Animated arrow pointing at Safari share button */}
      <div className="iosPromptArrowWrap">
        <div className="iosPromptArrow">↓</div>
      </div>
    </div>
  );
}
