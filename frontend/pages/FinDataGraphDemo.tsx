import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FinDataGraphApp from "../findatagraph/App";
import {
  FINDATAGRAPH_AUTH_MODE,
  FINDATAGRAPH_DEMO_ROUTE,
  FINDATAGRAPH_LIVE_STUDIO_URL,
  FINDATAGRAPH_PUBLIC_DEMO_HREF,
  probeFinDataGraphHealth,
} from "../data/findatagraphDemo";

type Mode = "checking" | "live" | "embedded";

/**
 * Portfolio demo shell for FinDataGraph.
 * Prefer the live agent host Spec Studio (`/studio`) when healthy; otherwise
 * fall back to the Pages-native embedded control plane so the demo never
 * shows a hard offline dead-end.
 */
export default function FinDataGraphDemo() {
  const [mode, setMode] = useState<Mode>("checking");
  const [detail, setDetail] = useState("Checking live Spec Studio host…");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await probeFinDataGraphHealth();
      if (cancelled) return;
      setDetail(result.detail);
      setMode(result.ok ? "live" : "embedded");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function useEmbedded() {
    setMode("embedded");
    setDetail("Using Pages-native Spec Studio demo.");
  }

  function recheckLive() {
    setMode("checking");
    setDetail("Rechecking live Spec Studio host…");
    void probeFinDataGraphHealth().then((result) => {
      setDetail(result.detail);
      setMode(result.ok ? "live" : "embedded");
    });
  }

  return (
    <div
      className={
        mode === "live"
          ? "fdg-demo-shell"
          : "fdg-demo-shell fdg-demo-shell-embedded"
      }
    >
      <header className="fdg-demo-bar">
        <div className="fdg-demo-bar-left">
          <Link to="/" className="brand">
            Chris Selvera
          </Link>
          <span className="fdg-demo-sep" aria-hidden="true">
            /
          </span>
          <Link to="/projects/findatagraph" className="fdg-demo-crumb">
            FinDataGraph
          </Link>
          <span className="fdg-demo-sep" aria-hidden="true">
            /
          </span>
          <span className="fdg-demo-crumb current">
            {mode === "live" ? "Spec Studio (live)" : "Spec Studio"}
          </span>
        </div>
        <div className="fdg-demo-bar-right">
          <code className="fdg-demo-creds">
            AUTH_MODE={FINDATAGRAPH_AUTH_MODE} · controller@findatagraph.demo /
            password123
          </code>
          {mode === "live" ? (
            <button type="button" className="btn btn-ghost" onClick={useEmbedded}>
              Pages demo
            </button>
          ) : mode === "embedded" ? (
            <button type="button" className="btn btn-ghost" onClick={recheckLive}>
              Try live host
            </button>
          ) : null}
          <Link className="btn btn-ghost" to="/projects/findatagraph">
            Case study
          </Link>
        </div>
      </header>

      {mode === "checking" ? (
        <div className="fdg-demo-fallback" role="status" aria-live="polite">
          <div className="fdg-demo-fallback-card">
            <div className="fdg-demo-fallback-kicker">Connecting</div>
            <h1>Loading Spec Studio…</h1>
            <p>{detail}</p>
          </div>
        </div>
      ) : null}

      {mode === "live" ? (
        <iframe
          className="fdg-demo-frame"
          title="FinDataGraph Spec Studio"
          src={FINDATAGRAPH_LIVE_STUDIO_URL}
          allow="clipboard-read; clipboard-write"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : null}

      {mode === "embedded" ? <FinDataGraphApp /> : null}

      <p className="fdg-demo-footnote">
        Viewing <code>{FINDATAGRAPH_DEMO_ROUTE}</code> on GitHub Pages — Spec Studio
        dual path · live host <code>AUTH_MODE={FINDATAGRAPH_AUTH_MODE}</code> (Clerk;
        local demo login allowed). Address bar stays on{" "}
        <code className="fdg-no-autolink">selvera247.github.io</code>. Share:{" "}
        <code className="fdg-no-autolink">{FINDATAGRAPH_PUBLIC_DEMO_HREF}</code>
        {mode === "embedded" ? ` · ${detail}` : null}
      </p>
    </div>
  );
}
