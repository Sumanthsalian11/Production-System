import { useEffect, useState } from "react";
import Loader from "./Loader";

// The first overlay after a page load takes over from the static loader in
// index.html, so it must not fade in from opacity 0 (that caused the blink).
let firstShown = false;

export default function LoadingOverlay() {
  const [fade] = useState(() => firstShown);

  useEffect(() => {
    firstShown = true;
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgb(0, 65, 187)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        animation: fade ? "fadeInOverlay 0.25s ease" : "none"
      }}
    >
      <style>{`
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <Loader />
    </div>
  );
}