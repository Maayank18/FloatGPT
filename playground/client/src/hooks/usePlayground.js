import { useState } from 'react';
import { db, doc, setDoc, auth } from '../../../../src/lib/firebase';
import { generateAIResponse } from '../../../../src/lib/ai';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const usePlayground = (globalState, setGlobalState) => {
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRun = async () => {
    if (!inputText.trim() || isLoading) return;
    
    const userMessage = { 
      id: Math.random().toString(36).substring(2, 9), 
      role: 'user', 
      content: inputText, 
      timestamp: Date.now() 
    };
    
    let isNewSession = false;
    let sessionId = globalState?.currentSessionId;
    
    if (!sessionId) {
      isNewSession = true;
      sessionId = `sess_${Math.random().toString(36).substring(2, 9)}`;
    }

    const updatedMessages = [...(globalState?.playgroundMessages || []), userMessage];
    const tempState = { 
      ...globalState, 
      playgroundMessages: updatedMessages,
      currentSessionId: sessionId
    };
    setGlobalState(tempState);
    setInputText("");
    setIsLoading(true);

    const updateSessionStorage = (messages, isError = false) => {
      const pastSessions = [...(tempState.pastSessions || [])];
      let sessionIndex = pastSessions.findIndex(s => s.id === sessionId);
      
      if (sessionIndex === -1) {
        // Create new session
        const title = messages[0]?.content?.substring(0, 40) + (messages[0]?.content?.length > 40 ? '...' : '') || 'New Chat';
        pastSessions.unshift({
          id: sessionId,
          title,
          updatedAt: Date.now(),
          messages: messages
        });
      } else {
        // Update existing
        pastSessions[sessionIndex] = {
          ...pastSessions[sessionIndex],
          updatedAt: Date.now(),
          messages: messages
        };
        // Move to top
        const [movedSession] = pastSessions.splice(sessionIndex, 1);
        pastSessions.unshift(movedSession);
      }

      // Limit to 10
      const trimmedSessions = pastSessions.slice(0, 10);
      
      const newState = { 
        ...tempState, 
        playgroundMessages: messages,
        pastSessions: trimmedSessions,
        currentSessionId: sessionId
      };
      
      setGlobalState(newState);
      if (auth.currentUser) {
        setDoc(doc(db, 'users', auth.currentUser.uid), { 
          playgroundMessages: messages,
          pastSessions: trimmedSessions,
          currentSessionId: sessionId
        }, { merge: true }).catch(e => console.error(e));
      }
    };

    try {
      // 1. Try local node backend if reachable
      let data = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(`${API_URL}/api/intelligence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userMessage.content,
            state: tempState,
            isPlayground: true,
            workspaceMemory: tempState.workspaceMemory
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          data = await response.json();
        }
      } catch (serverErr) {
        // Backend not running on localhost (e.g. hosted on Vercel) -> Fallback directly to client AI
      }

      // 2. Direct client-side AI Execution fallback
      if (!data) {
        const aiRes = await generateAIResponse(
          tempState,
          userMessage.content,
          undefined,
          undefined,
          { isPlayground: true, workspaceMemory: tempState.workspaceMemory }
        );
        data = {
          message: aiRes.message,
          newGoals: aiRes.newGoals,
          newProjects: aiRes.newProjects,
          newTasks: aiRes.newTasks,
          updatedTaskIds: aiRes.updatedTaskIds
        };
      }
      
      const aiMessage = { 
        id: Math.random().toString(36).substring(2, 9), 
        role: 'assistant', 
        content: data.error || data.message || "An unexpected error occurred. No message received.", 
        data: data,
        timestamp: Date.now() 
      };
      
      updateSessionStorage([...updatedMessages, aiMessage], false);
      
    } catch (err) {
      console.error("Playground error:", err);
      const activeProv = tempState?.settings?.aiConfig?.selectedProvider || 'groq';
      const errorMessage = {
        id: Math.random().toString(36).substring(2, 9), 
        role: 'assistant', 
        content: err.message?.includes('API key') || err.message?.includes('Authentication') || err.message?.includes('401')
          ? `⚠️ **AI Authentication Error (${activeProv.toUpperCase()})**\n\nYour API key was rejected or missing. Please configure or verify your API key in the **API_KEYS** tab above or in the Desktop Orb Settings.`
          : `⚠️ ${err.message || "Failed to generate AI response. Please check your API key and internet connection."}`, 
        timestamp: Date.now() 
      };
      updateSessionStorage([...updatedMessages, errorMessage], true);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewSession = () => {
    const newState = {
      ...globalState,
      playgroundMessages: [],
      currentSessionId: null
    };
    setGlobalState(newState);
    if (auth.currentUser) {
      setDoc(doc(db, 'users', auth.currentUser.uid), { 
        playgroundMessages: [],
        currentSessionId: null
      }, { merge: true }).catch(e => console.error(e));
    }
  };

  return {
    inputText,
    setInputText,
    isLoading,
    handleRun,
    startNewSession
  };
};
