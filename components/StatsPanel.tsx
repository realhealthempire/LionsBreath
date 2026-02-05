
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SessionResult, JournalEntry, AppGoals } from '../types';

interface StatsPanelProps {
  sessions: SessionResult[];
  onUpdateNotes?: (sessionId: string, notes: string) => void;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ sessions, onUpdateNotes }) => {
  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'JOURNAL' | 'GOALS'>('ANALYTICS');
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [goals, setGoals] = useState<AppGoals>({ breathHoldSeconds: 120 });
  const [newEntry, setNewEntry] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState("");

  useEffect(() => {
    const savedJournal = localStorage.getItem('lionsbreath_journal');
    if (savedJournal) setJournalEntries(JSON.parse(savedJournal));
    const savedGoals = localStorage.getItem('lionsbreath_goals');
    if (savedGoals) setGoals(JSON.parse(savedGoals));
  }, []);

  const saveJournal = (entries: JournalEntry[]) => {
    setJournalEntries(entries);
    localStorage.setItem('lionsbreath_journal', JSON.stringify(entries));
  };

  const saveGoals = (newGoals: AppGoals) => {
    setGoals(newGoals);
    localStorage.setItem('lionsbreath_goals', JSON.stringify(newGoals));
  };

  const addJournalEntry = () => {
    if (!newEntry.trim()) return;
    const entry: JournalEntry = {
      id: Math.random().toString(36).substr(2, 9),
      date: Date.now(),
      content: newEntry
    };
    saveJournal([entry, ...journalEntries]);
    setNewEntry("");
  };

  const sortedSessions = [...sessions].sort((a, b) => a.date - b.date).slice(-10);
  const chartData = sortedSessions.map((s, idx) => ({
    name: `Sess ${idx + 1}`,
    avg: s.avgHoldTime || 0,
    max: s.maxHoldTime || 0,
  }));

  const allHoldTimes = sessions.flatMap(s => s.holdTimes);
  const longestEver = allHoldTimes.length > 0 ? Math.max(...allHoldTimes) : 0;

  const handleEditSessionNotes = (session: SessionResult) => {
    setEditingId(session.id);
    setTempNotes(session.notes || "");
  };

  const handleSaveSessionNotes = (sessionId: string) => {
    onUpdateNotes?.(sessionId, tempNotes);
    setEditingId(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Tab Navigation - Polished Metallic Blue */}
      <div className="flex gap-2 p-1.5 bg-blue-950/40 rounded-3xl border border-blue-500/20 shadow-2xl">
        {(['ANALYTICS', 'JOURNAL', 'GOALS'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all duration-500 ${
              activeTab === tab 
                ? 'bg-blue-metallic text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] scale-[1.01]' 
                : 'text-blue-400/30 hover:text-blue-400/60'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-10 glass rounded-[2.5rem] border-blue-500/10 flex flex-col items-center justify-center metallic-shine shadow-2xl">
              <span className="text-[8px] font-black text-blue-400/40 uppercase mb-3 tracking-[0.2em]">Personal Best</span>
              <span className="text-4xl font-black text-blue-metallic drop-shadow-xl">{longestEver}s</span>
            </div>
            <div className="p-10 glass rounded-[2.5rem] border-blue-500/10 flex flex-col items-center justify-center metallic-shine shadow-2xl">
              <span className="text-[8px] font-black text-blue-400/40 uppercase mb-3 tracking-[0.2em]">Goal Capacity</span>
              <span className="text-4xl font-black text-blue-metallic drop-shadow-xl">{Math.round((longestEver / goals.breathHoldSeconds) * 100)}%</span>
            </div>
            <div className="p-10 glass rounded-[2.5rem] border-blue-500/10 flex flex-col items-center justify-center metallic-shine shadow-2xl">
              <span className="text-[8px] font-black text-blue-400/40 uppercase mb-3 tracking-[0.2em]">Total Presence</span>
              <span className="text-4xl font-black text-blue-metallic drop-shadow-xl">{sessions.length}</span>
            </div>
          </div>

          <div className="p-10 glass rounded-[3rem] border-blue-500/10 shadow-2xl">
            <h3 className="text-[10px] font-black mb-10 text-blue-metallic uppercase tracking-[0.4em]">Retention Performance History</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(59,130,246,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#60a5fa" fontSize={9} tick={{fontWeight: 900}} />
                  <YAxis stroke="#60a5fa" fontSize={9} tick={{fontWeight: 900}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '20px', fontSize: '11px', boxShadow: '0 15px 50px rgba(0,0,0,0.9)' }}
                    itemStyle={{ color: '#60a5fa', fontWeight: 900 }}
                    cursor={{fill: 'rgba(59,130,246,0.08)'}}
                  />
                  <Bar dataKey="max" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#93C5FD" />
                      <stop offset="50%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#1E40AF" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'JOURNAL' && (
        <div className="space-y-16 pb-12">
          {/* Personal Journal Section */}
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h3 className="text-gold text-[12px] md:text-sm font-black uppercase tracking-[0.6em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                Your story begins here...
              </h3>
              <div className="h-px w-24 bg-gold-metallic mx-auto opacity-30"></div>
            </div>
            
            <div className="space-y-4">
              <div className="glass rounded-[3rem] p-10 border-blue-500/10 space-y-6 shadow-2xl relative overflow-hidden metallic-shine">
                <textarea
                  value={newEntry}
                  onChange={(e) => setNewEntry(e.target.value)}
                  placeholder="Record your mindset, physiological state, and progress..."
                  className="w-full bg-blue-950/20 border border-blue-500/20 rounded-[2rem] p-8 text-[14px] text-blue-100 font-medium min-h-[200px] focus:outline-none focus:border-blue-500/60 transition-all shadow-inner placeholder:text-blue-400/20 leading-relaxed"
                />
                <div className="flex justify-end">
                  <button onClick={addJournalEntry} className="px-16 py-5 bg-blue-metallic text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] hover:scale-105 active:scale-95 transition-all shadow-2xl">Log Entry</button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {journalEntries.map(entry => (
                  <div key={entry.id} className="p-10 glass rounded-[2.5rem] border-blue-500/10 hover:bg-blue-500/5 transition-all group metallic-shine shadow-xl">
                    <span className="text-[8px] text-blue-400/60 block mb-6 font-black tracking-[0.3em] uppercase border-l-4 border-blue-500/40 pl-4">{new Date(entry.date).toLocaleString()}</span>
                    <p className="text-[14px] text-gray-200 font-medium leading-loose whitespace-pre-wrap">{entry.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Breathwork Journal Section */}
          <div className="space-y-8">
            <h3 className="text-[11px] font-black text-blue-metallic uppercase tracking-[0.5em] text-center">Neural Protocol Reflection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...sessions].reverse().map(session => (
                <div key={session.id} className="p-10 glass rounded-[2.5rem] border-blue-500/10 space-y-6 hover:bg-blue-500/5 transition-all group metallic-shine shadow-xl">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <span className="text-[12px] font-black text-white uppercase tracking-[0.3em] block drop-shadow-md">{session.mode.replace('_', ' ')}</span>
                      <span className="text-[9px] text-blue-400/50 font-black tracking-widest uppercase">{new Date(session.date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-right">
                       <span className="text-[11px] font-black text-blue-metallic drop-shadow-md">{session.maxHoldTime || 0}s Capacity</span>
                    </div>
                  </div>
                  {editingId === session.id ? (
                    <div className="space-y-4">
                      <textarea 
                        className="w-full bg-blue-950/20 border border-blue-500/30 rounded-2xl p-6 text-[12px] text-blue-100 font-medium min-h-[120px] focus:outline-none focus:border-blue-500/60 shadow-inner"
                        value={tempNotes}
                        onChange={(e) => setTempNotes(e.target.value)}
                      />
                      <div className="flex justify-end gap-4">
                         <button onClick={() => setEditingId(null)} className="px-5 py-2 text-[10px] text-gray-500 uppercase font-black tracking-widest hover:text-white transition-colors">Cancel</button>
                         <button onClick={() => handleSaveSessionNotes(session.id)} className="px-10 py-3 bg-blue-metallic text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] shadow-lg">Update</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <p className="text-[13px] text-gray-400 font-medium italic leading-relaxed bg-black/30 p-6 rounded-3xl border border-white/5 shadow-inner">
                        {session.notes || "Quiet observation. No reflections recorded."}
                      </p>
                      <button onClick={() => handleEditSessionNotes(session)} className="text-[10px] text-blue-400/40 group-hover:text-blue-400 uppercase tracking-[0.3em] font-black transition-colors flex items-center gap-3">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        Edit Observations
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'GOALS' && (
        <div className="max-w-xl mx-auto space-y-12 py-16">
          <div className="text-center space-y-3">
            <h3 className="text-lg font-black text-blue-metallic uppercase tracking-[0.5em] drop-shadow-lg">Biological Thresholds</h3>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Optimization Control Panel</p>
          </div>
          
          <div className="glass p-12 rounded-[4rem] border-blue-500/10 space-y-10 shadow-2xl relative metallic-shine">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-blue-metallic rounded-3xl flex items-center justify-center shadow-2xl">
               <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            
            <div className="space-y-8 pt-6">
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-black text-blue-300 uppercase tracking-[0.3em]">Retention Target</span>
                <span className="text-5xl font-black text-blue-metallic drop-shadow-2xl">{goals.breathHoldSeconds}s</span>
              </div>
              <input 
                type="range" 
                min="30" 
                max="600" 
                step="5"
                value={goals.breathHoldSeconds} 
                onChange={(e) => saveGoals({...goals, breathHoldSeconds: parseInt(e.target.value)})}
                className="w-full h-3 bg-blue-950/60 rounded-xl appearance-none cursor-pointer accent-blue-500 shadow-inner"
              />
            </div>
            
            <div className="pt-10 border-t border-blue-500/10 flex justify-between items-center px-4">
                <div className="text-center space-y-1">
                  <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Peak Recorded</div>
                  <div className="text-lg font-black text-blue-400 drop-shadow-sm">{longestEver}s</div>
                </div>
                <div className="text-center space-y-1">
                  <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Efficiency Gap</div>
                  <div className="text-lg font-black text-gold uppercase drop-shadow-sm">{Math.max(0, goals.breathHoldSeconds - longestEver)}s</div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
