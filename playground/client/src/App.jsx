import React, { useState } from 'react';
import { auth, db, doc, setDoc, onAuthStateChanged, onSnapshot, signOut } from '../../../src/lib/firebase';
import { INITIAL_STATE } from '../../../src/types';

// Import Views
import { AuthView } from './views/AuthView';
import { PlaygroundView } from './views/PlaygroundView';
import { HistoryDashboardView } from './views/HistoryDashboardView';
import { HabitProfileDashboardView } from './views/HabitProfileDashboardView';
import { ApiKeysView } from './views/ApiKeysView';
import { DownloadView } from './views/DownloadView';
import { ManualView } from './views/ManualView';
import { DocsView } from './views/DocsView';

// Import Layout Components
import { MainLayout } from './components/layout/MainLayout';
import { TopBar } from './components/layout/TopBar';
import { RightPanel } from './components/layout/RightPanel';

// Hooks
import { usePlayground } from './hooks/usePlayground';
import { useVoiceDictation } from './hooks/useVoiceDictation';

const normalizeGlobalState = (raw) => {
  const source = raw || {};
  const settings = source.settings || {};
  const aiConfig = settings.aiConfig || {};
  const features = settings.features || {};

  return {
    ...INITIAL_STATE,
    ...source,
    goals: Array.isArray(source.goals) ? source.goals : INITIAL_STATE.goals,
    projects: Array.isArray(source.projects) ? source.projects : INITIAL_STATE.projects,
    tasks: Array.isArray(source.tasks) ? source.tasks : INITIAL_STATE.tasks,
    risks: Array.isArray(source.risks) ? source.risks : INITIAL_STATE.risks,
    resources: Array.isArray(source.resources) ? source.resources : INITIAL_STATE.resources,
    history: Array.isArray(source.history) ? source.history : INITIAL_STATE.history,
    messages: Array.isArray(source.messages) ? source.messages : INITIAL_STATE.messages,
    playgroundMessages: Array.isArray(source.playgroundMessages) ? source.playgroundMessages : INITIAL_STATE.playgroundMessages,
    recommendations: Array.isArray(source.recommendations) ? source.recommendations : INITIAL_STATE.recommendations,
    notifications: Array.isArray(source.notifications) ? source.notifications : INITIAL_STATE.notifications,
    knowledge: Array.isArray(source.knowledge) ? source.knowledge : INITIAL_STATE.knowledge,
    pastSessions: Array.isArray(source.pastSessions) ? source.pastSessions : (INITIAL_STATE.pastSessions || []),
    currentSessionId: source.currentSessionId || null,
    metrics: { ...INITIAL_STATE.metrics, ...(source.metrics || {}) },
    uiState: { ...INITIAL_STATE.uiState, ...(source.uiState || {}) },
    settings: {
      ...INITIAL_STATE.settings,
      ...settings,
      appearance: { ...INITIAL_STATE.settings.appearance, ...(settings.appearance || {}) },
      system: { ...INITIAL_STATE.settings.system, ...(settings.system || {}) },
      features: {
        ...INITIAL_STATE.settings.features,
        ...features,
        structuredOutputs: features.structuredOutputs ?? true,
        codeExecution: features.codeExecution ?? false,
        functionCalling: features.functionCalling ?? true,
        groundingWithHabitData: features.groundingWithHabitData ?? true,
      },
      productivity: { ...INITIAL_STATE.settings.productivity, ...(settings.productivity || {}) },
      accessibility: { ...INITIAL_STATE.settings.accessibility, ...(settings.accessibility || {}) },
      privacy: { ...INITIAL_STATE.settings.privacy, ...(settings.privacy || {}) },
      sync: { ...INITIAL_STATE.settings.sync, ...(settings.sync || {}) },
      aiConfig: {
        ...INITIAL_STATE.settings.aiConfig,
        ...aiConfig,
        apiKeys: { ...INITIAL_STATE.settings.aiConfig.apiKeys, ...(aiConfig.apiKeys || {}) },
        selectedModels: { ...INITIAL_STATE.settings.aiConfig.selectedModels, ...(aiConfig.selectedModels || {}) },
        parameters: {
          ...INITIAL_STATE.settings.aiConfig.parameters,
          ...(aiConfig.parameters || {}),
          systemInstruction: aiConfig.parameters?.systemInstruction || '',
          temperature: aiConfig.parameters?.temperature ?? 1.0,
          thinkingLevel: aiConfig.parameters?.thinkingLevel || 'High',
        },
      },
    },
  };
};

function App() {
  const [activeMenu, setActiveMenu] = useState('playground');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  
  // Auth State
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Theme State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Unified State Sync
  const [globalState, setGlobalState] = useState(null);

  // Custom Hooks
  const { inputText, setInputText, isLoading, handleRun, startNewSession } = usePlayground(globalState, setGlobalState);
  const { isRecording, toggleRecording } = useVoiceDictation(setInputText);

  // Sync right panel state from global store once on load
  React.useEffect(() => {
    if (globalState?.uiState?.isRightPanelOpen !== undefined) {
      setIsRightPanelOpen(globalState.uiState.isRightPanelOpen);
    }
  }, [globalState?.sessionId]);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (!currentUser) setGlobalState(null);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!user) return;
    const unsubUsers = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        setGlobalState((prev) => {
          const normalized = normalizeGlobalState(remoteData);
          if (prev) {
            normalized.pastSessions = Array.isArray(remoteData.pastSessions) ? remoteData.pastSessions : (prev.pastSessions || []);
            normalized.currentSessionId = remoteData.currentSessionId !== undefined ? remoteData.currentSessionId : prev.currentSessionId;
            normalized.playgroundMessages = prev.playgroundMessages?.length > 0 
              ? prev.playgroundMessages 
              : (Array.isArray(remoteData.playgroundMessages) ? remoteData.playgroundMessages : []);
            normalized.messages = Array.isArray(remoteData.messages) && remoteData.messages.length > 0
              ? remoteData.messages
              : (prev.messages || []);
            // Preserve workspace memory if it exists from the other snapshot
            if (prev.workspaceMemory) {
              normalized.workspaceMemory = prev.workspaceMemory;
            }
            // FIX: Preserve the user's local API key settings during background syncs.
            // Without this, the onSnapshot echo-back can overwrite the selectedProvider
            // with a stale value from Firestore before the user's save has propagated.
            if (prev.settings?.aiConfig?.selectedProvider) {
              normalized.settings.aiConfig.selectedProvider = prev.settings.aiConfig.selectedProvider;
            }
            if (prev.settings?.aiConfig?.apiKeys) {
              normalized.settings.aiConfig.apiKeys = {
                ...normalized.settings.aiConfig.apiKeys,
                ...prev.settings.aiConfig.apiKeys
              };
            }
          }
          return normalized;
        });
      } else {
        setGlobalState((prev) => prev || normalizeGlobalState({}));
      }
    }, (err) => {
      console.error("Failed to sync state from Firestore:", err);
    });

    const unsubWorkspaces = onSnapshot(doc(db, 'workspaces', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const workspaceMemory = docSnap.data();
        setGlobalState((prev) => {
          if (!prev) return prev;
          return { ...prev, workspaceMemory };
        });
      }
    }, (err) => {
      console.error("Failed to sync workspace memory from Firestore:", err);
    });
    
    return () => {
      unsubUsers();
      unsubWorkspaces();
    };
  }, [user]);


  if (isAuthLoading) {
    return <div className="h-screen w-full bg-bg flex items-center justify-center text-text-muted">Loading...</div>;
  }

  if (!user) {
    return <AuthView />;
  }

  const toggleRightPanel = async (open) => {
    setIsRightPanelOpen(open);
    if (globalState) {
      const newState = { ...globalState, uiState: { ...globalState.uiState, isRightPanelOpen: open } };
      setGlobalState(newState);
      if (auth.currentUser) {
        // Only write the specific field that changed, never the full state
        setDoc(doc(db, 'users', auth.currentUser.uid), { uiState: newState.uiState }, { merge: true })
          .catch(e => console.error(e));
      }
    }
  };

  // Helper to render the active view
  const renderMainContent = () => {
    switch (activeMenu) {
      case 'download': return <DownloadView />;
      case 'keys': return <ApiKeysView globalState={globalState} setGlobalState={setGlobalState} />;
      case 'history': return <HistoryDashboardView globalState={globalState} setGlobalState={setGlobalState} setActiveMenu={setActiveMenu} />;
      case 'habit': return <HabitProfileDashboardView globalState={globalState} />;
      case 'manual': return <ManualView />;
      case 'docs': return <DocsView />;
      case 'playground':
      default:
        return (
          <PlaygroundView 
            isLeftPanelOpen={isLeftPanelOpen}
            setIsLeftPanelOpen={setIsLeftPanelOpen}
            isRightPanelOpen={isRightPanelOpen}
            toggleRightPanel={toggleRightPanel}
            globalState={globalState}
            setGlobalState={setGlobalState}
            inputText={inputText}
            setInputText={setInputText}
            handleRun={handleRun}
            isLoading={isLoading}
            activeMenu={activeMenu}
            isRecording={isRecording}
            toggleRecording={toggleRecording}
            startNewSession={startNewSession}
          />
        );
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  return (
    <MainLayout 
      rightPanel={
        <RightPanel 
          isRightPanelOpen={isRightPanelOpen}
          toggleRightPanel={toggleRightPanel}
          globalState={globalState}
          setGlobalState={setGlobalState}
        />
      }
    >
      <TopBar 
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        user={user}
        onSignOut={handleSignOut}
      />
      {renderMainContent()}
    </MainLayout>
  );
}

export default App;
