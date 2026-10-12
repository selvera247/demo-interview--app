import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FINDATAGRAPH_DEMO_ROUTE,
  FINDATAGRAPH_DEMO_URL,
  FINDATAGRAPH_PUBLIC_DEMO_HREF,
  probeFinDataGraphHealth,
} from "../data/findatagraphDemo";

type FrameState = "checking" | "online" | "offline";

/**
 * Hosted demo shell: visitors stay on the GitHub Pages finance path
 * (`/#/projects/findatagraph/demo`) while the live app loads in-frame.
 * Never send the browser chrome to the raw Cloudflare hostname.
 */
export default function FinDataGraphDemo() {
  const [state, setState] = useState<FrameState>("checking");
  const [detail, setDetail] = useState("Checking demo backend…");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await probeFinDataGraphHealth();
      if (cancelled) return;
      setDetail(result.detail);
      setState(result.ok ? "online" : "offline");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function recheck() {
    setState("checking");
    setDetail("Rechecking demo backend…");
    void probeFinDataGraphHealth().then((result) => {
      setDetail(result.detail);
      setState(result.ok ? "online" : "offline");
    });
  }

  return (
    <div className="fdg-demo-shell">
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
          <span className="fdg-demo-crumb current">Live demo</span>
        </div>
        <div className="fdg-demo-bar-right">
          <code className="fdg-demo-creds">
            controller@findatagraph.demo / password123
          </code>
          <Link className="btn btn-ghost" to="/projects/findatagraph">
            Case study
          </Link>
        </div>
      </header>

      {state === "online" ? (
        <iframe
          className="fdg-demo-frame"
          title="FinDataGraph continuous close demo"
          src={FINDATAGRAPH_DEMO_URL}
          allow="clipboard-read; clipboard-write"
          referrerPolicy="no-referrer"
          // Block top-level navigation out of the Pages shell; keep auth/storage working.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : (
        <div className="fdg-demo-fallback" role="status" aria-live="polite">
          <div className="fdg-demo-fallback-card">
            <div className="fdg-demo-fallback-kicker">
              {state === "checking" ? "Connecting" : "Demo offline"}
            </div>
            <h1>
              {state === "checking"
                ? "Loading FinDataGraph…"
                : "Live demo backend is unreachable"}
            </h1>
            <p>{detail}</p>
            {state === "offline" && (
              <>
                <p>
                  Stay on this finance path — the public demo link is always{" "}
                  <code className="fdg-no-autolink">{FINDATAGRAPH_PUBLIC_DEMO_HREF}</code>
                  . The backend is an ephemeral tunnel loaded inside this page; it is not
                  a separate site you should open in the address bar.
                </p>
                <p>
                  Login when back online:{" "}
                  <code>controller@findatagraph.demo / password123</code>
                </p>
                <div className="fdg-demo-fallback-actions">
                  <button type="button" className="btn btn-primary" onClick={recheck}>
                    Retry
                  </button>
                  <Link className="btn btn-ghost" to="/projects/findatagraph">
                    Back to case study
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <p className="fdg-demo-footnote">
        Viewing <code>{FINDATAGRAPH_DEMO_ROUTE}</code> on GitHub Pages — synthetic
        Meridian Retail data only. Address bar should stay on{" "}
        <code className="fdg-no-autolink">selvera247.github.io</code>.
      </p>
    </div>
  );
}
