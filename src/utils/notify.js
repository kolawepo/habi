// Send a push notification to a Habi user via the Vercel API route.
// Failures are silently swallowed — notifications are always best-effort.
export async function sendPushNotification(recipientUid, title, body, link = "/") {
  try {
    await fetch("/api/sendNotification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientUid, title, body, link }),
    });
  } catch (err) {
    console.warn("Push notification failed:", err.message);
  }
}
