import React from 'react';
import { History, MessageSquare, Play, Trash2, Calendar } from 'lucide-react';
import { db, doc, setDoc, auth } from '../../../../src/lib/firebase';

export const HistoryDashboardView = ({ globalState, setGlobalState, setActiveMenu }) => {
  const pastSessions = globalState?.pastSessions || [];

  const handleResumeSession = (session) => {
    // Switch active session
    const newState = {
      ...globalState,
      currentSessionId: session.id,
      playgroundMessages: session.messages
    };
    
    setGlobalState(newState);
    
    if (auth.currentUser) {
      setDoc(doc(db, 'users', auth.currentUser.uid), { 
        currentSessionId: session.id,
        playgroundMessages: session.messages
      }, { merge: true }).catch(e => console.error(e));
    }
    
    setActiveMenu('playground');
  };

  const handleDeleteSession = (sessionId) => {
    if (!confirm('Are you sure you want to delete this chat session?')) return;
    
    const newSessions = pastSessions.filter(s => s.id !== sessionId);
    
    // If the active session is deleted, start fresh
    let newPlaygroundMessages = globalState.playgroundMessages;
    let newCurrentSessionId = globalState.currentSessionId;
    
    if (globalState.currentSessionId === sessionId) {
      newPlaygroundMessages = [];
      newCurrentSessionId = null;
    }
    
    const newState = {
      ...globalState,
      pastSessions: newSessions,
      playgroundMessages: newPlaygroundMessages,
      currentSessionId: newCurrentSessionId
    };
    
    setGlobalState(newState);
    
    if (auth.currentUser) {
      setDoc(doc(db, 'users', auth.currentUser.uid), { 
        pastSessions: newSessions,
        playgroundMessages: newPlaygroundMessages,
        currentSessionId: newCurrentSessionId
      }, { merge: true }).catch(e => console.error(e));
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg overflow-hidden relative">
       <div className="absolute top-0 right-0 w-[800px] h-[400px] bg-accent/5 blur-[140px] rounded-full pointer-events-none"></div>
       
       <div className="flex-1 flex flex-col min-h-0 max-w-[960px] mx-auto w-full relative z-10 px-6 lg:px-12 pt-12 pb-0">
         
         {/* Header */}
         <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 shrink-0">
           <div>
             <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-panel to-bg shadow-lg ring-1 ring-white/10 mb-6">
                <History className="w-7 h-7 text-text-primary drop-shadow-sm" />
             </div>
             <h1 className="text-3xl font-semibold tracking-tight mb-3 text-text-primary">Chat History</h1>
             <p className="text-[15px] text-text-muted leading-relaxed max-w-2xl">
               Review and resume your previous interactions with FloatGPT. Up to 10 of your most recent sessions are automatically saved here.
             </p>
           </div>
         </div>
         
         {/* Sessions List */}
         <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar pr-4">
           {pastSessions.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-text-muted">
               <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
               <p className="text-[14px]">No past chat sessions found.</p>
               <button 
                 onClick={() => setActiveMenu('playground')}
                 className="mt-6 px-6 py-2.5 bg-accent/10 text-accent font-mono font-bold text-xs rounded-xl hover:bg-accent/20 transition-all border border-accent/30"
               >
                 START NEW CHAT
               </button>
             </div>
           ) : (
             <div className="flex flex-col gap-4">
               {pastSessions.map((session, idx) => (
                 <div key={session.id} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-panel border border-white/5 hover:border-white/10 transition-all shadow-sm">
                   <div className="flex items-center gap-4 min-w-0">
                     <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                       <MessageSquare className="w-5 h-5 text-accent" />
                     </div>
                     <div className="flex flex-col min-w-0">
                       <h3 className="text-white font-medium text-[15px] truncate max-w-[400px]">
                         {session.title || 'New Chat'}
                       </h3>
                       <div className="flex items-center gap-2 mt-1 text-text-muted text-[12px] font-mono">
                         <Calendar className="w-3.5 h-3.5" />
                         {new Date(session.updatedAt).toLocaleString()}
                         <span className="mx-2 opacity-50">•</span>
                         <span>{session.messages?.length || 0} messages</span>
                       </div>
                     </div>
                   </div>
                   
                   <div className="flex items-center gap-2 shrink-0">
                     <button
                       onClick={() => handleResumeSession(session)}
                       className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-accent hover:text-white rounded-lg text-xs font-bold text-text-primary transition-all border border-white/5 hover:border-accent"
                     >
                       <Play className="w-3.5 h-3.5" />
                       RESUME
                     </button>
                     <button
                       onClick={() => handleDeleteSession(session.id)}
                       className="p-2 rounded-lg bg-transparent hover:bg-danger/10 text-text-muted hover:text-danger border border-transparent transition-all"
                       title="Delete Session"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </div>
       </div>
    </div>
  );
};
