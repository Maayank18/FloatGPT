import React, { useState } from 'react';
import { Code2, PanelRightClose, ChevronDown, Check } from 'lucide-react';
import { db, doc, setDoc, auth } from '../../../../../src/lib/firebase';

const MODELS = [
  { name: 'GPT OSS 120B', id: 'openai/gpt-oss-120b', provider: 'Groq' },
  { name: 'GPT OSS 20B', id: 'openai/gpt-oss-20b', provider: 'Groq' },
  { name: 'Qwen 3.6 27B', id: 'qwen/qwen3.6-27b', provider: 'Groq' },
  { name: 'Llama 3.3 70B', id: 'llama-3.3-70b-versatile', provider: 'Groq' },
  { name: 'Gemini 2.5 Flash', id: 'gemini-2.5-flash', provider: 'Google' },
  { name: 'Gemini 1.5 Pro', id: 'gemini-1.5-pro', provider: 'Google' },
  { name: 'GPT-4o', id: 'gpt-4o', provider: 'OpenAI' }
];

export const RightPanel = ({ 
  isRightPanelOpen, 
  toggleRightPanel, 
  globalState, 
  setGlobalState
}) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  if (!isRightPanelOpen) return null;

  const aiConfig = globalState?.settings?.aiConfig || {};
  const parameters = aiConfig.parameters || {};
  const features = globalState?.settings?.features || {};

  const activeModelId = aiConfig.selectedModels?.active || MODELS[0].id;
  const activeModel = MODELS.find(m => m.id === activeModelId) || MODELS[0];

  const updateSettings = (section, key, value) => {
    // Perform a deep clone of the settings object to ensure React detects the state change
    const newSettings = JSON.parse(JSON.stringify(globalState?.settings || {}));
    
    if (!newSettings[section]) newSettings[section] = {};
    
    if (section === 'aiConfig') {
       if (!newSettings.aiConfig.parameters) newSettings.aiConfig.parameters = {};
       newSettings.aiConfig.parameters[key] = value;
    } else {
       newSettings[section][key] = value;
    }

    const newState = { ...globalState, settings: newSettings };
    setGlobalState(newState);
    
    if (auth.currentUser) {
      // Only write settings, never the full state (protects transcripts)
      setDoc(doc(db, 'users', auth.currentUser.uid), { settings: newSettings }, { merge: true })
        .catch(e => console.error(e));
    }
  };

  const updateModel = (modelId) => {
    const newSettings = JSON.parse(JSON.stringify(globalState?.settings || {}));
    if (!newSettings.aiConfig) newSettings.aiConfig = {};
    if (!newSettings.aiConfig.selectedModels) newSettings.aiConfig.selectedModels = {};
    
    newSettings.aiConfig.selectedModels.active = modelId;

    const newState = { ...globalState, settings: newSettings };
    setGlobalState(newState);
    
    if (auth.currentUser) {
      // Only write settings, never the full state (protects transcripts)
      setDoc(doc(db, 'users', auth.currentUser.uid), { settings: newSettings }, { merge: true })
        .catch(e => console.error(e));
    }
  };

  return (
    <aside className="w-[320px] border-l border-card-border/30 bg-bg flex flex-col shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-30">
      <div className="h-[72px] flex items-center px-5 justify-between border-b border-card-border/30 shrink-0">
        <h2 className="text-[14px] font-semibold text-text-primary tracking-wide">Run Settings</h2>
        <div className="flex items-center gap-2">
           <button className="flex items-center gap-1.5 text-[12px] font-medium text-text-secondary hover:text-white hover:bg-white/5 px-2.5 py-1.5 rounded-lg transition-colors">
              <Code2 className="w-[14px] h-[14px]" /> Get code
           </button>
           <button 
              onClick={() => toggleRightPanel(false)}
              className="p-2 rounded-xl hover:bg-white/5 text-text-secondary hover:text-white transition-all cursor-pointer group"
              title="Close Settings"
           >
              <PanelRightClose className="w-[16px] h-[16px] group-hover:scale-110 transition-transform" />
           </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8 custom-scrollbar">
         
         {/* Model Selection with Dropdown Logic */}
         <div className="relative">
            <div 
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className={`flex flex-col cursor-pointer group p-4 bg-panel rounded-2xl transition-all border border-white/5 hover:border-accent/30 shadow-sm`}
            >
               <div className="flex items-center justify-between mb-1.5">
                 <h3 className="text-[14px] font-semibold text-text-primary">{activeModel.name}</h3>
                 <ChevronDown className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
               </div>
               <p className="text-[11px] text-accent/80 font-mono mb-3">{activeModel.id}</p>
               <p className="text-[12px] text-text-muted leading-relaxed">
                 Our most intelligent model built for speed, combining frontier intelligence with superior search and grounding.
               </p>
            </div>
            
            {/* Dropdown Menu */}
            {isModelDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-panel border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 py-1.5 backdrop-blur-xl">
                 {MODELS.map(model => (
                   <div 
                     key={model.id}
                     onClick={() => {
                       updateModel(model.id);
                       setIsModelDropdownOpen(false);
                     }}
                     className="px-4 py-3 hover:bg-white/5 cursor-pointer flex items-center justify-between transition-colors"
                   >
                     <div>
                       <div className="text-[13px] font-medium text-text-primary mb-0.5">{model.name}</div>
                       <div className="text-[11px] text-text-muted font-mono">{model.provider}</div>
                     </div>
                     {activeModel.id === model.id && <Check className="w-4 h-4 text-accent" />}
                   </div>
                 ))}
              </div>
            )}
         </div>

         {/* System Instructions */}
         <div>
           <h3 className="text-[13px] font-semibold text-text-primary mb-1.5 tracking-wide">System instructions</h3>
           <p className="text-[12px] text-text-muted mb-3 leading-relaxed">Optional tone and style instructions for the model.</p>
           <div className="bg-panel border border-white/5 rounded-2xl p-4 focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/40 transition-all shadow-sm">
              <textarea 
                className="w-full h-24 bg-transparent text-[13px] text-text-primary resize-none focus:outline-none placeholder:text-text-muted/50 custom-scrollbar leading-relaxed"
                placeholder="Enter custom directives..."
                value={parameters.systemInstruction || ''}
                onChange={(e) => updateSettings('aiConfig', 'systemInstruction', e.target.value)}
              />
           </div>
         </div>

         <div className="h-px w-full bg-gradient-to-r from-transparent via-card-border/50 to-transparent"></div>

         {/* Sliders with real-time state */}
         <div className="space-y-8">
            <div>
              <div className="flex justify-between items-center mb-4">
                 <label className="text-[13px] font-semibold text-text-primary tracking-wide">Temperature</label>
                 <div className="bg-panel border border-white/5 rounded-lg px-2 py-1">
                   <input 
                     type="number" 
                     value={parameters.temperature ?? 1.0}
                     onChange={(e) => updateSettings('aiConfig', 'temperature', parseFloat(e.target.value) || 0)}
                     className="w-12 bg-transparent text-center text-[12px] font-mono text-text-primary focus:outline-none" 
                   />
                 </div>
              </div>
              <input 
                type="range" min="0" max="2" step="0.1" 
                value={parameters.temperature ?? 1.0}
                onChange={(e) => updateSettings('aiConfig', 'temperature', parseFloat(e.target.value))}
                className="w-full accent-accent"
              />
            </div>

            <div>
              <div className="flex justify-between items-center">
                 <label className="text-[13px] font-semibold text-text-primary tracking-wide">Thinking level</label>
                 <select 
                   value={parameters.thinkingLevel || 'High'}
                   onChange={(e) => updateSettings('aiConfig', 'thinkingLevel', e.target.value)}
                   className="bg-panel border border-white/5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer shadow-sm hover:bg-white/5 transition-colors"
                 >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                 </select>
              </div>
            </div>
         </div>

         <hr className="border-card-border" />

         {/* Tools Accordion */}
         <div>
           <div className="flex items-center justify-between mb-4 cursor-pointer group">
             <h3 className="text-[13px] font-medium text-text-primary">Tools</h3>
             <ChevronDown className="w-4 h-4 text-text-muted group-hover:text-text-primary" />
           </div>
           
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                 <span className="text-[13px] text-text-primary">Structured outputs</span>
                 <div className="flex items-center gap-2">
                   <div 
                     onClick={() => updateSettings('features', 'structuredOutputs', !features.structuredOutputs)}
                     className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${features.structuredOutputs ? 'bg-accent' : 'bg-card-border'}`}
                   >
                     <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${features.structuredOutputs ? 'right-0.5' : 'left-0.5 bg-text-muted'}`}></div>
                   </div>
                 </div>
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-[13px] text-text-primary">Code execution</span>
                 <div 
                   onClick={() => updateSettings('features', 'codeExecution', !features.codeExecution)}
                   className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${features.codeExecution ? 'bg-accent' : 'bg-card-border'}`}
                 >
                   <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${features.codeExecution ? 'right-0.5' : 'left-0.5 bg-text-muted'}`}></div>
                 </div>
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-[13px] text-text-primary">Function calling</span>
                 <div className="flex items-center gap-2">
                   <div 
                     onClick={() => updateSettings('features', 'functionCalling', !features.functionCalling)}
                     className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${features.functionCalling ? 'bg-accent' : 'bg-card-border'}`}
                   >
                     <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${features.functionCalling ? 'right-0.5' : 'left-0.5 bg-text-muted'}`}></div>
                   </div>
                 </div>
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-[13px] text-text-primary">Grounding with Habit Data</span>
                 <div 
                   onClick={() => updateSettings('features', 'groundingWithHabitData', !features.groundingWithHabitData)}
                   className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${features.groundingWithHabitData ? 'bg-accent' : 'bg-card-border'}`}
                 >
                   <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${features.groundingWithHabitData ? 'right-0.5' : 'left-0.5 bg-text-muted'}`}></div>
                 </div>
              </div>
           </div>
         </div>

      </div>
    </aside>
  );
};
