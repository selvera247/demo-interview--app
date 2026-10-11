import { Link } from "react-router-dom";
import {
  FINDATAGRAPH_DEMO_ROUTE,
  FINDATAGRAPH_DEMO_URL,
} from "../data/findatagraphDemo";

/**
 * Hosted demo shell: visitors stay on the GitHub Pages finance path
 * (`/#/projects/findatagraph/demo`) while the live app loads in-frame.
 */
export default function FinDataGraphDemo() {
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
      <iframe
        className="fdg-demo-frame"
        title="FinDataGraph continuous close demo"
        src={FINDATAGRAPH_DEMO_URL}
        allow="clipboard-read; clipboard-write"
      />
      <p className="fdg-demo-footnote">
        Viewing <code>{FINDATAGRAPH_DEMO_ROUTE}</code> on GitHub Pages — synthetic
        Meridian Retail data only.
      </p>
    </div>
  );
}
