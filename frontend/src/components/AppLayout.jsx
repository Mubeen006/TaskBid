import { NavLink, Outlet } from "react-router-dom";
import { useCurrentUser } from "../context/CurrentUserContext";

const navStyle = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
  padding: "0.75rem 1.5rem",
  borderBottom: "1px solid var(--border)",
  flexWrap: "wrap",
};

const linkStyle = ({ isActive }) => ({
  color: isActive ? "var(--accent)" : "var(--text-h)",
  textDecoration: "none",
  fontWeight: isActive ? "600" : "400",
});

const spacerStyle = { flex: 1 };

const selectStyle = {
  padding: "0.3rem 0.5rem",
  borderRadius: "4px",
  border: "1px solid var(--border)",
  background: "var(--code-bg)",
  color: "var(--text-h)",
  fontSize: "0.9rem",
  cursor: "pointer",
};

const labelStyle = {
  fontSize: "0.85rem",
  color: "var(--text)",
};

export default function AppLayout() {
  const { users, currentUser, setCurrentUser } = useCurrentUser();

  function handleChange(e) {
    const selected = users.find((u) => u._id === e.target.value);
    if (selected) setCurrentUser(selected);
  }

  return (
    <>
      <nav style={navStyle} aria-label="Main navigation">
        <NavLink to="/board" style={linkStyle}>Task Board</NavLink>
        <NavLink to="/dashboard" style={linkStyle}>Dashboard</NavLink>
        <div style={spacerStyle} />
        <label htmlFor="user-switcher" style={labelStyle}>
          Acting as:
        </label>
        <select
          id="user-switcher"
          style={selectStyle}
          value={currentUser?._id ?? ""}
          onChange={handleChange}
          aria-label="Switch current user"
        >
          {users.length === 0 && (
            <option value="" disabled>Loading users…</option>
          )}
          {users.map((u) => (
            <option key={u._id} value={u._id}>{u.name}</option>
          ))}
        </select>
      </nav>
      <main style={{ padding: "1.5rem", textAlign: "left" }}>
        <Outlet />
      </main>
    </>
  );
}
