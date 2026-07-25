import { useCurrentUser } from "../context/CurrentUserContext";

export default function TaskBoardPage() {
  const { currentUser } = useCurrentUser();
  return (
    <div>
      <h1>Task Board</h1>
      <p>Placeholder — tasks will appear here in Feature 13.</p>
      <p>
        Current user: <strong>{currentUser ? currentUser.name : "none selected"}</strong>
        {currentUser && <span style={{ fontSize: "0.8rem", color: "var(--text)", marginLeft: "0.5rem" }}>({currentUser._id})</span>}
      </p>
    </div>
  );
}
