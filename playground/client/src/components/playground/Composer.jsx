import React from 'react';
import { Plus, Mic, MicOff } from 'lucide-react';
import { ALL_COMMANDS, COMMAND_GROUPS, COMMAND_SCHEMAS } from '../../../../../src/chat/commandSchemas';

function slashMatches(cmd, typed) {
  if (`/${cmd}`.startsWith(typed)) return true;
  return COMMAND_SCHEMAS[cmd].aliases.some((alias) => `/${alias}`.startsWith(typed));
}

export const Composer = ({ 
  inputText, 
  setInputText, 
  handleRun, 
  isLoading, 
  activeMenu, 
  isRecording, 
  toggleRecording 
}) => {
  const slashQuery = /^\s*\/[^\s]*$/.test(inputText) ? inputText.trim() : '';
  const grouped = new Set(COMMAND_GROUPS.flatMap((group) => group.commands));
  const slashSections = slashQuery
    ? [
        ...COMMAND_GROUPS.map((group) => ({
          label: group.label,
          commands: group.commands.filter((cmd) => slashMatches(cmd, slashQuery)),
        })),
        {
          label: 'More',
          commands: ALL_COMMANDS.filter((cmd) => !grouped.has(cmd) && slashMatches(cmd, slashQuery)),
        },
      ].filter((section) => section.commands.length > 0)
    : [];

  return (
    <div className="px-4 lg:px-24 pb-12 pt-4 bg-gradient-to-t from-bg via-bg to-transparent relative z-10 shrink-0">
       <div className="max-w-[760px] mx-auto relative">
         {/* Glowing Background Ring */}
         <div className="absolute inset-0 bg-accent/20 blur-xl rounded-[28px] opacity-0 focus-within:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
         
         {slashQuery && (
           <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-card-border rounded-xl shadow-2xl shadow-black/80 z-50 overflow-hidden">
             <div className="px-3 py-2 border-b border-card-border flex items-center justify-between">
               <span className="text-[10px] font-semibold tracking-wider uppercase text-text-muted">Commands</span>
               <span className="text-[10px] text-text-muted">Type to filter</span>
             </div>
             <div className="max-h-[min(52vh,340px)] overflow-y-auto custom-scrollbar px-1.5 py-1">
               {slashSections.length === 0 && (
                 <div className="px-2 py-3 text-center text-[11px] text-text-muted">No matching commands.</div>
               )}
               {slashSections.map((section) => (
                 <div key={section.label} className="pb-1">
                   <p className="px-2 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-text-muted">{section.label}</p>
                   {section.commands.map((cmd) => (
                     <button
                       key={cmd}
                       type="button"
                       onClick={() => setInputText(`/${cmd} `)}
                       className="w-full grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-bg-secondary"
                     >
                       <span className="text-[11px] font-semibold text-accent truncate">/{cmd}</span>
                       <span className="text-[11px] text-text-secondary truncate">{COMMAND_SCHEMAS[cmd].description}</span>
                     </button>
                   ))}
                 </div>
               ))}
             </div>
           </div>
         )}
         <div className={`bg-panel/90 backdrop-blur-md rounded-[24px] flex flex-col border transition-all duration-300 relative shadow-xl ${isRecording ? 'border-red-500/50 ring-1 ring-red-500/30' : 'focus-within:ring-1 focus-within:ring-accent/50 border-white/10'}`}>
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
              placeholder={isRecording ? "Listening. Click the mic when you are done." : "Ask FloatGPT, or press / for commands"}
            />
            <div className="flex items-center justify-between px-3 pb-3 pt-1">
              <div className="flex items-center gap-1.5 text-text-muted">
                <label title="Upload Context (PDF, Image, Text)" className="p-2 rounded-xl hover:bg-white/10 hover:text-white transition-all group cursor-pointer border border-transparent hover:border-white/5">
                  <input type="file" className="hidden" accept=".pdf,image/*,text/*" onChange={async (e) => {
                     if (e.target.files && e.target.files[0]) {
                       setInputText(prev => prev + `\n[Reference Added: ${e.target.files[0].name}]`);
                     }
                  }} />
                  <Plus className="w-[18px] h-[18px] group-hover:scale-110 group-hover:text-accent transition-all" />
                </label>
                <button 
                  onClick={toggleRecording} 
                  className={`p-2 rounded-xl transition-all group cursor-pointer border ${isRecording ? 'bg-red-500 text-white border-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'text-text-muted hover:bg-white/10 hover:text-white hover:border-white/5 border-transparent'}`} 
                  title={isRecording ? "Stop Recording (Insert into Box)" : "Voice Dictation (Speak to Type)"}
                >
                  {isRecording ? <MicOff className="w-[18px] h-[18px] text-white" /> : <Mic className="w-[18px] h-[18px] group-hover:scale-110 transition-all" />}
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
