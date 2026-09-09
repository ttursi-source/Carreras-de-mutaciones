import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import { Organism, EthicsLogEntry } from '../types';
import { CreatureSprite } from './CreatureSprite';

interface SoloPodiumProps {
  results: Array<{ name: string; org: Organism; progress: number; isPlayer: boolean }>;
  ethicsLog: EthicsLogEntry[];
  onReturnToFacility: () => void;
  onRematch: () => void;
}

export const SoloPodium: React.FC<SoloPodiumProps> = ({
  results,
  ethicsLog,
  onReturnToFacility,
  onRematch,
}) => {
  const podiumRef = useRef<HTMLDivElement>(null);

  // Sort descending by progress
  const sorted = [...results].sort((a, b) => b.progress - a.progress);
  const medals = ['🥇', '🥈', '🥉', '4°'];

  const handleCapturePodium = async () => {
    if (!podiumRef.current) return;
    try {
      const canvas = await html2canvas(podiumRef.current, {
        backgroundColor: '#fdf6e3',
        useCORS: true,
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `podio_genlab_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
      alert('No se pudo exportar la imagen del podio.');
    }
  };

  return (
    <div
      ref={podiumRef}
      className="flex-1 flex flex-col w-full h-full bg-gradient-to-br from-[#fdf6e3] to-[#e0d8c3] overflow-y-auto p-3 select-none"
    >
      <h2 className="subtitle text-2xl font-bold text-center text-[#264653] my-1">
        🏆 PODIO FINAL DE LA CARRERA
      </h2>

      {/* Podium items */}
      <div className="flex flex-col gap-2 my-2">
        {sorted.map((r, idx) => {
          const s = r.org.stats;
          let why = '';
          if (idx === 0) {
            why = `Victoria por balance superior: Vel ${Math.round(s.velocidad)}, Res ${Math.round(s.resistencia)}, Rec ${Math.round(s.recuperacion)}.`;
          } else if (s.velocidad > 75 && s.resistencia < 45) {
            why = `Salió muy rápido pero sufrió la fatiga por su baja resistencia (${Math.round(s.resistencia)}).`;
          } else if (s.resistencia > 75 && s.velocidad < 45) {
            why = `Gran resistencia (${Math.round(s.resistencia)}) sin agotarse, pero le faltó aceleración pura.`;
          } else {
            why = `Desempeño equilibrado pero no suficiente para superar al líder.`;
          }

          return (
            <div
              key={idx}
              className={`flex items-center gap-3 p-2.5 rounded-xl border-2 shadow-sm ${
                r.isPlayer
                  ? 'bg-amber-100/90 border-amber-500 shadow-md ring-2 ring-amber-300'
                  : 'bg-white border-[#264653]/30'
              }`}
            >
              <div className="text-2xl w-8 text-center font-bold">{medals[idx]}</div>
              <CreatureSprite speciesId={r.org.speciesId} mods={r.org.mods} sizePx={52} />
              <div className="flex-1 text-xs leading-tight">
                <div className="font-bold text-sm text-[#264653]">
                  {r.name} {r.isPlayer ? '(Vos)' : ''}
                </div>
                <div className="text-gray-600">
                  {r.org.baseName} · {r.org.mods.length} mod. genéticas
                </div>
                <div className="text-gray-700 mt-1 italic text-[11px]">{why}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ethics Recap */}
      <div className="bg-purple-50 border-2 border-[#7b5ea7] rounded-xl p-3 my-2 text-xs leading-snug">
        <h4 className="font-bold text-[#7b5ea7] text-sm mb-1">⚖️ Bioética en tus decisiones:</h4>
        {ethicsLog.length > 0 ? (
          <ul className="list-disc pl-4 space-y-1">
            {ethicsLog.map((e, i) => (
              <li key={i}>
                <b>Postura:</b> {e.chosen}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">
            Aún no tomaste decisiones éticas en esta sesión. Aparecerán al finalizar cada modificación en el laboratorio.
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 mt-auto pt-2 pb-1">
        <div className="flex gap-2">
          <button
            onClick={onRematch}
            className="btn btn-fight flex-1 py-2 text-sm font-bold cursor-pointer"
          >
            🔁 OTRA CARRERA
          </button>
          <button
            onClick={handleCapturePodium}
            className="btn btn-action flex-1 py-2 text-sm font-bold cursor-pointer"
          >
            📸 CAPTURAR PODIO
          </button>
        </div>
        <button
          onClick={onReturnToFacility}
          className="btn btn-primary w-full py-2.5 text-base font-bold cursor-pointer"
        >
          VOLVER AL LABORATORIO
        </button>
      </div>
    </div>
  );
};
