import React, { useState, useEffect, useRef } from 'react';
import { Organism, Scientist } from '../types';
import { BASE_ORGANISMS, GENE_MODS, ABILITIES } from '../data/gameData';
import { CreatureSprite } from './CreatureSprite';

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

const SPEED_K = 0.0075;
const FATIGUE_K = 0.9;
const RECOVERY_K = 0.032;
const TICK_MS = 150;
const MAX_TICKS = 480;
const FINISH = 100;

function clamp(v: number): number {
  return Math.max(5, Math.min(100, v));
}

function randSigned(n: number): number {
  return Math.floor(Math.random() * (n * 2 + 1)) - n;
}

function buildEnemyOrganism(index: number): Organism {
  const b = BASE_ORGANISMS[Math.floor(Math.random() * BASE_ORGANISMS.length)];
  const count = 1 + Math.floor(Math.random() * 3);
  const shuffled = [...GENE_MODS].sort(() => Math.random() - 0.5).slice(0, count);
  const stats = { ...b.stats };

  shuffled.forEach((mod, idx) => {
    const w = [1, 0.7, 0.5, 0.35][idx] || 0.3;
    const m = mod.randomMod
      ? { velocidad: randSigned(12), resistencia: randSigned(12), recuperacion: randSigned(12) }
      : mod.mods;
    stats.velocidad = clamp(stats.velocidad + Math.round((m.velocidad || 0) * w));
    stats.resistencia = clamp(stats.resistencia + Math.round((m.resistencia || 0) * w));
    stats.recuperacion = clamp(stats.recuperacion + Math.round((m.recuperacion || 0) * w));
  });

  return {
    id: `ai_${Date.now()}_${index}`,
    baseName: b.name,
    speciesId: b.id,
    mods: shuffled,
    stats,
    ability: ABILITIES[Math.floor(Math.random() * ABILITIES.length)],
  };
}

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

  const rosterRef = useRef<LocalRacer[]>([]);
  rosterRef.current = roster;
  const activeEventRef = useRef(activeEvent);
  activeEventRef.current = activeEvent;
  const raceActiveRef = useRef(raceActive);
  raceActiveRef.current = raceActive;

  // Initialize racers
  useEffect(() => {
    const enemies = [
      buildEnemyOrganism(0),
      buildEnemyOrganism(1),
      buildEnemyOrganism(2),
    ];

    const initialRoster: LocalRacer[] = [
      {
        key: 'player',
        name: scientist.name,
        org: playerOrganism,
        progress: 0,
        fatigue: 0,
        overheated: false,
        isPlayer: true,
      },
      {
        key: 'e0',
        name: `Rival A (${enemies[0].baseName})`,
        org: enemies[0],
        progress: 0,
        fatigue: 0,
        overheated: false,
        isPlayer: false,
      },
      {
        key: 'e1',
        name: `Rival B (${enemies[1].baseName})`,
        org: enemies[1],
        progress: 0,
        fatigue: 0,
        overheated: false,
        isPlayer: false,
      },
      {
        key: 'e2',
        name: `Rival C (${enemies[2].baseName})`,
        org: enemies[2],
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

  // Ability handler
  const handleUseAbility = () => {
    if (hasUsedAbility || !raceActiveRef.current) return;
    const player = rosterRef.current.find(r => r.isPlayer);
    if (!player || player.fatigue >= 100) return;

    setHasUsedAbility(true);
    const ab = playerOrganism.ability;

    const nextRoster = rosterRef.current.map(r => {
      if (r.isPlayer) {
        if (ab.id === 'turbo') return { ...r, progress: r.progress + 15 };
        if (ab.id === 'cool') return { ...r, fatigue: 0 };
        if (ab.id === 'absorb') return { ...r, progress: r.progress + 12 };
      } else {
        if (ab.id === 'confuse') {
          return {
            ...r,
            progress: Math.max(0, r.progress - 10),
            fatigue: Math.min(100, r.fatigue + 20),
          };
        }
        if (ab.id === 'absorb') {
          return {
            ...r,
            progress: Math.max(0, r.progress - 5),
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

  // Keyboard shortcut: Spacebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleUseAbility();
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
    }, 7000);

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
        const effort = r.fatigue >= 100 ? 0.25 : r.fatigue > 65 ? 0.65 : 1;
        let speed = vel * SPEED_K * effort;
        if (activeEventRef.current?.id === 'favorable') speed *= 1.5;

        const newProgress = r.progress + speed;

        let gain = (vel * effort * FATIGUE_K) / Math.max(15, res);
        if (activeEventRef.current?.id === 'calor') gain *= 1.6;
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
          <span className="font-bold text-[#81ecec] tracking-wider">CARRERA SOLO · 4 CARRILES</span>
          <span className="text-yellow-300">⚡ Carrera Automática</span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-xs font-bold text-red-300">FATIGA:</span>
            <div className="flex-1 max-w-[100px] h-3 bg-gray-800 border border-gray-400 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-red-500 transition-all duration-150"
                style={{ width: `${player ? Math.min(100, player.fatigue) : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-amber-400 text-slate-900 px-3 py-0.5 rounded-full text-xs font-bold truncate max-w-[140px] border border-white shadow">
            Líder: {leader.name.split(' ')[0]}
          </div>

          <button
            onClick={handleUseAbility}
            disabled={hasUsedAbility || (player ? player.fatigue >= 100 : true)}
            className={`btn text-xs font-bold px-2.5 py-1 text-white border rounded ${
              hasUsedAbility || (player && player.fatigue >= 100)
                ? 'bg-gray-600 opacity-50 cursor-not-allowed border-gray-400'
                : 'bg-blue-600 hover:bg-blue-500 cursor-pointer border-blue-300 shadow active:translate-y-0.5'
            }`}
          >
            {hasUsedAbility ? '¡USADA!' : `[ESPACIO] ${playerOrganism.ability.name.split(' ')[0]}`}
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
          return (
            <div
              key={racer.key}
              className={`relative h-[24%] border-b border-dashed border-white/30 flex items-center ${
                index === 3 ? 'border-b-0 bg-yellow-400/10' : ''
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
                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold whitespace-nowrap shadow -mb-1 z-20 ${
                    racer.isPlayer ? 'bg-yellow-400 text-slate-900 border border-black' : 'bg-black/70 text-white'
                  }`}
                >
                  {racer.name}
                </div>

                {/* Fatigue bar above racer */}
                <div className="w-10 h-1 bg-black rounded-full overflow-hidden border border-black/50 my-0.5 z-20">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-red-600 transition-all duration-150"
                    style={{ width: `${Math.min(100, racer.fatigue)}%` }}
                  />
                </div>

                <CreatureSprite speciesId={racer.org.speciesId} mods={racer.org.mods} sizePx={54} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-center text-[#264653] font-medium mt-1">
        Carrera 100% automática según la genética de cada corredor. Presioná <b>[ESPACIO]</b> o hacé clic en la habilidad para usar tu ventaja.
      </p>
    </div>
  );
};
