import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import { Organism, Scientist } from '../types';
import { CreatureSprite } from './CreatureSprite';

interface FacilityProps {
  scientist: Scientist;
  organisms: Organism[];
  selectedOrganism: Organism | null;
  onSelectOrganism: (org: Organism | null) => void;
  onStartSoloRace: (org: Organism) => void;
  onStartDuel: (org: Organism) => void;
  onOpenDuelLobby: () => void;
  onCreateNewClone: () => void;
  onRecycleOrganism: (id: number | string) => void;
}

export const Facility: React.FC<FacilityProps> = ({
  scientist,
  organisms,
  selectedOrganism,
  onSelectOrganism,
  onStartSoloRace,
  onStartDuel,
  onOpenDuelLobby,
  onCreateNewClone,
  onRecycleOrganism,
}) => {
  const farmAreaRef = useRef<HTMLDivElement>(null);

  const handleCapturePhoto = async () => {
    if (!farmAreaRef.current) return;
    try {
      const canvas = await html2canvas(farmAreaRef.current, {
        backgroundColor: '#7bc04b',
        useCORS: true,
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `laboratorio_${scientist.name.toLowerCase().replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
      alert('No se pudo exportar la imagen del laboratorio.');
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-[#fdf6e3] overflow-hidden select-none">
      {/* Header bar */}
      <div className="bg-[#264653] text-white px-3 py-2 flex justify-between items-center border-b-4 border-[#2a9d8f]">
        <div>
          <h3 className="font-bold text-lg m-0 leading-tight">LABORATORIO DE {scientist.name.toUpperCase()}</h3>
          <p className="text-xs text-teal-200">Especímenes listos para entrenar y batallar</p>
        </div>
        <div className="bg-yellow-400 text-slate-900 px-3 py-1 rounded-full font-bold text-sm shadow">
          🧬 {organisms.length}
        </div>
      </div>

      {/* Pasture area */}
      <div
        ref={farmAreaRef}
        className="flex-1 bg-[#7bc04b] relative overflow-hidden min-h-[220px]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, #68a33f 4px, transparent 5px), radial-gradient(circle at 0 0, #68a33f 4px, transparent 5px)',
          backgroundSize: '40px 40px',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3)',
        }}
        onClick={e => {
          if (e.target === e.currentTarget) {
            onSelectOrganism(null);
          }
        }}
      >
        {organisms.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 text-white/90">
            <div className="text-4xl mb-2">🧪</div>
            <p className="font-bold text-xl drop-shadow">El laboratorio está vacío.</p>
            <p className="text-sm drop-shadow mb-3">Secuenciá tu primer espécimen para correr o desafiar amigos.</p>
            <button onClick={onCreateNewClone} className="btn btn-primary text-base font-bold py-1.5 px-4">
              CREAR ESPÉCIMEN
            </button>
          </div>
        ) : (
          organisms.map((org, index) => {
            const isSelected = selectedOrganism?.id === org.id;
            // Spread positions deterministically or via modulo
            const top = 10 + (index * 25) % 65;
            const left = 8 + (index * 28) % 68;

            return (
              <div
                key={org.id}
                onClick={e => {
                  e.stopPropagation();
                  onSelectOrganism(isSelected ? null : org);
                }}
                className={`absolute cursor-pointer flex flex-col items-center transition-transform duration-200 hover:scale-110 z-10 ${
                  isSelected ? 'scale-115 z-30 drop-shadow-[0_0_12px_gold]' : ''
                }`}
                style={{
                  top: `${top}%`,
                  left: `${left}%`,
                }}
              >
                <div className="drop-shadow-md">
                  <CreatureSprite speciesId={org.speciesId} mods={org.mods} sizePx={72} />
                </div>
                <div
                  className={`text-xs px-2 py-0.5 rounded border-2 font-bold whitespace-nowrap shadow -mt-2 max-w-[120px] truncate ${
                    isSelected ? 'bg-yellow-300 border-yellow-500 text-slate-900' : 'bg-white border-[#264653] text-[#264653]'
                  }`}
                >
                  {org.baseName} · {org.mods.length} mod.
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Action panel for selected clone */}
      {selectedOrganism && (
        <div className="bg-[#2d3436]/95 text-white p-3 mx-2 my-1 rounded-xl border-2 border-[#2a9d8f] text-center shadow-lg">
          <div className="flex justify-between items-center mb-1">
            <h4 className="text-[#81ecec] font-bold text-lg">{selectedOrganism.baseName}</h4>
            <span className="text-xs bg-purple-900/80 text-purple-200 px-2 py-0.5 rounded border border-purple-400">
              ⚡ {selectedOrganism.ability.name}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 my-1.5 text-xs text-left">
            <div className="bg-black/30 p-1.5 rounded">
              <span className="text-blue-300">Vel: {Math.round(selectedOrganism.stats.velocidad)}</span>
              <div className="h-1.5 bg-black/60 rounded-full overflow-hidden mt-0.5">
                <div className="h-full bg-blue-500" style={{ width: `${selectedOrganism.stats.velocidad}%` }} />
              </div>
            </div>
            <div className="bg-black/30 p-1.5 rounded">
              <span className="text-orange-300">Res: {Math.round(selectedOrganism.stats.resistencia)}</span>
              <div className="h-1.5 bg-black/60 rounded-full overflow-hidden mt-0.5">
                <div className="h-full bg-orange-500" style={{ width: `${selectedOrganism.stats.resistencia}%` }} />
              </div>
            </div>
            <div className="bg-black/30 p-1.5 rounded">
              <span className="text-emerald-300">Rec: {Math.round(selectedOrganism.stats.recuperacion)}</span>
              <div className="h-1.5 bg-black/60 rounded-full overflow-hidden mt-0.5">
                <div className="h-full bg-emerald-500" style={{ width: `${selectedOrganism.stats.recuperacion}%` }} />
              </div>
            </div>
          </div>

          <p className="text-xs text-left text-gray-300 truncate">
            <b className="text-yellow-300">Modificaciones:</b>{' '}
            {selectedOrganism.mods.length > 0
              ? selectedOrganism.mods.map(m => m.name).join(', ')
              : 'Genoma silvestre original'}
          </p>

          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onStartSoloRace(selectedOrganism)}
              className="btn btn-fight flex-1 py-1.5 px-2 text-sm font-bold cursor-pointer"
            >
              🏁 CARRERA SOLO
            </button>
            <button
              onClick={() => onStartDuel(selectedOrganism)}
              className="btn btn-primary flex-1 py-1.5 px-2 text-sm font-bold cursor-pointer bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 border-2 border-white shadow"
            >
              ⚔️ DUELO AMIGOS
            </button>
            <button
              onClick={() => onRecycleOrganism(selectedOrganism.id)}
              className="btn btn-danger py-1.5 px-2.5 text-xs font-bold cursor-pointer opacity-80 hover:opacity-100"
              title="Descartar este espécimen"
            >
              🗑️
            </button>
          </div>
        </div>
      )}

      {/* Bottom control bar */}
      <div className="bg-[#264653] p-2 flex gap-2 justify-between items-center">
        <button
          onClick={onCreateNewClone}
          className="btn btn-action flex-1 py-2 text-sm font-bold cursor-pointer"
        >
          ➕ NUEVO ESPÉCIMEN
        </button>

        <button
          onClick={() => {
            if (organisms.length === 0) {
              onCreateNewClone();
            } else {
              onOpenDuelLobby();
            }
          }}
          disabled={organisms.length === 0}
          className={`btn py-2 px-3 text-sm font-bold border-2 shadow ${
            organisms.length === 0
              ? 'bg-gray-400 text-gray-700 border-gray-500 opacity-50 cursor-not-allowed'
              : 'bg-amber-400 text-slate-900 border-yellow-100 cursor-pointer'
          }`}
          title={organisms.length === 0 ? 'Creá primero un espécimen en el laboratorio' : 'Entrar a duelos contra amigos'}
        >
          ⚔️ SALA DE DUELOS
        </button>

        <button
          onClick={handleCapturePhoto}
          className="btn btn-action py-2 px-3 text-sm font-bold cursor-pointer"
          title="Capturar foto del laboratorio"
        >
          📸 FOTO
        </button>
      </div>
    </div>
  );
};
