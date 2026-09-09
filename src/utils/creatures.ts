import { SPECIES, SCIENTIST_SPECS, SpeciesSpec } from '../data/gameData';
import { GeneMod } from '../types';

export function svgBody(spec: SpeciesSpec): string {
  const { body, spot, shape = 'round', feature = 'none', tail = 'short' } = spec;
  let head = '';
  let torso = '';
  let legs = '';
  let extra = '';
  let tailShape = '';
  let eyes = '';
  let mouth = '';

  if (shape === 'sleek') {
    torso = `<ellipse cx="60" cy="72" rx="38" ry="22" fill="${body}"/><ellipse cx="60" cy="80" rx="24" ry="11" fill="${spot}" opacity=".6"/>`;
    head = `<circle cx="86" cy="56" r="16" fill="${body}"/>`;
    eyes = `<circle cx="91" cy="53" r="4" fill="#fff"/><circle cx="92" cy="53" r="1.8" fill="#222"/>`;
    mouth = `<path d="M82 62 Q88 66 94 62" stroke="#222" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    legs = `<rect x="42" y="88" width="10" height="16" rx="4" fill="${body}"/><rect x="66" y="88" width="10" height="16" rx="4" fill="${body}"/>`;
  } else if (shape === 'armored') {
    torso = `<ellipse cx="60" cy="70" rx="32" ry="26" fill="${body}"/><path d="M30 62 Q60 44 90 62 Q60 54 30 62 Z" fill="${spot}"/>`;
    head = `<circle cx="60" cy="42" r="17" fill="${body}"/>`;
    eyes = `<circle cx="54" cy="40" r="3.5" fill="#fff"/><circle cx="54" cy="40" r="1.6" fill="#222"/><circle cx="66" cy="40" r="3.5" fill="#fff"/><circle cx="66" cy="40" r="1.6" fill="#222"/>`;
    mouth = `<path d="M52 50 Q60 54 68 50" stroke="#222" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    legs = `<rect x="38" y="90" width="12" height="14" rx="3" fill="${spot}"/><rect x="70" y="90" width="12" height="14" rx="3" fill="${spot}"/>`;
  } else if (shape === 'spiky') {
    torso = `<ellipse cx="60" cy="70" rx="30" ry="24" fill="${body}"/>`;
    head = `<circle cx="60" cy="40" r="16" fill="${body}"/>`;
    extra += `<polygon points="46,28 50,12 55,28" fill="${spot}"/><polygon points="65,28 70,12 74,28" fill="${spot}"/><polygon points="56,26 60,8 64,26" fill="${spot}"/>`;
    eyes = `<circle cx="54" cy="41" r="3.5" fill="#fff"/><circle cx="54" cy="41" r="1.6" fill="#222"/><circle cx="66" cy="41" r="3.5" fill="#fff"/><circle cx="66" cy="41" r="1.6" fill="#222"/>`;
    mouth = `<path d="M52 50 Q60 46 68 50" stroke="#222" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    legs = `<rect x="42" y="88" width="11" height="16" rx="4" fill="${body}"/><rect x="67" y="88" width="11" height="16" rx="4" fill="${body}"/>`;
  } else {
    torso = `<ellipse cx="60" cy="70" rx="34" ry="28" fill="${body}"/><ellipse cx="60" cy="80" rx="18" ry="12" fill="${spot}" opacity=".55"/>`;
    head = `<circle cx="60" cy="40" r="18" fill="${body}"/>`;
    eyes = `<circle cx="53" cy="39" r="4" fill="#fff"/><circle cx="53" cy="39" r="1.8" fill="#222"/><circle cx="67" cy="39" r="4" fill="#fff"/><circle cx="67" cy="39" r="1.8" fill="#222"/>`;
    mouth = `<path d="M52 50 Q60 55 68 50" stroke="#222" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    legs = `<rect x="42" y="90" width="12" height="16" rx="5" fill="${body}"/><rect x="66" y="90" width="12" height="16" rx="5" fill="${body}"/>`;
  }

  if (feature === 'horns') {
    extra += `<polygon points="46,26 41,8 52,24" fill="${spot}"/><polygon points="74,26 79,8 68,24" fill="${spot}"/>`;
  } else if (feature === 'shell') {
    extra += `<ellipse cx="60" cy="66" rx="30" ry="15" fill="${spot}" opacity=".7"/>`;
  } else if (feature === 'wings') {
    extra += `<ellipse cx="28" cy="62" rx="14" ry="9" fill="${spot}" opacity=".85" transform="rotate(-20 28 62)"/><ellipse cx="92" cy="62" rx="14" ry="9" fill="${spot}" opacity=".85" transform="rotate(20 92 62)"/>`;
  } else if (feature === 'antenna') {
    extra += `<line x1="52" y1="24" x2="45" y2="6" stroke="${spot}" stroke-width="2"/><circle cx="45" cy="6" r="3" fill="${spot}"/><line x1="68" y1="24" x2="75" y2="6" stroke="${spot}" stroke-width="2"/><circle cx="75" cy="6" r="3" fill="${spot}"/>`;
  } else if (feature === 'fin') {
    extra += `<polygon points="60,20 66,2 72,22" fill="${spot}"/>`;
  }

  if (tail === 'long') {
    tailShape = `<path d="M26 78 Q2 68 10 92 Q18 82 30 84 Z" fill="${body}"/>`;
  } else if (tail === 'short') {
    tailShape = `<polygon points="28,80 12,75 26,89" fill="${body}"/>`;
  }

  return `${tailShape}${legs}${torso}${head}${extra}${eyes}${mouth}`;
}

export function creatureSVGString(spec: SpeciesSpec, sizePx: number = 96): string {
  return `<svg viewBox="0 0 100 100" width="${sizePx}" height="${sizePx}">${svgBody(spec)}</svg>`;
}

export function modsFilterString(mods: Array<{ filterFrag?: string }>): string {
  return (mods || [])
    .map(m => m.filterFrag)
    .filter(Boolean)
    .join(' ');
}

export function modsBadgesList(mods: Array<{ icon?: string }>): string[] {
  return (mods || []).map(m => m.icon || '').filter(Boolean);
}

export function scientistSVGString(avatarKey: string, sizePx: number = 80): string {
  const spec = SCIENTIST_SPECS[avatarKey] || SCIENTIST_SPECS.LabOne;
  if (spec.robot) {
    return `<svg viewBox="0 0 100 100" width="${sizePx}" height="${sizePx}">
      <rect x="24" y="8" width="4" height="14" fill="${spec.metal}"/><circle cx="26" cy="8" r="4" fill="${spec.visor}"/>
      <rect x="22" y="22" width="56" height="46" rx="14" fill="${spec.metal}"/>
      <rect x="34" y="38" width="32" height="13" rx="6" fill="${spec.visor}"/>
      <circle cx="50" cy="44.5" r="3.5" fill="#fff"/>
      <rect x="14" y="70" width="72" height="26" rx="10" fill="${spec.coat}"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 100 100" width="${sizePx}" height="${sizePx}">
    <rect x="12" y="72" width="76" height="26" rx="11" fill="${spec.coat}"/>
    <circle cx="50" cy="44" r="23" fill="${spec.skin}"/>
    ${
      spec.hairStyle === 'bun'
        ? `<circle cx="50" cy="25" r="18" fill="${spec.hair}"/><circle cx="50" cy="12" r="7" fill="${spec.hair}"/>`
        : `<path d="M27 34 Q29 10 50 10 Q71 10 73 34 Q58 21 50 21 Q42 21 27 34 Z" fill="${spec.hair}"/>`
    }
    <circle cx="42" cy="44" r="3" fill="#222"/><circle cx="58" cy="44" r="3" fill="#222"/>
    ${
      spec.glasses
        ? `<circle cx="42" cy="44" r="7" fill="none" stroke="#333" stroke-width="2"/><circle cx="58" cy="44" r="7" fill="none" stroke="#333" stroke-width="2"/><line x1="49" y1="44" x2="51" y2="44" stroke="#333" stroke-width="2"/>`
        : ''
    }
    <path d="M42 55 Q50 60 58 55" stroke="#8a5a3a" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`;
}
