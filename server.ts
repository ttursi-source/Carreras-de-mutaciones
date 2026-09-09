import http from 'http';
import path from 'path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Types for multiplayer duels
interface OrganismStats {
  velocidad: number;
  resistencia: number;
  recuperacion: number;
}

interface Ability {
  id: string;
  name: string;
  desc: string;
}

interface Organism {
  id: number | string;
  baseName: string;
  speciesId: number;
  mods: Array<{
    id: number;
    name: string;
    icon?: string;
    filterFrag?: string;
  }>;
  stats: OrganismStats;
  ability: Ability;
}

interface DuelPlayer {
  id: string;
  name: string;
  avatarKey: string;
  organism: Organism;
  ready: boolean;
  usedAbility: boolean;
  ws: WebSocket;
  isHost: boolean;
  lastTurbo?: number;
}

interface RacerState {
  playerId: string;
  name: string;
  org: Organism;
  progress: number;
  fatigue: number;
  overheated: boolean;
  finished: boolean;
  finishRank?: number;
  finishTime?: number;
}

interface DuelRoom {
  code: string;
  isPublic: boolean;
  players: Map<string, DuelPlayer>;
  status: 'lobby' | 'countdown' | 'racing' | 'podium';
  countdownTimer: NodeJS.Timeout | null;
  raceInterval: NodeJS.Timeout | null;
  eventInterval: NodeJS.Timeout | null;
  activeEvent: { id: string; name: string } | null;
  tickCount: number;
  startTime: number;
  roster: RacerState[];
  results: Array<{
    rank: number;
    playerId: string;
    name: string;
    org: Organism;
    finishTime: number;
    reason: string;
  }>;
  chatMessages: Array<{ sender: string; text: string; time: string }>;
  rematchVotes: Set<string>;
}

const rooms = new Map<string, DuelRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function broadcastToRoom(room: DuelRoom, message: object) {
  const data = JSON.stringify(message);
  for (const player of room.players.values()) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}

function getSanitizedRoom(room: DuelRoom) {
  const playersList = Array.from(room.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    avatarKey: p.avatarKey,
    organism: p.organism,
    ready: p.ready,
    isHost: p.isHost,
    usedAbility: p.usedAbility,
  }));

  return {
    code: room.code,
    isPublic: room.isPublic,
    status: room.status,
    players: playersList,
    activeEvent: room.activeEvent,
    roster: room.roster.map(r => ({
      playerId: r.playerId,
      name: r.name,
      org: r.org,
      progress: r.progress,
      fatigue: r.fatigue,
      overheated: r.overheated,
      finished: r.finished,
      finishRank: r.finishRank,
    })),
    results: room.results,
    chatMessages: room.chatMessages.slice(-15),
    rematchVotesCount: room.rematchVotes.size,
  };
}

// Tuned so race lasts at least 10 to 16 seconds
const SPEED_K = 0.0052;
const FATIGUE_K = 0.70;
const RECOVERY_K = 0.024;
const TICK_MS = 100;
const MAX_TICKS = 600;
const FINISH = 100;

function startDuelRace(room: DuelRoom) {
  room.status = 'racing';
  room.tickCount = 0;
  room.startTime = Date.now();
  room.activeEvent = null;
  room.results = [];
  room.rematchVotes.clear();

  room.roster = Array.from(room.players.values()).map(p => {
    p.usedAbility = false;
    return {
      playerId: p.id,
      name: p.name,
      org: p.organism,
      progress: 0,
      fatigue: 0,
      overheated: false,
      finished: false,
    };
  });

  broadcastToRoom(room, {
    type: 'RACE_STARTED',
    room: getSanitizedRoom(room),
  });

  // Weather events during duel
  room.eventInterval = setInterval(() => {
    if (room.status !== 'racing') return;
    if (Math.random() < 0.4) return;
    const events = [
      { id: 'calor', name: '¡OLA DE CALOR!\n(+ Fatiga para ambos)' },
      { id: 'favorable', name: '¡CONDICIONES ÓPTIMAS!\n(+ Velocidad para ambos)' },
    ];
    const ev = events[Math.floor(Math.random() * events.length)];
    room.activeEvent = ev;
    broadcastToRoom(room, {
      type: 'RACE_EVENT',
      event: ev,
    });
    setTimeout(() => {
      if (room.activeEvent?.id === ev.id) {
        room.activeEvent = null;
        broadcastToRoom(room, { type: 'RACE_EVENT', event: null });
      }
    }, 3200);
  }, 7500);

  // Authoritative race tick
  room.raceInterval = setInterval(() => {
    if (room.status !== 'racing') return;
    room.tickCount++;

    let nextRank = room.results.length + 1;

    room.roster.forEach(r => {
      if (r.finished) return;

      const { velocidad: vel, resistencia: res, recuperacion: rec } = r.org.stats;
      const effort = r.fatigue >= 100 ? 0.25 : r.fatigue > 65 ? 0.65 : 1;
      let speed = vel * SPEED_K * effort;
      if (room.activeEvent?.id === 'favorable') speed *= 1.5;
      r.progress += speed;

      let gain = (vel * effort * FATIGUE_K) / Math.max(15, res);
      if (room.activeEvent?.id === 'calor') gain *= 1.6;
      const decay = rec * RECOVERY_K;
      r.fatigue = Math.max(0, Math.min(100, r.fatigue + gain - decay));
      r.overheated = r.fatigue >= 100;

      if (r.progress >= FINISH) {
        r.progress = FINISH;
        r.finished = true;
        r.finishRank = nextRank;
        r.finishTime = Math.round((Date.now() - room.startTime) / 100) / 10;

        const s = r.org.stats;
        let reason = '';
        if (nextRank === 1) {
          reason = `Ganó con gran balance de atributos: Vel ${Math.round(s.velocidad)}, Res ${Math.round(s.resistencia)}, Rec ${Math.round(s.recuperacion)}.`;
        } else if (s.velocidad > 75 && s.resistencia < 45) {
          reason = `Salió a toda velocidad pero la fatiga le jugó en contra hacia el final.`;
        } else if (s.resistencia > 75 && s.velocidad < 45) {
          reason = `Excelente resistencia y recuperación, pero le faltó aceleración pura en los tramos decisivos.`;
        } else {
          reason = `Buen desempeño general con ${r.org.mods.length} modificaciones genéticas.`;
        }

        room.results.push({
          rank: nextRank,
          playerId: r.playerId,
          name: r.name,
          org: r.org,
          finishTime: r.finishTime,
          reason,
        });

        nextRank++;
      }
    });

    broadcastToRoom(room, {
      type: 'RACE_TICK',
      roster: room.roster,
      activeEvent: room.activeEvent,
    });

    const allFinished = room.roster.every(r => r.finished);
    const someoneFinished = room.results.length > 0;

    if (allFinished || room.tickCount >= MAX_TICKS || (someoneFinished && room.tickCount > 250)) {
      // Complete any unfinished racers
      room.roster.forEach(r => {
        if (!r.finished) {
          r.finished = true;
          r.finishRank = nextRank++;
          r.finishTime = Math.round((Date.now() - room.startTime) / 100) / 10;
          room.results.push({
            rank: r.finishRank,
            playerId: r.playerId,
            name: r.name,
            org: r.org,
            finishTime: r.finishTime,
            reason: `Finalizó la carrera con resistencia agotada.`,
          });
        }
      });

      endDuelRace(room);
    }
  }, TICK_MS);
}

function endDuelRace(room: DuelRoom) {
  if (room.raceInterval) clearInterval(room.raceInterval);
  if (room.eventInterval) clearInterval(room.eventInterval);
  room.raceInterval = null;
  room.eventInterval = null;
  room.status = 'podium';

  // Sort results by rank
  room.results.sort((a, b) => a.rank - b.rank);

  broadcastToRoom(room, {
    type: 'RACE_FINISHED',
    results: room.results,
    room: getSanitizedRoom(room),
  });
}

function handleAbilityUse(room: DuelRoom, player: DuelPlayer) {
  if (room.status !== 'racing' || player.usedAbility) return;
  const racer = room.roster.find(r => r.playerId === player.id);
  if (!racer || racer.fatigue >= 100 || racer.finished) return;

  player.usedAbility = true;
  const ab = player.organism.ability;
  let message = '';

  if (ab.id === 'turbo') {
    racer.progress += 15;
    message = `¡${player.name} activó Impulso y se adelantó +15%!`;
  } else if (ab.id === 'cool') {
    racer.fatigue = 0;
    message = `¡${player.name} ejecutó Protocolo de Contención (fatiga a 0%)!`;
  } else if (ab.id === 'confuse') {
    room.roster.forEach(r => {
      if (r.playerId !== player.id && !r.finished) {
        r.progress = Math.max(0, r.progress - 10);
        r.fatigue = Math.min(100, r.fatigue + 20);
      }
    });
    message = `¡${player.name} liberó Nube de Feromonas (retrasó y fatigó a sus rivales)!`;
  } else if (ab.id === 'absorb') {
    room.roster.forEach(r => {
      if (r.playerId !== player.id && !r.finished) {
        r.progress = Math.max(0, r.progress - 5);
        r.fatigue = Math.min(100, r.fatigue + 10);
      }
    });
    racer.progress += 12;
    message = `¡${player.name} aprovechó Ventaja Regulada (+12% de avance y presión al rival)!`;
  }

  broadcastToRoom(room, {
    type: 'ABILITY_TRIGGERED',
    playerId: player.id,
    abilityName: ab.name,
    message,
    roster: room.roster,
  });
}

// WebSocket setup
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const parsedUrl = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    if (parsedUrl.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
      });
    }
  } catch (err) {
    socket.destroy();
  }
});

wss.on('connection', (ws: WebSocket) => {
  let currentRoomCode: string | null = null;
  let currentUserId: string | null = null;

  ws.on('message', (raw: string) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === 'CREATE_ROOM') {
        const code = generateRoomCode();
        currentRoomCode = code;
        currentUserId = data.playerId || `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        const player: DuelPlayer = {
          id: currentUserId,
          name: data.playerName || 'Científico/a',
          avatarKey: data.avatarKey || 'LabOne',
          organism: data.organism,
          ready: false,
          usedAbility: false,
          ws,
          isHost: true,
        };

        const room: DuelRoom = {
          code,
          isPublic: data.isPublic !== false,
          players: new Map([[currentUserId, player]]),
          status: 'lobby',
          countdownTimer: null,
          raceInterval: null,
          eventInterval: null,
          activeEvent: null,
          tickCount: 0,
          startTime: 0,
          roster: [],
          results: [],
          chatMessages: [
            {
              sender: 'SISTEMA',
              text: `Sala creada. ¡Compartí el código ${code} con tus amigos!`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ],
          rematchVotes: new Set(),
        };

        rooms.set(code, room);

        ws.send(
          JSON.stringify({
            type: 'ROOM_CREATED',
            roomCode: code,
            playerId: currentUserId,
            room: getSanitizedRoom(room),
          })
        );
      } else if (data.type === 'JOIN_ROOM') {
        const code = (data.roomCode || '').toUpperCase().trim();
        let room = rooms.get(code);

        if (!room) {
          if (data.autoCreateIfMissing || code.startsWith('PUB')) {
            currentRoomCode = code;
            currentUserId = data.playerId || `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const player: DuelPlayer = {
              id: currentUserId,
              name: data.playerName || 'Científico',
              avatarKey: data.avatarKey || 'LabOne',
              organism: data.organism,
              ready: true,
              usedAbility: false,
              ws,
              isHost: true,
            };

            room = {
              code,
              isPublic: true,
              players: new Map([[currentUserId, player]]),
              status: 'lobby',
              countdownTimer: null,
              raceInterval: null,
              eventInterval: null,
              activeEvent: null,
              tickCount: 0,
              startTime: 0,
              roster: [],
              results: [],
              chatMessages: [
                {
                  sender: 'SISTEMA',
                  text: `Lobby público ${code} abierto. ¡Esperando rivales!`,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ],
              rematchVotes: new Set(),
            };
            rooms.set(code, room);

            ws.send(
              JSON.stringify({
                type: 'ROOM_CREATED',
                roomCode: code,
                playerId: currentUserId,
                room: getSanitizedRoom(room),
              })
            );
            return;
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: `No se encontró la sala con código "${code}".` }));
            return;
          }
        }

        if (room.players.size >= 4) {
          ws.send(JSON.stringify({ type: 'ERROR', message: `La sala ${code} ya está llena (máx 4 jugadores).` }));
          return;
        }

        if (room.status === 'racing' || room.status === 'countdown') {
          ws.send(JSON.stringify({ type: 'ERROR', message: `La carrera en la sala ${code} ya está en curso.` }));
          return;
        }

        currentRoomCode = code;
        currentUserId = data.playerId || `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        const player: DuelPlayer = {
          id: currentUserId,
          name: data.playerName || 'Rival Amigo',
          avatarKey: data.avatarKey || 'LabTwo',
          organism: data.organism,
          ready: false,
          usedAbility: false,
          ws,
          isHost: room.players.size === 0,
        };

        room.players.set(currentUserId, player);
        room.chatMessages.push({
          sender: 'SISTEMA',
          text: `¡${player.name} se unió a la sala!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });

        ws.send(
          JSON.stringify({
            type: 'ROOM_JOINED',
            roomCode: code,
            playerId: currentUserId,
            room: getSanitizedRoom(room),
          })
        );

        broadcastToRoom(room, {
          type: 'ROOM_UPDATE',
          room: getSanitizedRoom(room),
        });
      } else if (data.type === 'UPDATE_ORGANISM') {
        if (!currentRoomCode || !currentUserId) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;
        const player = room.players.get(currentUserId);
        if (!player) return;

        player.organism = data.organism;
        broadcastToRoom(room, {
          type: 'ROOM_UPDATE',
          room: getSanitizedRoom(room),
        });
      } else if (data.type === 'TOGGLE_READY') {
        if (!currentRoomCode || !currentUserId) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;
        const player = room.players.get(currentUserId);
        if (!player) return;

        player.ready = data.ready !== undefined ? data.ready : !player.ready;
        broadcastToRoom(room, {
          type: 'ROOM_UPDATE',
          room: getSanitizedRoom(room),
        });
      } else if (data.type === 'START_RACE') {
        if (!currentRoomCode || !currentUserId) return;
        const room = rooms.get(currentRoomCode);
        if (!room || room.status !== 'lobby') return;

        const player = room.players.get(currentUserId);
        if (!player || !player.isHost) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Solo el anfitrión puede iniciar la carrera.' }));
          return;
        }

        if (room.players.size < 2) {
          ws.send(
            JSON.stringify({
              type: 'ERROR',
              message: 'Se necesitan al menos 2 amigos en la sala para competir.',
            })
          );
          return;
        }

        // Start countdown
        room.status = 'countdown';
        let count = 3;
        broadcastToRoom(room, { type: 'COUNTDOWN', count });

        room.countdownTimer = setInterval(() => {
          count--;
          if (count > 0) {
            broadcastToRoom(room, { type: 'COUNTDOWN', count });
          } else if (count === 0) {
            broadcastToRoom(room, { type: 'COUNTDOWN', count: '¡YA!' });
          } else {
            if (room.countdownTimer) clearInterval(room.countdownTimer);
            room.countdownTimer = null;
            startDuelRace(room);
          }
        }, 1000);
      } else if (data.type === 'USE_ABILITY') {
        if (!currentRoomCode || !currentUserId) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;
        const player = room.players.get(currentUserId);
        if (!player) return;

        handleAbilityUse(room, player);
      } else if (data.type === 'USE_TURBO') {
        if (!currentRoomCode || !currentUserId) return;
        const room = rooms.get(currentRoomCode);
        if (!room || room.status !== 'racing') return;
        const player = room.players.get(currentUserId);
        if (!player) return;
        const racer = room.roster.find(r => r.playerId === currentUserId);
        if (!racer || racer.finished || racer.fatigue >= 100) return;

        const now = Date.now();
        if (player.lastTurbo && now - player.lastTurbo < 150) return;
        player.lastTurbo = now;

        racer.progress = Math.min(FINISH, racer.progress + 1.0);
        racer.fatigue = Math.min(100, racer.fatigue + 2.2);
        racer.overheated = racer.fatigue >= 100;

        broadcastToRoom(room, {
          type: 'TURBO_TRIGGERED',
          playerId: currentUserId,
          roster: room.roster,
        });
      } else if (data.type === 'GET_PUBLIC_ROOMS') {
        const publicRooms: any[] = [];
        rooms.forEach((r, code) => {
          if (r.isPublic && r.status === 'lobby' && r.players.size < 4) {
            const host = Array.from(r.players.values()).find(p => p.isHost) || Array.from(r.players.values())[0];
            if (host) {
              publicRooms.push({
                code,
                hostName: host.name,
                hostAvatarKey: host.avatarKey,
                hostOrganismName: host.organism.baseName,
                hostSpeciesId: host.organism.speciesId,
                playerCount: r.players.size,
                maxPlayers: 4,
                status: r.status,
              });
            }
          }
        });
        ws.send(JSON.stringify({ type: 'PUBLIC_ROOMS_LIST', rooms: publicRooms }));
      } else if (data.type === 'SEND_CHAT') {
        if (!currentRoomCode || !currentUserId) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;
        const player = room.players.get(currentUserId);
        if (!player) return;

        const chatMsg = {
          sender: player.name,
          text: String(data.text || '').substring(0, 100),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        room.chatMessages.push(chatMsg);
        if (room.chatMessages.length > 30) room.chatMessages.shift();

        broadcastToRoom(room, {
          type: 'CHAT_MESSAGE',
          message: chatMsg,
        });
      } else if (data.type === 'REQUEST_REMATCH') {
        if (!currentRoomCode || !currentUserId) return;
        const room = rooms.get(currentRoomCode);
        if (!room || room.status !== 'podium') return;

        room.rematchVotes.add(currentUserId);
        const player = room.players.get(currentUserId);
        if (player) {
          room.chatMessages.push({
            sender: 'SISTEMA',
            text: `¡${player.name} propuso revancha! (${room.rematchVotes.size}/${room.players.size})`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
        }

        if (room.rematchVotes.size >= Math.min(2, room.players.size)) {
          // Reset to lobby
          room.status = 'lobby';
          room.rematchVotes.clear();
          room.results = [];
          room.players.forEach(p => {
            p.ready = false;
            p.usedAbility = false;
          });
          broadcastToRoom(room, {
            type: 'ROOM_UPDATE',
            room: getSanitizedRoom(room),
            notification: '¡Revancha aceptada! Preparen sus especímenes.',
          });
        } else {
          broadcastToRoom(room, {
            type: 'ROOM_UPDATE',
            room: getSanitizedRoom(room),
          });
        }
      } else if (data.type === 'LEAVE_ROOM') {
        cleanPlayerDisconnect(currentRoomCode, currentUserId);
        currentRoomCode = null;
        currentUserId = null;
      }
    } catch (err) {
      console.error('Error handling ws message', err);
    }
  });

  ws.on('close', () => {
    cleanPlayerDisconnect(currentRoomCode, currentUserId);
  });
});

function cleanPlayerDisconnect(roomCode: string | null, userId: string | null) {
  if (!roomCode || !userId) return;
  const room = rooms.get(roomCode);
  if (!room) return;

  const leavingPlayer = room.players.get(userId);
  room.players.delete(userId);
  room.rematchVotes.delete(userId);

  if (room.players.size === 0) {
    if (room.countdownTimer) clearInterval(room.countdownTimer);
    if (room.raceInterval) clearInterval(room.raceInterval);
    if (room.eventInterval) clearInterval(room.eventInterval);
    rooms.delete(roomCode);
  } else {
    // If host left, elect new host
    if (leavingPlayer?.isHost) {
      const nextHost = room.players.values().next().value;
      if (nextHost) nextHost.isHost = true;
    }

    room.chatMessages.push({
      sender: 'SISTEMA',
      text: `${leavingPlayer?.name || 'Un jugador'} abandonó la sala.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    if (room.status === 'racing') {
      const racer = room.roster.find(r => r.playerId === userId);
      if (racer) {
        racer.finished = true;
        racer.overheated = true;
      }
    }

    broadcastToRoom(room, {
      type: 'ROOM_UPDATE',
      room: getSanitizedRoom(room),
    });
  }
}

// Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`GENLAB Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
