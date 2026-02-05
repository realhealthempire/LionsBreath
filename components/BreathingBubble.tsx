
import React, { useMemo } from 'react';
import { BreathingMode } from '../types';

interface BreathingBubbleProps {
  phase: string;
  progress: number; // 0 to 1
  label?: string;
  subLabel?: string;
  color?: string; // 'gold' | 'purple' | 'emerald'
  mode?: BreathingMode;
  currentBreath?: number;
}

/**
 * Renders a comet with a fading tail following a path based on manual progress.
 */
const CometTrail: React.FC<{ 
  path: string; 
  targetProgress: number; // 0 to 1
  color: string; 
  headSize?: number; 
  dustCount?: number;
}> = React.memo(({ path, targetProgress, color, headSize = 1.1, dustCount = 6 }) => {
  const totalSegments = 40;
  const spacing = 0.006; 
  const gradientIdBase = useMemo(() => `rad-grad-${Math.random().toString(36).substr(2, 5)}`, []);

  // Dust particles that orbit slightly offset
  const dust = useMemo(() => {
    return Array.from({ length: dustCount }).map((_, i) => ({
      r: Math.random() * 0.12 + 0.04,
      phaseOffset: Math.random() * -0.1,
      offset: (Math.random() - 0.5) * 3,
    }));
  }, [dustCount]);

  return (
    <>
      <defs>
        <radialGradient id={`${gradientIdBase}-segment`}>
          <stop offset="20%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Dust particles */}
      {dust.map((d, i) => {
        const dProgress = ((targetProgress + d.phaseOffset % 1) + 1) % 1;
        return (
          <circle
            key={`dust-${i}`}
            r={d.r}
            fill="white"
            fillOpacity={0.2}
            style={{
              offsetPath: `path('${path}')`,
              offsetDistance: `${dProgress * 100}%`,
              transform: `translate(${d.offset}px, ${d.offset}px)`,
              willChange: 'offset-distance'
            } as any}
          />
        );
      })}

      {/* Comet Segments (Tail) */}
      {Array.from({ length: totalSegments }).map((_, i) => {
        const isHead = i < 10;
        const radius = isHead 
          ? headSize * (1.3 - (i / 10) * 0.4) 
          : headSize * (0.9 * Math.pow(1 - (i - 10) / (totalSegments - 10), 1.5)); 

        const opacity = Math.max(0.05, 1.0 - (i / totalSegments) * 0.95);
        // Calculate wrapping distance
        const segProgress = (targetProgress - i * spacing);
        const distance = ((segProgress % 1) + 1) % 1;
        
        return (
          <circle
            key={`seg-${i}`}
            r={radius}
            fill={`url(#${gradientIdBase}-segment)`}
            fillOpacity={opacity}
            style={{
              offsetPath: `path('${path}')`,
              offsetDistance: `${distance * 100}%`,
              willChange: 'offset-distance',
              filter: isHead ? `drop-shadow(0 0 ${6 - i / 2}px ${color})` : 'none'
            } as any}
          />
        );
      })}
    </>
  );
});

export const BreathingBubble: React.FC<BreathingBubbleProps> = React.memo(({ 
  phase, 
  progress, 
  label, 
  subLabel,
  color = 'gold',
  mode = 'NONE',
  currentBreath = 1
}) => {
  const boundaryScale = 0.68;
  const bubbleBaseScale = 0.08;
  const bubblePeakScale = 0.68;
  
  const currentScale = useMemo(() => {
    if (phase === 'INHALE') {
      return bubbleBaseScale + (bubblePeakScale - bubbleBaseScale) * progress;
    } else if (phase === 'EXHALE') {
      return bubblePeakScale - (bubblePeakScale - bubbleBaseScale) * progress;
    } else if (phase === 'HOLD_IN') {
      return bubblePeakScale;
    } else if (phase === 'RECOVER') {
      const expansionProgress = Math.min(progress * 15, 1);
      return bubbleBaseScale + (bubblePeakScale - bubbleBaseScale) * expansionProgress;
    } else if (phase === 'HOLD_OUT' || phase === 'PREPARE') {
      return bubbleBaseScale;
    }
    return bubbleBaseScale;
  }, [phase, progress]);

  // Sync Comet Path Progress
  const cometProgress = useMemo(() => {
    if (mode === 'POWER_BREATH') {
      // For power breathing, slow down the comet to be relaxing (1 rotation per 4 breaths)
      if (phase === 'INHALE' || phase === 'EXHALE') {
        const breathIndex = (currentBreath - 1) % 4;
        const phaseWithinBreath = (phase === 'INHALE' ? progress * 0.5 : 0.5 + progress * 0.5);
        return (breathIndex + phaseWithinBreath) / 4;
      }
      // Start/Stop at the top center during holds/prepare
      return 0;
    } else if (mode === 'BOX' || mode === 'FOUR_SEVEN_EIGHT') {
      // 1/4 of path per section
      if (phase === 'INHALE') return progress * 0.25;
      if (phase === 'HOLD_IN') return 0.25 + progress * 0.25;
      if (phase === 'EXHALE') return 0.50 + progress * 0.25;
      if (phase === 'HOLD_OUT') return 0.75 + progress * 0.25;
    }
    return 0;
  }, [mode, phase, progress, currentBreath]);

  const colorMap: Record<string, { stroke: string, glow: string, secondary: string }> = {
    gold: { stroke: '#FCF6BA', glow: 'glow-ps3-gold', secondary: '#B38728' },
    purple: { stroke: '#DDD6FE', glow: 'glow-ps3-purple', secondary: '#7C3AED' },
    emerald: { stroke: '#A7F3D0', glow: 'glow-ps3-emerald', secondary: '#059669' },
  };

  const current = colorMap[color] || colorMap.gold;

  // Path starts at the TOP CENTER (50, 0) for perfect alignment
  const basePath = "M 50,0 Q 70,0 70,5 L 95,30 Q 100,50 95,70 L 70,95 Q 50,100 30,95 L 5,70 Q 0,50 5,30 L 30,5 Q 30,0 50,0 Z";

  const getSilkOctagonPath = (offset: number, jitter: number = 0) => {
    const o = offset;
    const j = jitter;
    // We keep the internal shape path drawing consistent with the start point for visual symmetry
    return `
      M ${50},${0+o+j} 
      Q ${70},${0+o} ${70-o},${5+o-j} 
      L ${95-o-j},${30+o} 
      Q ${100-o},50 ${95-o+j},${70-o} 
      L ${70-o},${95-o+j} 
      Q 50,100 ${30+o},${95-o-j} 
      L ${5+o+j},${70-o} 
      Q ${0+o},50 ${5+o-j},${30+o} 
      L ${30+o},${5+o+j} 
      Q ${30+o},${0+o} ${50},${0+o+j} 
      Z
    `;
  };

  const getInternalSilk = (id: number) => {
    const yBase = 35 + (id * 15);
    return `M 15,${yBase} Q 50,${yBase + (id % 2 === 0 ? 20 : -20)} 85,${yBase}`;
  };

  const particles = useMemo(() => {
    return Array.from({ length: 45 }).map((_, i) => ({
      left: `${Math.random() * 80 + 10}%`,
      top: `${Math.random() * 80 + 10}%`,
      size: `${Math.random() * 5 + 1}px`,
      duration: `${Math.random() * 6 + 4}s`,
      delay: `${Math.random() * -10}s`,
      driftX: `${(Math.random() - 0.5) * 150}px`,
      driftY: `${-Math.random() * 200 - 80}px`,
    }));
  }, []);

  const isHoldLabel = label?.toUpperCase() === 'HOLD';
  const isPowerHold = isHoldLabel && mode === 'POWER_BREATH';
  const shouldShift = isPowerHold;

  // Optimized for Montserrat 'HOLD' with tracking-[0.7em]
  const holdXOffsetEm = -1.52;

  return (
    <div className="relative flex items-center justify-center w-80 h-80 md:w-[600px] md:h-[600px] overflow-visible">
      
      {/* Label Layer */}
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="relative flex flex-col items-center w-full h-full justify-center">
          
          <div className="relative flex items-center justify-center w-full">
            <h2 className={`font-black text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.6)] uppercase tracking-[0.8em] mr-[-0.8em] leading-none transition-all duration-700 whitespace-nowrap ${label === 'Recovery' ? 'text-lg md:text-2xl' : 'text-2xl md:text-[40px]'}`}>
              {isPowerHold ? (
                <>H<span className="opacity-0">O</span>LD</>
              ) : (
                label
              )}
            </h2>
          </div>
          
          {subLabel && (
            <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-700 ${isHoldLabel ? 'top-[58%] md:top-[60%]' : 'top-1/2 translate-y-12 md:translate-y-20'}`}>
               <p className="text-xs md:text-2xl text-white font-black tracking-[0.6em] mr-[-0.6em] animate-in fade-in slide-in-from-top-2 duration-500 whitespace-nowrap">
                {subLabel}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Orbiting Comet Layer */}
      <div className="absolute inset-0 pointer-events-none z-10" style={{ transform: `scale(${boundaryScale})` }}>
        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100">
          <path
            d={getSilkOctagonPath(0)}
            fill="none"
            stroke="white"
            strokeWidth="1.2"
            strokeOpacity="0.1"
          />
          <CometTrail 
            path={basePath} 
            targetProgress={cometProgress} 
            color={current.stroke} 
          />
        </svg>
      </div>

      {/* Main Bubble */}
      <div 
        className="w-full h-full flex items-center justify-center relative transition-transform duration-700 ease-in-out pointer-events-none"
        style={{ 
          transform: shouldShift ? `translateX(${holdXOffsetEm}em)` : 'translateX(0)' 
        }}
      >
        <div 
          className={`w-full h-full flex items-center justify-center relative ${current.glow}`}
          style={{ 
            transform: `scale(${currentScale})`,
            willChange: 'transform'
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
              <defs>
                <clipPath id="bubbleShellClip">
                  <path d={getSilkOctagonPath(0)} />
                </clipPath>
              </defs>

              <path 
                d={getSilkOctagonPath(0)} 
                fill={current.stroke} 
                fillOpacity="0.08"
                stroke={current.stroke}
                strokeWidth="1.5"
                strokeOpacity="0.4"
              />
              
              <g clipPath="url(#bubbleShellClip)">
                {[0.5, 2, 4, 6, 9].map((offset, i) => (
                  <path
                    key={`silk-${i}`}
                    d={getSilkOctagonPath(offset, i * 0.5)}
                    className="silk-path"
                    stroke={i % 2 === 0 ? current.stroke : current.secondary}
                    style={{
                      animation: i % 2 === 0 ? 'ribbon-flutter-1 8s ease-in-out infinite' : 'ribbon-flutter-2 12s ease-in-out infinite',
                      animationDelay: `${i * -2}s`,
                      strokeOpacity: 0.8 - (i * 0.1),
                      filter: `blur(${0.5 + i * 0.8}px)`,
                      strokeWidth: 3 + (i * 0.5)
                    }}
                  />
                ))}
              </g>
            </svg>
          </div>

          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p, i) => (
              <div 
                key={i}
                className="spirit-particle"
                style={{
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                  '--p-duration': p.duration,
                  '--drift-x': p.driftX,
                  '--drift-y': p.driftY,
                  animationDelay: p.delay,
                } as any}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
