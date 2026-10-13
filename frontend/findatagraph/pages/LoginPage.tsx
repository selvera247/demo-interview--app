import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { fdgPath } from "../demoBase";

export default function LoginPage() {
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("controller@findatagraph.demo");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to={fdgPath("/studio")} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate(fdgPath("/studio"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fdg-login-page">
      <form className="fdg-login-card" onSubmit={onSubmit}>
        <h1>FinDataGraph</h1>
        <p className="fdg-sub">Sign in to your financial data graph.</p>
        {error ? <p className="fdg-error">{error}</p> : null}
        <div className="fdg-field">
          <label htmlFor="fdg-email">Email</label>
          <input
            id="fdg-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="fdg-field">
          <label htmlFor="fdg-password">Password</label>
          <input
            id="fdg-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="fdg-btn" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="fdg-hint">
          Demo users (password <code>password123</code>):
          <br />
          controller@findatagraph.demo · accountant@findatagraph.demo ·
          admin@findatagraph.demo
        </p>
        <p className="fdg-hint">
          <Link to="/projects/findatagraph">← Case study</Link>
          {" · "}
          After login you land on Spec Studio (seeded CRM↔GL + NL generate).
        </p>
      </form>
    </div>
  );
}
