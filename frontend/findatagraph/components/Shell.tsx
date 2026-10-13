import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { fdgPath } from "../demoBase";

const links = [
  { to: fdgPath("/studio"), label: "Spec Studio", end: true },
  { to: fdgPath("/dashboard"), label: "Dashboard" },
  { to: fdgPath("/exceptions"), label: "Exceptions" },
  { to: fdgPath("/runs"), label: "Runs" },
  { to: fdgPath("/audit"), label: "Audit" },
];

export default function Shell() {
  const { user, logout } = useAuth();

  return (
    <div className="fdg-app-shell">
      <aside className="fdg-sidebar">
        <div className="fdg-brand">
          FinDataGraph
          <span>Financial data graph</span>
        </div>
        <nav className="fdg-nav-list" aria-label="App">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="fdg-sidebar-user">
          <strong>{user?.name}</strong>
          <span>
            {user?.role} · {user?.email}
          </span>
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="fdg-main">
        <Outlet />
      </main>
    </div>
  );
}
