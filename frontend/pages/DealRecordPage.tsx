import { Link } from "react-router-dom";
import App from "../App";

/** Existing Deal Record demo, framed as portfolio project #2. */
export default function DealRecordPage() {
  return (
    <div>
      <nav
        className="site-nav"
        style={{ position: "sticky", top: 0, zIndex: 30, marginBottom: 0 }}
      >
        <Link to="/" className="brand">
          Chris Selvera
        </Link>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/projects/close-agent">Close Agent</Link>
          <span style={{ color: "var(--signal)", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
            DEMO 02 · DEAL RECORD
          </span>
        </div>
      </nav>
      <App />
    </div>
  );
}
