import { useState } from "react";

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = window.navigator.standalone === true;

const STEPS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5"  cy="12" r="2"/>
        <circle cx="12" cy="12" r="2"/>
        <circle cx="19" cy="12" r="2"/>
      </svg>
    ),
    iconBg: "#e5e5ea",
    iconColor: "#3a3a3c",
    label: "Tap",
    chip: "···",
    chipStyle: "dots",
    detail: "next to the address bar",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <polyline points="16 6 12 2 8 6"/>
        <line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
    ),
    iconBg: "#007aff",
    iconColor: "#fff",
    label: "Tap",
    chip: "Share",
    chipStyle: "share",
    detail: "from the menu",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <line x1="12" y1="8"  x2="12" y2="16"/>
        <line x1="8"  y1="12" x2="16" y2="12"/>
      </svg>
    ),
    iconBg: "#e5e5ea",
    iconColor: "#3a3a3c",
    label: "Tap",
    chip: "Add to Home Screen",
    chipStyle: "add",
    detail: "",
  },
];

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

        <div className="iosPromptTop">
          <img src="/bibi.png" alt="habi" className="iosPromptAppIcon" />
          <div>
            <p className="iosPromptHeading">Add habi to your Home Screen</p>
            <p className="iosPromptSub">Needed for push notifications</p>
          </div>
        </div>

        <div className="iosPromptSteps">
          {STEPS.map((step, i) => (
            <div className="iosPromptStep" key={i}>
              <div
                className="iosPromptStepIcon"
                style={{ background: step.iconBg, color: step.iconColor }}
              >
                {step.icon}
              </div>
              <div className="iosPromptStepBody">
                <span className="iosPromptStepNum">{i + 1}</span>
                <span className="iosPromptStepLabel">{step.label}</span>
                <span className={`iosPromptChip iosPromptChip--${step.chipStyle}`}>
                  {step.chip}
                </span>
                {step.detail && (
                  <span className="iosPromptStepDetail">{step.detail}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className="iosPromptGotIt" onClick={dismiss}>Got it</button>
      </div>

      <div className="iosPromptArrowWrap" aria-hidden="true">↓</div>
    </div>
  );
}
