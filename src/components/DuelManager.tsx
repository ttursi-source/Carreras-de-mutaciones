import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Organism, Scientist, DuelRoomState, DuelPlayer, RacerState } from '../types';
import { BASE_ORGANISMS, ABILITIES } from '../data/gameData';
import { CreatureSprite } from './CreatureSprite';
import { PeerDuelService } from '../services/peerDuelService';

interface DuelManagerProps {
  scientist: Scientist;
  organisms: Organism[];
  initialDuelCode?: string | null;
  onExit: () => void;
  onAddNewOrganism: (org: Organism) => void;
}

export const DuelManager: React.FC<DuelManagerProps> = ({
  scientist,
  organisms,
  initialDuelCode = null,
  onExit,
  onAddNewOrganism,
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

  // Selected specimen for duel
  const [selectedOrg, setSelectedOrg] = useState<Organism | null>(() => {
    return organisms.length > 0 ? organisms[0] : null;
  });

  // Chat message state
  const [chatInput, setChatInput] = useState('');
  const [abilityBanner, setAbilityBanner] = useState<string | null>(null);
  const [countdownDisplay, setCountdownDisplay] = useState<string | number | null>(null);

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
    } else if (msg.type === 'RACE_TICK') {
      setRoom(prev => (prev ? { ...prev, roster: msg.roster, activeEvent: msg.activeEvent } : prev));
    } else if (msg.type === 'RACE_EVENT') {
      setRoom(prev => (prev ? { ...prev, activeEvent: msg.event } : prev));
    } else if (msg.type === 'ABILITY_TRIGGERED') {
      setAbilityBanner(msg.message);
      setTimeout(() => setAbilityBanner(null), 3000);
      setRoom(prev => (prev ? { ...prev, roster: msg.roster } : prev));
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

  // Spacebar to trigger ability during duel race
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && room?.status === 'racing') {
        e.preventDefault();
        handleUseAbility();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [room?.status, transport, ws]);

  const handleCreateRoom = () => {
    const org = ensureOrganism();
    if (transport === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'CREATE_ROOM',
          playerName: scientist.name,
          avatarKey: scientist.avatarKey,
          organism: org,
        })
      );
    } else {
      // P2P WebRTC fallback for Vercel
      p2pRef.current?.createRoom(scientist.name, scientist.avatarKey, org);
    }
  };

  const handleJoinRoom = (codeToJoin?: string) => {
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
        })
      );
    } else {
      // P2P WebRTC fallback for Vercel
      p2pRef.current?.joinRoom(targetCode, scientist.name, scientist.avatarKey, org);
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

  const me = room?.players.find(p => p.id === myPlayerId);
  const isHost = !!me?.isHost;
  const allReady = room?.players.every(p => p.ready || p.isHost);
  const canStart = isHost && (room?.players.length || 0) >= 2;

  // ================= VIEW 1: NO ROOM JOINED YET (Lobby Browser) =================
  if (!room) {
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
                ? '🌐 Red Directa P2P (Vercel)'
                : '⚡ Servidor WebSocket'
              : 'Conectando...'}
          </div>
        </div>

        <div className="text-center mb-4">
          <h1 className="pixel-text text-3xl font-bold text-[#e76f51] leading-none mb-1">
            DUELOS ENTRE AMIGOS
          </h1>
          <p className="text-sm text-[#264653]">
            Competí en tiempo real con tus amigos usando los organismos de tu laboratorio.
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-100 border-2 border-red-500 text-red-800 p-2.5 rounded-xl text-xs font-bold mb-3 text-center">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Selected Specimen Preview */}
        <div className="bg-white/80 border-2 border-[#264653] rounded-xl p-3 mb-4 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-[#264653] uppercase">Tu Espécimen Seleccionado:</span>
            {organisms.length > 1 && (
              <span className="text-[11px] text-gray-500">({organisms.length} disponibles)</span>
            )}
          </div>

          {selectedOrg ? (
            <div className="flex items-center gap-3">
              <CreatureSprite speciesId={selectedOrg.speciesId} mods={selectedOrg.mods} sizePx={64} />
              <div className="flex-1 text-xs">
                <div className="font-bold text-base text-[#264653]">{selectedOrg.baseName}</div>
                <div className="text-gray-600">
                  Vel {Math.round(selectedOrg.stats.velocidad)} · Res {Math.round(selectedOrg.stats.resistencia)} · Rec{' '}
                  {Math.round(selectedOrg.stats.recuperacion)}
                </div>
                <div className="text-purple-700 font-bold mt-0.5">⚡ {selectedOrg.ability.name}</div>
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
                  {org.baseName} ({org.mods.length}m)
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Cards */}
        <div className="flex flex-col gap-3 max-w-sm mx-auto w-full">
          {/* Card 1: Create Room */}
          <div className="bg-white border-3 border-[#264653] rounded-xl p-4 shadow text-center">
            <h3 className="font-bold text-lg text-[#264653] mb-1">👑 CREAR NUEVA SALA</h3>
            <p className="text-xs text-gray-600 mb-3">
              Creá una sala y compartile el código o enlace directo a tus amigos para que jueguen contra vos.
            </p>
            <button
              onClick={handleCreateRoom}
              disabled={!connected}
              className="btn btn-primary w-full py-2.5 text-lg font-bold cursor-pointer"
            >
              CREAR SALA DE DUELO
            </button>
          </div>

          <div className="text-center font-bold text-sm text-[#264653] my-1">— O —</div>

          {/* Card 2: Join Room with Code */}
          <div className="bg-white border-3 border-[#264653] rounded-xl p-4 shadow text-center">
            <h3 className="font-bold text-lg text-[#264653] mb-1">🎮 UNIRSE A UNA SALA</h3>
            <p className="text-xs text-gray-600 mb-2">Ingresá el código de 4 caracteres que te pasó tu amigo:</p>
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
            <span className="text-xs text-teal-200">SALA DE DUELO</span>
            <div className="text-2xl font-mono font-bold text-yellow-400 tracking-wider flex items-center gap-2">
              {room.code}
              <button
                onClick={handleCopyCode}
                className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded cursor-pointer font-sans"
              >
                {copiedCode ? '¡Copiado!' : 'Copiar'}
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
        <div className="bg-amber-100 border border-amber-400 text-amber-900 px-2.5 py-1.5 rounded-lg text-xs mb-2 flex items-center justify-between">
          <span>
            💡 Pasale el link a tu amigo o pedile que ingrese el código <b>{room.code}</b>.
          </span>
          <span className="font-bold text-xs bg-amber-300 px-2 py-0.5 rounded-full">
            {room.players.length}/4 Jugadores
          </span>
        </div>

        {/* Players List Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          {room.players.map(p => {
            const isMe = p.id === myPlayerId;
            return (
              <div
                key={p.id}
                className={`p-2.5 rounded-xl border-2 shadow-sm relative ${
                  isMe
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-white border-[#264653]/40'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-[#264653] flex items-center gap-1">
                    {p.name} {isMe && '(Vos)'}
                    {p.isHost && (
                      <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.2 rounded font-bold">
                        ANFITRIÓN
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.ready
                        ? 'bg-emerald-500 text-white'
                        : p.isHost
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-300 text-gray-700'
                    }`}
                  >
                    {p.ready ? '✓ LISTO' : p.isHost ? 'ORGANIZANDO' : 'PENDIENTE'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <CreatureSprite speciesId={p.organism.speciesId} mods={p.organism.mods} sizePx={56} />
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-[#264653]">{p.organism.baseName}</div>
                    <div className="text-gray-600 font-mono text-[11px]">
                      Vel {Math.round(p.organism.stats.velocidad)} · Res{' '}
                      {Math.round(p.organism.stats.resistencia)} · Rec{' '}
                      {Math.round(p.organism.stats.recuperacion)}
                    </div>
                    <div className="text-purple-700 font-bold text-[11px] truncate">
                      ⚡ {p.organism.ability.name}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty slot placeholder */}
          {room.players.length === 1 && (
            <div className="p-4 rounded-xl border-2 border-dashed border-[#264653]/40 flex flex-col items-center justify-center text-center text-gray-500 bg-white/40">
              <div className="text-2xl animate-spin mb-1" style={{ animationDuration: '3s' }}>
                ⏳
              </div>
              <span className="text-xs font-bold text-[#264653]">Esperando a tu amigo...</span>
              <span className="text-[11px] text-gray-500">Compartí el código {room.code}</span>
            </div>
          )}
        </div>

        {/* Change my organism picker inside lobby */}
        {organisms.length > 1 && (
          <div className="bg-white/90 border border-gray-300 rounded-xl p-2 mb-2 text-xs">
            <span className="font-bold text-gray-700 mr-2">Cambiar mi espécimen:</span>
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
          </div>
        )}

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
              className={`btn btn-primary w-full py-3 text-xl font-bold cursor-pointer shadow-lg ${
                !canStart ? 'opacity-40 cursor-not-allowed' : 'animate-pulse'
              }`}
            >
              {room.players.length < 2
                ? 'ESPERANDO QUE SE UNA UN AMIGO...'
                : '¡INICIAR DUELO ENTRE AMIGOS!'}
            </button>
          ) : (
            <button
              onClick={handleToggleReady}
              className={`btn w-full py-3 text-xl font-bold cursor-pointer shadow-lg ${
                me?.ready ? 'btn-action bg-emerald-600 border-emerald-300' : 'btn-primary'
              }`}
            >
              {me?.ready ? '✓ ¡ESTÁS LISTO! (Esperando al anfitrión)' : 'MARCAR COMO LISTO'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ================= VIEW 3: MULTIPLAYER RACE =================
  if (room.status === 'racing') {
    const meRacer = room.roster.find(r => r.playerId === myPlayerId);
    const leader = room.roster.reduce(
      (prev, curr) => (curr.progress > prev.progress ? curr : prev),
      room.roster[0] || { name: '-', progress: 0 }
    );

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
        <div className="bg-[#2d3436]/95 text-white px-3 py-2 rounded-xl mb-2 border-b-4 border-[#2a9d8f] shadow">
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="font-bold text-amber-300 font-mono">SALA: {room.code}</span>
            <span className="font-bold text-[#81ecec] tracking-wider">⚔️ DUELO EN VIVO</span>
            <span className="text-xs bg-emerald-500/80 px-2 py-0.5 rounded-full">Sincronizado</span>
          </div>

          <div className="flex items-center justify-between gap-2 mt-1">
            {/* My Fatigue Meter */}
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-xs font-bold text-red-300">TU FATIGA:</span>
              <div className="flex-1 max-w-[100px] h-3 bg-gray-800 border border-gray-400 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-red-500 transition-all duration-150"
                  style={{ width: `${meRacer ? Math.min(100, meRacer.fatigue) : 0}%` }}
                />
              </div>
            </div>

            {/* Leader badge */}
            <div className="bg-amber-400 text-slate-900 px-3 py-0.5 rounded-full text-xs font-bold truncate max-w-[140px] border border-white shadow">
              Líder: {leader.name}
            </div>

            {/* Ability button */}
            <button
              onClick={handleUseAbility}
              disabled={me?.usedAbility || (meRacer ? meRacer.fatigue >= 100 : true)}
              className={`btn text-xs font-bold px-3 py-1.5 text-white border rounded cursor-pointer ${
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

        {/* Track Container */}
        <div className="flex-1 bg-[#d35400] border-t-8 border-b-8 border-[#2a9d8f] relative rounded shadow-inner flex flex-col justify-around py-1">
          {/* Finish Line */}
          <div
            className="absolute right-[8%] top-0 bottom-0 w-6 border-l-2 border-r-2 border-white z-10 opacity-90"
            style={{
              backgroundImage: 'repeating-conic-gradient(#000 0% 25%, #fff 0% 50%)',
              backgroundSize: '16px 16px',
            }}
          />

          {/* Lanes for each friend */}
          {room.roster.map((racer, index) => {
            const isMe = racer.playerId === myPlayerId;
            const leftPercent = Math.min(84, (racer.progress / 100) * 84);

            return (
              <div
                key={racer.playerId}
                className={`relative flex-1 border-b border-dashed border-white/30 flex items-center ${
                  isMe ? 'bg-yellow-400/10' : ''
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
                      isMe
                        ? 'bg-yellow-400 text-slate-900 border border-black'
                        : 'bg-black/75 text-white border border-white/40'
                    }`}
                  >
                    {racer.name} {isMe && '(Vos)'}
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
          Duelo en vivo contra tus amigos. Presioná <b>[ESPACIO]</b> o el botón para usar tu habilidad en el momento justo.
        </p>
      </div>
    );
  }

  // ================= VIEW 4: MULTIPLAYER PODIUM =================
  if (room.status === 'podium') {
    const winner = room.results[0];
    const isWinnerMe = winner?.playerId === myPlayerId;

    return (
      <div
        ref={podiumRef}
        className="flex-1 flex flex-col w-full h-full bg-gradient-to-br from-[#264653] via-[#2a9d8f] to-[#264653] text-white overflow-y-auto p-3 select-none"
      >
        {/* Victory Banner */}
        <div className="text-center my-2">
          <div className="text-4xl mb-1">{isWinnerMe ? '👑 🏆 👑' : '🏁 🏆 🏁'}</div>
          <h2 className="text-2xl font-bold text-yellow-300 drop-shadow">
            {isWinnerMe ? '¡GANASTE EL DUELO!' : `¡${winner?.name.toUpperCase()} GANÓ EL DUELO!`}
          </h2>
          <p className="text-xs text-teal-100">Resultado final sincronizado</p>
        </div>

        {/* Results List */}
        <div className="flex flex-col gap-2 my-2">
          {room.results.map(res => {
            const isMe = res.playerId === myPlayerId;
            const medal = res.rank === 1 ? '🥇' : res.rank === 2 ? '🥈' : res.rank === 3 ? '🥉' : '4°';

            return (
              <div
                key={res.playerId}
                className={`flex items-center gap-3 p-2.5 rounded-xl border-2 text-slate-900 shadow-md ${
                  res.rank === 1
                    ? 'bg-gradient-to-r from-amber-100 to-yellow-200 border-yellow-400 ring-2 ring-yellow-300'
                    : 'bg-white/95 border-gray-300'
                }`}
              >
                <div className="text-3xl w-8 text-center font-bold">{medal}</div>
                <CreatureSprite speciesId={res.org.speciesId} mods={res.org.mods} sizePx={52} />
                <div className="flex-1 text-xs">
                  <div className="font-bold text-sm text-[#264653] flex justify-between">
                    <span>
                      {res.name} {isMe && '(Vos)'}
                    </span>
                    <span className="font-mono text-gray-700">{res.finishTime}s</span>
                  </div>
                  <div className="text-gray-600 font-medium">
                    {res.org.baseName} · {res.org.mods.length} mod. genéticas
                  </div>
                  <div className="text-gray-800 text-[11px] italic mt-0.5">{res.reason}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Head to Head Comparison */}
        {room.results.length >= 2 && (
          <div className="bg-black/30 border border-teal-300/40 rounded-xl p-2.5 my-2 text-xs">
            <h4 className="font-bold text-yellow-300 text-sm mb-1 text-center">
              ⚔️ COMPARATIVA GENÉTICA DEL DUELO
            </h4>
            <div className="grid grid-cols-2 gap-2 text-center pt-1 font-mono">
              <div className="bg-black/40 p-2 rounded">
                <div className="font-bold text-yellow-400">{room.results[0].name}</div>
                <div className="text-[11px] text-gray-300 mt-1">
                  Vel: {Math.round(room.results[0].org.stats.velocidad)} | Res:{' '}
                  {Math.round(room.results[0].org.stats.resistencia)}
                </div>
                <div className="text-[10px] text-purple-300 mt-0.5">
                  {room.results[0].org.ability.name}
                </div>
              </div>
              <div className="bg-black/40 p-2 rounded">
                <div className="font-bold text-blue-300">{room.results[1].name}</div>
                <div className="text-[11px] text-gray-300 mt-1">
                  Vel: {Math.round(room.results[1].org.stats.velocidad)} | Res:{' '}
                  {Math.round(room.results[1].org.stats.resistencia)}
                </div>
                <div className="text-[10px] text-purple-300 mt-0.5">
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
