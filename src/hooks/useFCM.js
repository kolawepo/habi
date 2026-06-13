import { useEffect } from "react";
import { isSupported, getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { messaging, db } from "../firebase";

export function useFCM(currentUser, onTabSwitch) {
  useEffect(() => {
    if (!currentUser) return;

    let unsubscribe = () => {};

    (async () => {
      try {
        if (!(await isSupported())) return;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FCM_VAPID_KEY,
        });

        if (token) {
          await updateDoc(doc(db, "users", currentUser.uid), { fcmToken: token });
        }

        // Foreground messages: show a native notification
        unsubscribe = onMessage(messaging, (payload) => {
          const title = payload.notification?.title || "Habi";
          const body  = payload.notification?.body  || "";
          const link  = payload.data?.link || "/";

          if (Notification.permission === "granted") {
            const n = new Notification(title, { body, icon: "/bibi.png" });
            n.onclick = () => {
              window.focus();
              onTabSwitch?.(link);
              n.close();
            };
          }
        });
      } catch (err) {
        // Non-fatal: FCM unavailable in this environment
        console.warn("FCM init skipped:", err.message);
      }
    })();

    // Handle tab-switch messages posted by the service worker on notification click
    function onSWMessage(event) {
      if (event.data?.type === "NOTIFICATION_TAB") {
        onTabSwitch?.(event.data.link);
      }
    }
    navigator.serviceWorker?.addEventListener("message", onSWMessage);

    return () => {
      unsubscribe();
      navigator.serviceWorker?.removeEventListener("message", onSWMessage);
    };
  }, [currentUser]); // eslint-disable-line
}
