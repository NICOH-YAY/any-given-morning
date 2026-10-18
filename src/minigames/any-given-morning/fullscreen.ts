/** Fullscreen refusal falls back to a fixed panel within the current browser tab. */
export function bindFullscreen(root: HTMLElement, canvas: HTMLCanvasElement): { toggle(): Promise<void>; resize(): void; dispose(): void } {
  let disposed = false;
  const resize = () => {
    const full = document.fullscreenElement === root || root.classList.contains("agm-full-window");
    const width = full ? window.innerWidth : root.clientWidth || 320;
    const height = full ? Math.max(100, window.innerHeight - (root.scrollHeight - (canvas.parentElement?.clientHeight || 0))) : Infinity;
    const available = Math.min(width, height * 320 / 192);
    const scale = Math.floor(available / 320);
    const cssWidth = scale >= 1 ? scale * 320 : Math.max(100, available);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.maxWidth = "100%";
  };
  const change = () => { if (!disposed) resize(); };
  window.addEventListener("resize", change); document.addEventListener("fullscreenchange", change);
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(change);
  observer?.observe(root);
  return {
    resize,
    async toggle() {
      if (disposed) return;
      if (document.fullscreenElement === root) {
        try { await document.exitFullscreen(); } catch { /* Browser owns this state. */ }
      } else if (root.classList.contains("agm-full-window")) root.classList.remove("agm-full-window");
      else {
        try {
          if (!root.requestFullscreen) throw new Error("Fullscreen unavailable");
          await root.requestFullscreen();
        } catch { if (!disposed) root.classList.add("agm-full-window"); }
      }
      if (!disposed) { resize(); root.focus({ preventScroll: true }); }
    },
    dispose() {
      disposed = true; observer?.disconnect();
      window.removeEventListener("resize", change); document.removeEventListener("fullscreenchange", change);
      root.classList.remove("agm-full-window");
      if (document.fullscreenElement === root) void document.exitFullscreen().catch(() => {});
    },
  };
}
