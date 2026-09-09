import React, { useState } from 'react';
import { Organism, Scientist, Ability, GeneMod } from '../types';
import { BASE_ORGANISMS, GENE_MODS, ABILITIES } from '../data/gameData';
import { CreatureSprite } from './CreatureSprite';
import { generateRandomClone } from '../utils/cloneGenerator';

interface CloneCreatorProps {
  scientist: Scientist;
  onConfirmClone: (newClone: Organism) => void;
  onBack: () => void;
}

const CLONE_NAMES = [
  'Clon Alfa', 'Cyber-Quimera', 'Depredador X', 'Bio-Titán', 'Raptor Iónico',
  'Fénix Cuántico', 'Sombra Ápex', 'Nova Mutante', 'Giga Bestia', 'Vórtice Gen'
];

export const CloneCreator: React.FC<CloneCreatorProps> = ({
  scientist,
  onConfirmClone,
  onBack,
}) => {
  const [cloneName, setCloneName] = useState(() => {
    return CLONE_NAMES[Math.floor(Math.random() * CLONE_NAMES.length)];
  });

  const [selectedSpeciesId, setSelectedSpeciesId] = useState<number>(1);
  const [selectedAbility, setSelectedAbility] = useState<Ability>(ABILITIES[0]);
  const [selectedMods, setSelectedMods] = useState<GeneMod[]>([GENE_MODS[0]]);

  // Stats
  const baseOrg = BASE_ORGANISMS.find(b => b.id === selectedSpeciesId) || BASE_ORGANISMS[0];
  const [stats, setStats] = useState({
    velocidad: baseOrg.stats.velocidad,
    resistencia: baseOrg.stats.resistencia,
    recuperacion: baseOrg.stats.recuperacion,
  });

  const handleSelectSpecies = (id: number) => {
    setSelectedSpeciesId(id);
    const org = BASE_ORGANISMS.find(b => b.id === id);
    if (org) {
      setStats({
        velocidad: org.stats.velocidad,
        resistencia: org.stats.resistencia,
        recuperacion: org.stats.recuperacion,
      });
    }
  };

  const handleApplyPreset = (type: 'velocista' | 'tanque' | 'equilibrado' | 'recuperador') => {
    if (type === 'velocista') {
      setStats({ velocidad: 92, resistencia: 48, recuperacion: 55 });
      setSelectedAbility(ABILITIES[0]); // Nitro
    } else if (type === 'tanque') {
      setStats({ velocidad: 54, resistencia: 92, recuperacion: 65 });
      setSelectedAbility(ABILITIES[1]); // Escudo
    } else if (type === 'equilibrado') {
      setStats({ velocidad: 74, resistencia: 74, recuperacion: 74 });
      setSelectedAbility(ABILITIES[2]); // Ráfaga
    } else if (type === 'recuperador') {
      setStats({ velocidad: 64, resistencia: 56, recuperacion: 95 });
      setSelectedAbility(ABILITIES[3]); // Hiper-Recuperación
    }
  };

  const handleToggleMod = (mod: GeneMod) => {
    setSelectedMods(prev => {
      const exists = prev.some(m => m.id === mod.id);
      if (exists) {
        return prev.filter(m => m.id !== mod.id);
      } else {
        if (prev.length >= 3) return [...prev.slice(1), mod];
        return [...prev, mod];
      }
    });
  };

  const handleRandomizeClone = () => {
    const random = generateRandomClone(scientist.name);
    setCloneName(random.baseName);
    setSelectedSpeciesId(random.speciesId);
    setSelectedAbility(random.ability);
    setSelectedMods(random.mods);
    setStats({ ...random.stats });
  };

  const handleConfirm = () => {
    const finalName = cloneName.trim() || `Clon #${Math.floor(Math.random() * 900 + 100)}`;
    const newClone: Organism = {
      id: `clone_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      baseName: finalName,
      speciesId: selectedSpeciesId,
      mods: selectedMods,
      stats: {
        velocidad: Math.max(20, Math.min(100, stats.velocidad)),
        resistencia: Math.max(20, Math.min(100, stats.resistencia)),
        recuperacion: Math.max(20, Math.min(100, stats.recuperacion)),
      },
      ability: selectedAbility,
    };

    onConfirmClone(newClone);
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-gradient-to-br from-[#fdf6e3] via-[#f4ebd0] to-[#e4d7b5] overflow-y-auto p-4 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3 border-b-2 border-[#264653]/20 pb-2">
        <button
          onClick={onBack}
          className="text-xs font-bold text-[#264653] hover:underline flex items-center gap-1 cursor-pointer"
        >
          ← Volver
        </button>
        <span className="text-[11px] font-bold text-[#2a9d8f] uppercase tracking-wider bg-white/70 px-2 py-0.5 rounded-full border border-teal-300">
          Paso 1 de 2: Creación de Clon
        </span>
        <button
          onClick={handleRandomizeClone}
          className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold px-2.5 py-1 rounded-lg border border-amber-400 cursor-pointer shadow-sm transition active:scale-95 flex items-center gap-1"
          title="Genera un clon totalmente aleatorio con 1 clic"
        >
          🎲 Clon Aleatorio
        </button>
      </div>

      <div className="text-center mb-3">
        <h1 className="pixel-text text-2xl sm:text-3xl font-bold text-[#e76f51] leading-none mb-1">
          CREÁ TU CLON
        </h1>
        <p className="text-xs text-[#264653] max-w-sm mx-auto">
          Diseñá el clon con el que vas a correr en las <b>salas multijugador</b>.
        </p>
      </div>

      {/* Main Specimen Card & Live Preview */}
      <div className="bg-white border-3 border-[#264653] rounded-2xl p-3 shadow-md mb-3 max-w-md mx-auto w-full">
        <div className="flex items-center gap-3 bg-yellow-50/70 p-2.5 rounded-xl border border-yellow-200 mb-3">
          <div className="bg-white rounded-xl p-1.5 border-2 border-[#264653] shadow-inner flex items-center justify-center">
            <CreatureSprite speciesId={selectedSpeciesId} mods={selectedMods} sizePx={72} />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">
              Nombre de tu Clon:
            </label>
            <div className="flex gap-1.5 items-center">
              <input
                type="text"
                value={cloneName}
                onChange={e => setCloneName(e.target.value)}
                maxLength={20}
                placeholder="Nombre del Clon"
                className="font-bold text-sm text-[#264653] border-2 border-[#264653] rounded-lg px-2 py-1 w-full bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={() => setCloneName(CLONE_NAMES[Math.floor(Math.random() * CLONE_NAMES.length)])}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-400 rounded text-xs cursor-pointer"
                title="Generar nombre aleatorio"
              >
                🎲
              </button>
            </div>

            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-purple-800 font-bold">
              <span>⚡ {selectedAbility.name}</span>
              {selectedMods.length > 0 && (
                <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded">
                  {selectedMods.length} mut.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Bars with Adjusters */}
        <div className="space-y-1.5 text-xs mb-2">
          {/* Velocidad */}
          <div>
            <div className="flex justify-between font-bold text-[#264653] mb-0.5">
              <span>⚡ Velocidad: {stats.velocidad}</span>
              <span className="text-[10px] text-gray-500">Avance base en carrera</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="30"
                max="98"
                value={stats.velocidad}
                onChange={e => setStats(prev => ({ ...prev, velocidad: Number(e.target.value) }))}
                className="flex-1 accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Resistencia */}
          <div>
            <div className="flex justify-between font-bold text-[#264653] mb-0.5">
              <span>🛡️ Resistencia: {stats.resistencia}</span>
              <span className="text-[10px] text-gray-500">Resiste el calor del turbo</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="30"
                max="98"
                value={stats.resistencia}
                onChange={e => setStats(prev => ({ ...prev, resistencia: Number(e.target.value) }))}
                className="flex-1 accent-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Recuperación */}
          <div>
            <div className="flex justify-between font-bold text-[#264653] mb-0.5">
              <span>🔄 Recuperación: {stats.recuperacion}</span>
              <span className="text-[10px] text-gray-500">Velocidad de enfriamiento</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="30"
                max="98"
                value={stats.recuperacion}
                onChange={e => setStats(prev => ({ ...prev, recuperacion: Number(e.target.value) }))}
                className="flex-1 accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Stat Presets */}
        <div className="flex gap-1 justify-between pt-1 border-t border-gray-200">
          <button
            type="button"
            onClick={() => handleApplyPreset('velocista')}
            className="text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded px-1.5 py-1 cursor-pointer flex-1"
          >
            ⚡ Velocista
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('tanque')}
            className="text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded px-1.5 py-1 cursor-pointer flex-1"
          >
            🛡️ Tanque
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('equilibrado')}
            className="text-[10px] font-bold bg-gray-50 hover:bg-gray-100 text-gray-900 border border-gray-300 rounded px-1.5 py-1 cursor-pointer flex-1"
          >
            ⚖️ Equilibrado
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('recuperador')}
            className="text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded px-1.5 py-1 cursor-pointer flex-1"
          >
            🔄 Recup.
          </button>
        </div>
      </div>

      {/* Select Species */}
      <div className="bg-white/90 border-2 border-[#264653] rounded-xl p-3 mb-3 max-w-md mx-auto w-full">
        <label className="text-xs font-bold text-[#264653] uppercase block mb-1.5">
          Elegí la Especie Base del Genoma:
        </label>
        <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
          {BASE_ORGANISMS.map(base => {
            const isSelected = selectedSpeciesId === base.id;
            return (
              <button
                key={base.id}
                type="button"
                onClick={() => handleSelectSpecies(base.id)}
                className={`flex flex-col items-center p-1.5 rounded-lg border-2 cursor-pointer transition ${
                  isSelected
                    ? 'border-[#e76f51] bg-orange-50 shadow scale-102 font-bold'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                <CreatureSprite speciesId={base.id} sizePx={42} />
                <span className="text-[10px] mt-1 truncate w-full text-center">{base.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Select Ability */}
      <div className="bg-white/90 border-2 border-[#264653] rounded-xl p-3 mb-3 max-w-md mx-auto w-full">
        <label className="text-xs font-bold text-[#264653] uppercase block mb-1.5">
          Habilidad Especial de Carrera:
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {ABILITIES.map(ab => {
            const isSelected = selectedAbility.id === ab.id;
            return (
              <button
                key={ab.id}
                type="button"
                onClick={() => setSelectedAbility(ab)}
                className={`p-2 rounded-lg border-2 text-left cursor-pointer transition flex flex-col justify-between ${
                  isSelected
                    ? 'border-purple-600 bg-purple-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="font-bold text-xs text-[#264653] mb-0.5">{ab.name}</div>
                <div className="text-[10px] text-gray-600 leading-tight">{ab.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mutations / Gene Mods */}
      <div className="bg-white/90 border-2 border-[#264653] rounded-xl p-3 mb-4 max-w-md mx-auto w-full">
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-xs font-bold text-[#264653] uppercase">
            Mutaciones Genéticas ({selectedMods.length}/3):
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {GENE_MODS.slice(0, 6).map(mod => {
            const isSelected = selectedMods.some(m => m.id === mod.id);
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => handleToggleMod(mod)}
                className={`text-[11px] px-2 py-1 rounded-lg border cursor-pointer transition font-medium ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                    : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {mod.icon} {mod.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA Button */}
      <div className="max-w-md mx-auto w-full pt-1 pb-2">
        <button
          onClick={handleConfirm}
          className="btn btn-fight w-full py-3 text-base sm:text-lg font-bold cursor-pointer shadow-lg tracking-wide flex items-center justify-center gap-2"
        >
          <span>🧬</span> CONFIRMAR CLON Y ENTRAR A LAS SALAS <span>→</span>
        </button>
      </div>
    </div>
  );
};
