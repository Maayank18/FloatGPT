import React from 'react';

import { HeroSection } from '../components/playground/HeroSection';
import { Composer } from '../components/playground/Composer';
import { RotateCcw, Copy } from 'lucide-react';
import { db, doc, setDoc, auth } from '../../../../src/lib/firebase';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

export const PlaygroundView = ({ 
  isLeftPanelOpen, 
  setIsLeftPanelOpen, 
  isRightPanelOpen, 
  toggleRightPanel, 
  globalState, 
  setGlobalState,
  inputText, 
  setInputText, 
  handleRun, 
  isLoading, 
  activeMenu, 
  isRecording, 
  toggleRecording,
  startNewSession 
}) => {
  const activeMessages = globalState?.playgroundMessages || [];

  const handleRewind = (messageIndex) => {
    if (!confirm("Are you sure you want to rewind to this point? All subsequent messages will be deleted.")) return;
    
    const newMessages = (globalState?.playgroundMessages || []).slice(0, messageIndex + 1);
    const newState = { ...globalState, playgroundMessages: newMessages };
    setGlobalState(newState);
    
    if (auth.currentUser) {
      // Only write playgroundMessages, never the full state (protects orb transcript)
      setDoc(doc(db, 'users', auth.currentUser.uid), { playgroundMessages: newMessages }, { merge: true })
        .catch(e => console.error(e));
    }
  };

  const handleClearChat = () => {
    if (!confirm("Are you sure you want to clear the Playground chat?")) return;
    
    const newState = { ...globalState, playgroundMessages: [] };
    setGlobalState(newState);
    
    if (auth.currentUser) {
      setDoc(doc(db, 'users', auth.currentUser.uid), { playgroundMessages: [] }, { merge: true })
        .catch(e => console.error(e));
    }
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
      {/* Top Actions */}
      <div className="absolute top-4 right-8 z-50">
        <button 
          onClick={startNewSession}
          className="flex items-center gap-2 px-4 py-2 bg-panel border border-white/10 hover:border-accent hover:bg-accent/10 rounded-lg text-xs font-mono font-bold text-white transition-all shadow-lg"
        >
          <RotateCcw className="w-3.5 h-3.5 text-accent" />
          NEW CHAT
        </button>
      </div>

      {/* Chat Canvas */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-24 pt-10 pb-4 custom-scrollbar">
        <div className="max-w-[760px] mx-auto flex flex-col gap-6">
          {(activeMessages).length === 0 && (
            <HeroSection />
          )}
          
          {(activeMessages).map((msg, idx) => (
            msg.role === 'user' ? (
              <div key={idx} className="flex justify-end">
                 <div className="bg-white/10 border border-white/5 px-5 py-3 rounded-2xl text-[14px] leading-[1.6] max-w-[85%] text-white font-normal backdrop-blur-sm shadow-md">
                    <MarkdownRenderer content={msg.content} />
                 </div>
              </div>
            ) : (
              <div key={idx} className="flex gap-4 max-w-[100%] group relative">
                 <div className="w-9 h-9 shrink-0 mt-0.5 flex items-center justify-center">
                   <img src="/logo-chat.png" className="w-full h-full object-contain scale-[1.2]" alt="FloatGPT" />
                 </div>
                 <div className="pt-1 text-[14px] text-text-primary leading-[1.6] w-full relative group/msg">
                    <MarkdownRenderer content={msg.content} />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        const el = document.getElementById(`pg-copy-msg-${idx}`);
                        if (el) {
                          el.innerHTML = '<svg class="w-3.5 h-3.5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                          setTimeout(() => {
                            el.innerHTML = '<svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                          }, 2000);
                        }
                      }}
                      className="absolute -top-3 -right-3 p-1.5 bg-card border border-card-border rounded-lg text-text-muted opacity-0 group-hover/msg:opacity-100 transition-opacity hover:text-accent shadow-sm"
                      title="Copy Response"
                      id={`pg-copy-msg-${idx}`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {msg.data && Array.isArray(msg.data.newTasks) && msg.data.newTasks.length > 0 && (
                        <div className="mt-3 text-xs bg-panel p-3 rounded-lg border border-card-border">
                          <p className="font-semibold mb-2">Generated Tasks:</p>
                          <ul className="list-disc pl-4 space-y-1">
                            {msg.data.newTasks.map(t => <li key={t.id || t.title}>{t.title}</li>)}
                          </ul>
                        </div>
                    )}
                 </div>
                 {/* Rewind Action */}
                 {idx > 0 && (
                   <button 
                     onClick={() => handleRewind(idx)}
                     className="absolute -left-12 top-2 p-1.5 rounded-full text-text-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all"
                     title="Rewind to here"
                   >
                     <RotateCcw className="w-4 h-4" />
                   </button>
                 )}
              </div>
            )
          ))}
          {isLoading && (
            <div className="flex gap-4 max-w-[100%]">
               <div className="w-9 h-9 shrink-0 mt-0.5 flex items-center justify-center">
                 <img src="/logo-chat.png" className="w-full h-full object-contain scale-[1.2] opacity-50 animate-pulse" alt="Loading" />
               </div>
               <div className="pt-2 text-[14px] text-text-muted">Thinking...</div>
            </div>
          )}
        </div>
      </div>

      <Composer 
        inputText={inputText}
        setInputText={setInputText}
        handleRun={handleRun}
        isLoading={isLoading}
        activeMenu={activeMenu}
        isRecording={isRecording}
        toggleRecording={toggleRecording}
      />
    </main>
  );
};
