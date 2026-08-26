import { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceService } from '../../../../src/lib/voiceService';

export const useVoiceDictation = (setInputText, globalState, currentInputText = '') => {
  const [isRecording, setIsRecording] = useState(false);
  const voiceServiceRef = useRef(null);
  const prevInputRef = useRef('');

  const groqKey = globalState?.settings?.aiConfig?.apiKeys?.groq || globalState?.settings?.aiConfig?.apiKeys?.openai || '';

  useEffect(() => {
    voiceServiceRef.current = new VoiceService({
      apiKey: groqKey,
      provider: 'groq',
      onInterimResult: (text) => {
        if (text) {
          const base = prevInputRef.current ? prevInputRef.current.trim() + ' ' : '';
          setInputText(base + text);
        }
      },
      onFinalResult: (text) => {
        if (text) {
          const base = prevInputRef.current ? prevInputRef.current.trim() + ' ' : '';
          setInputText(base + text);
        }
      },
      onStateChange: (recording) => {
        setIsRecording(recording);
      },
      onError: (err) => {
        console.warn('[Playground Voice]', err);
        setIsRecording(false);
      }
    });

    return () => {
      if (voiceServiceRef.current) {
        voiceServiceRef.current.stop();
      }
    };
  }, [groqKey, setInputText]);

  const toggleRecording = useCallback(async () => {
    if (!voiceServiceRef.current) return;

    if (isRecording) {
      const result = await voiceServiceRef.current.stop();
      if (result) {
        const base = prevInputRef.current ? prevInputRef.current.trim() + ' ' : '';
        setInputText(base + result);
      }
    } else {
      prevInputRef.current = typeof currentInputText === 'string' ? currentInputText : '';
      await voiceServiceRef.current.start();
    }
  }, [isRecording, setInputText, currentInputText]);

  return {
    isRecording,
    toggleRecording
  };
};
