import { useEffect } from "react";
import { PlayerPage } from "./Player";
import "./youtubeAutoplayGuard";

// Keep the player visually identical without loading the administrative React
// pages. CSS is cheap to parse compared with the full application JS graph and
// this preserves all existing player selectors while the dedicated TV host gets
// a much smaller JavaScript bootstrap.
import "../styles.css";
import "../styles-v2.css";
import "../system.css";
import "../panels.css";
import "../branding.css";
import "../refinements.css";
import "../brand-mobile-fixes.css";
import "../playlist-builder.css";
import "../screen-experience.css";
import "../messages-experience.css";
import "../account-experience.css";
import "../pontoview-clean-preview.css";
import "../pontoview-ux-polish.css";
import "../mobile-account-nav.css";
import "../mobile-dock-safety.css";

export default function PlayerRoot() {
  useEffect(() => {
    // These controllers are enhancements, not boot requirements. Loading them
    // after React commits the player prevents DOM observers from competing with
    // the initial render on memory-constrained Android TV devices.
    const frame = window.requestAnimationFrame(() => {
      void Promise.all([
        import("./rotationController"),
        import("./orientationController"),
        import("./internalPanelSizing"),
      ]).catch(() => {
        // The base player remains usable even if an enhancement fails to load.
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <PlayerPage />;
}
