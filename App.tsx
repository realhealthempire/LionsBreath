
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BreathingMode, 
  PowerBreathConfig, 
  BoxConfig, 
  SessionResult, 
  Phase,
  AppGoals
} from './types';
import { 
  DEFAULT_POWER_CONFIG, 
  DEFAULT_BOX_CONFIG, 
  FOUR_SEVEN_EIGHT_CONFIG,
  RECOVERY_HOLD_TIME 
} from './constants';
import { BreathingBubble } from './components/BreathingBubble';
import { StatsPanel } from './components/StatsPanel';

type PowerSpeed = 'QUICK' | 'STANDARD' | 'SLOW';

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const useSpaMusic = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const pulseGainRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);

  const stopMusic = useCallback(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      masterGainRef.current.gain.exponentialRampToValueAtTime(0.001, now + 2);
      setTimeout(() => {
        nodesRef.current.forEach(node => {
          try { (node as any).stop(); } catch(e) {}
          node.disconnect();
        });
        nodesRef.current = [];
        if (audioCtxRef.current) {
          audioCtxRef.current.close();
          audioCtxRef.current = null;
        }
      }, 2100);
    }
  }, []);

  const setPulseFactor = useCallback((factor: number) => {
    if (pulseGainRef.current && audioCtxRef.current) {
      pulseGainRef.current.gain.setTargetAtTime(factor, audioCtxRef.current.currentTime, 0.1);
    }
  }, []);

  const startMusic = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;
      
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 3);
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      const pulseGain = ctx.createGain();
      pulseGain.gain.value = 1.0;
      pulseGain.connect(masterGain);
      pulseGainRef.current = pulseGain;

      const createDrone = (freq: number, vol: number, type: OscillatorType = 'sine') => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        lfo.frequency.value = 0.05 + Math.random() * 0.05;
        lfoG.gain.value = 0.05;
        lfo.connect(lfoG);
        lfoG.connect(g.gain);
        lfo.start();
        
        g.gain.value = vol;
        osc.connect(g);
        g.connect(pulseGain);
        osc.start();
        nodesRef.current.push(osc, lfo);
      };

      createDrone(92.50, 0.2);
      createDrone(116.54, 0.1);
      createDrone(138.59, 0.08);
      createDrone(185.00, 0.05);

      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0, b1, b2, b3, b4, b5, b6;
      b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }
      
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(350, ctx.currentTime);
      
      const noiseLFO = ctx.createOscillator();
      const noiseLFOGain = ctx.createGain();
      noiseLFO.frequency.value = 0.1;
      noiseLFOGain.gain.value = 150;
      noiseLFO.connect(noiseLFOGain);
      noiseLFOGain.connect(noiseFilter.frequency);
      noiseLFO.start();

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(pulseGain);
      noiseSource.start();
      nodesRef.current.push(noiseSource, noiseLFO);

    } catch (e) {
      console.warn("Spa Music Engine failed", e);
    }
  }, []);

  return { startMusic, stopMusic, setPulseFactor };
};

const useAudioGuidance = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Clear queue for immediate feedback
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      utterance.volume = 0.7;
      window.speechSynthesis.speak(utterance);
    }
  };

  const playChime = () => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) {}
  };

  const playBreathSound = (type: 'INHALE' | 'EXHALE', duration: number) => {
    try {
      const ctx = getCtx();
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);

      if (type === 'INHALE') {
        filter.frequency.setValueAtTime(150, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + duration);
        gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + duration * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.03, ctx.currentTime + duration);
      } else {
        filter.frequency.setValueAtTime(700, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + duration);
        gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      }

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      whiteNoise.start();
      whiteNoise.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  return { speak, playChime, playBreathSound };
};

const App: React.FC = () => {
  const [view, setView] = useState<'HOME' | 'SESSION' | 'STATS' | 'SETTINGS'>('HOME');
  const [activeMode, setActiveMode] = useState<BreathingMode>('NONE');
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [showPowerSetup, setShowPowerSetup] = useState(false);
  const [showBoxSetup, setShowBoxSetup] = useState(false);
  const [breathSoundsEnabled, setBreathSoundsEnabled] = useState(false);
  
  const { speak, playChime, playBreathSound } = useAudioGuidance();
  const { startMusic, stopMusic, setPulseFactor } = useSpaMusic();
  
  const [powerConfig, setPowerConfig] = useState<PowerBreathConfig>(DEFAULT_POWER_CONFIG);
  const [boxConfig, setBoxConfig] = useState<BoxConfig>(DEFAULT_BOX_CONFIG);

  const [setupBreaths, setSetupBreaths] = useState(30);
  const [setupRounds, setSetupRounds] = useState(3);
  const [setupSpeed, setSetupSpeed] = useState<PowerSpeed>('STANDARD');
  const [setupBoxDuration, setSetupBoxDuration] = useState(7);
  const [setupBoxCycles, setSetupBoxCycles] = useState(10);

  const [currentRound, setCurrentRound] = useState(1);
  const [currentBreath, setCurrentBreath] = useState(1);
  const [phase, setPhase] = useState<Phase>('PREPARE');
  const [timer, setTimer] = useState(0);
  const [roundHoldTimes, setRoundHoldTimes] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState(0);

  const [pendingSession, setPendingSession] = useState<SessionResult | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");
  const [goals, setGoals] = useState<AppGoals>({ breathHoldSeconds: 120 });

  const requestRef = useRef<number>(null);
  const previousTimeRef = useRef<number>(null);
  const lastAnnouncedBreathRef = useRef<number>(0);
  const lastAnnouncedHoldRef = useRef<number>(0);
  const lastBreathSoundPhaseRef = useRef<string>('');
  
  const goalAnnounced30s = useRef(false);
  const goalAnnounced3s = useRef(false);
  const goalAnnounced2s = useRef(false);
  const goalAnnounced1s = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('lionsbreath_sessions');
    if (saved) setSessions(JSON.parse(saved));
    const savedGoals = localStorage.getItem('lionsbreath_goals');
    if (savedGoals) setGoals(JSON.parse(savedGoals));
  }, []);

  const saveSession = useCallback((result: SessionResult) => {
    const updated = [...sessions, result];
    setSessions(updated);
    localStorage.setItem('lionsbreath_sessions', JSON.stringify(updated));
  }, [sessions]);

  const updateSessionNotes = (sessionId: string, notes: string) => {
    const updated = sessions.map(s => s.id === sessionId ? { ...s, notes } : s);
    setSessions(updated);
    localStorage.setItem('lionsbreath_sessions', JSON.stringify(updated));
  };

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = (time - (previousTimeRef.current || time)) / 1000;
      setTimer((t) => t + deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (isActive) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      previousTimeRef.current = null;
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, animate]);

  useEffect(() => {
    if (!isActive) return;
    
    let pulse = 1.0;
    const progress = getProgress();

    if (phase === 'INHALE') {
      pulse = 1.0 + (progress * 0.6);
    } else if (phase === 'EXHALE') {
      pulse = 1.6 - (progress * 0.9);
    } else if (phase === 'HOLD_IN' || phase === 'HOLD_OUT') {
      pulse = 0.8;
    } else if (phase === 'RECOVER') {
      pulse = 1.2;
    } else {
      pulse = 1.0;
    }

    setPulseFactor(pulse);
  }, [isActive, phase, timer]); 

  useEffect(() => {
    if (activeMode !== 'POWER_BREATH' || !isActive) return;

    const prepareDuration = currentRound === 1 ? 3 : 1;

    if (phase === 'PREPARE') {
      if (timer >= prepareDuration) {
        setPhase('INHALE');
        setTimer(0);
        lastAnnouncedBreathRef.current = 0;
      }
    } else if (phase === 'INHALE' || phase === 'EXHALE') {
      const pace = powerConfig.breathPace;
      const phaseDuration = pace / 2;

      if (breathSoundsEnabled && lastBreathSoundPhaseRef.current !== phase + currentBreath) {
        playBreathSound(phase as 'INHALE' | 'EXHALE', phaseDuration);
        lastBreathSoundPhaseRef.current = phase + currentBreath;
      }

      if (phase === 'INHALE' && timer < 0.1 && currentBreath !== lastAnnouncedBreathRef.current) {
        const breathsLeft = powerConfig.breathsPerRound - currentBreath + 1;
        if (breathsLeft === 3) speak("3 breaths left");
        if (breathsLeft === 2) speak("2 breaths left");
        if (breathsLeft === 1) speak("1 breath");
        lastAnnouncedBreathRef.current = currentBreath;
      }

      if (timer >= phaseDuration) {
        if (phase === 'INHALE') {
          setPhase('EXHALE');
        } else {
          if (currentBreath >= powerConfig.breathsPerRound) {
            setPhase('HOLD_OUT');
            setTimer(0);
            lastAnnouncedHoldRef.current = 0;
            goalAnnounced30s.current = false;
            goalAnnounced3s.current = false;
            goalAnnounced2s.current = false;
            goalAnnounced1s.current = false;
          } else {
            setCurrentBreath(cb => cb + 1);
            setPhase('INHALE');
          }
        }
        setTimer(0);
      }
    } else if (phase === 'HOLD_OUT') {
      const currentSeconds = Math.floor(timer);
      
      // Periodic announcements
      if (currentSeconds > 0 && currentSeconds % 30 === 0 && currentSeconds !== lastAnnouncedHoldRef.current) {
        playChime();
        const minutes = Math.floor(currentSeconds / 60);
        const remainingSec = currentSeconds % 60;
        let ann = minutes > 0 ? `${minutes} minute${minutes > 1 ? 's' : ''}${remainingSec > 0 ? ` ${remainingSec} seconds` : ''}` : `${currentSeconds} seconds`;
        speak(ann);
        lastAnnouncedHoldRef.current = currentSeconds;
      }

      // Goal Tracking Logic
      const goal = goals.breathHoldSeconds;
      const timeLeft = goal - timer;

      if (timeLeft <= 30 && timeLeft > 29 && !goalAnnounced30s.current) {
        speak("30 seconds to goal");
        goalAnnounced30s.current = true;
      }
      if (timeLeft <= 3 && timeLeft > 2 && !goalAnnounced3s.current) {
        speak("3");
        goalAnnounced3s.current = true;
      }
      if (timeLeft <= 2 && timeLeft > 1 && !goalAnnounced2s.current) {
        speak("2");
        goalAnnounced2s.current = true;
      }
      if (timeLeft <= 1 && timeLeft > 0 && !goalAnnounced1s.current) {
        speak("1");
        goalAnnounced1s.current = true;
      }
      if (timeLeft <= 0 && goalAnnounced1s.current) {
        playChime();
        speak("Goal reached");
        goalAnnounced1s.current = false; // Reset so it doesn't loop
      }

    } else if (phase === 'RECOVER') {
      if (timer >= RECOVERY_HOLD_TIME + 1) { 
        if (currentRound >= powerConfig.totalRounds) {
          finishSession();
        } else {
          setCurrentRound(cr => cr + 1);
          setCurrentBreath(1);
          setPhase('PREPARE');
          setTimer(0);
        }
      }
    }
  }, [activeMode, isActive, phase, timer, currentBreath, currentRound, powerConfig, breathSoundsEnabled, goals]);

  useEffect(() => {
    if ((activeMode !== 'BOX' && activeMode !== 'FOUR_SEVEN_EIGHT') || !isActive) return;

    const config = activeMode === 'FOUR_SEVEN_EIGHT' ? FOUR_SEVEN_EIGHT_CONFIG : boxConfig;
    const maxCycles = activeMode === 'BOX' ? setupBoxCycles : 10;
    
    const getNextPhase = (current: Phase): Phase => {
      if (current === 'PREPARE') return 'INHALE';
      if (current === 'INHALE') return config.holdIn > 0 ? 'HOLD_IN' : 'EXHALE';
      if (current === 'HOLD_IN') return 'EXHALE';
      if (current === 'EXHALE') return config.holdOut > 0 ? 'HOLD_OUT' : 'INHALE';
      if (current === 'HOLD_OUT') return 'INHALE';
      return 'INHALE';
    };

    const getPhaseDuration = (p: Phase): number => {
      switch (p) {
        case 'PREPARE': return 3; // Reduced to 3s
        case 'INHALE': return config.inhale;
        case 'HOLD_IN': return config.holdIn;
        case 'EXHALE': return config.exhale;
        case 'HOLD_OUT': return config.holdOut;
        default: return 0;
      }
    };

    const duration = getPhaseDuration(phase);

    if (breathSoundsEnabled && (phase === 'INHALE' || phase === 'EXHALE') && lastBreathSoundPhaseRef.current !== phase + currentBreath) {
      playBreathSound(phase as 'INHALE' | 'EXHALE', duration);
      lastBreathSoundPhaseRef.current = phase + currentBreath;
    }

    if (timer >= duration) {
      const next = getNextPhase(phase);
      setPhase(next);
      setTimer(0);
      if (phase === 'HOLD_OUT' || (phase === 'EXHALE' && config.holdOut === 0)) {
        if (currentBreath >= maxCycles) {
          finishSession();
        } else {
          setCurrentBreath(b => b + 1);
        }
      }
    }
  }, [activeMode, isActive, phase, timer, boxConfig, setupBoxCycles, breathSoundsEnabled]);

  const startSession = (mode: BreathingMode) => {
    if (mode === 'POWER_BREATH') {
      let speedPace = 3.15; 
      if (setupSpeed === 'QUICK') speedPace = 2.1;
      if (setupSpeed === 'SLOW') speedPace = 5.25;
      setPowerConfig({ ...powerConfig, breathsPerRound: setupBreaths, totalRounds: setupRounds, breathPace: speedPace });
      setShowPowerSetup(false);
    } else if (mode === 'BOX') {
      setBoxConfig({ inhale: setupBoxDuration, holdIn: setupBoxDuration, exhale: setupBoxDuration, holdOut: setupBoxDuration });
      setShowBoxSetup(false);
    }
    setActiveMode(mode);
    setView('SESSION');
    setPhase('PREPARE');
    setTimer(0);
    setCurrentRound(1);
    setCurrentBreath(1);
    setRoundHoldTimes([]);
    setIsActive(true);
    setStartTime(Date.now());
    setSessionNotes("");
    lastBreathSoundPhaseRef.current = '';
    startMusic();
  };

  const finishSession = () => {
    setIsActive(false);
    stopMusic();
    const finalHoldTimes = (phase === 'HOLD_OUT' && activeMode === 'POWER_BREATH') 
      ? [...roundHoldTimes, Math.floor(timer)] 
      : roundHoldTimes;

    const result: SessionResult = {
      id: Math.random().toString(36).substr(2, 9),
      date: Date.now(),
      mode: activeMode,
      rounds: activeMode === 'POWER_BREATH' ? powerConfig.totalRounds : currentBreath,
      holdTimes: finalHoldTimes,
      maxHoldTime: finalHoldTimes.length > 0 ? Math.max(...finalHoldTimes) : undefined,
      avgHoldTime: finalHoldTimes.length > 0 ? Math.round(finalHoldTimes.reduce((a, b) => a + b, 0) / finalHoldTimes.length) : undefined,
      totalDuration: Math.round((Date.now() - startTime) / 1000),
    };
    
    setPendingSession(result);
    setPhase('COMPLETED');
  };

  const handleManualHoldEnd = () => {
    if (phase === 'HOLD_OUT' && activeMode === 'POWER_BREATH') {
      setRoundHoldTimes(prev => [...prev, Math.floor(timer)]);
      setPhase('RECOVER');
      setTimer(0);
    }
  };

  const triggerManualHold = () => {
    if ((phase === 'INHALE' || phase === 'EXHALE') && activeMode === 'POWER_BREATH') {
      setPhase('HOLD_OUT');
      setTimer(0);
    }
  };

  const finalizeSession = () => {
    if (pendingSession) {
      saveSession({ ...pendingSession, notes: sessionNotes });
    }
    setPendingSession(null);
    setView('HOME');
  };

  const getLabel = () => {
    if (phase === 'PREPARE') return 'Ready';
    if (phase === 'INHALE') return 'In';
    if (phase === 'EXHALE') return 'Out';
    if (phase === 'HOLD_IN') return 'Hold';
    if (phase === 'HOLD_OUT') return activeMode === 'POWER_BREATH' ? 'Hold' : 'Retention';
    if (phase === 'RECOVER') return 'Recovery';
    if (phase === 'COMPLETED') return 'Finished';
    return '';
  };

  const getProgress = () => {
    if (phase === 'HOLD_OUT' && activeMode === 'POWER_BREATH') return 1;
    let max = 1;
    if (activeMode === 'POWER_BREATH') {
      const prepTime = currentRound === 1 ? 3 : 1;
      if (phase === 'INHALE' || phase === 'EXHALE') max = powerConfig.breathPace / 2;
      else if (phase === 'RECOVER') { max = RECOVERY_HOLD_TIME + 1; return Math.min(Math.max(0, timer - 1) / RECOVERY_HOLD_TIME, 1); }
      else if (phase === 'PREPARE') max = prepTime;
    } else {
      const config = activeMode === 'FOUR_SEVEN_EIGHT' ? FOUR_SEVEN_EIGHT_CONFIG : boxConfig;
      if (phase === 'INHALE') max = config.inhale;
      else if (phase === 'HOLD_IN') max = config.holdIn;
      else if (phase === 'EXHALE') max = config.exhale;
      else if (phase === 'HOLD_OUT') max = config.holdOut;
      else if (phase === 'PREPARE') max = 3; // Reduced to 3s
    }
    return Math.min(timer / max, 1);
  };

  const ToggleBreathSounds = () => (
    <div className="flex items-center justify-between w-full bg-white/5 p-4 rounded-2xl border border-white/10">
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Acoustic Feedback</span>
      <button onClick={() => setBreathSoundsEnabled(!breathSoundsEnabled)} className={`w-14 h-7 rounded-full transition-all duration-500 relative ${breathSoundsEnabled ? 'bg-gold-metallic shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'bg-white/10'}`}>
        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-2xl transition-all duration-500 ${breathSoundsEnabled ? 'left-8' : 'left-1'}`}></div>
      </button>
    </div>
  );

  const renderHome = () => (
    <div className="max-w-4xl mx-auto space-y-16 py-12 px-6">
      <header className="text-center space-y-4">
        <h1 className="text-5xl md:text-[72px] font-black text-gold uppercase tracking-tighter leading-tight drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]">LIONSBREATH</h1>
        <p className="text-[#D4AF37] text-[11px] md:text-sm font-black tracking-[0.6em] uppercase opacity-90">by Real Health Empire</p>
        <p className="text-gray-400 text-sm mt-8 max-w-xl mx-auto font-bold tracking-wide leading-relaxed">Elite human biological optimization through advanced respiration protocols.</p>
      </header>

      <div className="grid grid-cols-2 gap-8 md:gap-12 relative">
        <div onClick={() => setShowPowerSetup(true)} className="aspect-square p-8 md:p-12 glass rounded-[3rem] md:rounded-[4rem] cursor-pointer border-white/5 hover:border-[#D4AF37]/50 flex flex-col justify-end overflow-hidden group relative transition-all duration-700 hover:scale-[1.03] shadow-2xl">
          <div className="absolute top-4 right-4 md:-top-10 md:-right-10 p-2 opacity-5 group-hover:opacity-25 transition-all duration-700"><svg className="w-24 h-24 md:w-64 md:h-64 text-[#D4AF37]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/></svg></div>
          <div className="relative z-10 space-y-2">
            <h2 className="text-sm md:text-3xl font-black tracking-tight text-gold uppercase drop-shadow-md">Power Protocol</h2>
            <p className="text-gray-500 text-[9px] md:text-[11px] font-black uppercase tracking-widest">Oxygen Saturation Cycle</p>
            <p className="hidden md:block text-[10px] text-gray-400 font-medium leading-tight">Increases oxygen efficiency, sharpens mental clarity, and helps the nervous system handle stress more effectively. Regular use can support focus, energy, and overall resilience.</p>
            <span className="inline-block mt-2 text-[8px] md:text-[11px] bg-gold-metallic text-black px-6 md:px-10 py-2.5 md:py-4 font-black rounded-2xl uppercase tracking-[0.2em] shadow-2xl">Initialize</span>
          </div>
        </div>

        <div onClick={() => setShowBoxSetup(true)} className="aspect-square p-8 md:p-12 glass rounded-[3rem] md:rounded-[4rem] cursor-pointer border-white/5 hover:border-emerald-500/50 flex flex-col justify-end overflow-hidden group relative transition-all duration-700 hover:scale-[1.03] shadow-2xl">
          <div className="absolute top-4 right-4 md:-top-10 md:-right-10 p-2 opacity-5 group-hover:opacity-25 transition-all duration-700"><svg className="w-24 h-24 md:w-64 md:h-64 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3M19 19H5V5H19V19Z"/></svg></div>
          <div className="relative z-10 space-y-2">
            <h2 className="text-sm md:text-3xl font-black tracking-tight text-emerald-metallic uppercase drop-shadow-md">Box Focus</h2>
            <p className="text-gray-500 text-[9px] md:text-[11px] font-black uppercase tracking-widest">Symmetric Regulation</p>
            <p className="hidden md:block text-[10px] text-gray-400 font-medium leading-tight">Box breathing slows the breath to calm the nervous system, reduce stress, and improve emotional control. It helps steady focus, regulate heart rate, and restore a sense of balance.</p>
            <span className="inline-block mt-2 text-[8px] md:text-[11px] bg-emerald-metallic text-white px-6 md:px-10 py-2.5 md:py-4 font-black rounded-2xl uppercase tracking-[0.2em] shadow-2xl">Initialize</span>
          </div>
        </div>

        <div onClick={() => startSession('FOUR_SEVEN_EIGHT')} className="aspect-square p-8 md:p-12 glass rounded-[3rem] md:rounded-[4rem] cursor-pointer border-white/5 hover:border-purple-500/50 flex flex-col justify-end overflow-hidden group relative transition-all duration-700 hover:scale-[1.03] shadow-2xl">
          <div className="absolute top-4 right-4 md:-top-10 md:-right-10 p-2 opacity-5 group-hover:opacity-25 transition-all duration-700"><svg className="w-24 h-24 md:w-64 md:h-64 text-purple-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21H23L12 2M12 6L19.53 19H4.47L12 6Z"/></svg></div>
          <div className="relative z-10 space-y-2">
            <h2 className="text-sm md:text-3xl font-black tracking-tight text-purple-metallic uppercase drop-shadow-md">4-7-8 Calming</h2>
            <p className="text-gray-500 text-[9px] md:text-[11px] font-black uppercase tracking-widest">Neural Tranquilizer</p>
            <p className="hidden md:block text-[10px] text-gray-400 font-medium leading-tight">This Navy SEAL technique acts as a biological sedative to shut down anxiety and prepare the body for high-quality restoration.</p>
            <span className="inline-block mt-2 text-[8px] md:text-[11px] bg-purple-metallic text-white px-6 md:px-10 py-2.5 md:py-4 font-black rounded-2xl uppercase tracking-[0.2em] shadow-2xl">Execute</span>
          </div>
        </div>

        <div onClick={() => setView('STATS')} className="aspect-square p-8 md:p-12 glass rounded-[3rem] md:rounded-[4rem] cursor-pointer border-dashed border-2 border-blue-500/20 relative group transition-all duration-700 hover:scale-[1.03] flex flex-col items-center justify-center shadow-2xl">
          <div className="w-16 h-16 md:w-28 md:h-28 bg-blue-500/10 rounded-[2.5rem] md:rounded-[3rem] flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-all shadow-inner"><svg className="w-10 h-10 md:w-16 md:h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div>
          <h2 className="text-[10px] md:text-xl font-black uppercase tracking-[0.3em] text-blue-metallic text-center drop-shadow-md">Records & Journal</h2>
        </div>
      </div>

      {showPowerSetup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-700">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto glass p-10 md:p-14 rounded-[4rem] border border-[#D4AF37]/30 shadow-[0_30px_100px_rgba(0,0,0,1)] space-y-10 animate-in zoom-in duration-700 scrollbar-hide">
            <h3 className="text-xl font-black text-gold uppercase tracking-[0.5em] text-center drop-shadow-lg">Protocol Config</h3>
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] pl-2">Intensity Vector</label>
                <div className="flex gap-3">
                  {(['QUICK', 'STANDARD', 'SLOW'] as PowerSpeed[]).map(s => (
                    <button key={s} onClick={() => setSetupSpeed(s)} className={`flex-1 py-5 rounded-[1.5rem] text-[9px] font-black border transition-all duration-500 ${setupSpeed === s ? 'bg-gold-metallic border-[#D4AF37] text-black shadow-2xl scale-105' : 'bg-white/5 border-white/10 text-gray-500'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] pl-2">Cycle Count</label>
                <div className="flex gap-3">
                  {[20, 30, 40].map(val => (
                    <button key={val} onClick={() => setSetupBreaths(val)} className={`flex-1 py-5 rounded-[1.5rem] border text-[12px] font-black transition-all duration-500 ${setupBreaths === val ? 'bg-gold-metallic text-black border-[#D4AF37] shadow-2xl scale-105' : 'bg-white/5 text-gray-400'}`}>{val}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] pl-2">Rounds</label>
                <div className="flex items-center gap-6 bg-white/5 p-3 rounded-[2rem] border border-white/10 shadow-inner">
                  <button onClick={() => setSetupRounds(Math.max(1, setupRounds - 1))} className="w-14 h-14 flex items-center justify-center hover:bg-white/10 rounded-2xl text-2xl font-black text-gold transition-all">-</button>
                  <span className="flex-1 text-3xl font-black text-center text-white">{setupRounds}</span>
                  <button onClick={() => setSetupRounds(setupRounds + 1)} className="w-14 h-14 flex items-center justify-center hover:bg-white/10 rounded-2xl text-2xl font-black text-gold transition-all">+</button>
                </div>
              </div>
              <ToggleBreathSounds />
              <div className="flex gap-5 pt-6">
                <button onClick={() => setShowPowerSetup(false)} className="flex-1 py-6 bg-white/5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest text-gray-400 transition-all hover:bg-white/10">Back</button>
                <button onClick={() => startSession('POWER_BREATH')} className="flex-[2] py-6 bg-gold-metallic text-black font-black rounded-[2rem] text-[10px] uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">Engage</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBoxSetup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-700">
          <div className="w-full max-md max-h-[90vh] overflow-y-auto glass p-10 md:p-14 rounded-[4rem] border border-emerald-500/30 shadow-[0_30px_100px_rgba(0,0,0,1)] space-y-10 animate-in zoom-in duration-700 scrollbar-hide">
            <h3 className="text-xl font-black text-emerald-metallic uppercase tracking-[0.5em] text-center drop-shadow-lg">Box Config</h3>
            <div className="space-y-8">
              <div className="space-y-5">
                <div className="flex justify-between items-center px-2">
                  <span className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]">Temporal Symmetry</span>
                  <span className="text-3xl font-black text-emerald-metallic drop-shadow-md">{setupBoxDuration}s</span>
                </div>
                <input 
                  type="range" 
                  min="4" 
                  max="12" 
                  value={setupBoxDuration} 
                  onChange={(e) => setSetupBoxDuration(parseInt(e.target.value))}
                  className="w-full h-3 bg-white/10 rounded-xl appearance-none cursor-pointer accent-emerald-500 shadow-inner"
                />
              </div>
              <div className="space-y-4">
                <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] pl-2">Cycles</label>
                <div className="flex items-center gap-6 bg-white/5 p-3 rounded-[2rem] border border-white/10 shadow-inner">
                  <button onClick={() => setSetupBoxCycles(Math.max(1, setupBoxCycles - 1))} className="w-14 h-14 flex items-center justify-center hover:bg-white/10 rounded-2xl text-2xl font-black text-emerald-400 transition-all">-</button>
                  <span className="flex-1 text-3xl font-black text-center text-white">{setupBoxCycles}</span>
                  <button onClick={() => setSetupBoxCycles(setupBoxCycles + 1)} className="w-14 h-14 flex items-center justify-center hover:bg-white/10 rounded-2xl text-2xl font-black text-emerald-400 transition-all">+</button>
                </div>
              </div>
              <ToggleBreathSounds />
              <div className="flex gap-5 pt-6">
                <button onClick={() => setShowBoxSetup(false)} className="flex-1 py-6 bg-white/5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest text-gray-400 transition-all hover:bg-white/10">Back</button>
                <button onClick={() => startSession('BOX')} className="flex-[2] py-6 bg-emerald-metallic text-white font-black rounded-[2rem] text-[10px] uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">Engage</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSession = () => {
    const themeStyles = {
      POWER_BREATH: 'border-[#D4AF37] text-[#D4AF37] hover:bg-gold-metallic hover:text-black',
      BOX: 'border-emerald-500 text-emerald-500 hover:bg-emerald-metallic hover:text-white',
      FOUR_SEVEN_EIGHT: 'border-purple-500 text-purple-500 hover:bg-purple-metallic hover:text-white',
      NONE: 'border-white/20 text-white/20 hover:text-white'
    }[activeMode];

    const prepTimeRemaining = currentRound === 1 ? Math.ceil(3 - timer) : Math.ceil(1 - timer);

    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] p-8">
        {phase !== 'COMPLETED' ? (
          <div className="w-full max-w-2xl flex flex-col items-center relative">
            {(phase === 'INHALE' || phase === 'EXHALE') && activeMode === 'POWER_BREATH' && <div onClick={triggerManualHold} className="absolute inset-0 z-[60] cursor-pointer flex items-end justify-center pb-16"><div className="text-[12px] font-black uppercase text-gold animate-pulse tracking-[0.4em] drop-shadow-[0_0_10px_rgba(184,134,11,0.5)]">Tap to Trigger Hold</div></div>}
            {phase === 'HOLD_OUT' && activeMode === 'POWER_BREATH' && <div onClick={handleManualHoldEnd} className="absolute inset-0 z-[60] cursor-pointer flex items-end justify-center pb-16"><div className="text-[12px] font-black uppercase text-blue-metallic animate-pulse tracking-[0.4em] drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">Tap to Initiate Recovery</div></div>}
            
            <div className="h-32 flex flex-col items-center justify-center mb-12">
              <h3 className="text-white font-black uppercase tracking-[0.6em] text-[8px] opacity-60 mb-6">{activeMode.replace('_', ' ')} Protocol</h3>
              <div className="text-white font-black text-xs md:text-sm glass px-12 py-4 rounded-[1.5rem] border border-white/20 shadow-2xl tracking-[0.3em] uppercase metallic-shine">
                {activeMode === 'POWER_BREATH' ? `Protocol Round ${currentRound} / ${powerConfig.totalRounds}` : `Cycle ${currentBreath}`}
              </div>
            </div>

            <div className="flex items-center justify-center mb-12 h-[350px] md:h-[550px] overflow-visible">
              <BreathingBubble 
                phase={phase} 
                progress={getProgress()} 
                label={getLabel()} 
                subLabel={phase === 'PREPARE' ? (prepTimeRemaining > 0 ? prepTimeRemaining.toString() : "") : phase === 'RECOVER' ? formatTime(Math.ceil(RECOVERY_HOLD_TIME - Math.max(0, timer - 1))) : (activeMode === 'POWER_BREATH' && (phase === 'INHALE' || phase === 'EXHALE')) ? '' : formatTime(Math.floor(timer))} 
                color={activeMode === 'POWER_BREATH' ? 'gold' : activeMode === 'BOX' ? 'emerald' : 'purple'} 
                mode={activeMode} 
                currentBreath={currentBreath} 
              />
            </div>

            <div className="h-48 flex flex-col items-center space-y-10">
              <div className="h-24 flex items-center justify-center">
                {(phase === 'INHALE' || phase === 'EXHALE') && activeMode === 'POWER_BREATH' ? (
                  <div className="text-3xl font-black text-gold/40 tracking-[0.5em] drop-shadow-sm">{currentBreath} / {powerConfig.breathsPerRound}</div>
                ) : null}
              </div>
              <button 
                onClick={() => { setIsActive(false); stopMusic(); finishSession(); }} 
                className={`px-16 py-5 rounded-[2.5rem] border-2 text-[10px] font-black tracking-[0.5em] uppercase transition-all duration-700 z-[70] shadow-2xl ${themeStyles}`}
              >
                Terminate Session
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl w-full glass p-12 md:p-16 rounded-[5rem] border-blue-500/30 shadow-[0_40px_120px_rgba(0,0,0,1)] animate-in zoom-in duration-700 space-y-12 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-metallic opacity-60"></div>
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-black tracking-tighter text-blue-metallic uppercase drop-shadow-2xl">Neural Performance Report</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.4em] font-black">Biological systems synchronized and logged.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="glass p-7 rounded-[2rem] border-blue-500/10 text-center shadow-inner metallic-shine">
                <div className="text-[8px] text-gray-500 uppercase font-black mb-3 tracking-widest">Temporal Presence</div>
                <div className="text-2xl font-black text-blue-metallic drop-shadow-md">{formatTime(pendingSession?.totalDuration || 0)}</div>
              </div>
              <div className="glass p-7 rounded-[2rem] border-blue-500/10 text-center shadow-inner metallic-shine">
                <div className="text-[8px] text-gray-500 uppercase font-black mb-3 tracking-widest">Peak Retention</div>
                <div className="text-2xl font-black text-blue-metallic drop-shadow-md">{pendingSession?.maxHoldTime || 0}s</div>
              </div>
              <div className="glass p-7 rounded-[2rem] border-blue-500/10 text-center shadow-inner metallic-shine">
                <div className="text-[8px] text-gray-500 uppercase font-black mb-3 tracking-widest">Mean Capacity</div>
                <div className="text-2xl font-black text-blue-metallic drop-shadow-md">{pendingSession?.avgHoldTime || 0}s</div>
              </div>
              <div className="glass p-7 rounded-[2rem] border-blue-500/10 text-center shadow-inner metallic-shine">
                <div className="text-[8px] text-gray-500 uppercase font-black mb-3 tracking-widest">Project PB</div>
                <div className="text-2xl font-black text-gold uppercase drop-shadow-md">
                  {Math.max(pendingSession?.maxHoldTime || 0, sessions.flatMap(s => s.holdTimes).length > 0 ? Math.max(...sessions.flatMap(s => s.holdTimes)) : 0)}s
                </div>
              </div>
            </div>

            {pendingSession?.holdTimes && pendingSession.holdTimes.length > 0 && (
              <div className="space-y-6">
                <h4 className="text-[10px] text-gray-400 uppercase tracking-[0.4em] font-black pl-4">Retention Vectors</h4>
                <div className="flex flex-wrap gap-4">
                  {pendingSession.holdTimes.map((h, i) => (
                    <div key={i} className="px-7 py-4 bg-blue-950/20 rounded-3xl border border-blue-500/20 flex flex-col items-center min-w-[90px] shadow-2xl transition-all hover:scale-105">
                      <span className="text-[9px] text-blue-400 font-black uppercase mb-2 tracking-widest">Round {i+1}</span>
                      <span className="text-lg font-black text-white">{h}s</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              <h4 className="text-[10px] text-gray-400 uppercase tracking-[0.4em] font-black pl-4">Metabolic Reflections</h4>
              <textarea 
                className="w-full bg-blue-950/20 border border-blue-500/20 rounded-[3rem] p-10 text-[14px] text-blue-100 font-medium focus:outline-none focus:border-blue-500/50 min-h-[160px] transition-all shadow-inner leading-relaxed"
                placeholder="Log internal physiological sensations..."
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
              />
            </div>

            <button 
              onClick={finalizeSession} 
              className="w-full py-8 bg-blue-metallic text-white font-black rounded-[3rem] text-[12px] tracking-[0.5em] uppercase shadow-[0_20px_50px_rgba(37,99,235,0.4)] hover:scale-[1.02] active:scale-95 transition-all"
            >
              Commit Protocol to Archive
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24 selection:bg-blue-500/40">
      <nav className="p-12 flex justify-between items-center max-w-7xl mx-auto">
        <div onClick={() => { setView('HOME'); stopMusic(); setPendingSession(null); }} className="flex flex-col cursor-pointer group">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 md:w-20 md:h-20 bg-gold-metallic rounded-3xl md:rounded-[1.75rem] group-hover:rotate-12 transition-all duration-500 shadow-[0_15px_40px_rgba(0,0,0,0.6)] flex items-center justify-center text-black font-black text-2xl md:text-4xl">L</div>
            <div className="flex flex-col">
               <span className="text-xl md:text-3xl font-black text-gold tracking-tighter drop-shadow-2xl">LIONSBREATH</span>
               <span className="text-[7px] md:text-[10px] text-[#D4AF37]/70 font-black tracking-[0.6em] uppercase">Imperial Protocol v3.0</span>
            </div>
          </div>
        </div>
        <div className="flex gap-6">
          <button onClick={() => setView('STATS')} className={`px-8 md:px-12 py-4 rounded-[1.5rem] text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] transition-all duration-500 ${view === 'STATS' ? 'bg-blue-metallic text-white shadow-[0_10px_30px_rgba(59,130,246,0.3)] scale-110' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}>Archived Data</button>
          <button onClick={() => setView('SETTINGS')} className={`px-8 md:px-12 py-4 rounded-[1.5rem] text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] transition-all duration-500 ${view === 'SETTINGS' ? 'bg-gold-metallic text-black shadow-[0_10px_30px_rgba(212,175,55,0.3)] scale-110' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}>Interface Config</button>
        </div>
      </nav>
      <main>
        {view === 'HOME' && renderHome()}
        {view === 'SESSION' && renderSession()}
        {view === 'STATS' && (
          <div className="max-w-6xl mx-auto py-16 px-6 space-y-12 animate-in slide-in-from-bottom-10 duration-1000">
            <div className="flex items-center justify-between border-b border-blue-500/10 pb-8">
              <h2 className="text-3xl font-black tracking-tighter text-blue-metallic uppercase tracking-[0.4em] drop-shadow-2xl">Archived Records & Journal</h2>
              <button onClick={() => setView('HOME')} className="text-blue-400/60 font-black uppercase text-[10px] tracking-[0.5em] hover:text-blue-400 transition-all">Relinquish Access</button>
            </div>
            <StatsPanel sessions={sessions} onUpdateNotes={updateSessionNotes} />
          </div>
        )}
        {view === 'SETTINGS' && (
          <div className="max-w-2xl mx-auto py-16 px-6 space-y-12 animate-in fade-in duration-1000">
            <h2 className="text-3xl font-black tracking-tighter text-gold uppercase tracking-[0.4em] drop-shadow-2xl">Neural Configuration</h2>
            <div className="space-y-10 glass p-14 rounded-[4rem] border-[#D4AF37]/20 shadow-[0_40px_100px_rgba(0,0,0,0.8)]"><ToggleBreathSounds /></div>
            <button onClick={() => setView('HOME')} className="w-full py-8 bg-gold-metallic text-black font-black rounded-[3rem] text-[12px] tracking-[0.5em] uppercase shadow-[0_20px_60px_rgba(212,175,55,0.4)] hover:scale-[1.02] active:scale-95 transition-all">Synchronize Local Buffer</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
