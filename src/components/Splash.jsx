import BibiRunGame from "./BibiRunGame";
export default function Splash({ onNext, onLogin }) {
  return (
    <section className="screen splash">
      <div className="brandBlock">
        <h1>Habi</h1>
        <p>LEARN • GROW • SHARE</p>
      </div>

      <div className="splashHero">
        <BibiRunGame />
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