import { Peer, DataConnection } from 'peerjs';
import { Organism, DuelRoomState, DuelPlayer, RacerState } from '../types';

export interface PeerDuelCallbacks {
  onMessage: (msg: any) => void;
  onError: (error: string) => void;
  onConnected: () => void;
  onDisconnected: () => void;
}

const FINISH = 100;
// Physics tuned so the race lasts at least 10 to 16 seconds
const SPEED_K = 0.0050;
const FATIGUE_K = 0.65;
const RECOVERY_K = 0.022;
const TICK_MS = 80;
const MAX_TICKS = 550;

export class PeerDuelService {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private isHost = false;
  private myPlayerId = '';
  private roomCode = '';
  private isPublic = true;
  private callbacks: PeerDuelCallbacks;
  private lastTurboTimes: Map<string, number> = new Map();

  // Host state
  private players: Map<
    string,
    {
      id: string;
      name: string;
      avatarKey: string;
      organism: Organism;
      ready: boolean;
      usedAbility: boolean;
      isHost: boolean;
      conn?: DataConnection;
    }
  > = new Map();
  private status: 'lobby' | 'countdown' | 'racing' | 'podium' = 'lobby';
  private countdownTimer: any = null;
  private raceInterval: any = null;
  private eventInterval: any = null;
  private activeEvent: { id: string; name: string } | null = null;
  private tickCount = 0;
  private startTime = 0;
  private roster: RacerState[] = [];
  private results: Array<{
    rank: number;
    playerId: string;
    name: string;
    org: Organism;
    finishTime: number;
    reason: string;
  }> = [];
  private chatMessages: Array<{ sender: string; text: string; time: string }> = [];
  private rematchVotes: Set<string> = new Set();

  constructor(callbacks: PeerDuelCallbacks) {
    this.callbacks = callbacks;
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private getSanitizedRoom(): DuelRoomState {
    const playersList: DuelPlayer[] = Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      avatarKey: p.avatarKey,
      organism: p.organism,
      ready: p.ready,
      isHost: p.isHost,
      usedAbility: p.usedAbility,
    }));

    return {
      code: this.roomCode,
      isPublic: this.isPublic,
      players: playersList,
      status: this.status,
      activeEvent: this.activeEvent,
      roster: this.roster,
      results: this.results,
      chatMessages: this.chatMessages,
    };
  }

  private broadcast(msg: any) {
    // Notify host UI
    this.callbacks.onMessage(msg);
    // Send to guest if connected
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(msg);
      } catch (e) {
        console.error('Error sending P2P message', e);
      }
    }
  }

  public createRoom(
    playerName: string,
    avatarKey: string,
    organism: Organism,
    customCode?: string,
    isPublic = true
  ) {
    this.destroy();
    this.isHost = true;
    this.roomCode = (customCode ? customCode.trim().toUpperCase() : this.generateCode());
    this.isPublic = isPublic;
    this.myPlayerId = 'p_' + Math.random().toString(36).substring(2, 8);
    const peerId = `genlab-${this.roomCode.toLowerCase()}`;

    try {
      this.peer = new Peer(peerId, {
        debug: 1,
      });
    } catch (e: any) {
      this.callbacks.onError('Error al inicializar red P2P: ' + (e?.message || ''));
      return;
    }

    this.peer.on('open', () => {
      this.players.set(this.myPlayerId, {
        id: this.myPlayerId,
        name: playerName,
        avatarKey,
        organism,
        ready: true,
        usedAbility: false,
        isHost: true,
      });

      this.callbacks.onConnected();
      this.callbacks.onMessage({
        type: 'ROOM_CREATED',
        roomCode: this.roomCode,
        playerId: this.myPlayerId,
        room: this.getSanitizedRoom(),
      });
    });

    this.peer.on('connection', connection => {
      // Allow only 1 guest for 1v1 duel
      if (this.players.size >= 2 && !Array.from(this.players.values()).some(p => p.id === connection.peer)) {
        connection.on('open', () => {
          connection.send({ type: 'ERROR', message: 'La sala ya está llena (máximo 2 jugadores).' });
          setTimeout(() => connection.close(), 1000);
        });
        return;
      }

      this.conn = connection;
      connection.on('open', () => {
        // Connection established
      });

      connection.on('data', (data: any) => {
        this.handleHostReceivedMessage(data, connection);
      });

      connection.on('close', () => {
        // Guest disconnected
        const guest = Array.from(this.players.values()).find(p => !p.isHost);
        if (guest) {
          this.players.delete(guest.id);
          this.broadcast({
            type: 'CHAT_MESSAGE',
            message: {
              sender: 'Sistema',
              text: `${guest.name} abandonó la sala.`,
              time: new Date().toLocaleTimeString().slice(0, 5),
            },
          });
          this.broadcast({
            type: 'ROOM_UPDATE',
            room: this.getSanitizedRoom(),
          });
        }
      });
    });

    this.peer.on('error', (err: any) => {
      if (err.type === 'unavailable-id') {
        // Retry with another code
        this.createRoom(playerName, avatarKey, organism);
      } else {
        this.callbacks.onError('Error en sala P2P: ' + err.message);
      }
    });
  }

  public joinRoom(
    roomCode: string,
    playerName: string,
    avatarKey: string,
    organism: Organism,
    autoHostOnFail = false
  ) {
    this.destroy();
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase().trim();
    this.myPlayerId = 'p_' + Math.random().toString(36).substring(2, 8);

    try {
      this.peer = new Peer({ debug: 1 });
    } catch (e: any) {
      this.callbacks.onError('Error de red P2P: ' + (e?.message || ''));
      return;
    }

    this.peer.on('open', () => {
      const targetHostId = `genlab-${this.roomCode.toLowerCase()}`;
      const connection = this.peer!.connect(targetHostId, { reliable: true });
      this.conn = connection;

      const timeout = setTimeout(() => {
        if (!connection.open) {
          if (autoHostOnFail) {
            this.createRoom(playerName, avatarKey, organism, this.roomCode, true);
          } else {
            this.callbacks.onError(`No se encontró la sala "${this.roomCode}". Verificá el código con tu amigo.`);
          }
        }
      }, 5000);

      connection.on('open', () => {
        clearTimeout(timeout);
        this.callbacks.onConnected();
        connection.send({
          type: 'JOIN_ROOM',
          playerName,
          avatarKey,
          organism,
          playerId: this.myPlayerId,
        });
      });

      connection.on('data', (data: any) => {
        this.callbacks.onMessage(data);
      });

      connection.on('close', () => {
        this.callbacks.onError('La conexión con el anfitrión se cerró.');
        this.callbacks.onDisconnected();
      });

      connection.on('error', err => {
        clearTimeout(timeout);
        if (autoHostOnFail) {
          this.createRoom(playerName, avatarKey, organism, this.roomCode, true);
        } else {
          this.callbacks.onError('Error al conectar con la sala: ' + err.message);
        }
      });
    });

    this.peer.on('error', (err: any) => {
      if (err.type === 'peer-unavailable') {
        if (autoHostOnFail) {
          this.createRoom(playerName, avatarKey, organism, this.roomCode, true);
        } else {
          this.callbacks.onError(`No se encontró la sala "${this.roomCode}". Asegurate de que tu amigo esté en la sala.`);
        }
      } else {
        this.callbacks.onError('Error P2P: ' + err.message);
      }
    });
  }

  private handleHostReceivedMessage(msg: any, connection: DataConnection) {
    if (msg.type === 'JOIN_ROOM') {
      if (this.players.size >= 2) {
        connection.send({ type: 'ERROR', message: 'La sala está completa.' });
        return;
      }
      const guestId = msg.playerId || ('p_' + Math.random().toString(36).substring(2, 8));
      this.players.set(guestId, {
        id: guestId,
        name: msg.playerName,
        avatarKey: msg.avatarKey,
        organism: msg.organism,
        ready: false,
        usedAbility: false,
        isHost: false,
        conn: connection,
      });

      const sanitized = this.getSanitizedRoom();
      // Notify guest
      connection.send({
        type: 'ROOM_JOINED',
        roomCode: this.roomCode,
        playerId: guestId,
        room: sanitized,
      });

      // Announce join
      this.broadcast({
        type: 'CHAT_MESSAGE',
        message: {
          sender: 'Sistema',
          text: `¡${msg.playerName} se unió al laboratorio!`,
          time: new Date().toLocaleTimeString().slice(0, 5),
        },
      });

      this.broadcast({
        type: 'ROOM_UPDATE',
        room: sanitized,
      });
    } else if (msg.type === 'UPDATE_ORGANISM') {
      const guest = Array.from(this.players.values()).find(p => !p.isHost);
      if (guest) {
        guest.organism = msg.organism;
        guest.ready = false;
        this.broadcast({ type: 'ROOM_UPDATE', room: this.getSanitizedRoom() });
      }
    } else if (msg.type === 'TOGGLE_READY') {
      const guest = Array.from(this.players.values()).find(p => !p.isHost);
      if (guest) {
        guest.ready = !guest.ready;
        this.broadcast({ type: 'ROOM_UPDATE', room: this.getSanitizedRoom() });
      }
    } else if (msg.type === 'USE_ABILITY') {
      const guest = Array.from(this.players.values()).find(p => !p.isHost);
      if (guest) {
        this.hostUseAbility(guest.id);
      }
    } else if (msg.type === 'USE_TURBO') {
      const guest = Array.from(this.players.values()).find(p => !p.isHost);
      if (guest) {
        this.hostUseTurbo(guest.id);
      }
    } else if (msg.type === 'SEND_CHAT') {
      const guest = Array.from(this.players.values()).find(p => !p.isHost);
      const senderName = guest ? guest.name : 'Rival';
      const chatItem = {
        sender: senderName,
        text: String(msg.text).slice(0, 100),
        time: new Date().toLocaleTimeString().slice(0, 5),
      };
      this.chatMessages.push(chatItem);
      this.broadcast({ type: 'CHAT_MESSAGE', message: chatItem });
    } else if (msg.type === 'REQUEST_REMATCH') {
      const guest = Array.from(this.players.values()).find(p => !p.isHost);
      if (guest) {
        this.rematchVotes.add(guest.id);
        this.checkHostRematch();
      }
    }
  }

  // Client actions (called from UI)
  public updateOrganism(org: Organism) {
    if (this.isHost) {
      const hostP = this.players.get(this.myPlayerId);
      if (hostP) {
        hostP.organism = org;
        hostP.ready = false;
        this.broadcast({ type: 'ROOM_UPDATE', room: this.getSanitizedRoom() });
      }
    } else if (this.conn && this.conn.open) {
      this.conn.send({ type: 'UPDATE_ORGANISM', organism: org });
    }
  }

  public toggleReady() {
    if (this.isHost) {
      const hostP = this.players.get(this.myPlayerId);
      if (hostP) {
        hostP.ready = !hostP.ready;
        this.broadcast({ type: 'ROOM_UPDATE', room: this.getSanitizedRoom() });
      }
    } else if (this.conn && this.conn.open) {
      this.conn.send({ type: 'TOGGLE_READY' });
    }
  }

  public startRace() {
    if (!this.isHost || this.players.size < 2) return;

    this.status = 'countdown';
    this.broadcast({ type: 'ROOM_UPDATE', room: this.getSanitizedRoom() });

    let count = 3;
    this.broadcast({ type: 'COUNTDOWN', count });

    this.countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        this.broadcast({ type: 'COUNTDOWN', count });
      } else if (count === 0) {
        this.broadcast({ type: 'COUNTDOWN', count: '¡YA!' });
      } else {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.hostStartRacing();
      }
    }, 1000);
  }

  private hostStartRacing() {
    this.status = 'racing';
    this.startTime = Date.now();
    this.tickCount = 0;
    this.activeEvent = null;
    this.results = [];

    this.roster = Array.from(this.players.values()).map(p => {
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

    this.broadcast({
      type: 'RACE_STARTED',
      room: this.getSanitizedRoom(),
    });

    // Random events
    this.eventInterval = setInterval(() => {
      if (this.status !== 'racing') return;
      const roll = Math.random();
      if (roll < 0.35) {
        this.activeEvent = { id: 'calor', name: '☀️ Ola de Calor (+60% Fatiga)' };
      } else if (roll < 0.65) {
        this.activeEvent = { id: 'favorable', name: '🍃 Condiciones Óptimas (+50% Velocidad)' };
      } else {
        this.activeEvent = null;
      }
      this.broadcast({
        type: 'RACE_EVENT',
        event: this.activeEvent,
      });
    }, 6000);

    // Race loop
    this.raceInterval = setInterval(() => {
      this.tickCount++;
      let nextRank = this.results.length + 1;

      this.roster.forEach(r => {
        if (r.finished) return;

        const { velocidad: vel, resistencia: res, recuperacion: rec } = r.org.stats;
        const effort = r.fatigue >= 100 ? 0.25 : r.fatigue > 65 ? 0.65 : 1;
        let speed = vel * SPEED_K * effort;
        if (this.activeEvent?.id === 'favorable') speed *= 1.5;
        r.progress += speed;

        let gain = (vel * effort * FATIGUE_K) / Math.max(15, res);
        if (this.activeEvent?.id === 'calor') gain *= 1.6;
        const decay = rec * RECOVERY_K;
        r.fatigue = Math.max(0, Math.min(100, r.fatigue + gain - decay));
        r.overheated = r.fatigue >= 100;

        if (r.progress >= FINISH) {
          r.progress = FINISH;
          r.finished = true;
          r.finishRank = nextRank;
          r.finishTime = Math.round((Date.now() - this.startTime) / 100) / 10;

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

          this.results.push({
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

      this.broadcast({
        type: 'RACE_TICK',
        roster: this.roster,
        activeEvent: this.activeEvent,
      });

      const allFinished = this.roster.every(r => r.finished);
      const someoneFinished = this.results.length > 0;

      if (allFinished || this.tickCount >= MAX_TICKS || (someoneFinished && this.tickCount > 250)) {
        this.roster.forEach(r => {
          if (!r.finished) {
            r.finished = true;
            r.finishRank = nextRank++;
            r.finishTime = Math.round((Date.now() - this.startTime) / 100) / 10;
            this.results.push({
              rank: r.finishRank,
              playerId: r.playerId,
              name: r.name,
              org: r.org,
              finishTime: r.finishTime,
              reason: `Finalizó la carrera con resistencia agotada.`,
            });
          }
        });

        this.hostEndRace();
      }
    }, TICK_MS);
  }

  private hostEndRace() {
    if (this.raceInterval) clearInterval(this.raceInterval);
    if (this.eventInterval) clearInterval(this.eventInterval);
    this.raceInterval = null;
    this.eventInterval = null;
    this.status = 'podium';

    this.results.sort((a, b) => a.rank - b.rank);

    this.broadcast({
      type: 'RACE_FINISHED',
      results: this.results,
      room: this.getSanitizedRoom(),
    });
  }

  public useAbility() {
    if (this.isHost) {
      this.hostUseAbility(this.myPlayerId);
    } else if (this.conn && this.conn.open) {
      this.conn.send({ type: 'USE_ABILITY' });
    }
  }

  private hostUseAbility(playerId: string) {
    if (this.status !== 'racing') return;
    const player = this.players.get(playerId);
    if (!player || player.usedAbility) return;
    const racer = this.roster.find(r => r.playerId === playerId);
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
      this.roster.forEach(r => {
        if (r.playerId !== playerId && !r.finished) {
          r.progress = Math.max(0, r.progress - 10);
          r.fatigue = Math.min(100, r.fatigue + 20);
        }
      });
      message = `¡${player.name} liberó Nube de Feromonas (retrasó y fatigó a sus rivales)!`;
    } else if (ab.id === 'absorb') {
      this.roster.forEach(r => {
        if (r.playerId !== playerId && !r.finished) {
          r.progress = Math.max(0, r.progress - 5);
          r.fatigue = Math.min(100, r.fatigue + 10);
        }
      });
      racer.progress += 12;
      message = `¡${player.name} aprovechó Ventaja Regulada (+12% de avance y presión al rival)!`;
    }

    this.broadcast({
      type: 'ABILITY_TRIGGERED',
      playerId,
      abilityName: ab.name,
      message,
      roster: this.roster,
    });
  }

  public useTurbo() {
    if (this.isHost) {
      this.hostUseTurbo(this.myPlayerId);
    } else if (this.conn && this.conn.open) {
      this.conn.send({ type: 'USE_TURBO' });
    }
  }

  private hostUseTurbo(playerId: string) {
    if (this.status !== 'racing') return;
    const racer = this.roster.find(r => r.playerId === playerId);
    if (!racer || racer.finished || racer.fatigue >= 100) return;

    const now = Date.now();
    const last = this.lastTurboTimes.get(playerId) || 0;
    if (now - last < 150) return; // 150ms cooldown
    this.lastTurboTimes.set(playerId, now);

    racer.progress = Math.min(FINISH, racer.progress + 1.0);
    racer.fatigue = Math.min(100, racer.fatigue + 2.2);
    racer.overheated = racer.fatigue >= 100;
    racer.turboActive = true;

    this.broadcast({
      type: 'TURBO_TRIGGERED',
      playerId,
      roster: this.roster,
    });
  }

  public sendChat(text: string) {
    const cleanText = text.trim();
    if (!cleanText) return;

    if (this.isHost) {
      const hostP = this.players.get(this.myPlayerId);
      const chatItem = {
        sender: hostP ? hostP.name : 'Anfitrión',
        text: cleanText.slice(0, 100),
        time: new Date().toLocaleTimeString().slice(0, 5),
      };
      this.chatMessages.push(chatItem);
      this.broadcast({ type: 'CHAT_MESSAGE', message: chatItem });
    } else if (this.conn && this.conn.open) {
      this.conn.send({ type: 'SEND_CHAT', text: cleanText });
    }
  }

  public requestRematch() {
    if (this.isHost) {
      this.rematchVotes.add(this.myPlayerId);
      this.checkHostRematch();
    } else if (this.conn && this.conn.open) {
      this.conn.send({ type: 'REQUEST_REMATCH' });
    }
  }

  private checkHostRematch() {
    // If both voted or if single, reset to lobby
    this.status = 'lobby';
    this.roster = [];
    this.results = [];
    this.rematchVotes.clear();
    for (const p of this.players.values()) {
      p.ready = false;
      p.usedAbility = false;
    }
    this.broadcast({
      type: 'ROOM_UPDATE',
      room: this.getSanitizedRoom(),
    });
  }

  public leaveRoom() {
    this.destroy();
  }

  public destroy() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.raceInterval) clearInterval(this.raceInterval);
    if (this.eventInterval) clearInterval(this.eventInterval);
    this.countdownTimer = null;
    this.raceInterval = null;
    this.eventInterval = null;

    if (this.conn) {
      try {
        this.conn.close();
      } catch {}
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }
    this.players.clear();
    this.isHost = false;
    this.status = 'lobby';
  }
}
