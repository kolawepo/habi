import { useState } from "react";

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = window.navigator.standalone === true;

export default function IOSInstallPrompt() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("habi_ios_prompt_dismissed") === "1"
  );

  if (!isIOS || isStandalone || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem("habi_ios_prompt_dismissed", "1");
    setDismissed(true);
  }

  return (
    <div className="iosPromptBanner">
      <button className="iosPromptClose" onClick={dismiss} aria-label="Dismiss">✕</button>
      <p className="iosPromptText">
        To get push notifications, tap{" "}
        <span className="iosPromptIcon">
          {/* iOS Share icon */}
          <svg width="16" height="16" viewBox="0 0 50 50" fill="currentColor">
            <path d="M30.3 8.5 25 3.2l-5.3 5.3-1.4-1.4L25 .4l6.7 6.7z"/>
            <path d="M24 2h2v27h-2z"/>
            <path d="M9 19h32v29H9zm2 2v25h28V21z"/>
          </svg>
        </span>{" "}
        then <strong>Add to Home Screen</strong>.
      </p>
    </div>
  );
}
