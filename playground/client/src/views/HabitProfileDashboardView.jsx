import React from 'react';
import { Fingerprint, Zap, BrainCircuit, Target } from 'lucide-react';

export const HabitProfileDashboardView = ({ globalState }) => {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg overflow-hidden relative">
       <div className="absolute top-0 right-0 w-[800px] h-[400px] bg-accent/5 blur-[140px] rounded-full pointer-events-none"></div>
       
       <div className="flex-1 flex flex-col max-w-[960px] mx-auto w-full relative z-10 px-6 lg:px-12 pt-12 pb-0 h-full overflow-hidden">
         
         {/* Header */}
         <div className="mb-10 flex flex-col md:flex-row justify-between items-start gap-6 shrink-0">
           <div>
             <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-panel to-bg shadow-lg ring-1 ring-white/10 mb-6">
                <Fingerprint className="w-7 h-7 text-accent drop-shadow-sm" />
             </div>
             <h1 className="text-3xl font-semibold tracking-tight mb-3 text-text-primary">Habit Profile</h1>
             <p className="text-[15px] text-text-muted leading-relaxed max-w-xl">
               Your personalized behavioral analysis. FloatGPT tracks your execution trends to help you understand your peak performance zones.
             </p>
           </div>
           <div className="bg-panel/80 backdrop-blur-md border border-white/5 rounded-2xl p-5 flex flex-col items-end shadow-sm">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-[0.15em] mb-1.5">Behavioral Archetype</span>
              <div className="flex items-center gap-2.5 text-text-muted mt-1 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                 <Zap className="w-4 h-4 text-amber-500 drop-shadow-md" />
                 <span className="text-[15px] font-bold text-text-primary tracking-wide">{globalState?.habitProfile?.archetype || "The Sprint Executor"}</span>
              </div>
              <p className="text-[11px] text-text-muted/60 mt-3 text-right max-w-[200px] font-medium tracking-wide">Analyzed from {globalState?.tasks?.length || 0} tasks and {globalState?.workspaceMemory?.recentSummaries?.length || 0} chat sessions.</p>
           </div>
         </div>
         
         {/* Content Area */}
         <div className="flex-1 overflow-y-auto pb-16 hide-scrollbar pr-2 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {(() => {
               // Live Habit Profile Computation
               const tasks = globalState?.tasks || [];
               const completedTasks = tasks.filter((t) => t.status === 'Completed' && t.completedAt);
               const now = Date.now();
               
               let peakFocus = globalState?.habitProfile?.focusWindow;
               let prefSession = globalState?.habitProfile?.preferredSession;
               let activeHours = globalState?.habitProfile?.activeHours;
               let delayRisk = globalState?.habitProfile?.delayRisk;

               if (!peakFocus || peakFocus === "Unknown") {
                  if (completedTasks.length > 0) {
                     const hours = completedTasks.map(t => new Date(t.completedAt).getHours());
                     const avgHour = Math.round(hours.reduce((a,b)=>a+b, 0) / hours.length);
                     if (avgHour >= 5 && avgHour < 12) { peakFocus = "Morning"; prefSession = "Early Day"; }
                     else if (avgHour >= 12 && avgHour < 17) { peakFocus = "Afternoon"; prefSession = "Mid Day"; }
                     else if (avgHour >= 17 && avgHour < 22) { peakFocus = "Evening"; prefSession = "Late Day"; }
                     else { peakFocus = "Night"; prefSession = "Late Night"; }
                     
                     const minHour = Math.min(...hours);
                     const maxHour = Math.max(...hours);
                     activeHours = `${minHour}:00 - ${maxHour}:00`;
                  } else if (globalState?.workspaceMemory?.recentSummaries?.length > 0) {
                     peakFocus = "Conversational";
                     prefSession = "Ideation Mode";
                     activeHours = "Active in chats";
                  } else {
                     peakFocus = "Not enough data";
                     prefSession = "Not enough data";
                     activeHours = "Not enough data";
                  }
               }

               if (!delayRisk || delayRisk === "Unknown") {
                  const overdueTasks = tasks.filter((t) => t.deadlineAt && t.deadlineAt < now && t.status !== 'Completed');
                  if (overdueTasks.length > 0) {
                     const categories = overdueTasks.map((t) => t.title.split(' ')[0]);
                     const mostCommon = categories.sort((a,b) => categories.filter(v => v===a).length - categories.filter(v => v===b).length).pop();
                     delayRisk = `High risk of delaying tasks related to "${mostCommon}".`;
                  } else {
                     delayRisk = "No major risks identified yet.";
                  }
               }

               return (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
                   <div className="bg-panel border border-white/5 hover:border-white/10 transition-colors rounded-2xl p-7 shadow-sm">
                     <h3 className="text-[12px] font-bold text-text-muted uppercase tracking-[0.15em] mb-6 border-b border-card-border/30 pb-3 flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-text-primary" /> Cognitive Load Mapping</h3>
                     <div className="space-y-6">
                       <div className="flex items-center justify-between group">
                         <span className="text-[12px] font-medium text-text-muted uppercase tracking-wider group-hover:text-text-primary transition-colors">Peak Focus Window</span>
                         <span className="text-[15px] font-medium text-text-primary">{peakFocus}</span>
                       </div>
                       <div className="flex items-center justify-between group">
                         <span className="text-[12px] font-medium text-text-muted uppercase tracking-wider group-hover:text-text-primary transition-colors">Preferred Work Session</span>
                         <span className="text-[15px] font-medium text-text-primary">{prefSession}</span>
                       </div>
                       <div className="flex items-center justify-between group">
                         <span className="text-[12px] font-medium text-text-muted uppercase tracking-wider group-hover:text-text-primary transition-colors">Active Hours</span>
                         <span className="text-[15px] font-medium text-text-primary bg-white/5 px-2 py-1 rounded-md font-mono">{activeHours}</span>
                       </div>
                     </div>
                   </div>
                   
                   <div className="bg-panel border border-white/5 hover:border-white/10 transition-colors rounded-2xl p-7 shadow-sm relative overflow-hidden group">
                     <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                       <Target className="w-40 h-40 text-danger" />
                     </div>
                     <h3 className="text-[12px] font-bold text-text-muted uppercase tracking-[0.15em] mb-6 border-b border-card-border/30 pb-3 flex items-center gap-2"><Target className="w-4 h-4 text-danger drop-shadow-md" /> Procrastination Hotspots</h3>
                     <div className="space-y-4 relative z-10">
                       <div>
                         <span className="text-[11px] font-bold text-danger uppercase tracking-[0.15em] block mb-3 bg-danger/10 w-fit px-2.5 py-1 rounded-lg border border-danger/20">Identified Delay Risks</span>
                         <p className="text-[15px] text-text-primary leading-relaxed bg-bg p-4 rounded-xl border border-white/5">{delayRisk}</p>
                       </div>
                     </div>
                   </div>
                 </div>
               );
            })()}
          </div>
       </div>
    </div>
  );
};
