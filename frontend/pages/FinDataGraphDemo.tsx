import { Link } from "react-router-dom";
import FinDataGraphApp from "../findatagraph/App";
import {
  FINDATAGRAPH_DEMO_ROUTE,
  FINDATAGRAPH_PUBLIC_DEMO_HREF,
} from "../data/findatagraphDemo";

/**
 * Hosted demo shell on GitHub Pages.
 * The control plane runs in-process (synthetic fixtures) so hiring managers
 * never depend on ephemeral Cloudflare tunnels or a sleeping PaaS dyno.
 */
export default function FinDataGraphDemo() {
  return (
    <div className="fdg-demo-shell fdg-demo-shell-embedded">
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

      <FinDataGraphApp />

      <p className="fdg-demo-footnote">
        Viewing <code>{FINDATAGRAPH_DEMO_ROUTE}</code> on GitHub Pages — synthetic
        Meridian Retail data, in-browser control plane (always online). Share:{" "}
        <code className="fdg-no-autolink">{FINDATAGRAPH_PUBLIC_DEMO_HREF}</code>
      </p>
    </div>
  );
}
