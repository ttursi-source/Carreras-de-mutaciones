import React, { useState, useEffect } from 'react';
import { Organism, Scientist, EthicsLogEntry } from './types';
import { BASE_ORGANISMS, BaseOrganism, SCIENTIST_SPECS, ABILITIES } from './data/gameData';
import { CreatureSprite } from './components/CreatureSprite';
import { ScientistSprite } from './components/ScientistSprite';
import { GeneLab } from './components/GeneLab';
import { Facility } from './components/Facility';
import { SoloRace } from './components/SoloRace';
import { SoloPodium } from './components/SoloPodium';
import { DuelManager } from './components/DuelManager';
import { CloneCreator } from './components/CloneCreator';
import { generateRandomClone } from './utils/cloneGenerator';

type Screen = 'start' | 'scientist' | 'dilemma' | 'incubator' | 'facility' | 'solo_race' | 'solo_podium' | 'duel' | 'create_duel_clone';

export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [scientist, setScientist] = useState<Scientist>(() => {
    try {
      const saved = localStorage.getItem('genlab_scientist');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load scientist from localStorage', e);
    }
    return {
      name: 'Científico/a',
      avatarKey: 'LabOne',
    };
  });
  const [scientistNameInput, setScientistNameInput] = useState('');
  const [organisms, setOrganisms] = useState<Organism[]>(() => {
    try {
      const saved = localStorage.getItem('genlab_organisms');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load organisms from localStorage', e);
    }
    // Generate an initial unique custom clone
    return [generateRandomClone('Lab')];
  });
  const [selectedOrganism, setSelectedOrganism] = useState<Organism | null>(() => organisms[0] || null);

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('genlab_organisms', JSON.stringify(organisms));
    } catch (e) {
      console.error(e);
    }
  }, [organisms]);

  useEffect(() => {
    try {
      localStorage.setItem('genlab_scientist', JSON.stringify(scientist));
    } catch (e) {
      console.error(e);
    }
  }, [scientist]);

  // Dilemma state
  const [dilemmaChoices, setDilemmaChoices] = useState<[BaseOrganism, BaseOrganism]>([
    BASE_ORGANISMS[0],
    BASE_ORGANISMS[1],
  ]);
  const [chosenBase, setChosenBase] = useState<BaseOrganism | null>(null);

  // Ethics log & solo race results
  const [ethicsLog, setEthicsLog] = useState<EthicsLogEntry[]>([]);
  const [soloResults, setSoloResults] = useState<
    Array<{ name: string; org: Organism; progress: number; isPlayer: boolean }>
  >([]);

  // Duel room code if user arrived via invite link
  const [duelInviteCode, setDuelInviteCode] = useState<string | null>(null);
  const [returnScreenFromClone, setReturnScreenFromClone] = useState<Screen>('start');

  // Detect query parameters (?duel=CODE or ?room=CODE)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const duelCode = params.get('duel') || params.get('room');
      if (duelCode) {
        setDuelInviteCode(duelCode.toUpperCase());
        setReturnScreenFromClone('start');
        setScreen('create_duel_clone');
      }
    } catch (e) {
      console.error('Error parsing query params', e);
    }
  }, []);

  // Starter organism creator helper if needed
  const handleAddNewOrganism = (org: Organism) => {
    setOrganisms(prev => [...prev, org]);
  };

  const handleStartNewGame = () => {
    setScreen('scientist');
  };

  const handleConfirmScientist = () => {
    if (scientistNameInput.trim()) {
      setScientist(prev => ({ ...prev, name: scientistNameInput.trim() }));
    }
    setupDilemma();
    setScreen('dilemma');
  };

  const setupDilemma = () => {
    const b1 = BASE_ORGANISMS[Math.floor(Math.random() * BASE_ORGANISMS.length)];
    let b2 = BASE_ORGANISMS[Math.floor(Math.random() * BASE_ORGANISMS.length)];
    while (b2.id === b1.id) {
      b2 = BASE_ORGANISMS[Math.floor(Math.random() * BASE_ORGANISMS.length)];
    }
    setDilemmaChoices([b1, b2]);
  };

  const handleSelectBase = (base: BaseOrganism) => {
    setChosenBase(base);
    setScreen('incubator');
  };

  const handleOrganismFinalized = (org: Organism, ethicsEntry: EthicsLogEntry) => {
    setOrganisms(prev => [...prev, org]);
    setSelectedOrganism(org);
    setEthicsLog(prev => [...prev, ethicsEntry]);
    setChosenBase(null);
    setScreen('facility');
  };

  const handleStartSoloRace = (org: Organism) => {
    setSelectedOrganism(org);
    setScreen('solo_race');
  };

  const handleSoloRaceFinished = (
    results: Array<{ name: string; org: Organism; progress: number; isPlayer: boolean }>
  ) => {
    setSoloResults(results);
    setScreen('solo_podium');
  };

  const handleStartDuelFromOrganism = (org: Organism) => {
    setSelectedOrganism(org);
    setReturnScreenFromClone('facility');
    setScreen('create_duel_clone');
  };

  const handleOpenDuelLobby = () => {
    setReturnScreenFromClone(screen);
    setScreen('create_duel_clone');
  };

  const handleConfirmDuelClone = (newClone: Organism) => {
    setOrganisms(prev => [newClone, ...prev.filter(o => o.id !== newClone.id)]);
    setSelectedOrganism(newClone);
    setScreen('duel');
  };

  const handleRecycleOrganism = (id: number | string) => {
    setOrganisms(prev => prev.filter(o => o.id !== id));
    if (selectedOrganism?.id === id) {
      setSelectedOrganism(null);
    }
  };

  return (
    <main
      className="w-full h-full max-w-[440px] max-h-[860px] bg-[#fdf6e3] relative border-8 border-[#264653] rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none"
      id="game-container"
    >
      {/* ================= SCREEN: START ================= */}
      {screen === 'start' && (
        <div
          id="screen-start"
          className="flex-1 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#fdf6e3] to-[#e0d8c3] text-center"
        >
          <h1 className="pixel-text text-5xl font-bold text-[#e76f51] drop-shadow-[3px_3px_0px_#264653] tracking-widest mt-2">
            GENLAB
          </h1>
          <h2 className="subtitle text-2xl text-[#264653] font-bold drop-shadow-[1px_1px_0px_#e9c46a] mb-2">
            Carrera de la Evolución
          </h2>

          <div className="flex gap-4 my-3">
            <div className="animate-bounce" style={{ animationDuration: '1.2s' }}>
              <CreatureSprite speciesId={1} sizePx={76} />
            </div>
            <div className="animate-bounce" style={{ animationDuration: '1.2s', animationDelay: '0.3s' }}>
              <CreatureSprite speciesId={7} sizePx={76} />
            </div>
          </div>

          <p className="text-sm max-w-xs text-[#264653] opacity-90 leading-relaxed mb-4 px-2">
            Diseñá organismos ficticios combinando genética, tomá decisiones bioéticas y hacelos competir en carreras automáticas y{' '}
            <b className="text-[#e76f51]">duelos en tiempo real entre amigos</b>.
          </p>

          <div className="flex flex-col gap-2.5 w-full max-w-xs px-2">
            <button
              id="btn-start"
              onClick={handleStartNewGame}
              className="btn btn-primary py-3 text-xl font-bold cursor-pointer shadow-md"
            >
              NUEVA PARTIDA
            </button>

            <button
              id="btn-duel-menu"
              onClick={handleOpenDuelLobby}
              className="btn btn-fight py-2.5 text-lg font-bold cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <span>⚔️</span> DUELOS ENTRE AMIGOS
            </button>
          </div>
        </div>
      )}

      {/* ================= SCREEN: SCIENTIST ================= */}
      {screen === 'scientist' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#fdf6e3] to-[#e0d8c3]">
          <h2 className="subtitle text-2xl font-bold text-[#264653] mb-3">CREÁ TU CIENTÍFICO/A</h2>

          <div className="bg-white border-4 border-[#264653] rounded-2xl p-4 w-full max-w-xs shadow text-center mb-4">
            <label htmlFor="input-scientist-name" className="text-xs font-bold text-gray-500 uppercase block mb-1">
              Nombre:
            </label>
            <input
              id="input-scientist-name"
              type="text"
              placeholder="Tu nombre..."
              maxLength={14}
              value={scientistNameInput}
              onChange={e => setScientistNameInput(e.target.value)}
              className="font-mono text-center text-xl w-full p-2 border-3 border-[#264653] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3"
            />

            <p className="text-sm font-bold text-[#264653] mb-2">Elegí tu avatar de laboratorio:</p>
            <div className="flex justify-center gap-3">
              {(['LabOne', 'LabTwo', 'LabBot'] as const).map(key => {
                const isSelected = scientist.avatarKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setScientist(prev => ({ ...prev, avatarKey: key }))}
                    className={`w-20 h-24 border-3 rounded-xl flex items-center justify-center cursor-pointer transition ${
                      isSelected
                        ? 'border-[#e9c46a] bg-yellow-100 shadow-[0_0_12px_#e9c46a] scale-105'
                        : 'border-[#264653] bg-white/70 hover:bg-white'
                    }`}
                  >
                    <ScientistSprite avatarKey={key} sizePx={74} />
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleConfirmScientist}
            className="btn btn-primary w-full max-w-xs py-3 text-xl font-bold cursor-pointer"
          >
            EMPEZAR EXPERIMENTO
          </button>
        </div>
      )}

      {/* ================= SCREEN: DILEMMA (BASE SELECTION) ================= */}
      {screen === 'dilemma' && (
        <div className="flex-1 flex flex-col p-4 bg-gradient-to-br from-[#fdf6e3] to-[#e0d8c3] justify-between">
          <div className="text-center">
            <h2 className="subtitle text-2xl font-bold text-[#264653] mb-1">BASE GENÉTICA</h2>
            <div className="bg-white border-3 border-[#264653] rounded-xl p-2.5 text-base leading-snug shadow-sm">
              ¿Qué organismo base querés utilizar para comenzar tu secuenciación genética?
            </div>
          </div>

          <div className="flex flex-col gap-3 my-auto">
            {dilemmaChoices.map((base, idx) => (
              <button
                key={base.id}
                onClick={() => handleSelectBase(base)}
                className="btn bg-white hover:bg-amber-50 text-left p-3 flex items-center gap-3 rounded-xl border-3 border-[#264653] cursor-pointer shadow active:translate-y-1 transition"
              >
                <div className="bg-gray-100 rounded-lg p-1 border border-gray-300">
                  <CreatureSprite speciesId={base.id} sizePx={64} />
                </div>
                <div className="flex-1">
                  <span className="text-xl font-bold text-[#264653] block leading-none mb-1">
                    {base.name}
                  </span>
                  <span className="text-xs text-gray-600 block font-mono">
                    Velocidad: {base.stats.velocidad} · Resistencia: {base.stats.resistencia} · Recuperación:{' '}
                    {base.stats.recuperacion}
                  </span>
                  <span className="text-[11px] text-teal-700 font-bold mt-1 inline-block">
                    Elegir Opción {idx + 1} →
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={() => {
                setupDilemma();
              }}
              className="text-xs text-[#264653] underline cursor-pointer"
            >
              🔄 Mezclar otras especies
            </button>
          </div>
        </div>
      )}

      {/* ================= SCREEN: INCUBATOR (GENELAB) ================= */}
      {screen === 'incubator' && chosenBase && (
        <GeneLab
          base={chosenBase}
          onOrganismFinalized={handleOrganismFinalized}
          onCancel={() => setScreen('dilemma')}
        />
      )}

      {/* ================= SCREEN: FACILITY ================= */}
      {screen === 'facility' && (
        <Facility
          scientist={scientist}
          organisms={organisms}
          selectedOrganism={selectedOrganism}
          onSelectOrganism={setSelectedOrganism}
          onStartSoloRace={handleStartSoloRace}
          onStartDuel={handleStartDuelFromOrganism}
          onOpenDuelLobby={handleOpenDuelLobby}
          onCreateNewClone={() => {
            setupDilemma();
            setScreen('dilemma');
          }}
          onRecycleOrganism={handleRecycleOrganism}
        />
      )}

      {/* ================= SCREEN: SOLO RACE ================= */}
      {screen === 'solo_race' && selectedOrganism && (
        <SoloRace
          playerOrganism={selectedOrganism}
          scientist={scientist}
          onFinishRace={handleSoloRaceFinished}
          onExit={() => setScreen('facility')}
        />
      )}

      {/* ================= SCREEN: SOLO PODIUM ================= */}
      {screen === 'solo_podium' && (
        <SoloPodium
          results={soloResults}
          ethicsLog={ethicsLog}
          onReturnToFacility={() => setScreen('facility')}
          onRematch={() => {
            if (selectedOrganism) setScreen('solo_race');
            else setScreen('facility');
          }}
        />
      )}

      {/* ================= SCREEN: CREATE CLONE FOR DUEL ================= */}
      {screen === 'create_duel_clone' && (
        <CloneCreator
          scientist={scientist}
          onConfirmClone={handleConfirmDuelClone}
          onBack={() => setScreen(returnScreenFromClone || 'start')}
        />
      )}

      {/* ================= SCREEN: DUELS (ONLINE MULTIPLAYER) ================= */}
      {screen === 'duel' && (
        <DuelManager
          scientist={scientist}
          organisms={organisms}
          initialDuelCode={duelInviteCode}
          onExit={() => setScreen('facility')}
          onAddNewOrganism={handleAddNewOrganism}
          onOpenCloneCreator={() => {
            setReturnScreenFromClone('duel');
            setScreen('create_duel_clone');
          }}
        />
      )}
    </main>
  );
}
