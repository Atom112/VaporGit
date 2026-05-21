import "./App.css";
import Navbar from "./components/Navbar";
import Titlebar from "./components/Titlebar";
import PageTransition from "./components/PageTransition";

export default function App(props: { children?: any }) {
  return (
    <div class="h-screen w-screen flex flex-col bg-white/10 backdrop-blur-2xl text-white/90 overflow-hidden">
      <Titlebar />
      <Navbar />
      <div class="flex-1 overflow-auto bg-black/5" style="scrollbar-gutter: stable">
        <PageTransition>
          {props.children}
        </PageTransition>
      </div>
    </div>
  );
}
