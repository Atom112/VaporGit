import { useLocation } from '@solidjs/router';
import { createMemo } from 'solid-js';

export default function PageTransition(props: { children: any }) {
  const location = useLocation();
  let prevPath = location.pathname;
  let counter = 0;

  // Recomputes synchronously during render when location.pathname changes
  const animTick = createMemo(() => {
    const path = location.pathname;
    if (path !== prevPath) {
      prevPath = path;
      counter++;
    }
    return counter;
  });

  // Alternates between pageEnter_0 / pageEnter_1 on each route change,
  // forcing the browser to restart the CSS animation on the same element.
  const animStyle = () => ({
    animation: `pageEnter_${animTick() % 2} 0.35s ease-out forwards`,
  });

  return (
    <div class="h-full" style={animStyle()}>
      {props.children}
    </div>
  );
}
