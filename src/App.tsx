import "./App.css";
import { For } from "solid-js";
import { useLocation } from "@solidjs/router";
import Navbar from "./components/Navbar";
import Titlebar from "./components/Titlebar";

export default function App(props: { children?: any }) {
  const location = useLocation();

  return (
    <div class="h-screen w-screen flex flex-col bg-white/10 backdrop-blur-2xl text-white/90 overflow-hidden">
      <Titlebar />
      <Navbar />
      <For each={[location.pathname]}>
        {() => (
          <div class="flex-1 overflow-auto bg-black/5 animate-route-enter">
            {props.children}
          </div>
        )}
      </For>
    </div>
  );
}
