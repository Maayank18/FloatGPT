import React from 'react';
import { Plus, Mic } from 'lucide-react';

export const Composer = ({ 
  inputText, 
  setInputText, 
  handleRun, 
  isLoading, 
  activeMenu, 
  isRecording, 
  toggleRecording 
}) => {
  return (
    <div className="px-4 lg:px-24 pb-12 pt-4 bg-gradient-to-t from-bg via-bg to-transparent relative z-10 shrink-0">
       <div className="max-w-[760px] mx-auto relative">
         {/* Glowing Background Ring */}
         <div className="absolute inset-0 bg-accent/20 blur-xl rounded-[28px] opacity-0 focus-within:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
         
         <div className="bg-panel/90 backdrop-blur-md rounded-[24px] flex flex-col focus-within:ring-1 focus-within:ring-accent/50 border border-white/10 transition-all duration-300 relative shadow-xl">
            <textarea 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { 
                if (e.key === 'Enter' && !e.shiftKey) { 
                  e.preventDefault(); 
                  handleRun(); 
                } 
              }}
              className="w-full bg-transparent text-text-primary placeholder:text-text-muted text-[15px] resize-none focus:outline-none min-h-[56px] py-4 px-5 custom-scrollbar leading-relaxed"
              rows={1}
              placeholder={activeMenu === 'history' ? "Search execution history..." : "Ask FloatGPT to execute or press / for commands..."}
            />
            <div className="flex items-center justify-between px-3 pb-3 pt-1">
              <div className="flex items-center gap-1.5 text-text-muted">
                <label title="Upload Context (PDF, Image, Text)" className="p-2 rounded-xl hover:bg-white/10 hover:text-white transition-all group cursor-pointer border border-transparent hover:border-white/5">
                  <input type="file" className="hidden" accept=".pdf,image/*,text/*" onChange={async (e) => {
                     if (e.target.files && e.target.files[0]) {
                       // Note: IngestionService will need to be imported or passed down in a real implementation
                       // await IngestionService.ingestFile(e.target.files[0]);
                       setInputText(prev => prev + `\n[Reference Added: ${e.target.files[0].name}]`);
                     }
                  }} />
                  <Plus className="w-[18px] h-[18px] group-hover:scale-110 group-hover:text-accent transition-all" />
                </label>
                <button onClick={toggleRecording} className={`p-2 rounded-xl transition-all group border border-transparent ${isRecording ? 'text-red-400 bg-red-400/10 border-red-400/20 shadow-[0_0_10px_rgba(248,113,113,0.2)]' : 'text-text-muted hover:bg-white/10 hover:text-white hover:border-white/5'}`} title="Voice Dictation">
                  <Mic className="w-[18px] h-[18px] group-hover:scale-110 transition-all" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleRun}
                  disabled={!inputText.trim() || isLoading}
                  className={`w-[36px] h-[36px] rounded-full flex items-center justify-center transition-all ${!inputText.trim() || isLoading ? 'bg-white/5 text-text-muted/50' : 'bg-white text-black hover:scale-105 hover:shadow-[0_0_15px_rgba(255,255,255,0.4)]'}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>
              </div>
            </div>
         </div>
         
         <div className="text-center mt-3">
           <p className="text-[10px] text-text-muted/50 tracking-wide font-medium">FloatGPT may produce inaccurate information about people, places, or facts.</p>
         </div>
       </div>
    </div>
  );
};
