import { useEffect } from "react";
import { Header } from "./components/layout/Header";
import { MainWorkspace } from "./components/layout/MainWorkspace";
import { RightPanel } from "./components/layout/RightPanel";
import { Sidebar } from "./components/layout/Sidebar";
import { OperationOverlay } from "./components/OperationOverlay";
import { useAppStore } from "./stores/appStore";

function App() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const activeRepoId = useAppStore((s) => s.activeRepoId);
  const refreshStatus = useAppStore((s) => s.refreshStatus);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!activeRepoId) return;
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeRepoId, refreshStatus]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <div className="flex min-h-0 flex-1">
            <MainWorkspace />
            <RightPanel />
          </div>
        </div>
      </div>
      <OperationOverlay />
    </div>
  );
}

export default App;
