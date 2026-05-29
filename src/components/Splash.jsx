import { BIBI } from "../data/appData";
export default function Splash({ onNext, onLogin }) {
  return (
    <section className="screen splash">
      <div className="brandBlock">
        <h1>Habi</h1>
        <p>LEARN • GROW • SHARE</p>
      </div>

      <div className="splashHero">
        <img src={BIBI.happy} alt="Bibi" className="splashBibi" />

        <div className="speechBubble">
          <div className="bubbleTail" />
          <h2>Hi! I’m Bibi</h2>
          <p>Let’s build your next skill together.</p>
        </div>
      </div>

      <div className="splashActions">
        <button className="primaryButton" onClick={onNext}>
          Let’s Start
        </button>

        <button className="loginLink" onClick={onLogin}>
          Already have an account? <span>Log in</span>
        </button>
      </div>
    </section>
  );
}