/** Keep native touch scrolling/inertia; constrain only the secondary axis.
 * No preventDefault, pointer capture, React state, or layout reads on scroll.
 * CSS alone permits diagonal panning in Chromium and WebKit.
 */
export function attachCalendarAxisLock(region: HTMLElement) {
  let gesture: { x: number; y: number; left: number; top: number; axis: "x" | "y" | null } | null = null;
  let touching = false;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const reset = () => { gesture = null; if (idle) clearTimeout(idle); };
  const start = (event: TouchEvent) => {
    reset();
    touching = event.touches.length === 1;
    if (touching) gesture = { x: event.touches[0].clientX, y: event.touches[0].clientY,
      left: region.scrollLeft, top: region.scrollTop, axis: null };
  };
  const constrain = () => {
    if (!gesture?.axis) return;
    if (gesture.axis === "x" && region.scrollTop !== gesture.top) region.scrollTop = gesture.top;
    if (gesture.axis === "y" && region.scrollLeft !== gesture.left) region.scrollLeft = gesture.left;
  };
  const move = (event: TouchEvent) => {
    if (event.touches.length !== 1) { touching = false; reset(); return; }
    if (!gesture || gesture.axis) return;
    const dx = Math.abs(event.touches[0].clientX - gesture.x);
    const dy = Math.abs(event.touches[0].clientY - gesture.y);
    if (Math.max(dx, dy) < 8) return;
    gesture.axis = dx > dy ? "x" : "y";
    constrain();
  };
  const scroll = () => {
    constrain();
    if (!touching && gesture) {
      if (idle) clearTimeout(idle);
      idle = setTimeout(reset, 180);
    }
  };
  const end = () => { touching = false; if (idle) clearTimeout(idle); idle = setTimeout(reset, 180); };
  const scrollEnd = () => { if (!touching) reset(); };
  region.addEventListener("touchstart", start, { passive: true });
  region.addEventListener("touchmove", move, { passive: true });
  region.addEventListener("touchend", end, { passive: true });
  region.addEventListener("touchcancel", end, { passive: true });
  region.addEventListener("scroll", scroll, { passive: true });
  region.addEventListener("scrollend", scrollEnd, { passive: true });
  // Wheel/keyboard/programmatic navigation starts its own interaction.
  region.addEventListener("wheel", reset, { passive: true });
  region.addEventListener("keydown", reset);
  return () => {
    reset();
    region.removeEventListener("touchstart", start); region.removeEventListener("touchmove", move);
    region.removeEventListener("touchend", end); region.removeEventListener("touchcancel", end);
    region.removeEventListener("scroll", scroll); region.removeEventListener("scrollend", scrollEnd);
    region.removeEventListener("wheel", reset); region.removeEventListener("keydown", reset);
  };
}
