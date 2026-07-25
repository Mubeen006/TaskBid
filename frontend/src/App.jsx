import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CurrentUserProvider } from "./context/CurrentUserContext";
import AppLayout from "./components/AppLayout";
import TaskBoardPage from "./pages/TaskBoardPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import DashboardPage from "./pages/DashboardPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrentUserProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/board" replace />} />
              <Route path="/board" element={<TaskBoardPage />} />
              <Route path="/tasks/:id" element={<TaskDetailPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CurrentUserProvider>
    </QueryClientProvider>
  );
}
