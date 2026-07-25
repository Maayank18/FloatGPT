import { useState } from 'react';

export const useVoiceDictation = (setInputText) => {
  const [isRecording, setIsRecording] = useState(false);

  const toggleRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    
    if (isRecording) {
      setIsRecording(false);
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      
      recognition.onstart = () => setIsRecording(true);
      
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results).map(result => result[0].transcript).join('');
        setInputText(prev => prev + (prev ? " " : "") + transcript);
      };
      
      recognition.onerror = (event) => {
        console.error("Speech error", event.error);
        alert(`Microphone Error: ${event.error}. Please ensure microphone permissions are granted.`);
        setIsRecording(false);
      };
      
      recognition.onend = () => setIsRecording(false);
      
      recognition.start();
    }
  };

  return {
    isRecording,
    toggleRecording
  };
};
