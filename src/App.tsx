import { useEffect, useState, type ReactNode } from "react";
import { RepoToolbar } from "./components/layout/Header";
import { MainWorkspace } from "./components/layout/MainWorkspace";
import { Sidebar } from "./components/layout/Sidebar";
import { Dashboard } from "./components/dashboard/Dashboard";
import { CredentialsPage } from "./components/pages/CredentialsPage";
import { RepoListPage } from "./components/pages/AppPages";
import {
  AboutPage,
  PluginsPage,
  SettingsPage,
  SshKeysPage,
} from "./components/pages/SettingsPage";
import { OperationOverlay } from "./components/OperationOverlay";
import { useAppStore } from "./stores/appStore";
import { usePrefsStore } from "./stores/prefsStore";
import { OpeningRepoOverlay } from "./components/OpeningRepoOverlay";
import { AppChrome } from "./components/layout/AppChrome";
import { IconTerminal } from "./components/Icons";
import { WelcomeSetup } from "./components/WelcomeSetup";
import { BootSplash } from "./components/BootSplash";
import { AlertModal } from "./components/AlertModal";
import { FeedbackModal } from "./components/FeedbackModal";
import { CheckoutBranchModal } from "./components/CheckoutBranchModal";
import {
  applyMainWindow,
  applySetupWindow,
  applySplashWindow,
} from "./lib/windowLayout";

function App() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const bootLoading = useAppStore((s) => s.bootLoading);
  const bootError = useAppStore((s) => s.bootError);
  const profiles = useAppStore((s) => s.profiles);
  const activeRepoId = useAppStore((s) => s.activeRepoId);
  const refreshStatus = useAppStore((s) => s.refreshStatus);
  const commit = useAppStore((s) => s.commit);
  const openRepositoryDialog = useAppStore((s) => s.openRepositoryDialog);
  const appView = useAppStore((s) => s.appView);
  const shellTabs = useAppStore((s) => s.shellTabs);
  const activeShellTabId = useAppStore((s) => s.activeShellTabId);
  const notice = useAppStore((s) => s.notice);
  const error = useAppStore((s) => s.error);
  const clearNotice = useAppStore((s) => s.clearNotice);
  const health = useAppStore((s) => s.health);
  const terminalOpen = useAppStore((s) => s.terminalOpen);
  const setTerminalOpen = useAppStore((s) => s.setTerminalOpen);
  const status = useAppStore((s) => s.status);
  const remotes = useAppStore((s) => s.remotes);
  const repositories = useAppStore((s) => s.repositories);
  const openingRepoName = useAppStore((s) => s.openingRepoName);
  const statusPollSeconds = usePrefsStore((s) => s.statusPollSeconds);
  const onboardingComplete = usePrefsStore((s) => s.onboardingComplete);
  const setPref = usePrefsStore((s) => s.setPref);

  const [prefsReady, setPrefsReady] = useState(() =>
    usePrefsStore.persist.hasHydrated(),
  );
  const [setupDone, setSetupDone] = useState(false);
  const [splashProgress, setSplashProgress] = useState(0.15);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    const unsub = usePrefsStore.persist.onFinishHydration(() => {
      setPrefsReady(true);
    });
    if (usePrefsStore.persist.hasHydrated()) setPrefsReady(true);
    return unsub;
  }, []);

  useEffect(() => {
    void applySplashWindow();
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    void bootstrap();
  }, [prefsReady, bootstrap]);

  useEffect(() => {
    if (!prefsReady || bootLoading) return;
    if (!onboardingComplete && profiles.length > 0) {
      setPref("onboardingComplete", true);
    }
  }, [prefsReady, bootLoading, onboardingComplete, profiles.length, setPref]);

  const booting = !prefsReady || bootLoading;

  useEffect(() => {
    if (!booting) return;
    setSplashProgress(0.2);
    const t1 = window.setTimeout(() => setSplashProgress(0.55), 280);
    const t2 = window.setTimeout(() => setSplashProgress(0.82), 700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [booting]);

  const needsOnboarding =
    prefsReady &&
    !bootLoading &&
    !bootError &&
    !onboardingComplete &&
    profiles.length === 0 &&
    !setupDone;

  useEffect(() => {
    if (booting) {
      void applySplashWindow();
      return;
    }
    if (needsOnboarding) {
      void applySetupWindow();
    } else if (!bootError) {
      void applyMainWindow();
    }
  }, [booting, needsOnboarding, bootError]);

  useEffect(() => {
    if (!activeRepoId || needsOnboarding || booting) return;
    const ms = Math.max(2, statusPollSeconds) * 1000;
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, ms);
    return () => window.clearInterval(timer);
  }, [activeRepoId, refreshStatus, statusPollSeconds, needsOnboarding, booting]);

  useEffect(() => {
    if (needsOnboarding || booting) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        void openRepositoryDialog();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        setTerminalOpen(!terminalOpen);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void commit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    commit,
    openRepositoryDialog,
    setTerminalOpen,
    terminalOpen,
    needsOnboarding,
    booting,
  ]);

  if (booting) {
    return (
      <BootSplash
        message={prefsReady ? "Carregando…" : "Iniciando…"}
        progress={splashProgress}
      />
    );
  }

  if (bootError) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-[#12141a] px-8 text-center">
        <p className="text-[14px] text-[#f0f1f4]">Não foi possível iniciar</p>
        <p className="max-w-md text-[12px] text-[#f85149]">{bootError}</p>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <WelcomeSetup
        onComplete={() => {
          setSetupDone(true);
        }}
      />
    );
  }

  const activeTab =
    shellTabs.find((t) => t.id === activeShellTabId) ?? shellTabs[0] ?? null;
  const inRepo = activeTab?.kind === "repo" && Boolean(activeRepoId);
  const repo = repositories.find((r) => r.id === activeRepoId);
  const showSidebar =
    activeTab?.kind === "start" ||
    appView === "repositories" ||
    appView === "favorites";

  let main: ReactNode = null;
  if (appView === "dashboard") main = <Dashboard />;
  else if (appView === "repositories") main = <RepoListPage mode="all" />;
  else if (appView === "favorites") main = <RepoListPage mode="favorites" />;
  else if (appView === "history") main = <MainWorkspace />;
  else if (appView === "credentials") main = <CredentialsPage />;
  else if (appView === "ssh") main = <SshKeysPage />;
  else if (appView === "settings") main = <SettingsPage />;
  else if (appView === "plugins") main = <PluginsPage />;
  else if (appView === "about") main = <AboutPage />;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#171a20]">
      <AppChrome onFeedback={() => setFeedbackOpen(true)} />
      {inRepo && <RepoToolbar />}
      <div className="flex min-h-0 flex-1 flex-col">
        {inRepo ? (
          <>
            <main aria-label="Workspace" className="flex min-h-0 min-w-0 flex-1">
              {main}
            </main>
            <footer className="flex h-5 shrink-0 items-center justify-between border-t border-[#2d3139] bg-[#12141a] px-2.5 text-[10px] text-[#5c6370]">
              <div className="flex items-center gap-2.5">
                <span className="text-[#c8ccd4]">{repo?.name}</span>
                <span className="text-[#3dd68c]">{status?.branch ?? "—"}</span>
                <span>
                  {remotes.length === 0
                    ? "sem remote"
                    : remotes.map((r) => r.name).join(", ")}
                </span>
                {status?.upstream && (
                  <span className="font-mono">
                    ↑{status.ahead} ↓{status.behind}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 hover:text-[#e8eaed] ${
                    terminalOpen ? "text-[#e8eaed]" : ""
                  }`}
                  onClick={() => setTerminalOpen(!terminalOpen)}
                >
                  <IconTerminal className="h-3.5 w-3.5" />
                  Terminal
                  <kbd className="rounded border border-[#2d3139] px-0.5 text-[8px]">
                    Ctrl+`
                  </kbd>
                </button>
                <span>v{health?.appVersion ?? "0.1.0"}</span>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {showSidebar && <Sidebar />}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <main aria-label="Área de trabalho" className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
                {main}
              </main>
            </div>
          </div>
        )}
      </div>
      <OperationOverlay />
      <CheckoutBranchModal />
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
      {openingRepoName !== null && <OpeningRepoOverlay name={openingRepoName} />}
      {error && (
        <AlertModal title="Algo deu errado" onClose={clearNotice}>
          {error}
        </AlertModal>
      )}
      {!error && notice && (
        <AlertModal title="Atenção" onClose={clearNotice}>
          {notice}
        </AlertModal>
      )}
    </div>
  );
}

export default App;
