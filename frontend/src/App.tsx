import { Routes, Route } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Keywords } from "./pages/Keywords";
import { SettingsPage } from "./pages/Settings";
import { settingsApi } from "./api/client";

export default function App() {
  const { data: status } = useQuery({
    queryKey: ["status"],
    queryFn: settingsApi.status,
    refetchInterval: (query) =>
      query.state.data?.scan_running ? 3000 : 60000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });

  return (
    <Layout status={status}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/keywords" element={<Keywords />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}
