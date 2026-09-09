import React, { useState, useEffect, useRef } from 'react';
import { Organism, Scientist } from '../types';
import { CreatureSprite } from './CreatureSprite';
import { generateRandomClone } from '../utils/cloneGenerator';
import { GuitarHeroTrack, GuitarHeroHitEvent } from './GuitarHeroTrack';

interface SoloRaceProps {
  playerOrganism: Organism;
  scientist: Scientist;
  onFinishRace: (results: Array<{ name: string; org: Organism; progress: number; isPlayer: boolean }>) => void;
  onExit: () => void;
}

interface LocalRacer {
  key: string;
  name: string;
  org: Organism;
  progress: number;
  fatigue: number;
  overheated: boolean;
  isPlayer: boolean;
}

// Physics scaled for intermediate difficulty (25 to 35 seconds with rhythmic boosts)
const SPEED_K = 0.0025;
const FATIGUE_K = 0.30;
const RECOVERY_K = 0.026;
const TICK_MS = 100;
const MAX_TICKS = 900;
const FINISH = 100;

export const SoloRace: React.FC<SoloRaceProps> = ({
  playerOrganism,
  scientist,
  onFinishRace,
  onExit,
}) => {
  const [roster, setRoster] = useState<LocalRacer[]>([]);
  const [activeEvent, setActiveEvent] = useState<{ id: string; name: string } | null>(null);
  const [hasUsedAbility, setHasUsedAbility] = useState(false);
  const [raceActive, setRaceActive] = useState(true);
  const [tickCount, setTickCount] = useState(0);
  const [isTurboActive, setIsTurboActive] = useState(false);
  const [guitarHeroCombo, setGuitarHeroCombo] = useState(0);

  const rosterRef = useRef<LocalRacer[]>([]);
  rosterRef.current = roster;
  const activeEventRef = useRef(activeEvent);
  activeEventRef.current = activeEvent;
  const raceActiveRef = useRef(raceActive);
  raceActiveRef.current = raceActive;
  const lastTurboTimeRef = useRef<number>(0);
  const turboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize racers with unique clones
  useEffect(() => {
    const enemy1 = generateRandomClone('Rival A', playerOrganism.speciesId);
    const enemy2 = generateRandomClone('Rival B', enemy1.speciesId);
    const enemy3 = generateRandomClone('Rival C', enemy2.speciesId);

    const initialRoster: LocalRacer[] = [
      {
        key: 'player',
        name: `${scientist.name} (${playerOrganism.baseName.split(' ')[0]})`,
        org: playerOrganism,
        progress: 0,
        fatigue: 0,
        overheated: false,
        isPlayer: true,
      },
      {
        key: 'e0',
        name: enemy1.baseName,
        org: enemy1,
        progress: 0,
        fatigue: 0,
        overheated: false,
        isPlayer: false,
      },
      {
        key: 'e1',
        name: enemy2.baseName,
        org: enemy2,
        progress: 0,
        fatigue: 0,
        overheated: false,
        isPlayer: false,
      },
      {
        key: 'e2',
        name: enemy3.baseName,
        org: enemy3,
        progress: 0,
        fatigue: 0,
        overheated: false,
        isPlayer: false,
      },
    ];

    setRoster(initialRoster);
    setRaceActive(true);
    setHasUsedAbility(false);
    setTickCount(0);
  }, [playerOrganism, scientist]);

  // Turbo handler: triggered by pressing any key or clicking the turbo button
  const handleGuitarHeroHit = (event: GuitarHeroHitEvent) => {
    if (!raceActiveRef.current) return;
    if (event.rating === 'PERFECT') {
      setIsTurboActive(true);
      setTimeout(() => setIsTurboActive(false), 200);
    }
    setRoster(prev =>
      prev.map(r => {
        if (!r.isPlayer || r.progress >= FINISH) return r;
        if (event.rating === 'PERFECT') {
          return {
            ...r,
            progress: Math.min(FINISH, r.progress + 1.40),
            fatigue: Math.max(0, r.fatigue - 1.5),
          };
        } else if (event.rating === 'GOOD') {
          return {
            ...r,
            progress: Math.min(FINISH, r.progress + 0.85),
            fatigue: Math.max(0, r.fatigue - 0.5),
          };
        } else if (event.rating === 'MISS') {
          return {
            ...r,
            fatigue: Math.min(100, r.fatigue + 0.6),
          };
        }
        return r;
      })
    );
  };

  const handleTurbo = () => {
    if (!raceActiveRef.current) return;
    const now = Date.now();
    // Rate limit: max 1 turbo per 150ms
    if (now - lastTurboTimeRef.current < 150) return;
    lastTurboTimeRef.current = now;

    const player = rosterRef.current.find(r => r.isPlayer);
    if (!player || player.fatigue >= 100) return;

    // Flash turbo visual state
    setIsTurboActive(true);
    if (turboTimerRef.current) clearTimeout(turboTimerRef.current);
    turboTimerRef.current = setTimeout(() => setIsTurboActive(false), 260);

    const nextRoster = rosterRef.current.map(r => {
      if (r.isPlayer) {
        return {
          ...r,
          progress: Math.min(FINISH, r.progress + 1.1),
          fatigue: Math.min(100, r.fatigue + 2.2),
          overheated: r.fatigue + 2.2 >= 100,
        };
      }
      return r;
    });

    setRoster(nextRoster);

    if (nextRoster.some(r => r.progress >= FINISH)) {
      setRaceActive(false);
      onFinishRace(
        nextRoster.map(r => ({
          name: r.name,
          org: r.org,
          progress: r.progress,
          isPlayer: r.isPlayer,
        }))
      );
    }
  };

  // Ability handler
  const handleUseAbility = () => {
    if (hasUsedAbility || !raceActiveRef.current) return;
    const player = rosterRef.current.find(r => r.isPlayer);
    if (!player || player.fatigue >= 100) return;

    setHasUsedAbility(true);
    const ab = playerOrganism.ability;

    const nextRoster = rosterRef.current.map(r => {
      if (r.isPlayer) {
        if (ab.id === 'turbo') return { ...r, progress: Math.min(FINISH, r.progress + 14) };
        if (ab.id === 'cool') return { ...r, fatigue: 0 };
        if (ab.id === 'absorb') return { ...r, progress: Math.min(FINISH, r.progress + 11) };
      } else {
        if (ab.id === 'confuse') {
          return {
            ...r,
            progress: Math.max(0, r.progress - 8),
            fatigue: Math.min(100, r.fatigue + 18),
          };
        }
        if (ab.id === 'absorb') {
          return {
            ...r,
            progress: Math.max(0, r.progress - 4),
            fatigue: Math.min(100, r.fatigue + 10),
          };
        }
      }
      return r;
    });

    setRoster(nextRoster);

    if (nextRoster.some(r => r.progress >= FINISH)) {
      setRaceActive(false);
      onFinishRace(
        nextRoster.map(r => ({
          name: r.name,
          org: r.org,
          progress: r.progress,
          isPlayer: r.isPlayer,
        }))
      );
    }
  };

  // Keyboard controls: Space for ability (if available) or turbo, ANY other key for turbo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // Prevent continuous hold
      if (e.code === 'Space') {
        e.preventDefault();
        if (!hasUsedAbility) {
          handleUseAbility();
        } else {
          handleTurbo();
        }
      } else {
        // Any other key triggers turbo!
        handleTurbo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUsedAbility]);

  // Weather events
  useEffect(() => {
    const eventTimer = setInterval(() => {
      if (!raceActiveRef.current) return;
      if (Math.random() < 0.35) {
        const events = [
          { id: 'calor', name: '¡OLA DE CALOR!\n(+ Fatiga para todos)' },
          { id: 'favorable', name: '¡CONDICIONES ÓPTIMAS!\n(+ Velocidad para todos)' },
        ];
        const ev = events[Math.floor(Math.random() * events.length)];
        setActiveEvent(ev);
        setTimeout(() => setActiveEvent(null), 3000);
      }
    }, 8000);

    return () => clearInterval(eventTimer);
  }, []);

  // Main race physics loop
  useEffect(() => {
    if (!raceActive) return;

    const timer = setInterval(() => {
      if (!raceActiveRef.current) return;

      setTickCount(t => t + 1);

      const nextRoster = rosterRef.current.map(r => {
        if (r.progress >= FINISH) return r;

        const { velocidad: vel, resistencia: res, recuperacion: rec } = r.org.stats;
        const effort = r.fatigue >= 100 ? 0.45 : r.fatigue > 65 ? 0.72 : 1;
        let speed = vel * SPEED_K * effort;
        if (activeEventRef.current?.id === 'favorable') speed *= 1.4;

        const newProgress = r.progress + speed;

        let gain = (vel * effort * FATIGUE_K) / Math.max(15, res);
        if (activeEventRef.current?.id === 'calor') gain *= 1.5;
        const decay = rec * RECOVERY_K;
        const newFatigue = Math.max(0, Math.min(100, r.fatigue + gain - decay));
        const overheated = newFatigue >= 100;

        return {
          ...r,
          progress: newProgress,
          fatigue: newFatigue,
          overheated,
        };
      });

      setRoster(nextRoster);

      const finished = nextRoster.some(r => r.progress >= FINISH);
      if (finished || tickCount >= MAX_TICKS) {
        setRaceActive(false);
        onFinishRace(
          nextRoster.map(r => ({
            name: r.name,
            org: r.org,
            progress: r.progress,
            isPlayer: r.isPlayer,
          }))
        );
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [raceActive, tickCount, onFinishRace]);

  const player = roster.find(r => r.isPlayer);
  const leader = roster.reduce(
    (prev, curr) => (curr.progress > prev.progress ? curr : prev),
    roster[0] || { name: '-', progress: 0 }
  );

  const secondsElapsed = (tickCount * (TICK_MS / 1000)).toFixed(1);

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-gradient-to-b from-[#74b9ff] via-[#74b9ff]/60 to-[#55efc4] relative overflow-hidden select-none p-2">
      {/* Event Banner */}
      {activeEvent && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#7b5ea7]/95 text-white px-6 py-2.5 rounded-2xl font-bold text-center z-50 border-4 border-white shadow-2xl animate-pulse">
          <div className="text-xl leading-tight whitespace-pre-line">{activeEvent.name}</div>
        </div>
      )}

      {/* Top HUD */}
      <div className="bg-[#2d3436]/95 text-white px-3 py-2 rounded-xl mb-2 border-b-4 border-[#2a9d8f] shadow">
        <div className="flex justify-between items-center text-xs mb-1">
          <button onClick={onExit} className="text-gray-300 hover:text-white cursor-pointer underline">
            ← Salir al Lab
          </button>
          <span className="font-bold text-[#81ecec] tracking-wider">CARRERA SOLO · 4 CLONES</span>
          <span className="text-yellow-300 font-mono font-bold">⏱️ {secondsElapsed}s</span>
        </div>

        <div className="flex items-center justify-between gap-1.5 mt-1 flex-wrap">
          {/* Fatigue Bar */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
            <span className="text-[11px] font-bold text-red-300">FATIGA:</span>
            <div className="flex-1 h-3 bg-gray-800 border border-gray-400 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-red-500 transition-all duration-150"
                style={{ width: `${player ? Math.min(100, player.fatigue) : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full text-[11px] font-bold truncate max-w-[120px] border border-white shadow">
            1º: {leader.name.split(' ')[0]}
          </div>

          {/* Turbo Tap Button (Any key or tap) */}
          <button
            onClick={handleTurbo}
            disabled={!raceActive || (player ? player.fatigue >= 100 : true)}
            className={`text-xs font-bold px-2 py-1 text-white border rounded shadow active:scale-95 transition-transform cursor-pointer flex items-center gap-1 ${
              isTurboActive
                ? 'bg-amber-500 border-yellow-200 scale-105 ring-2 ring-yellow-400'
                : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-300'
            }`}
          >
            <span>🚀</span> TURBO <span className="text-[10px] opacity-80">(Toca tecla)</span>
          </button>

          {/* Genetic Ability Button */}
          <button
            onClick={handleUseAbility}
            disabled={hasUsedAbility || (player ? player.fatigue >= 100 : true)}
            className={`btn text-xs font-bold px-2 py-1 text-white border rounded ${
              hasUsedAbility || (player && player.fatigue >= 100)
                ? 'bg-gray-600 opacity-50 cursor-not-allowed border-gray-400'
                : 'bg-blue-600 hover:bg-blue-500 cursor-pointer border-blue-300 shadow active:translate-y-0.5'
            }`}
          >
            {hasUsedAbility ? '¡HABILIDAD USADA!' : `✨ [ESPACIO] ${playerOrganism.ability.name.split(' ')[0]}`}
          </button>
        </div>
      </div>

      {/* Track container */}
      <div className="flex-1 bg-[#d35400] border-t-8 border-b-8 border-[#2a9d8f] relative rounded shadow-inner flex flex-col justify-around py-1">
        {/* Finish Line */}
        <div
          className="absolute right-[8%] top-0 bottom-0 w-6 border-l-2 border-r-2 border-white z-10 opacity-90"
          style={{
            backgroundImage: 'repeating-conic-gradient(#000 0% 25%, #fff 0% 50%)',
            backgroundSize: '16px 16px',
          }}
        />

        {/* 4 Lanes */}
        {roster.map((racer, index) => {
          const leftPercent = Math.min(84, (racer.progress / FINISH) * 84);
          const isPlayerTurbo = racer.isPlayer && isTurboActive;
          return (
            <div
              key={racer.key}
              className={`relative h-[24%] border-b border-dashed border-white/30 flex items-center ${
                racer.isPlayer ? 'bg-yellow-400/10' : ''
              }`}
            >
              <div
                className={`absolute transition-all duration-150 flex flex-col items-center select-none ${
                  racer.overheated ? 'sepia hue-rotate-[-50deg] saturate-200' : ''
                }`}
                style={{ left: `${leftPercent}%` }}
              >
                {/* Name Tag */}
                <div
                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold whitespace-nowrap shadow -mb-1 z-20 flex items-center gap-1 ${
                    racer.isPlayer ? 'bg-yellow-400 text-slate-900 border border-black' : 'bg-black/70 text-white'
                  }`}
                >
                  {racer.name}
                  {isPlayerTurbo && <span className="text-[10px] text-red-600 animate-bounce">⚡TURBO!</span>}
                </div>

                {/* Fatigue bar above racer */}
                <div className="w-10 h-1 bg-black rounded-full overflow-hidden border border-black/50 my-0.5 z-20">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-red-600 transition-all duration-150"
                    style={{ width: `${Math.min(100, racer.fatigue)}%` }}
                  />
                </div>

                <div className="relative">
                  {isPlayerTurbo && (
                    <div className="absolute -left-3 top-1 text-xs animate-ping">🔥</div>
                  )}
                  <CreatureSprite speciesId={racer.org.speciesId} mods={racer.org.mods} sizePx={54} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guitar Hero Rhythm Highway & Hit Controls */}
      <div className="mt-1.5 shadow-lg">
        <GuitarHeroTrack
          active={raceActive}
          onHit={handleGuitarHeroHit}
          combo={guitarHeroCombo}
          onComboChange={setGuitarHeroCombo}
        />
      </div>
    </div>
  );
};

