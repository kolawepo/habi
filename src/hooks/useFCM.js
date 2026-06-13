import { useEffect } from "react";
import { isSupported, getToken, getMessaging, onMessage } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import app, { db } from "../firebase";

export function useFCM(currentUser, onTabSwitch) {
  useEffect(() => {
    console.log("[FCM] hook fired — currentUser:", currentUser?.uid ?? "null");
    if (!currentUser) return;

    let unsubscribe = () => {};

    (async () => {
      try {
        const supported = await isSupported();
        console.log("[FCM] isSupported:", supported);
        if (!supported) return;

        console.log("[FCM] requesting notification permission…");
        const permission = await Notification.requestPermission();
        console.log("[FCM] permission result:", permission);
        if (permission !== "granted") return;

        const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY;
        console.log("[FCM] VAPID key present:", !!vapidKey);

        const m = getMessaging(app);
        console.log("[FCM] messaging instance:", !!m);

        const token = await getToken(m, { vapidKey });
        console.log("[FCM] token obtained:", !!token);

        if (token) {
          await updateDoc(doc(db, "users", currentUser.uid), { fcmToken: token });
          console.log("[FCM] token saved to Firestore");
        }

        // Foreground messages: show a native notification.
        // We use data-only payloads so read from payload.data, not payload.notification.
        unsubscribe = onMessage(m, (payload) => {
          const title = payload.data?.title || "Habi";
          const body  = payload.data?.body  || "";
          const link  = payload.data?.link  || "/";

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
        console.error("[FCM] init error:", err.code ?? "", err.message, err);
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
