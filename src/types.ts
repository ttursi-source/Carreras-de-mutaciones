export interface OrganismStats {
  velocidad: number;
  resistencia: number;
  recuperacion: number;
}

export interface Ability {
  id: string;
  name: string;
  desc: string;
}

export interface GeneMod {
  id: number;
  name: string;
  filterFrag?: string;
  icon?: string;
  germinal?: boolean;
  randomMod?: boolean;
  mods: Partial<OrganismStats>;
  fact: {
    tag: 'real' | 'juego';
    text: string;
  };
}

export interface Organism {
  id: number | string;
  baseName: string;
  speciesId: number;
  mods: GeneMod[];
  stats: OrganismStats;
  ability: Ability;
}

export interface Scientist {
  name: string;
  avatarKey: string;
}

export interface EthicsOption {
  label: string;
  stance: 'autonomy' | 'precaution' | 'governance' | 'equity';
  effect: Partial<OrganismStats>;
  result: string;
}

export interface EthicsEvent {
  id: string;
  prompt: string;
  options: EthicsOption[];
}

export interface EthicsLogEntry {
  prompt: string;
  chosen: string;
  result: string;
}

// Multiplayer types
export interface DuelPlayer {
  id: string;
  name: string;
  avatarKey: string;
  organism: Organism;
  ready: boolean;
  isHost: boolean;
  usedAbility: boolean;
}

export interface RacerState {
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

export interface DuelResult {
  rank: number;
  playerId: string;
  name: string;
  org: Organism;
  finishTime: number;
  reason: string;
}

export interface ChatMessage {
  sender: string;
  text: string;
  time: string;
}

export interface DuelRoomState {
  code: string;
  status: 'lobby' | 'countdown' | 'racing' | 'podium';
  players: DuelPlayer[];
  activeEvent: { id: string; name: string } | null;
  roster: RacerState[];
  results: DuelResult[];
  chatMessages: ChatMessage[];
  rematchVotesCount?: number;
}
