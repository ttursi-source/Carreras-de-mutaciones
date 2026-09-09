import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Organism, Scientist, DuelRoomState, DuelPlayer, RacerState } from '../types';
import { BASE_ORGANISMS, ABILITIES } from '../data/gameData';
import { CreatureSprite } from './CreatureSprite';
import { PeerDuelService } from '../services/peerDuelService';
import { generateRandomClone } from '../utils/cloneGenerator';
import { GuitarHeroTrack, GuitarHeroHitEvent } from './GuitarHeroTrack';

interface DuelManagerProps {
  scientist: Scientist;
  organisms: Organism[];
  initialDuelCode?: string | null;
  onExit: () => void;
  onAddNewOrganism: (org: Organism) => void;
  onOpenCloneCreator?: () => void;
}

export const DuelManager: React.FC<DuelManagerProps> = ({
  scientist,
  organisms,
  initialDuelCode = null,
  onExit,
  onAddNewOrganism,
  onOpenCloneCreator,
}) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [transport, setTransport] = useState<'ws' | 'p2p'>('ws');
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<DuelRoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>(initialDuelCode || '');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Tabs for lobby selection
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const [customPublicCode, setCustomPublicCode] = useState('');
  const [customRoomNumber, setCustomRoomNumber] = useState('');

  // Turbo mechanics
  const [turboFlash, setTurboFlash] = useState(false);
  const [turboCooldown, setTurboCooldown] = useState(false);

  // Selected specimen for duel
  const [selectedOrg, setSelectedOrg] = useState<Organism | null>(() => {
    return organisms.length > 0 ? organisms[0] : null;
  });

  // Chat message state
  const [chatInput, setChatInput] = useState('');
  const [abilityBanner, setAbilityBanner] = useState<string | null>(null);
  const [countdownDisplay, setCountdownDisplay] = useState<string | number | null>(null);
  const [guitarHeroCombo, setGuitarHeroCombo] = useState<number>(0);

  const podiumRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const p2pRef = useRef<PeerDuelService | null>(null);

  // Fallback starter organism if player has none
  const ensureOrganism = (): Organism => {
    if (selectedOrg) return selectedOrg;
    if (organisms.length > 0) return organisms[0];

    // Create a starter base organism
    const starterBase = BASE_ORGANISMS[0]; // Veloxis
    const starter: Organism = {
      id: `starter_${Date.now()}`,
      baseName: starterBase.name,
      speciesId: starterBase.id,
      mods: [],
      stats: { ...starterBase.stats },
      ability: ABILITIES[0],
    };
    onAddNewOrganism(starter);
    setSelectedOrg(starter);
    return starter;
  };

  // Shared game message processor
  const handleGameMessage = (msg: any) => {
    if (msg.type === 'ROOM_CREATED' || msg.type === 'ROOM_JOINED') {
      setRoom(msg.room);
      setMyPlayerId(msg.playerId);
      setErrorMessage('');
    } else if (msg.type === 'ROOM_UPDATE') {
      setRoom(msg.room);
    } else if (msg.type === 'COUNTDOWN') {
      setCountdownDisplay(msg.count);
      if (msg.count === '¡YA!') {
        setTimeout(() => setCountdownDisplay(null), 1000);
      }
    } else if (msg.type === 'RACE_STARTED') {
      setRoom(msg.room);
      setCountdownDisplay(null);
      setGuitarHeroCombo(0);
    } else if (msg.type === 'RACE_TICK') {
      setRoom(prev => (prev ? { ...prev, roster: msg.roster, activeEvent: msg.activeEvent } : prev));
    } else if (msg.type === 'RACE_EVENT') {
      setRoom(prev => (prev ? { ...prev, activeEvent: msg.event } : prev));
    } else if (msg.type === 'ABILITY_TRIGGERED') {
      setAbilityBanner(msg.message);
      setTimeout(() => setAbilityBanner(null), 3000);
      setRoom(prev => (prev ? { ...prev, roster: msg.roster } : prev));
    } else if (msg.type === 'GUITAR_HERO_SYNC') {
      if (msg.roster) {
        setRoom(prev => (prev ? { ...prev, roster: msg.roster } : prev));
      }
      if (msg.playerId === myPlayerId && msg.rating === 'PERFECT') {
        setTurboFlash(true);
        setTimeout(() => setTurboFlash(false), 200);
      }
    } else if (msg.type === 'TURBO_TRIGGERED') {
      if (msg.roster) {
        setRoom(prev => (prev ? { ...prev, roster: msg.roster } : prev));
      }
      if (msg.playerId === myPlayerId) {
        setTurboFlash(true);
        setTimeout(() => setTurboFlash(false), 200);
      }
    } else if (msg.type === 'PUBLIC_ROOMS_LIST') {
      setPublicRooms(msg.rooms || []);
    } else if (msg.type === 'RACE_FINISHED') {
      setRoom(msg.room);
    } else if (msg.type === 'CHAT_MESSAGE') {
      setRoom(prev =>
        prev ? { ...prev, chatMessages: [...prev.chatMessages, msg.message].slice(-25) } : prev
      );
    } else if (msg.type === 'ERROR') {
      setErrorMessage(msg.message);
    }
  };

  // Connect via WebSocket or fallback to PeerJS (WebRTC) for Vercel/static deployments
  useEffect(() => {
    let wsInstance: WebSocket | null = null;
    let isMounted = true;
    let wsConnected = false;

    // Initialize P2P service fallback
    const p2p = new PeerDuelService({
      onMessage: msg => {
        if (isMounted) handleGameMessage(msg);
      },
      onError: err => {
        if (isMounted) setErrorMessage(err);
      },
      onConnected: () => {
        if (isMounted) {
          setConnected(true);
          setErrorMessage('');
        }
      },
      onDisconnected: () => {
        if (isMounted) setConnected(false);
      },
    });
    p2pRef.current = p2p;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      wsInstance = new WebSocket(wsUrl);

      const wsTimeout = setTimeout(() => {
        if (!wsConnected && isMounted) {
          console.info('Servidor WebSocket no disponible. Activando modo Peer-to-Peer para Vercel/WebRTC.');
          setTransport('p2p');
          setConnected(true);
          if (initialDuelCode) {
            const org = ensureOrganism();
            p2p.joinRoom(initialDuelCode, scientist.name, scientist.avatarKey, org);
          }
        }
      }, 1200);

      wsInstance.onopen = () => {
        wsConnected = true;
        clearTimeout(wsTimeout);
        if (!isMounted) return;
        setTransport('ws');
        setConnected(true);
        setErrorMessage('');

        if (initialDuelCode) {
          const org = ensureOrganism();
          wsInstance?.send(
            JSON.stringify({
              type: 'JOIN_ROOM',
              roomCode: initialDuelCode.toUpperCase(),
              playerName: scientist.name,
              avatarKey: scientist.avatarKey,
              organism: org,
            })
          );
        }
      };

      wsInstance.onclose = () => {
        if (!wsConnected && isMounted) {
          clearTimeout(wsTimeout);
          setTransport('p2p');
          setConnected(true);
        } else if (isMounted) {
          setConnected(false);
        }
      };

      wsInstance.onerror = () => {
        if (!wsConnected && isMounted) {
          clearTimeout(wsTimeout);
          setTransport('p2p');
          setConnected(true);
          if (initialDuelCode) {
            const org = ensureOrganism();
            p2p.joinRoom(initialDuelCode, scientist.name, scientist.avatarKey, org);
          }
        }
      };

      wsInstance.onmessage = event => {
        try {
          const msg = JSON.parse(event.data);
          handleGameMessage(msg);
        } catch (err) {
          console.error('Error al procesar mensaje WS', err);
        }
      };

      setWs(wsInstance);
    } catch (e) {
      setTransport('p2p');
      setConnected(true);
    }

    return () => {
      isMounted = false;
      if (wsInstance) wsInstance.close();
      p2p.destroy();
    };
  }, []);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.chatMessages]);

  // Poll public rooms if on WebSocket and in lobby view
  useEffect(() => {
    if (transport === 'ws' && ws && ws.readyState === WebSocket.OPEN && !room) {
      ws.send(JSON.stringify({ type: 'GET_PUBLIC_ROOMS' }));
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN && !room) {
          ws.send(JSON.stringify({ type: 'GET_PUBLIC_ROOMS' }));
        }
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [transport, ws, room]);

  // Keyboard controls during race:
  // [ESPACIO] = Habilidad especial
  // CUALQUIER OTRA TECLA = Turbo boost!
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (room?.status !== 'racing') return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleUseAbility();
      } else {
        // Any key generates turbo!
        handleUseTurbo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [room?.status, transport, ws, turboCooldown]);

  const handleUseTurbo = () => {
    if (room?.status !== 'racing') return;
    if (turboCooldown) return;
    setTurboCooldown(true);
    setTimeout(() => setTurboCooldown(false), 150);

    setTurboFlash(true);
    setTimeout(() => setTurboFlash(false), 200);

    if (transport === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'USE_TURBO' }));
    } else if (transport === 'p2p') {
      p2pRef.current?.useTurbo();
    }
  };

  const handleCreateRoom = (customCode?: string, isPublic = true) => {
    const org = ensureOrganism();
    if (transport === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'CREATE_ROOM',
          playerName: scientist.name,
          avatarKey: scientist.avatarKey,
          organism: org,
          isPublic,
        })
      );
    } else {
      // P2P WebRTC fallback for Vercel
      p2pRef.current?.createRoom(scientist.name, scientist.avatarKey, org, customCode, isPublic);
    }
  };

  const handleJoinRoom = (codeToJoin?: string, autoCreateIfMissing = false) => {
    const targetCode = (codeToJoin || inputCode).toUpperCase().trim();
    if (!targetCode) {
      setErrorMessage('Ingresá el código de 4 letras de la sala.');
      return;
    }
    const org = ensureOrganism();
    if (transport === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          roomCode: targetCode,
          playerName: scientist.name,
          avatarKey: scientist.avatarKey,
          organism: org,
          autoCreateIfMissing,
        })
      );
    } else {
      // P2P WebRTC fallback for Vercel
      p2pRef.current?.joinRoom(targetCode, scientist.name, scientist.avatarKey, org, autoCreateIfMissing);
    }
  };

  const handleJoinPublicArena = (arenaCode: string) => {
    handleJoinRoom(arenaCode, true);
  };

  const handleGenerateNewClone = () => {
    const newClone = generateRandomClone(scientist.name);
    onAddNewOrganism(newClone);
    setSelectedOrg(newClone);
    if (room && (room.status === 'lobby' || room.status === 'countdown')) {
      handleSelectDifferentOrganism(newClone);
    }
  };

  const handleSelectDifferentOrganism = (org: Organism) => {
    setSelectedOrg(org);
    if (transport === 'ws' && ws && ws.readyState === WebSocket.OPEN && room) {
      ws.send(
        JSON.stringify({
          type: 'UPDATE_ORGANISM',
          organism: org,
        })
      );
    } else if (transport === 'p2p') {
      p2pRef.current?.updateOrganism(org);
    }
  };

  const handleToggleReady = () => {
    if (transport === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'TOGGLE_READY' }));
    } else if (transport === 'p2p') {
      p2pRef.current?.toggleReady();
    }
  };

  const handleStartRace = () => {
    if (transport === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'START_RACE' }));
    } else if (transport === 'p2p') {
      p2pRef.current?.startRace();
    }
  };

  const handleUseAbility = () => {
    if (transport === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'USE_ABILITY' }));
    } else if (transport === 'p2p') {
      p2pRef.current?.useAbility();
    }
  };

  const handleSendChat = (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text) return;
    if (transport === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SEND_CHAT', text }));
      setChatInput('');
    } else if (transport === 'p2p') {
      p2pRef.current?.sendChat(text);
      setChatInput('');
    }
  };

  const handleRequestRematch = () => {
    if (transport === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'REQUEST_REMATCH' }));
    } else if (transport === 'p2p') {
      p2pRef.current?.requestRematch();
    }
  };

  const handleLeaveRoom = () => {
    if (transport === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'LEAVE_ROOM' }));
    } else if (transport === 'p2p') {
      p2pRef.current?.leaveRoom();
    }
    setRoom(null);
    setErrorMessage('');
  };

  const handleCopyInviteLink = () => {
    if (!room) return;
    const url = `${window.location.origin}${window.location.pathname}?duel=${room.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleCaptureDuelPodium = async () => {
    if (!podiumRef.current) return;
    try {
      const canvas = await html2canvas(podiumRef.current, {
        backgroundColor: '#264653',
        useCORS: true,
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `duelo_genlab_${room?.code || 'amigos'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
      alert('No se pudo exportar la imagen del duelo.');
    }
  };

  const handleGuitarHeroHit = (event: GuitarHeroHitEvent) => {
    if (transport === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'GUITAR_HERO_HIT', rating: event.rating, combo: event.combo }));
    } else if (transport === 'p2p') {
      p2pRef.current?.guitarHeroHit(event.rating, event.combo);
    }
    if (event.rating === 'PERFECT') {
      setTurboFlash(true);
      setTimeout(() => setTurboFlash(false), 200);
    }
  };

  const me = room?.players.find(p => p.id === myPlayerId);
  const isHost = !!me?.isHost;
  const allReady = room?.players.every(p => p.ready || p.isHost);
  const canStart = isHost && (room?.players.length || 0) >= 1;

  // ================= VIEW 1: NO ROOM JOINED YET (Lobby Browser) =================
  if (!room) {
    const NUMBERED_ROOMS = [1, 2, 3, 4, 5, 6, 7, 8];

    return (
      <div className="flex-1 flex flex-col w-full h-full bg-gradient-to-br from-[#fdf6e3] via-[#e0d8c3] to-[#d8cca8] overflow-y-auto p-4 select-none">
        <div className="flex justify-between items-center mb-3">
          <button onClick={onExit} className="text-sm underline cursor-pointer text-[#264653] font-bold">
            ← Volver al Laboratorio
          </button>
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {connected
              ? transport === 'p2p'
                ? '🌐 Red P2P Directa (Sin Servidor)'
                : '⚡ Servidor WebSocket'
              : 'Conectando...'}
          </div>
        </div>

        <div className="text-center mb-3">
          <h1 className="pixel-text text-3xl font-bold text-[#e76f51] leading-none mb-1">
            DUELOS MULTIJUGADOR
          </h1>
          <p className="text-xs text-[#264653] max-w-md mx-auto">
            Competí en tiempo real con <b>tu clon personalizado</b> en las salas públicas o en salas privadas.
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-100 border-2 border-red-500 text-red-800 p-2.5 rounded-xl text-xs font-bold mb-3 text-center">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Selected Specimen & Clone Creator */}
        <div className="bg-white/85 border-2 border-[#264653] rounded-xl p-3 mb-3 shadow-sm max-w-lg mx-auto w-full">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[#264653] uppercase">
              🧬 Tu Clon para la Carrera:
            </span>
            <div className="flex gap-1.5">
              {onOpenCloneCreator && (
                <button
                  onClick={onOpenCloneCreator}
                  className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer shadow flex items-center gap-1 transition active:scale-95"
                  title="Personalizá o creá un nuevo clon"
                >
                  🧬 Crear / Editar Clon
                </button>
              )}
              <button
                onClick={handleGenerateNewClone}
                className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold px-2 py-1 rounded-lg cursor-pointer shadow flex items-center gap-1 transition active:scale-95"
                title="Crea un clon mutante aleatorio"
              >
                🎲 Aleatorio
              </button>
            </div>
          </div>

          {selectedOrg ? (
            <div className="flex items-center gap-3 bg-yellow-50/60 p-2 rounded-lg border border-yellow-200">
              <CreatureSprite speciesId={selectedOrg.speciesId} mods={selectedOrg.mods} sizePx={60} />
              <div className="flex-1 text-xs">
                <div className="font-bold text-sm text-[#264653] flex items-center gap-1.5">
                  {selectedOrg.baseName}
                  {selectedOrg.mods.length > 0 && (
                    <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded border border-purple-300">
                      {selectedOrg.mods.length} mutación(es)
                    </span>
                  )}
                </div>
                <div className="text-gray-600 font-mono text-[11px] mt-0.5">
                  Vel {Math.round(selectedOrg.stats.velocidad)} · Res {Math.round(selectedOrg.stats.resistencia)} · Rec{' '}
                  {Math.round(selectedOrg.stats.recuperacion)}
                </div>
                <div className="text-purple-700 font-bold text-[11px] mt-0.5">
                  ⚡ Habilidad: {selectedOrg.ability.name}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-600 italic py-2">
              Se creará automáticamente un espécimen inicial para tu duelo.
            </div>
          )}

          {/* Quick toggle if multiple specimens exist */}
          {organisms.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pt-2 mt-2 border-t border-gray-200">
              {organisms.map(org => (
                <button
                  key={org.id}
                  onClick={() => handleSelectDifferentOrganism(org)}
                  className={`px-2 py-1 rounded text-xs border font-bold cursor-pointer transition ${
                    selectedOrg?.id === org.id
                      ? 'bg-yellow-400 border-yellow-600 text-black shadow'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {org.baseName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab Switcher: Public Lobbies vs Private Room */}
        <div className="flex justify-center max-w-md mx-auto w-full mb-3">
          <div className="bg-black/15 p-1 rounded-xl flex w-full border border-[#264653]/30">
            <button
              onClick={() => setActiveTab('public')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg cursor-pointer transition ${
                activeTab === 'public'
                  ? 'bg-[#264653] text-yellow-300 shadow'
                  : 'text-[#264653] hover:bg-white/40'
              }`}
            >
              🌍 SALAS PÚBLICAS (1, 2, 3...)
            </button>
            <button
              onClick={() => setActiveTab('private')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg cursor-pointer transition ${
                activeTab === 'private'
                  ? 'bg-[#264653] text-yellow-300 shadow'
                  : 'text-[#264653] hover:bg-white/40'
              }`}
            >
              🔒 SALA PRIVADA (Con Amigos)
            </button>
          </div>
        </div>

        {/* TAB 1: PUBLIC NUMBERED ROOMS */}
        {activeTab === 'public' && (
          <div className="max-w-lg mx-auto w-full space-y-3">
            <div className="bg-amber-100/90 border border-amber-300 text-amber-900 px-3 py-2 rounded-xl text-xs flex items-center justify-between shadow-sm">
              <span>
                🏁 <b>Salas Públicas:</b> Todas las salas tienen las mismas condiciones reglamentarias. Tocá en cualquier sala para ingresar y competir.
              </span>
            </div>

            {/* Grid of Equal Numbered Rooms: Sala 1, Sala 2, etc. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {NUMBERED_ROOMS.map(num => {
                const roomCode = String(num);
                const activeRoom = publicRooms.find(pr => String(pr.code) === roomCode);
                const count = activeRoom ? activeRoom.playerCount : 0;
                const hasPlayers = count > 0;

                return (
                  <div
                    key={num}
                    className="bg-white border-2 border-[#264653] rounded-xl p-3 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-base text-[#264653]">Sala {num}</span>
                        <span className="text-[11px] font-mono bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                          #{num}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mb-1.5">
                        Pista Estándar de Competencia · 2 a 4 Jugadores
                      </div>
                      <div className="text-xs font-bold mb-2 flex items-center gap-1.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            hasPlayers ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
                          }`}
                        />
                        {hasPlayers ? (
                          <span className="text-emerald-700">
                            {count}/4 Jugadores (Anfitrión: {activeRoom.hostName})
                          </span>
                        ) : (
                          <span className="text-gray-500">Disponible (0/4 jugadores)</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleJoinPublicArena(roomCode)}
                      disabled={!connected}
                      className="btn btn-fight w-full py-2 text-xs font-bold cursor-pointer tracking-wide"
                    >
                      ⚔️ ENTRAR A SALA {num}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick entry to any room number */}
            <div className="bg-white/90 border-2 border-[#264653] rounded-xl p-3 text-center shadow-sm">
              <span className="text-xs font-bold text-[#264653] block mb-1.5">
                ¿Querés entrar a otra sala numerada? (Ej: 9, 10, 11, etc.)
              </span>
              <div className="flex gap-2 max-w-xs mx-auto">
                <input
                  type="number"
                  min="1"
                  placeholder="N° de Sala"
                  value={customRoomNumber}
                  onChange={e => setCustomRoomNumber(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customRoomNumber.trim()) {
                      handleJoinPublicArena(customRoomNumber.trim());
                    }
                  }}
                  className="flex-1 font-mono text-center text-sm font-bold border-2 border-[#264653] rounded-lg p-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  onClick={() => {
                    if (customRoomNumber.trim()) {
                      handleJoinPublicArena(customRoomNumber.trim());
                    }
                  }}
                  disabled={!connected || !customRoomNumber.trim()}
                  className="btn btn-primary text-xs px-4 py-1.5 font-bold cursor-pointer"
                >
                  ENTRAR
                </button>
              </div>
            </div>

            {/* Active rooms found on WebSocket server */}
            {publicRooms.length > 0 && (
              <div className="bg-white border-2 border-[#264653] rounded-xl p-3 shadow">
                <div className="text-xs font-bold text-[#264653] mb-2 flex items-center justify-between">
                  <span>📡 SALAS PÚBLICAS ACTIVAS EN VIVO:</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    {publicRooms.length} disponible(s)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {publicRooms.map(pr => (
                    <div
                      key={pr.code}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs"
                    >
                      <div>
                        <span className="font-bold font-mono text-[#264653] mr-2">[{pr.code}]</span>
                        <span className="text-gray-700">Anfitrión: {pr.hostName}</span>
                        <span className="text-gray-500 ml-2">({pr.playerCount}/4 jugadores)</span>
                      </div>
                      <button
                        onClick={() => handleJoinRoom(pr.code)}
                        className="btn btn-action text-xs px-3 py-1 font-bold cursor-pointer"
                      >
                        UNIRSE
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create custom public room */}
            <div className="bg-white/80 border border-gray-300 rounded-xl p-3 text-center">
              <span className="text-xs font-bold text-gray-700 block mb-1.5">
                ¿Querés abrir una sala pública con tu propio código?
              </span>
              <div className="flex gap-2 max-w-xs mx-auto">
                <input
                  type="text"
                  placeholder="Ej: COLIS"
                  value={customPublicCode}
                  onChange={e => setCustomPublicCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="flex-1 uppercase font-mono text-center text-sm font-bold border-2 border-[#264653] rounded-lg p-1.5 bg-white"
                />
                <button
                  onClick={() => {
                    const code = customPublicCode.trim() || undefined;
                    handleCreateRoom(code, true);
                  }}
                  disabled={!connected}
                  className="btn btn-primary text-xs px-3 py-1.5 font-bold cursor-pointer"
                >
                  ABRIR LOBBY
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRIVATE ROOM WITH FRIENDS */}
        {activeTab === 'private' && (
          <div className="flex flex-col gap-3 max-w-sm mx-auto w-full">
            {/* Card 1: Create Private Room */}
            <div className="bg-white border-3 border-[#264653] rounded-xl p-4 shadow text-center">
              <h3 className="font-bold text-lg text-[#264653] mb-1">👑 CREAR SALA PRIVADA</h3>
              <p className="text-xs text-gray-600 mb-3">
                Creá una sala y compartile el código o link directo a tu amigo. Con solo 2 jugadores ya compiten 1 vs 1.
              </p>
              <button
                onClick={() => handleCreateRoom(undefined, false)}
                disabled={!connected}
                className="btn btn-primary w-full py-2.5 text-base font-bold cursor-pointer"
              >
                CREAR SALA PRIVADA
              </button>
            </div>

            <div className="text-center font-bold text-sm text-[#264653] my-0.5">— O —</div>

            {/* Card 2: Join Room with Code */}
            <div className="bg-white border-3 border-[#264653] rounded-xl p-4 shadow text-center">
              <h3 className="font-bold text-lg text-[#264653] mb-1">🎮 UNIRSE CON CÓDIGO</h3>
              <p className="text-xs text-gray-600 mb-2">Ingresá el código de 4 caracteres de tu amigo:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="CÓDIGO (Ej: GEN4)"
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="flex-1 uppercase font-mono text-center text-xl font-bold border-3 border-[#264653] rounded-lg p-2 bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  onClick={() => handleJoinRoom()}
                  disabled={!connected || !inputCode.trim()}
                  className="btn btn-fight px-4 py-2 text-base font-bold cursor-pointer"
                >
                  UNIRSE
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= VIEW 2: DUEL LOBBY =================
  if (room.status === 'lobby' || room.status === 'countdown') {
    return (
      <div className="flex-1 flex flex-col w-full h-full bg-gradient-to-br from-[#fdf6e3] via-[#e0d8c3] to-[#d8cca8] overflow-y-auto p-3 select-none relative">
        {/* Big Countdown Overlay */}
        {countdownDisplay !== null && (
          <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center text-white text-center">
            <div className="text-8xl font-bold text-yellow-400 animate-bounce">{countdownDisplay}</div>
            <div className="text-xl mt-2 tracking-widest">¡PREPARADOS!</div>
          </div>
        )}

        {/* Lobby Header */}
        <div className="flex justify-between items-center bg-[#264653] text-white px-3 py-2 rounded-xl border-b-4 border-[#2a9d8f] shadow mb-2">
          <div>
            <span className="text-xs text-teal-200">PISTA DE COMPETENCIA</span>
            <div className="text-2xl font-mono font-black text-yellow-400 tracking-wider flex items-center gap-2">
              {/^\d+$/.test(room.code) ? `SALA ${room.code}` : room.code}
              <button
                onClick={handleCopyCode}
                className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded cursor-pointer font-sans font-normal"
                title="Copiar código para compartir"
              >
                {copiedCode ? '¡Copiado!' : 'Copiar PIN'}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopyInviteLink}
              className="btn btn-action text-xs py-1.5 px-2.5 font-bold cursor-pointer bg-emerald-600 hover:bg-emerald-500 border-emerald-300"
            >
              {copiedLink ? '✓ ¡Link Copiado!' : '📋 Link Amigos'}
            </button>
            <button
              onClick={handleLeaveRoom}
              className="btn text-xs py-1.5 px-2 font-bold cursor-pointer bg-red-800 text-white border-red-500"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Invite helper banner */}
        <div className="bg-amber-100 border border-amber-400 text-amber-900 px-3 py-1.5 rounded-lg text-xs mb-2 flex items-center justify-between flex-wrap gap-2">
          <span>
            💡 PIN de sala: <b>{room.code}</b>. <b>¡No hay límite de jugadores!</b> Todos los que tengan el código pueden sumarse.
          </span>
          <span className="font-bold text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-full shadow-sm">
            👥 {room.players.length} Corredor{room.players.length > 1 ? 'es' : ''} (Sin límite)
          </span>
        </div>

        {/* Players List Grid - Responsive & Scrollable for Unlimited Racers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-2 max-h-[300px] overflow-y-auto pr-1">
          {room.players.map(p => {
            const isMe = p.id === myPlayerId;
            return (
              <div
                key={p.id}
                className={`p-2.5 rounded-xl border-2 shadow-sm relative transition-all ${
                  isMe
                    ? 'bg-yellow-50 border-yellow-500 ring-2 ring-yellow-400/30'
                    : 'bg-white border-[#264653]/40 hover:border-[#264653]'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-[#264653] flex items-center gap-1 truncate max-w-[130px]">
                    {p.name} {isMe && '(Vos)'}
                    {p.isHost && (
                      <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.2 rounded font-bold">
                        HOST
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      p.ready
                        ? 'bg-emerald-500 text-white'
                        : p.isHost
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-300 text-gray-700'
                    }`}
                  >
                    {p.ready ? '✓ LISTO' : p.isHost ? 'HOST' : 'ESPERA'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <CreatureSprite speciesId={p.organism.speciesId} mods={p.organism.mods} sizePx={48} />
                  <div className="flex-1 text-xs min-w-0">
                    <div className="font-bold text-[#264653] truncate">{p.organism.baseName}</div>
                    <div className="text-gray-600 font-mono text-[10px]">
                      Vel {Math.round(p.organism.stats.velocidad)} · Res{' '}
                      {Math.round(p.organism.stats.resistencia)}
                    </div>
                    <div className="text-purple-700 font-bold text-[10px] truncate">
                      ⚡ {p.organism.ability.name}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Slot for waiting or inviting more friends */}
          <div className="p-3 rounded-xl border-2 border-dashed border-[#264653]/40 flex flex-col items-center justify-center text-center text-gray-500 bg-white/40 hover:bg-white/60 transition">
            <span className="text-lg">➕</span>
            <span className="text-xs font-bold text-[#264653]">¡Entran todos!</span>
            <span className="text-[10px] text-gray-500">Compartí el PIN <b>{room.code}</b></span>
          </div>
        </div>

        {/* Change my organism or clone a new one inside lobby */}
        <div className="bg-white/90 border border-gray-300 rounded-xl p-2 mb-2 text-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-gray-700">Tu espécimen para la carrera:</span>
            <div className="flex gap-1">
              {onOpenCloneCreator && (
                <button
                  onClick={onOpenCloneCreator}
                  className="text-[11px] bg-purple-600 hover:bg-purple-700 text-white font-bold px-2 py-0.5 rounded cursor-pointer shadow flex items-center gap-1 transition active:scale-95"
                  title="Diseñá un clon personalizado"
                >
                  🧬 Personalizar
                </button>
              )}
              <button
                onClick={handleGenerateNewClone}
                className="text-[11px] bg-amber-500 hover:bg-amber-600 text-white font-bold px-2 py-0.5 rounded cursor-pointer shadow flex items-center gap-1 transition active:scale-95"
                title="Crea un clon mutante único con sus propios stats y habilidades"
              >
                + 🎲 Clonar
              </button>
            </div>
          </div>
          {organisms.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pt-1">
              {organisms.map(org => (
                <button
                  key={org.id}
                  onClick={() => handleSelectDifferentOrganism(org)}
                  className={`px-2 py-0.5 rounded border text-[11px] font-bold cursor-pointer ${
                    selectedOrg?.id === org.id
                      ? 'bg-yellow-400 border-yellow-600 text-black'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {org.baseName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Emotes and Chat */}
        <div className="bg-white/90 border-2 border-[#264653]/40 rounded-xl p-2 mb-2 flex-1 flex flex-col min-h-[140px] max-h-[180px]">
          <div className="text-[11px] font-bold text-gray-500 mb-1">CHAT & PROVOCACIONES:</div>
          <div className="flex-1 overflow-y-auto text-xs space-y-1 pr-1 font-mono">
            {room.chatMessages.map((m, idx) => (
              <div key={idx} className="leading-tight">
                <span className="text-gray-400 text-[10px]">[{m.time}] </span>
                <span className="font-bold text-[#264653]">{m.sender}: </span>
                <span className="text-slate-800">{m.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Taunt Buttons */}
          <div className="flex gap-1 overflow-x-auto py-1 border-t border-gray-200 mt-1">
            {['¡Mi espécimen vuela! ⚡', '¡Te voy a ganar! 🏆', '¡Buena suerte! 🤝', '🧬 Genética perfecta', '🥵 Cuidado con la fatiga'].map(
              (taunt, i) => (
                <button
                  key={i}
                  onClick={() => handleSendChat(taunt)}
                  className="bg-gray-100 hover:bg-amber-100 border border-gray-300 rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap cursor-pointer"
                >
                  {taunt}
                </button>
              )
            )}
          </div>

          <div className="flex gap-1 mt-1">
            <input
              type="text"
              placeholder="Escribí un mensaje..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              maxLength={70}
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none"
            />
            <button
              onClick={() => handleSendChat()}
              className="bg-[#264653] text-white px-2.5 py-1 text-xs font-bold rounded cursor-pointer"
            >
              Enviar
            </button>
          </div>
        </div>

        {/* Start / Ready Buttons */}
        <div className="mt-auto">
          {isHost ? (
            <button
              onClick={handleStartRace}
              disabled={!canStart}
              className="btn btn-primary w-full py-3.5 text-lg sm:text-xl font-black cursor-pointer shadow-xl animate-pulse bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 text-white border-2 border-yellow-300"
            >
              {room.players.length < 2
                ? '🚀 ¡INICIAR CARRERA AHORA! (O esperar a tus amigos)'
                : `🏁 ¡INICIAR CARRERA YA! (${room.players.length} jugadores listos)`}
            </button>
          ) : (
            <button
              onClick={handleToggleReady}
              className={`btn w-full py-3 text-lg font-bold cursor-pointer shadow-lg ${
                me?.ready ? 'btn-action bg-emerald-600 border-emerald-300 text-white' : 'btn-primary'
              }`}
            >
              {me?.ready ? '✓ ¡ESTÁS LISTO! (Esperando a que el anfitrión inicie...)' : 'MARCAR COMO LISTO'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ================= VIEW 3: MULTIPLAYER RACE =================
  if (room.status === 'racing') {
    const totalRacers = room.roster.length;
    const sortedRoster = [...room.roster].sort((a, b) => b.progress - a.progress);
    const meRacer = room.roster.find(r => r.playerId === myPlayerId);
    const myRank = sortedRoster.findIndex(r => r.playerId === myPlayerId) + 1;
    const leader = sortedRoster[0] || { name: '-', progress: 0 };

    return (
      <div className="flex-1 flex flex-col w-full h-full bg-gradient-to-b from-[#74b9ff] via-[#74b9ff]/60 to-[#55efc4] relative overflow-hidden select-none p-2">
        {/* Weather event banner */}
        {room.activeEvent && (
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#7b5ea7]/95 text-white px-6 py-2.5 rounded-2xl font-bold text-center z-50 border-4 border-white shadow-2xl animate-pulse">
            <div className="text-xl leading-tight whitespace-pre-line">{room.activeEvent.name}</div>
          </div>
        )}

        {/* Ability banner notification */}
        {abilityBanner && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-yellow-400 text-slate-900 border-2 border-black px-4 py-1.5 rounded-full font-bold text-xs shadow-xl z-40 animate-bounce">
            ⚡ {abilityBanner}
          </div>
        )}

        {/* Race HUD */}
        <div className="bg-[#2d3436]/95 text-white px-3 py-2 rounded-xl mb-1.5 border-b-4 border-[#2a9d8f] shadow">
          <div className="flex justify-between items-center text-xs mb-1 flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-300 font-mono">
                {/^\d+$/.test(room.code) ? `SALA ${room.code}` : `SALA: ${room.code}`}
              </span>
              <span className="text-[10px] bg-teal-800 text-teal-200 px-2 py-0.5 rounded-full font-semibold">
                👥 {totalRacers} corredores
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* My live rank pill */}
              <div className="flex items-center gap-1 bg-yellow-400 text-slate-900 px-2.5 py-0.5 rounded-full font-black text-xs shadow">
                <span>{myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🏃'}</span>
                <span>PUESTO #{myRank} de {totalRacers}</span>
              </div>
              <span className="text-[11px] bg-emerald-500/80 text-white px-2 py-0.5 rounded-full font-bold">
                EN VIVO
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
            {/* My Fatigue Meter */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
              <span className="text-[11px] font-bold text-red-300">TU FATIGA:</span>
              <div className="flex-1 max-w-[120px] h-3 bg-gray-800 border border-gray-400 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 transition-all duration-150"
                  style={{ width: `${meRacer ? Math.min(100, meRacer.fatigue) : 0}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-gray-300">
                {meRacer ? Math.round(meRacer.fatigue) : 0}%
              </span>
            </div>

            {/* Leader badge */}
            <div className="bg-amber-300 text-slate-900 px-2.5 py-0.5 rounded-full text-xs font-bold truncate max-w-[160px] border border-white shadow flex items-center gap-1">
              <span>👑 1º:</span>
              <span className="truncate">{leader.name}</span>
              <span className="font-mono text-[10px] text-gray-700">({Math.round(leader.progress)}%)</span>
            </div>

            {/* Actions: Turbo + Ability */}
            <div className="flex items-center gap-1.5">
              {/* Turbo boost button */}
              <button
                onClick={handleUseTurbo}
                disabled={meRacer ? meRacer.fatigue >= 100 || meRacer.finished : true}
                className={`btn text-xs font-bold px-2.5 py-1 text-white border rounded cursor-pointer transition ${
                  meRacer && (meRacer.fatigue >= 100 || meRacer.finished)
                    ? 'bg-gray-600 opacity-50 cursor-not-allowed border-gray-400'
                    : turboFlash
                      ? 'bg-amber-400 text-slate-900 border-yellow-200 scale-105 shadow-lg font-black'
                      : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 border-amber-300 shadow active:scale-95'
                }`}
                title="Presioná cualquier tecla para dar un empujón de turbo (genera fatiga)"
              >
                {turboFlash ? '⚡ ¡TURBO! 💨' : '⚡ TURBO'}
              </button>

              {/* Ability button */}
              <button
                onClick={handleUseAbility}
                disabled={me?.usedAbility || (meRacer ? meRacer.fatigue >= 100 : true)}
                className={`btn text-xs font-bold px-2.5 py-1 text-white border rounded cursor-pointer ${
                  me?.usedAbility || (meRacer && meRacer.fatigue >= 100)
                    ? 'bg-gray-600 opacity-50 cursor-not-allowed border-gray-400'
                    : 'bg-blue-600 hover:bg-blue-500 border-blue-300 shadow active:translate-y-0.5'
                }`}
              >
                {me?.usedAbility
                  ? '¡USADA!'
                  : `[ESPACIO] ${me?.organism.ability.name.split(' ')[0] || 'HABILIDAD'}`}
              </button>
            </div>
          </div>
        </div>

        {/* Global Panoramic Track (Minimap for ALL racers) */}
        <div className="bg-[#2d3436] rounded-lg p-1.5 mb-1.5 border border-[#2a9d8f]/60 shadow">
          <div className="flex justify-between items-center text-[10px] text-teal-300 font-bold mb-0.5 px-1">
            <span>🚩 SALIDA (0%)</span>
            <span className="text-yellow-300 font-mono">PISTA PANORÁMICA ({totalRacers} CORREDORES)</span>
            <span>🏁 META (100%)</span>
          </div>

          <div
            className="h-9 relative rounded overflow-hidden border border-white/30"
            style={{
              backgroundColor: '#c0392b',
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 24%, rgba(255,255,255,0.15) 24%, rgba(255,255,255,0.15) 25%)',
            }}
          >
            {/* Finish Line on Minimap */}
            <div
              className="absolute right-0 top-0 bottom-0 w-4 border-l border-white z-10"
              style={{
                backgroundImage: 'repeating-conic-gradient(#000 0% 25%, #fff 0% 50%)',
                backgroundSize: '8px 8px',
              }}
            />

            {/* All racers pins */}
            {sortedRoster.map((racer, idx) => {
              const isMe = racer.playerId === myPlayerId;
              const leftPercent = Math.min(92, (racer.progress / 100) * 92);
              const rank = idx + 1;

              return (
                <div
                  key={racer.playerId}
                  className={`absolute top-0.5 transition-all duration-150 flex flex-col items-center ${
                    isMe ? 'z-30' : 'z-20'
                  }`}
                  style={{ left: `${leftPercent}%` }}
                >
                  {/* Runner Marker */}
                  <div
                    className={`rounded-full flex items-center justify-center shadow-md transition-transform ${
                      isMe
                        ? 'w-6 h-6 ring-2 ring-yellow-400 bg-yellow-300 scale-110'
                        : 'w-5 h-5 bg-white/90 border border-black/40'
                    }`}
                    title={`${racer.name} (#${rank})`}
                  >
                    <CreatureSprite speciesId={racer.org.speciesId} mods={racer.org.mods} sizePx={isMe ? 22 : 18} />
                  </div>
                  {isMe && (
                    <span className="text-[9px] font-black bg-yellow-400 text-slate-900 px-1 rounded-sm shadow -mt-0.5 whitespace-nowrap">
                      TÚ #{myRank}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Action Lanes Container */}
        <div className="flex-1 bg-[#d35400] border-t-4 border-b-4 border-[#2a9d8f] relative rounded-xl shadow-inner flex flex-col overflow-hidden min-h-[140px]">
          {/* Finish Line on main tracks */}
          <div
            className="absolute right-[8%] top-0 bottom-0 w-6 border-l-2 border-r-2 border-white z-10 opacity-90 pointer-events-none"
            style={{
              backgroundImage: 'repeating-conic-gradient(#000 0% 25%, #fff 0% 50%)',
              backgroundSize: '16px 16px',
            }}
          />

          {totalRacers <= 4 ? (
            /* Traditional full lanes for 2-4 players */
            <div className="flex-1 flex flex-col justify-around py-1">
              {room.roster.map(racer => {
                const isMe = racer.playerId === myPlayerId;
                const leftPercent = Math.min(84, (racer.progress / 100) * 84);
                const racerRank = sortedRoster.findIndex(r => r.playerId === racer.playerId) + 1;

                return (
                  <div
                    key={racer.playerId}
                    className={`relative flex-1 border-b border-dashed border-white/30 flex items-center ${
                      isMe ? 'bg-yellow-400/15' : ''
                    }`}
                  >
                    <div
                      className={`absolute transition-all duration-150 flex flex-col items-center select-none ${
                        racer.overheated ? 'sepia hue-rotate-[-50deg] saturate-200' : ''
                      }`}
                      style={{ left: `${leftPercent}%` }}
                    >
                      <div
                        className={`text-[10px] px-1.5 py-0.2 rounded font-bold whitespace-nowrap shadow -mb-1 z-20 flex items-center gap-1 ${
                          isMe
                            ? 'bg-yellow-400 text-slate-900 border border-black ring-2 ring-yellow-300'
                            : 'bg-black/75 text-white border border-white/40'
                        }`}
                      >
                        <span>#{racerRank} {racer.name} {isMe && '(Vos)'}</span>
                        {isMe && turboFlash && <span className="animate-ping text-xs">🔥</span>}
                      </div>

                      <div className="w-10 h-1 bg-black rounded-full overflow-hidden border border-black/50 my-0.5 z-20">
                        <div
                          className="h-full bg-gradient-to-r from-yellow-400 to-red-600 transition-all duration-150"
                          style={{ width: `${Math.min(100, racer.fatigue)}%` }}
                        />
                      </div>

                      <div className="relative">
                        <CreatureSprite speciesId={racer.org.speciesId} mods={racer.org.mods} sizePx={48} />
                        {isMe && turboFlash && (
                          <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-sm select-none pointer-events-none animate-bounce">
                            💨
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Adaptive layout for >4 unlimited players: Spotlight Lane + Live Rivals Pack */
            <div className="flex-1 flex flex-col h-full">
              {/* Spotlight Lane: TU CLON */}
              <div className="h-[90px] relative bg-yellow-400/20 border-b-2 border-yellow-300/60 flex items-center px-2">
                <div className="absolute left-2 top-1 text-[10px] font-black bg-yellow-400 text-slate-900 px-2 py-0.5 rounded shadow z-20">
                  ⭐ TU CARRIL (Puesto #{myRank} de {totalRacers})
                </div>

                {meRacer && (
                  <div
                    className={`absolute transition-all duration-150 flex flex-col items-center select-none ${
                      meRacer.overheated ? 'sepia hue-rotate-[-50deg] saturate-200' : ''
                    }`}
                    style={{ left: `${Math.min(84, (meRacer.progress / 100) * 84)}%` }}
                  >
                    <div className="text-[10px] px-2 py-0.5 rounded font-black whitespace-nowrap shadow bg-yellow-400 text-slate-900 border border-black flex items-center gap-1 z-20">
                      <span>{meRacer.name} (Vos) · {meRacer.progress.toFixed(1)}%</span>
                      {turboFlash && <span className="animate-ping text-xs">🔥</span>}
                    </div>

                    <div className="relative mt-0.5">
                      <CreatureSprite speciesId={meRacer.org.speciesId} mods={meRacer.org.mods} sizePx={52} />
                      {turboFlash && (
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-sm select-none pointer-events-none animate-bounce">
                          💨
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Scrollable Rivals Pack */}
              <div className="flex-1 overflow-y-auto p-1.5 space-y-1 bg-black/25">
                <div className="text-[10px] text-teal-200 font-bold px-1 mb-0.5 flex justify-between">
                  <span>PELOTÓN DE RIVALES EN TIEMPO REAL:</span>
                  <span>{totalRacers - 1} oponentes en carrera</span>
                </div>
                {sortedRoster
                  .filter(r => r.playerId !== myPlayerId)
                  .map((racer, idx) => {
                    const rank = sortedRoster.findIndex(r => r.playerId === racer.playerId) + 1;
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

                    return (
                      <div
                        key={racer.playerId}
                        className="bg-black/40 border border-white/20 rounded-lg p-1.5 flex items-center gap-2 text-white text-xs"
                      >
                        <span className="font-bold font-mono text-yellow-300 w-6 text-center text-xs">
                          {medal}
                        </span>
                        <CreatureSprite speciesId={racer.org.speciesId} mods={racer.org.mods} sizePx={30} />
                        <div className="w-24 truncate font-bold text-[11px]">{racer.name}</div>
                        <div className="flex-1 bg-gray-900/80 rounded-full h-3 border border-gray-600 overflow-hidden relative">
                          <div
                            className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 transition-all duration-150 rounded-full"
                            style={{ width: `${Math.min(100, racer.progress)}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-white drop-shadow">
                            {racer.progress.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-12 text-right font-mono text-[10px] text-gray-300">
                          {racer.finished ? (
                            <span className="text-emerald-400 font-bold">¡META!</span>
                          ) : (
                            <span>{Math.round(racer.fatigue)}% fatiga</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Guitar Hero Rhythm Highway & Hit Controls */}
        <div className="mt-1.5 shadow-lg">
          <GuitarHeroTrack
            active={room.status === 'racing'}
            onHit={handleGuitarHeroHit}
            combo={guitarHeroCombo}
            onComboChange={setGuitarHeroCombo}
          />
        </div>
      </div>
    );
  }

  // ================= VIEW 4: MULTIPLAYER PODIUM =================
  if (room.status === 'podium') {
    const winner = room.results[0];
    const isWinnerMe = winner?.playerId === myPlayerId;
    const myResult = room.results.find(r => r.playerId === myPlayerId);
    const myFinishRank = myResult ? myResult.rank : null;

    return (
      <div
        ref={podiumRef}
        className="flex-1 flex flex-col w-full h-full bg-gradient-to-br from-[#264653] via-[#2a9d8f] to-[#264653] text-white overflow-y-auto p-3 select-none"
      >
        {/* Victory Banner */}
        <div className="text-center my-2">
          <div className="text-4xl mb-1">{isWinnerMe ? '👑 🏆 👑' : '🏁 🏆 🏁'}</div>
          <h2 className="text-2xl font-bold text-yellow-300 drop-shadow">
            {isWinnerMe ? '¡GANASTE LA CARRERA!' : `¡${winner?.name.toUpperCase()} GANÓ LA CARRERA!`}
          </h2>
          <p className="text-xs text-teal-100">
            {room.results.length} corredores completaron la pista sincronizada
          </p>
          {myFinishRank && (
            <div className="inline-block mt-1 bg-yellow-400 text-slate-900 px-3 py-0.5 rounded-full font-black text-xs shadow">
              Tu resultado: Puesto #{myFinishRank} de {room.results.length}
            </div>
          )}
        </div>

        {/* Results List - Scalable for Unlimited Racers */}
        <div className="flex flex-col gap-2 my-2 max-h-[380px] overflow-y-auto pr-1">
          {room.results.map(res => {
            const isMe = res.playerId === myPlayerId;
            const medal = res.rank === 1 ? '🥇' : res.rank === 2 ? '🥈' : res.rank === 3 ? '🥉' : `${res.rank}°`;

            return (
              <div
                key={res.playerId}
                className={`flex items-center gap-3 p-2.5 rounded-xl border-2 text-slate-900 shadow-md transition-all ${
                  isMe
                    ? 'bg-gradient-to-r from-yellow-50 to-amber-100 border-yellow-500 ring-2 ring-yellow-400'
                    : res.rank === 1
                      ? 'bg-gradient-to-r from-amber-100 to-yellow-200 border-yellow-400'
                      : 'bg-white/95 border-gray-300'
                }`}
              >
                <div className="text-2xl w-8 text-center font-black">{medal}</div>
                <CreatureSprite speciesId={res.org.speciesId} mods={res.org.mods} sizePx={48} />
                <div className="flex-1 text-xs min-w-0">
                  <div className="font-bold text-sm text-[#264653] flex justify-between items-center">
                    <span className="truncate">
                      {res.name} {isMe && '(Vos)'}
                    </span>
                    <span className="font-mono text-gray-700 text-xs">{res.finishTime}s</span>
                  </div>
                  <div className="text-gray-600 font-medium truncate">
                    {res.org.baseName} · {res.org.mods.length} mod. genéticas
                  </div>
                  <div className="text-gray-800 text-[11px] italic mt-0.5 truncate">{res.reason}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Head to Head / Top Comparison */}
        {room.results.length >= 2 && (
          <div className="bg-black/30 border border-teal-300/40 rounded-xl p-2.5 my-2 text-xs">
            <h4 className="font-bold text-yellow-300 text-sm mb-1 text-center">
              ⚔️ COMPARATIVA GENÉTICA DEL PODIO
            </h4>
            <div className="grid grid-cols-2 gap-2 text-center pt-1 font-mono">
              <div className="bg-black/40 p-2 rounded">
                <div className="font-bold text-yellow-400">🥇 {room.results[0].name}</div>
                <div className="text-[11px] text-gray-300 mt-1">
                  Vel: {Math.round(room.results[0].org.stats.velocidad)} | Res:{' '}
                  {Math.round(room.results[0].org.stats.resistencia)}
                </div>
                <div className="text-[10px] text-purple-300 mt-0.5 truncate">
                  {room.results[0].org.ability.name}
                </div>
              </div>
              <div className="bg-black/40 p-2 rounded">
                <div className="font-bold text-blue-300">🥈 {room.results[1].name}</div>
                <div className="text-[11px] text-gray-300 mt-1">
                  Vel: {Math.round(room.results[1].org.stats.velocidad)} | Res:{' '}
                  {Math.round(room.results[1].org.stats.resistencia)}
                </div>
                <div className="text-[10px] text-purple-300 mt-0.5 truncate">
                  {room.results[1].org.ability.name}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2 mt-auto pt-2 pb-1">
          <div className="flex gap-2">
            <button
              onClick={handleRequestRematch}
              className="btn btn-primary flex-1 py-2.5 text-base font-bold cursor-pointer bg-yellow-400 text-slate-900 border-white shadow-lg"
            >
              🔁 PEDIR REVANCHA {room.rematchVotesCount ? `(${room.rematchVotesCount})` : ''}
            </button>
            <button
              onClick={handleCaptureDuelPodium}
              className="btn btn-action py-2.5 px-3 text-xs font-bold cursor-pointer"
            >
              📸 FOTO PODIO
            </button>
          </div>

          <button
            onClick={handleLeaveRoom}
            className="btn text-white bg-[#264653] hover:bg-[#1e3842] border-2 border-white/40 py-2 text-sm font-bold cursor-pointer rounded-lg text-center"
          >
            VOLVER AL MENÚ DE DUELOS
          </button>
        </div>
      </div>
    );
  }

  return null;
};
