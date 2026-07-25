import { useState } from 'react';
import { db, doc, setDoc, auth } from '../../../../src/lib/firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
    
    const updatedMessages = [...(globalState?.playgroundMessages || []), userMessage];
    const tempState = { ...globalState, playgroundMessages: updatedMessages };
    setGlobalState(tempState);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage.content,
          state: tempState,
          isPlayground: true,
          workspaceMemory: tempState.workspaceMemory // If passed or we rely on the backend fetching it, or we just rely on state
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
      
      const finalMessages = [...updatedMessages, aiMessage];
      const newState = { ...tempState, playgroundMessages: finalMessages };
      
      // Update state locally and push to central unified store
      setGlobalState(newState);
      if (auth.currentUser) {
        setDoc(doc(db, 'users', auth.currentUser.uid), { playgroundMessages: finalMessages }, { merge: true })
          .catch(e => console.error(e));
      }
      
    } catch (err) {
      console.error("Playground error:", err);
      
      const errorMessage = {
        id: Math.random().toString(36).substring(2, 9), 
        role: 'assistant', 
        content: "Error: Failed to connect to the intelligence engine. Is the backend server running?", 
        timestamp: Date.now() 
      };
      
      const finalMessages = [...updatedMessages, errorMessage];
      const newState = { ...tempState, playgroundMessages: finalMessages };
      
      setGlobalState(newState);
      if (auth.currentUser) {
        setDoc(doc(db, 'users', auth.currentUser.uid), { playgroundMessages: finalMessages }, { merge: true })
          .catch(e => console.error(e));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    inputText,
    setInputText,
    isLoading,
    handleRun
  };
};
