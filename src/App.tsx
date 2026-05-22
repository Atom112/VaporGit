import "./App.css";
import { onMount } from "solid-js";
import Navbar from "./components/Navbar";
import Titlebar from "./components/Titlebar";
import PageTransition from "./components/PageTransition";
import ToastContainer from "./components/ToastContainer";
import { githubCheckAuth } from "./lib/tauriCommands";
import { setAuthenticated } from "./stores/githubStore";

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
    </div>
  );
}
