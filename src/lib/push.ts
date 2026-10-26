import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID as string | undefined;
const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY as string | undefined;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY as string | undefined,
  projectId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID as string | undefined,
  appId,
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export type PushResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" };

/** Panggil dari klik tombol: browser mengabaikan permintaan izin tanpa interaksi pengguna. */
export async function enablePush(): Promise<PushResult> {
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId ||
    !appId ||
    !vapidKey ||
    !firebaseConfig.messagingSenderId
  ) {
    return { status: "not-configured" };
  }
  if (typeof window === "undefined" || !("Notification" in window) || !(await isSupported())) {
    return { status: "unsupported" };
  }
  if (window.top !== window.self) {
    return { status: "open-in-new-tab" };
  }

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const query = new URLSearchParams(firebaseConfig as Record<string, string>).toString();
  const swReg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`);
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig as any);
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
  return token ? { status: "registered", token } : { status: "denied" };
}

/** Notifikasi saat aplikasi sedang dibuka (foreground). */
export async function listenForeground(cb: (title: string, body: string) => void) {
  if (typeof window === "undefined" || !(await isSupported())) return;
  if (!firebaseConfig.apiKey || !firebaseConfig.messagingSenderId) return;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig as any);
  onMessage(getMessaging(app), (payload) => {
    cb(payload.notification?.title ?? "SIAP PKL", payload.notification?.body ?? "");
  });
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}
