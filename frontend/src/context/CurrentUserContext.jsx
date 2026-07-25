import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "../api/client";

const CurrentUserContext = createContext(null);

const SESSION_KEY = "taskbid_current_user";

export function CurrentUserProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUserState] = useState(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    apiFetch("/api/users")
      .then((data) => {
        setUsers(data);
        setCurrentUserState((prev) => {
          if (prev) return prev;
          const first = data[0] ?? null;
          if (first) sessionStorage.setItem(SESSION_KEY, JSON.stringify(first));
          return first;
        });
      })
      .catch((err) => {
        console.error("Failed to load users:", err.message);
      });
  }, []);

  function setCurrentUser(user) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch {
      // sessionStorage unavailable — continue without persistence
    }
    setCurrentUserState(user);
  }

  return (
    <CurrentUserContext.Provider value={{ currentUser, setCurrentUser, users }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  }
  return ctx;
}
