export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const el = Object.assign(document.createElement("textarea"), {
      value: text,
      style: "position:fixed;top:-9999px;left:-9999px;opacity:0",
    });
    document.body.appendChild(el);
    el.focus(); el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

export async function shareLink({ title, text, url }, setToast) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
    } else {
      await copyText(text);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    try {
      await copyText(text);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    } catch {
      // clipboard unavailable and share was already rejected — nothing more we can do
    }
  }
}
