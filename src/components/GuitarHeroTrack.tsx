import React, { useState, useEffect, useRef, useCallback } from 'react';
import { guitarAudio } from '../utils/guitarAudio';

export interface GuitarHeroHitEvent {
  rating: 'PERFECT' | 'GOOD' | 'MISS';
  lane: number;
  combo: number;
}

interface GuitarHeroTrackProps {
  active: boolean;
  onHit: (event: GuitarHeroHitEvent) => void;
  combo: number;
  onComboChange: (combo: number) => void;
}

interface FallingNote {
  id: number;
  lane: number; // 0, 1, 2, 3
  y: number; // 0 (top) to 100 (bottom receptor)
  hit: boolean;
  missed: boolean;
}

const LANES = [
  { key: 'A', altKey: '1', name: 'Verde', color: 'from-emerald-400 to-green-600', ring: 'border-emerald-400', bg: 'bg-emerald-500', glow: '#10b981' },
  { key: 'S', altKey: '2', name: 'Rojo', color: 'from-red-400 to-rose-600', ring: 'border-rose-400', bg: 'bg-rose-500', glow: '#f43f5e' },
  { key: 'D', altKey: '3', name: 'Amarillo', color: 'from-amber-300 to-yellow-500', ring: 'border-amber-400', bg: 'bg-amber-400', glow: '#f59e0b' },
  { key: 'F', altKey: '4', name: 'Azul', color: 'from-sky-400 to-blue-600', ring: 'border-sky-400', bg: 'bg-sky-500', glow: '#0ea5e9' },
];

const TARGET_Y = 82; // Percentage where receptors sit
const HIT_WINDOW_PERFECT = 10; // ±10% from TARGET_Y (Satisfying and accessible)
const HIT_WINDOW_GOOD = 20; // ±20% from TARGET_Y (Intermediate tolerance)
const NOTE_SPEED = 0.40; // Balanced intermediate speed allowing clear reaction time

export const GuitarHeroTrack: React.FC<GuitarHeroTrackProps> = ({
  active,
  onHit,
  combo,
  onComboChange,
}) => {
  const [notes, setNotes] = useState<FallingNote[]>([]);
  const [pressedLanes, setPressedLanes] = useState<boolean[]>([false, false, false, false]);
  const [feedback, setFeedback] = useState<{ text: string; color: string; key: number } | null>(null);

  const notesRef = useRef<FallingNote[]>([]);
  notesRef.current = notes;

  const nextNoteId = useRef(1);
  const lastSpawnTime = useRef(Date.now());
  const animFrameId = useRef<number | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const comboRef = useRef(combo);
  comboRef.current = combo;

  const onHitRef = useRef(onHit);
  onHitRef.current = onHit;
  const onComboChangeRef = useRef(onComboChange);
  onComboChangeRef.current = onComboChange;

  // Visual feedback popup
  const showFeedback = useCallback((text: string, color: string) => {
    setFeedback({ text, color, key: Date.now() });
  }, []);

  // Handle a hit attempt on a specific lane
  const triggerLaneHit = useCallback((laneIndex: number) => {
    if (!activeRef.current) return;

    // Flash lane receptor
    setPressedLanes(prev => {
      const next = [...prev];
      next[laneIndex] = true;
      return next;
    });
    setTimeout(() => {
      setPressedLanes(prev => {
        const next = [...prev];
        next[laneIndex] = false;
        return next;
      });
    }, 120);

    const currentNotes = notesRef.current;
    // Find closest unhit note in this lane near TARGET_Y
    let candidate: FallingNote | null = null;
    let minDistance = Infinity;

    for (const note of currentNotes) {
      if (note.lane === laneIndex && !note.hit && !note.missed) {
        const dist = Math.abs(note.y - TARGET_Y);
        if (dist < minDistance) {
          minDistance = dist;
          candidate = note;
        }
      }
    }

    if (candidate && minDistance <= HIT_WINDOW_GOOD) {
      const isPerfect = minDistance <= HIT_WINDOW_PERFECT;
      const rating = isPerfect ? 'PERFECT' : 'GOOD';
      const newCombo = comboRef.current + 1;

      candidate.hit = true;
      guitarAudio.playNote(laneIndex, rating, newCombo);
      onComboChangeRef.current(newCombo);
      onHitRef.current({ rating, lane: laneIndex, combo: newCombo });

      if (isPerfect) {
        showFeedback('¡PERFECTO! 🔥', 'text-yellow-300 drop-shadow-[0_0_8px_rgba(234,179,8,0.9)]');
      } else {
        showFeedback('¡BIEN! ✨', 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]');
      }

      setNotes(prev => prev.map(n => (n.id === candidate!.id ? { ...n, hit: true } : n)));
    } else {
      // Pressed without note nearby -> Strike / Miss penalty
      guitarAudio.playNote(laneIndex, 'MISS', 0);
      onComboChangeRef.current(0);
      onHitRef.current({ rating: 'MISS', lane: laneIndex, combo: 0 });
      showFeedback('¡MISS! ❌', 'text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.8)]');
    }
  }, [showFeedback]);

  // Keyboard controls
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      const key = e.key.toUpperCase();
      let lane = -1;
      if (key === 'A' || key === '1' || key === 'ARROWLEFT') lane = 0;
      else if (key === 'S' || key === '2' || key === 'ARROWDOWN') lane = 1;
      else if (key === 'D' || key === '3' || key === 'ARROWUP') lane = 2;
      else if (key === 'F' || key === '4' || key === 'ARROWRIGHT') lane = 3;

      if (lane !== -1 && !e.repeat) {
        triggerLaneHit(lane);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, triggerLaneHit]);

  // Main animation and note spawning loop
  useEffect(() => {
    if (!active) {
      setNotes([]);
      notesRef.current = [];
      return;
    }

    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min(35, currentTime - lastTime);
      lastTime = currentTime;

      // Spawn notes periodically at intermediate rhythm tempo (680ms to 920ms)
      const now = Date.now();
      const spawnInterval = Math.max(680, 920 - Math.min(220, comboRef.current * 10));
      let currentList = [...notesRef.current];

      if (now - lastSpawnTime.current > spawnInterval) {
        lastSpawnTime.current = now;
        const lane = Math.floor(Math.random() * 4);
        const newNote: FallingNote = {
          id: nextNoteId.current++,
          lane,
          y: 0,
          hit: false,
          missed: false,
        };
        // Occasional double note only on high combo (>= 15)
        const notesToAppend: FallingNote[] = [newNote];
        if (comboRef.current >= 15 && Math.random() < 0.15) {
          const secondLane = (lane + 1 + Math.floor(Math.random() * 2)) % 4;
          notesToAppend.push({
            id: nextNoteId.current++,
            lane: secondLane,
            y: -4,
            hit: false,
            missed: false,
          });
        }

        currentList = [...currentList.slice(-16), ...notesToAppend];
      }

      // Update falling notes position
      const step = (NOTE_SPEED * (dt / 16.66));
      let comboDropped = false;
      const updated = currentList
        .map(note => {
          if (note.hit) return note;
          const nextY = note.y + step;

          // Note passed the hit receptor without being hit
          if (!note.missed && nextY > TARGET_Y + HIT_WINDOW_GOOD) {
            comboDropped = true;
            return { ...note, y: nextY, missed: true };
          }
          return { ...note, y: nextY };
        })
        .filter(note => note.y < 110 && !note.hit);

      notesRef.current = updated;
      setNotes(updated);

      if (comboDropped && comboRef.current > 0) {
        comboRef.current = 0;
        onComboChangeRef.current(0);
        showFeedback('¡MISS! ❌', 'text-red-400');
      }

      animFrameId.current = requestAnimationFrame(loop);
    };

    animFrameId.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [active, showFeedback]);

  return (
    <div className="w-full bg-[#1e1e24] border-2 border-[#264653] rounded-xl overflow-hidden shadow-2xl relative select-none flex flex-col">
      {/* Header bar: Guitar Hero title & Combo Rock Meter */}
      <div className="bg-gradient-to-r from-[#2b2d42] via-[#1f2421] to-[#2b2d42] px-2 py-1 flex items-center justify-between border-b border-white/20 text-white text-[11px]">
        <div className="flex items-center gap-1.5 font-bold tracking-wider text-amber-300">
          <span>🎸</span>
          <span className="font-mono">RITMO GENÉTICO</span>
          <span className="text-[10px] text-gray-400 font-normal hidden sm:inline">(Guitar Hero)</span>
        </div>

        {/* Combo multiplier badge */}
        <div className="flex items-center gap-1.5">
          <div
            className={`px-2 py-0.5 rounded-full font-bold font-mono text-[11px] transition-all transform ${
              combo >= 12
                ? 'bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-black animate-pulse scale-105'
                : combo >= 5
                  ? 'bg-amber-400 text-slate-900'
                  : combo > 0
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400'
            }`}
          >
            {combo > 0 ? `COMBO x${combo} ${combo >= 10 ? '🔥' : '⚡'}` : 'SIN COMBO'}
          </div>
        </div>
      </div>

      {/* Floating feedback alert */}
      {feedback && (
        <div
          key={feedback.key}
          className={`absolute top-10 left-1/2 -translate-x-1/2 z-40 text-sm sm:text-base font-black pointer-events-none animate-bounce ${feedback.color}`}
        >
          {feedback.text}
        </div>
      )}

      {/* The 4-Lane Highway */}
      <div className="relative h-32 sm:h-36 w-full bg-[#111318] flex overflow-hidden">
        {/* Subtle perspective grid lines */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.2)_100%)]" />

        {/* 4 Lanes */}
        {LANES.map((lane, idx) => (
          <div
            key={idx}
            className={`flex-1 relative border-r border-white/10 last:border-r-0 flex flex-col justify-end items-center pb-2 ${
              pressedLanes[idx] ? 'bg-white/10' : ''
            }`}
          >
            {/* Lane string glow */}
            <div className="absolute inset-y-0 w-0.5 bg-white/10 left-1/2 -translate-x-1/2 pointer-events-none" />

            {/* Target Receptor at TARGET_Y */}
            <div
              className="absolute left-1/2 -translate-x-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full border-3 flex items-center justify-center transition-transform z-10"
              style={{
                top: `${TARGET_Y}%`,
                transform: `translate(-50%, -50%) scale(${pressedLanes[idx] ? 1.2 : 1.0})`,
                borderColor: lane.glow,
                backgroundColor: pressedLanes[idx] ? `${lane.glow}66` : 'rgba(0,0,0,0.6)',
                boxShadow: pressedLanes[idx] ? `0 0 16px ${lane.glow}` : 'none',
              }}
            >
              <div
                className="w-3 h-3 sm:w-4 sm:h-4 rounded-full"
                style={{ backgroundColor: lane.glow }}
              />
            </div>
          </div>
        ))}

        {/* Target Hit Line Horizontal Bar */}
        <div
          className="absolute left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-yellow-400 to-sky-500 opacity-60 pointer-events-none z-0 shadow-[0_0_8px_rgba(255,255,255,0.4)]"
          style={{ top: `${TARGET_Y}%`, transform: 'translateY(-50%)' }}
        />

        {/* Falling Notes */}
        {notes.map(note => {
          if (note.hit) return null;
          const lane = LANES[note.lane];
          return (
            <div
              key={note.id}
              className={`absolute w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-b ${lane.color} shadow-lg z-20 flex items-center justify-center border-2 border-white`}
              style={{
                left: `${(note.lane * 25) + 12.5}%`,
                top: `${note.y}%`,
                transform: 'translate(-50%, -50%)',
                boxShadow: `0 0 12px ${lane.glow}`,
                opacity: note.missed ? 0.35 : 1,
              }}
            >
              <span className="text-[10px] text-white font-black drop-shadow">⚡</span>
            </div>
          );
        })}
      </div>

      {/* Interactive Touch/Click Hit Controls (Large Touch Targets for Mobile) */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-[#1a1c23] border-t border-white/20">
        {LANES.map((lane, idx) => (
          <button
            key={idx}
            type="button"
            onPointerDown={e => {
              e.preventDefault();
              triggerLaneHit(idx);
            }}
            className={`py-2 px-1 rounded-lg font-bold text-xs sm:text-sm text-white flex flex-col items-center justify-center transition active:scale-95 shadow-md cursor-pointer border-2 ${
              lane.ring
            } ${lane.bg} hover:brightness-110 active:brightness-125`}
            style={{
              boxShadow: pressedLanes[idx] ? `0 0 12px ${lane.glow}` : undefined,
            }}
          >
            <span className="font-mono text-xs sm:text-sm tracking-wider">[{lane.key}]</span>
            <span className="text-[9px] opacity-90 hidden sm:inline">{lane.name}</span>
          </button>
        ))}
      </div>

      <div className="bg-black/80 px-2 py-0.5 text-center text-[10px] text-gray-400">
        Tocá las notas al llegar al círculo con las teclas <b>[A] [S] [D] [F]</b> o los botones de colores para acelerar a tu espécimen.
      </div>
    </div>
  );
};
