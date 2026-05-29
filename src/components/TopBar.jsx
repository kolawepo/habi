export default function TopBar({ step, onBack }) {
  return (
    <div className="topBar">
      <button onClick={onBack}>←</button>
      <span>{step}</span>
    </div>
  );
}