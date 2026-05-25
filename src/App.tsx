import "./App.css";
import { onMount, createEffect, createSignal } from "solid-js";
import Navbar from "./components/layout/Navbar";
import Titlebar from "./components/layout/Titlebar";
import PageTransition from "./components/layout/PageTransition";
import ToastContainer from "./components/ui/ToastContainer";
import UpdateNotification from "./components/ui/UpdateNotification";
import { githubCheckAuth, checkUpdate } from "./lib/tauriCommands";
import { setAuthenticated } from "./stores/githubStore";
import { showUpdate } from "./stores/updateStore";
import { settingsStore } from "./stores/settingsStore";

export default function App(props: { children?: any }) {
  const [systemDark, setSystemDark] = createSignal(
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  onMount(() => {
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  });

  onMount(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

  createEffect(() => {
    const setting = settingsStore.theme;
    const effective = setting === "system"
      ? (systemDark() ? "dark" : "light")
      : setting;
    document.documentElement.setAttribute("data-theme", effective);
  });

  onMount(async () => {
    try {
      const status = await githubCheckAuth();
      if (status.authenticated && status.user) {
        setAuthenticated(status.user);
      }
    } catch {
      // No stored session — not authenticated, that's fine
    }
  });

  onMount(async () => {
    try {
      const update = await checkUpdate();
      if (update) {
        showUpdate(update);
      }
    } catch {
      // Silently ignore (offline, rate-limited, etc.)
    }
  });

  return (
    <div class="h-screen w-screen flex flex-col bg-white/10 backdrop-blur-2xl text-white/90 overflow-hidden">
      <Titlebar />
      <Navbar />
      <div class="flex-1 overflow-hidden">
        <PageTransition>
          {props.children}
        </PageTransition>
      </div>
      <ToastContainer />
      <UpdateNotification />
    </div>
  );
}
