export default function Page({ title, children }) {
  return (
    <div className="page">
      <h1 className="pageTitle">{title}</h1>
      {children}
    </div>
  );
}