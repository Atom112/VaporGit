import "./App.css";
import { onMount } from "solid-js";
import Navbar from "./components/Navbar";
import Titlebar from "./components/Titlebar";
import PageTransition from "./components/PageTransition";
import ToastContainer from "./components/ToastContainer";
import UpdateNotification from "./components/UpdateNotification";
import { githubCheckAuth, checkUpdate } from "./lib/tauriCommands";
import { setAuthenticated } from "./stores/githubStore";
import { showUpdate } from "./stores/updateStore";

export default function App(props: { children?: any }) {
  onMount(() => {
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
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
        showUpdate(update.tagName, update.htmlUrl);
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
