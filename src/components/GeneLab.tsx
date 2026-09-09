import React, { useState } from 'react';
import { BaseOrganism, GENE_MODS, ETHICS_EVENTS, GENERAL_FACTS, abilityForStance } from '../data/gameData';
import { GeneMod, Organism, EthicsOption, EthicsEvent, EthicsLogEntry } from '../types';
import { CreatureSprite } from './CreatureSprite';

interface GeneLabProps {
  base: BaseOrganism;
  onOrganismFinalized: (org: Organism, ethicsEntry: EthicsLogEntry) => void;
  onCancel: () => void;
}

const MAX_MODS = 4;
const MOD_WEIGHTS = [1, 0.7, 0.5, 0.35];

function clamp(v: number): number {
  return Math.max(5, Math.min(100, v));
}

function randSigned(n: number): number {
  return Math.floor(Math.random() * (n * 2 + 1)) - n;
}

function fmtDelta(v: number | string | undefined): string {
  if (v === undefined) return '+0';
  if (v === '?') return '±?';
  const num = typeof v === 'number' ? v : parseInt(String(v), 10);
  return (num > 0 ? '+' : '') + num;
}

export const GeneLab: React.FC<GeneLabProps> = ({ base, onOrganismFinalized, onCancel }) => {
  const [mods, setMods] = useState<GeneMod[]>([]);
  const [stats, setStats] = useState({ ...base.stats });
  const [activeToast, setActiveToast] = useState<{ tag: 'real' | 'juego'; text: string } | null>(null);

  // Ethics modal state
  const [ethicsModal, setEthicsModal] = useState<{
    event: EthicsEvent;
    intro: string;
    chosenOption: EthicsOption | null;
    generalFact: { tag: 'real' | 'juego'; text: string } | null;
  } | null>(null);

  const showFact = (fact: { tag: 'real' | 'juego'; text: string }) => {
    setActiveToast(fact);
    setTimeout(() => {
      setActiveToast(prev => (prev === fact ? null : prev));
    }, 4500);
  };

  const pickGeneMod = (mod: GeneMod) => {
    if (mods.length >= MAX_MODS) return;
    if (mods.some(m => m.id === mod.id)) return;

    const idx = mods.length;
    const w = MOD_WEIGHTS[idx] || 0.3;
    const m = mod.randomMod
      ? { velocidad: randSigned(12), resistencia: randSigned(12), recuperacion: randSigned(12) }
      : mod.mods;

    const newStats = {
      velocidad: clamp(stats.velocidad + Math.round((m.velocidad || 0) * w)),
      resistencia: clamp(stats.resistencia + Math.round((m.resistencia || 0) * w)),
      recuperacion: clamp(stats.recuperacion + Math.round((m.recuperacion || 0) * w)),
    };

    setStats(newStats);
    const newMods = [...mods, mod];
    setMods(newMods);
    showFact(mod.fact);
  };

  const handleFinishSequencing = () => {
    if (mods.length === 0) return;
    const hasGerminal = mods.some(m => m.id === 8);
    const event = hasGerminal
      ? ETHICS_EVENTS[0]
      : ETHICS_EVENTS[1 + Math.floor(Math.random() * (ETHICS_EVENTS.length - 1))];
    const comboNames = mods.map(m => m.name).join(', ');
    const intro = `Tu espécimen ya combina: ${comboNames}. `;

    setEthicsModal({
      event,
      intro,
      chosenOption: null,
      generalFact: null,
    });
  };

  const handleChooseEthics = (option: EthicsOption) => {
    const fact = GENERAL_FACTS[Math.floor(Math.random() * GENERAL_FACTS.length)];
    setEthicsModal(prev => (prev ? { ...prev, chosenOption: option, generalFact: fact } : null));
  };

  const handleConfirmEthics = () => {
    if (!ethicsModal || !ethicsModal.chosenOption) return;
    const option = ethicsModal.chosenOption;
    const eff = option.effect || {};

    const finalStats = {
      velocidad: clamp(stats.velocidad + (eff.velocidad || 0)),
      resistencia: clamp(stats.resistencia + (eff.resistencia || 0)),
      recuperacion: clamp(stats.recuperacion + (eff.recuperacion || 0)),
    };

    const ability = abilityForStance(option.stance);

    const newOrg: Organism = {
      id: Date.now() + Math.random(),
      baseName: base.name,
      speciesId: base.id,
      mods,
      stats: finalStats,
      ability,
    };

    const ethicsEntry: EthicsLogEntry = {
      prompt: ethicsModal.event.prompt,
      chosen: option.label,
      result: option.result,
    };

    onOrganismFinalized(newOrg, ethicsEntry);
  };

  const reachedMax = mods.length >= MAX_MODS;

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-gradient-to-br from-[#fdf6e3] to-[#e0d8c3] overflow-y-auto relative p-3">
      {/* Toast Notification */}
      {activeToast && (
        <div className="absolute left-3 right-3 bottom-3 bg-[#264653]/95 text-white rounded-xl p-3 text-base leading-snug z-50 border-2 border-[#e9c46a] shadow-xl">
          <span
            className={`font-bold px-2 py-0.5 rounded-full text-xs inline-block mb-1 ${
              activeToast.tag === 'real' ? 'bg-[#2a9d8f] text-white' : 'bg-[#e9c46a] text-[#264653]'
            }`}
          >
            💡 {activeToast.tag === 'real' ? 'CIENCIA REAL' : 'EN ESTE JUEGO'}
          </span>
          <br />
          {activeToast.text}
        </div>
      )}

      {/* Ethics Modal */}
      {ethicsModal && (
        <div className="absolute inset-0 bg-[#14191e]/90 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-4 border-[#7b5ea7] rounded-2xl p-4 max-w-sm w-full my-auto shadow-2xl">
            <h3 className="text-[#7b5ea7] text-2xl font-bold mb-2 text-center">⚖️ Dilema Ético Final</h3>
            <p className="text-lg leading-snug mb-3">
              {ethicsModal.intro}
              {ethicsModal.event.prompt}
            </p>

            {!ethicsModal.chosenOption ? (
              <div className="flex flex-col gap-2">
                {ethicsModal.event.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleChooseEthics(opt)}
                    className="btn text-left text-base p-2.5 bg-gray-100 hover:bg-purple-50 transition border-2 border-[#264653] rounded-lg cursor-pointer"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="text-sm bg-purple-50 border-2 border-[#7b5ea7] rounded-lg p-2.5 leading-snug">
                  {ethicsModal.chosenOption.result}
                </div>
                <div className="text-sm bg-purple-50 border-2 border-[#7b5ea7] rounded-lg p-2.5 leading-snug">
                  <b>🧬 Habilidad derivada de tu postura:</b>{' '}
                  <span className="text-[#e76f51] font-bold">
                    {abilityForStance(ethicsModal.chosenOption.stance).name}
                  </span>{' '}
                  — {abilityForStance(ethicsModal.chosenOption.stance).desc}.
                </div>
                {ethicsModal.generalFact && (
                  <div className="text-sm bg-amber-50 border-2 border-[#e9c46a] rounded-lg p-2.5 leading-snug">
                    <b>🧠 Para reflexionar:</b>
                    <br />
                    {ethicsModal.generalFact.text}
                  </div>
                )}
                <button onClick={handleConfirmEthics} className="btn btn-primary w-full mt-2 text-xl font-bold py-2">
                  GUARDAR ESPÉCIMEN EN LABORATORIO
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-1">
        <button onClick={onCancel} className="text-sm underline cursor-pointer text-[#264653]">
          ← Cambiar Base
        </button>
        <h2 className="subtitle text-xl font-bold text-[#264653]">SECUENCIADOR GENÉTICO</h2>
        <span className="text-xs bg-[#264653] text-white px-2 py-0.5 rounded font-mono">
          {mods.length}/{MAX_MODS}
        </span>
      </div>

      {/* Creature Showcase */}
      <div className="flex flex-col items-center justify-center my-1 bg-white/40 border-2 border-[#264653]/30 rounded-xl p-2">
        <CreatureSprite speciesId={base.id} mods={mods} sizePx={110} />
        <span className="font-bold text-lg mt-1 text-[#264653]">
          {base.name} <span className="text-xs font-normal opacity-80">({mods.length} modificaciones)</span>
        </span>

        {/* Stats Bars */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-xs mt-2 text-center text-sm">
          <div className="bg-white/80 p-1.5 rounded-lg border border-[#264653]/30">
            <div className="font-bold text-blue-700">Vel: {Math.round(stats.velocidad)}</div>
            <div className="bg-gray-200 h-2 rounded-full overflow-hidden mt-1">
              <div className="bg-[#0984e3] h-full transition-all" style={{ width: `${stats.velocidad}%` }} />
            </div>
          </div>
          <div className="bg-white/80 p-1.5 rounded-lg border border-[#264653]/30">
            <div className="font-bold text-orange-700">Res: {Math.round(stats.resistencia)}</div>
            <div className="bg-gray-200 h-2 rounded-full overflow-hidden mt-1">
              <div className="bg-[#e17055] h-full transition-all" style={{ width: `${stats.resistencia}%` }} />
            </div>
          </div>
          <div className="bg-white/80 p-1.5 rounded-lg border border-[#264653]/30">
            <div className="font-bold text-emerald-700">Rec: {Math.round(stats.recuperacion)}</div>
            <div className="bg-gray-200 h-2 rounded-full overflow-hidden mt-1">
              <div className="bg-[#00b894] h-full transition-all" style={{ width: `${stats.recuperacion}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-sm mb-2 text-[#264653] font-medium">
        {reachedMax
          ? '¡Espécimen completado! Hacé clic en Finalizar para resolver su dilema ético.'
          : 'Seleccioná modificaciones genéticas para combinar sus rasgos:'}
      </div>

      {/* Gene Mods Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {GENE_MODS.map(mod => {
          const already = mods.some(m => m.id === mod.id);
          const d = mod.randomMod ? { velocidad: '?', resistencia: '?', recuperacion: '?' } : mod.mods;
          return (
            <button
              key={mod.id}
              disabled={already || reachedMax}
              onClick={() => pickGeneMod(mod)}
              className={`text-left p-2 rounded-lg border-2 border-[#264653] transition flex flex-col justify-between ${
                already
                  ? 'bg-gray-300 opacity-40 cursor-not-allowed'
                  : reachedMax
                    ? 'bg-white/50 opacity-40 cursor-not-allowed'
                    : 'bg-white hover:bg-amber-50 cursor-pointer shadow-sm active:translate-y-0.5'
              }`}
            >
              <div className="text-sm font-bold leading-tight">
                {mod.icon && <span className="mr-1">{mod.icon}</span>}
                {mod.name}
              </div>
              <div className="text-xs opacity-75 mt-1 font-mono">
                Vel {fmtDelta(d.velocidad)} · Res {fmtDelta(d.resistencia)} · Rec {fmtDelta(d.recuperacion)}
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-center mt-auto pb-1">
        <button
          onClick={handleFinishSequencing}
          disabled={mods.length === 0}
          className={`btn btn-primary w-full py-2.5 text-xl font-bold cursor-pointer ${
            mods.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          FINALIZAR Y RESOLVER DILEMA ÉTICO
        </button>
      </div>
    </div>
  );
};
