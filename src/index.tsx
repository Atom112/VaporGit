/* @refresh reload */
import "./App.css"; // ensure css is imported
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import App from "./App";
import Home from "./routes/Home";
import Repository from "./routes/Repository";
import Settings from "./routes/Settings";

render(() => (
  <Router root={App}>
    <Route path="/" component={Home} />
    <Route path="/repository" component={Repository} />
    <Route path="/settings" component={Settings} />
  </Router>
), document.getElementById("root") as HTMLElement);
