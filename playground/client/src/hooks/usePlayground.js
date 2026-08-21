import { useState } from 'react';
import { db, doc, setDoc, auth } from '../../../../src/lib/firebase';

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
      const response = await fetch(`${API_URL}/api/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage.content,
          state: tempState,
          isPlayground: true,
          workspaceMemory: tempState.workspaceMemory
        })
      });
      const data = await response.json();
      
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
      const errorMessage = {
        id: Math.random().toString(36).substring(2, 9), 
        role: 'assistant', 
        content: "Error: Failed to connect to the intelligence engine. Is the backend server running?", 
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
