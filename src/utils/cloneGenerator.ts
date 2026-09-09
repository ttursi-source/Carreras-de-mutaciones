import { Organism, GeneMod, Ability } from '../types';
import { BASE_ORGANISMS, GENE_MODS, ABILITIES } from '../data/gameData';

const CLONE_PREFIXES = [
  'Clon', 'Mutante', 'Cepa', 'Híbrido', 'Bio-Espécimen', 'Gen-X', 'Variante', 'Prototipo'
];

const CLONE_SUFFIXES = [
  'Alpha', 'Prime', 'Neo', 'Omega', 'V2', 'Delta', 'Titan', 'Specter', 'Quantum', 'Apex'
];

function clamp(v: number): number {
  return Math.max(10, Math.min(100, v));
}

export function generateRandomClone(creatorName?: string, excludeSpeciesId?: number): Organism {
  // Choose a base species, preferably different from excludeSpeciesId
  const availableBases = excludeSpeciesId
    ? BASE_ORGANISMS.filter(b => b.id !== excludeSpeciesId)
    : BASE_ORGANISMS;
  const base = availableBases[Math.floor(Math.random() * availableBases.length)] || BASE_ORGANISMS[0];

  // Pick 1 to 3 random distinct gene mods
  const modCount = 1 + Math.floor(Math.random() * 3);
  const shuffledMods = [...GENE_MODS].sort(() => Math.random() - 0.5);
  const selectedMods: GeneMod[] = shuffledMods.slice(0, modCount);

  // Calculate adjusted stats
  const stats = { ...base.stats };
  selectedMods.forEach((mod, idx) => {
    const factor = [1.0, 0.7, 0.5][idx] || 0.4;
    const m = mod.mods;
    stats.velocidad = clamp(stats.velocidad + Math.round((m.velocidad || 0) * factor));
    stats.resistencia = clamp(stats.resistencia + Math.round((m.resistencia || 0) * factor));
    stats.recuperacion = clamp(stats.recuperacion + Math.round((m.recuperacion || 0) * factor));
  });

  // Pick an ability
  const ability: Ability = ABILITIES[Math.floor(Math.random() * ABILITIES.length)];

  // Generate distinct name
  const prefix = CLONE_PREFIXES[Math.floor(Math.random() * CLONE_PREFIXES.length)];
  const suffix = CLONE_SUFFIXES[Math.floor(Math.random() * CLONE_SUFFIXES.length)];
  const customName = creatorName
    ? `${base.name} ${suffix} (${creatorName.slice(0, 8)})`
    : `${prefix} ${base.name} ${suffix}`;

  return {
    id: `clone_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    baseName: customName,
    speciesId: base.id,
    mods: selectedMods,
    stats,
    ability,
  };
}
