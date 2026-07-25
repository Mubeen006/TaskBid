import { useParams } from "react-router-dom";
import { useCurrentUser } from "../context/CurrentUserContext";

export default function TaskDetailPage() {
  const { id } = useParams();
  const { currentUser } = useCurrentUser();
  return (
    <div>
      <h1>Task Detail</h1>
      <p>Placeholder — task detail and bid form will appear here in Feature 14.</p>
      <p>Task ID: <code>{id}</code></p>
      <p>
        Current user: <strong>{currentUser ? currentUser.name : "none selected"}</strong>
      </p>
    </div>
  );
}
