import TopBar from "./TopBar";

export default function Onboarding({
  step,
  bibi,
  title,
  children,
  onBack,
  onNext,
  canContinue,
}) {
  return (
    <section className="screen onboarding">
      <TopBar step={step} onBack={onBack} />

      <div className="mascotWrap">
        <img src={bibi} alt="Bibi" className="onboardingBibi" />
      </div>

      <div className="card questionCard">
        <h1>{title}</h1>

        <div className="questionContent">{children}</div>
      </div>

      <div className="bottomAction">
        <button
          className="primaryButton"
          disabled={!canContinue}
          onClick={onNext}
        >
          Continue
        </button>
      </div>
    </section>
  );
}