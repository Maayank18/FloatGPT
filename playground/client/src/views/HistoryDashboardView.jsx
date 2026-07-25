import React, { useState } from 'react';
import { History, Sparkles, Library, CheckCircle2, Activity, Target, Coffee, Clock, Trash2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export const HistoryDashboardView = ({ globalState }) => {
  const [activeTab, setActiveTab] = useState('chat');
  const recentSummaries = globalState?.workspaceMemory?.recentSummaries || [];

  const handleDeleteSummary = (summaryId) => {
    if (!confirm('Are you sure you want to delete this summary from your shared memory?')) return;
    import('../../../../src/lib/firebase').then(({ db, doc, setDoc, auth }) => {
      if (auth.currentUser && globalState?.workspaceMemory) {
        const newSummaries = recentSummaries.filter(s => s.id !== summaryId);
        setDoc(doc(db, 'workspaces', auth.currentUser.uid), { recentSummaries: newSummaries }, { merge: true });
      }
    });
  };

    return (
      <div className="flex-1 flex flex-col min-w-0 bg-bg overflow-hidden relative">
         <div className="absolute top-0 right-0 w-[800px] h-[400px] bg-accent/5 blur-[140px] rounded-full pointer-events-none"></div>
         
         <div className="flex-1 flex flex-col max-w-[960px] mx-auto w-full relative z-10 px-6 lg:px-12 pt-12 pb-0">
           
           {/* Header */}
           <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 shrink-0">
             <div>
               <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-panel to-bg shadow-lg ring-1 ring-white/10 mb-6">
                  <History className="w-7 h-7 text-text-primary drop-shadow-sm" />
               </div>
               <h1 className="text-3xl font-semibold tracking-tight mb-3 text-text-primary">History & Analytics</h1>
               <p className="text-[15px] text-text-muted leading-relaxed max-w-2xl">
                 Review your past interactions, track completed work, and analyze your productivity behavior.
               </p>
             </div>
           </div>
           
           {/* Sub-navigation */}
           <div className="flex bg-panel/80 p-1.5 rounded-2xl border border-white/5 mb-8 w-fit backdrop-blur-md shadow-sm">
              <button onClick={() => setActiveTab('chat')} className={`px-5 py-2.5 text-[13px] font-semibold tracking-wide rounded-xl transition-all cursor-pointer ${activeTab === 'chat' ? 'bg-panel/90 text-text-primary shadow-sm border border-white/10' : 'text-text-muted hover:text-text-primary hover:bg-white/5 border border-transparent'}`}>
                 Chat Archives
              </button>
              <button onClick={() => setActiveTab('ledger')} className={`px-5 py-2.5 text-[13px] font-semibold tracking-wide rounded-xl transition-all cursor-pointer ${activeTab === 'ledger' ? 'bg-panel/90 text-text-primary shadow-sm border border-white/10' : 'text-text-muted hover:text-text-primary hover:bg-white/5 border border-transparent'}`}>
                 Execution Ledger
              </button>
              <button onClick={() => setActiveTab('analytics')} className={`px-5 py-2.5 text-[13px] font-semibold tracking-wide rounded-xl transition-all cursor-pointer ${activeTab === 'analytics' ? 'bg-panel/90 text-text-primary shadow-sm border border-white/10' : 'text-text-muted hover:text-text-primary hover:bg-white/5 border border-transparent'}`}>
                 Performance Analytics
              </button>
           </div>

           {/* Content Area */}
           <div className="flex-1 overflow-y-auto pb-16 hide-scrollbar">
             {activeTab === 'chat' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {recentSummaries.length === 0 ? (
                    <div className="text-center text-text-muted mt-24 flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                        <Sparkles className="w-8 h-8 opacity-40" />
                      </div>
                      <p className="text-[15px]">No chat summaries available from the Desktop Orb.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-panel border border-card-border/50 rounded-2xl p-6 shadow-sm">
                         <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-[0.15em] mb-6 border-b border-card-border/30 pb-3">Desktop Orb Session Topics</h3>
                         <div className="space-y-4">
                           {recentSummaries.slice().reverse().map((summary, idx) => (
                             <div key={idx} className="flex gap-4 group bg-bg/50 p-4 rounded-xl border border-white/5 items-start">
                               <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-accent/20 to-panel flex items-center justify-center shrink-0 border border-white/10 shadow-sm">
                                 <History className="w-4 h-4 text-accent" />
                               </div>
                               <div className="pt-0.5 text-[14px] text-text-primary leading-relaxed flex-1">
                                 <div className="flex justify-between items-center mb-1">
                                   <h4 className="font-bold text-text-primary text-[15px]">{summary.topic}</h4>
                                   <span className="text-[11px] text-text-muted">{new Date(summary.timestamp).toLocaleString()}</span>
                                 </div>
                                 <p className="text-text-secondary text-[13px]">{summary.summary}</p>
                               <div className="mt-2 text-[10px] uppercase tracking-wider text-text-muted font-bold flex justify-between items-center">
                                 <span>Source: {summary.source}</span>
                                 <button
                                   onClick={() => handleDeleteSummary(summary.id)}
                                   className="text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                   title="Delete summary"
                                 >
                                   <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                               </div>
                             </div>
                           </div>
                           ))}
                         </div>
                      </div>
                    </div>
                  )}
                </div>
             )}

             {activeTab === 'ledger' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {!(globalState?.tasks || []).some((t) => t.status === 'Completed') ? (
                    <div className="text-center text-text-muted mt-24 flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                        <Library className="w-8 h-8 opacity-40" />
                      </div>
                      <p className="text-[15px]">No tasks completed yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(globalState?.tasks || []).filter((t) => t.status === 'Completed').map((task) => (
                         <div key={task.id} className="bg-panel border border-white/5 hover:border-white/10 hover:-translate-y-0.5 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all duration-300 shadow-sm">
                            <div>
                               <h3 className="text-[15px] font-medium text-text-primary line-through opacity-70 mb-1">{task.title}</h3>
                               <p className="text-[13px] text-text-muted">Completed on {new Date(task.completedAt || Date.now()).toLocaleDateString()}</p>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider text-emerald-400 uppercase flex items-center gap-2">
                               <CheckCircle2 className="w-3.5 h-3.5" /> Success
                            </div>
                         </div>
                      ))}
                    </div>
                  )}
                </div>
             )}

             {activeTab === 'analytics' && (() => {
                const tasks = globalState?.tasks || [];
                const completedTasks = tasks.filter((t) => t.status === 'Completed');
                
                // Live Analytics Computation
                const totalCreatedTasks = tasks.length;
                const completionRate = totalCreatedTasks === 0 ? 0 : Math.round((completedTasks.length / totalCreatedTasks) * 100);
                
                let totalDelayMins = 0;
                let accuracyCount = 0;
                let accurateHits = 0;
                const now = Date.now();
                
                tasks.forEach(t => {
                   if (t.deadlineAt) {
                      if (t.status === 'Completed') {
                         accuracyCount++;
                         const completedTime = t.completedAt || now;
                         if (completedTime > t.deadlineAt) {
                            totalDelayMins += Math.floor((completedTime - t.deadlineAt) / 60000);
                         } else {
                            accurateHits++;
                         }
                      } else if (t.status !== 'Archived') {
                         if (now > t.deadlineAt) {
                            totalDelayMins += Math.floor((now - t.deadlineAt) / 60000);
                            accuracyCount++;
                         }
                      }
                   }
                });
                
                const planAccuracy = accuracyCount === 0 ? 100 : Math.round((accurateHits / accuracyCount) * 100);
                const avgDelay = accuracyCount === 0 ? 0 : Math.floor(totalDelayMins / accuracyCount);
                const avgFocusTime = globalState?.executionProfile?.averageFocusDurationMinutes || 0;

                return (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {tasks.length === 0 ? (
                      <div className="text-center text-text-muted mt-24 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                          <Activity className="w-8 h-8 opacity-40" />
                        </div>
                        <p className="text-[15px]">Analytics will populate as you use FloatGPT.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Summary Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="bg-panel border border-white/5 rounded-2xl p-6 text-left hover:border-white/10 transition-colors group relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                               <CheckCircle2 className="w-16 h-16 text-text-primary" />
                             </div>
                             <div className="text-[32px] font-semibold text-text-primary mb-2 tracking-tight">{completionRate}%</div>
                             <div className="text-[12px] text-text-muted font-medium">Completion Rate</div>
                          </div>
                          <div className="bg-panel border border-white/5 rounded-2xl p-6 text-left hover:border-white/10 transition-colors group relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                               <Target className="w-16 h-16 text-accent" />
                             </div>
                             <div className="text-[32px] font-semibold text-accent mb-2 tracking-tight">{planAccuracy}%</div>
                             <div className="text-[12px] text-text-muted font-medium">Plan Accuracy</div>
                          </div>
                          <div className="bg-panel border border-white/5 rounded-2xl p-6 text-left hover:border-white/10 transition-colors group relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                               <Coffee className="w-16 h-16 text-text-primary" />
                             </div>
                             <div className="text-[32px] font-semibold text-text-primary mb-2 tracking-tight">{avgFocusTime}m</div>
                             <div className="text-[12px] text-text-muted font-medium">Avg Focus Time</div>
                          </div>
                          <div className="bg-panel border border-white/5 rounded-2xl p-6 text-left hover:border-white/10 transition-colors group relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                               <Clock className="w-16 h-16 text-amber-500" />
                             </div>
                             <div className="text-[32px] font-semibold text-amber-500 mb-2 tracking-tight">{avgDelay}m</div>
                             <div className="text-[12px] text-text-muted font-medium">Avg Delay</div>
                          </div>
                        </div>

                        {/* Interactive Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                           {/* Velocity Line Chart */}
                           <div className="bg-panel border border-card-border/50 rounded-2xl p-6 shadow-sm">
                              <h3 className="text-[13px] font-semibold text-text-primary mb-6">Task Completion Velocity (Last 7 Days)</h3>
                              <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={[
                                    { day: 'Mon', tasks: 4 }, { day: 'Tue', tasks: 6 }, 
                                    { day: 'Wed', tasks: 3 }, { day: 'Thu', tasks: 8 }, 
                                    { day: 'Fri', tasks: 5 }, { day: 'Sat', tasks: 2 }, 
                                    { day: 'Sun', tasks: 7 }
                                  ]}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="day" stroke="#ffffff40" tick={{ fill: '#ffffff60', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#ffffff40" tick={{ fill: '#ffffff60', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip 
                                      contentStyle={{ backgroundColor: '#1A1D24', border: '1px solid #ffffff10', borderRadius: '12px' }}
                                      itemStyle={{ color: '#E2E8F0' }}
                                    />
                                    <Line type="monotone" dataKey="tasks" stroke="#7C3AED" strokeWidth={3} dot={{ fill: '#7C3AED', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                           </div>

                           {/* Peak Energy Bar Chart */}
                           <div className="bg-panel border border-card-border/50 rounded-2xl p-6 shadow-sm">
                              <h3 className="text-[13px] font-semibold text-text-primary mb-6">Peak Energy Hours</h3>
                              <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={[
                                    { time: '9 AM', energy: 65 }, { time: '12 PM', energy: 85 }, 
                                    { time: '3 PM', energy: 45 }, { time: '6 PM', energy: 90 }, 
                                    { time: '9 PM', energy: 30 }
                                  ]}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="time" stroke="#ffffff40" tick={{ fill: '#ffffff60', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#ffffff40" tick={{ fill: '#ffffff60', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip 
                                      contentStyle={{ backgroundColor: '#1A1D24', border: '1px solid #ffffff10', borderRadius: '12px' }}
                                      itemStyle={{ color: '#E2E8F0' }}
                                      cursor={{ fill: '#ffffff05' }}
                                    />
                                    <Bar dataKey="energy" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
             })()}
           </div>
         </div>
      </div>
    );
};
