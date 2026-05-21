import "./App.css";
import { onMount } from "solid-js";
import Navbar from "./components/Navbar";
import Titlebar from "./components/Titlebar";
import PageTransition from "./components/PageTransition";
import ToastContainer from "./components/ToastContainer";

export default function App(props: { children?: any }) {
  onMount(() => {
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
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
