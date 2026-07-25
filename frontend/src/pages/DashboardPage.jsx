import { useCurrentUser } from "../context/CurrentUserContext";

export default function DashboardPage() {
  const { currentUser } = useCurrentUser();
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Placeholder — aggregated stats and chart will appear here in Feature 16.</p>
      <p>
        Current user: <strong>{currentUser ? currentUser.name : "none selected"}</strong>
      </p>
    </div>
  );
}
