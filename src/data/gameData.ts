import { GeneMod, EthicsEvent, Ability } from '../types';

export interface SpeciesSpec {
  name: string;
  body: string;
  spot: string;
  shape: 'sleek' | 'armored' | 'spiky' | 'round';
  feature: 'none' | 'horns' | 'shell' | 'wings' | 'antenna' | 'fin';
  tail: 'none' | 'short' | 'long';
}

export const SPECIES: Record<number, SpeciesSpec> = {
  1: { name: 'Veloxis', body: '#e67e22', spot: '#f6b352', shape: 'sleek', feature: 'fin', tail: 'long' },
  2: { name: 'Terratox', body: '#6b8e4e', spot: '#4f6b37', shape: 'armored', feature: 'shell', tail: 'short' },
  3: { name: 'Aquafin', body: '#2a9df4', spot: '#8fd6f7', shape: 'sleek', feature: 'fin', tail: 'long' },
  4: { name: 'Pyrolix', body: '#e74c3c', spot: '#ff9d85', shape: 'spiky', feature: 'horns', tail: 'short' },
  5: { name: 'Glacero', body: '#8fd6e8', spot: '#c7f0fa', shape: 'round', feature: 'none', tail: 'short' },
  6: { name: 'Umbraw', body: '#5b4b8a', spot: '#8a72c4', shape: 'sleek', feature: 'wings', tail: 'long' },
  7: { name: 'Ferronte', body: '#95a5a6', spot: '#6c7a7b', shape: 'armored', feature: 'shell', tail: 'short' },
  8: { name: 'Volantip', body: '#f1c40f', spot: '#fde68a', shape: 'round', feature: 'wings', tail: 'short' },
  9: { name: 'Fungara', body: '#9b59b6', spot: '#d2a6e6', shape: 'round', feature: 'antenna', tail: 'none' },
  10: { name: 'Cristalum', body: '#00cec9', spot: '#8bf2ee', shape: 'spiky', feature: 'horns', tail: 'none' },
  11: { name: 'Electron', body: '#f9ca24', spot: '#fff3b0', shape: 'sleek', feature: 'antenna', tail: 'long' },
  12: { name: 'Muskelon', body: '#d35400', spot: '#8a3600', shape: 'armored', feature: 'horns', tail: 'short' },
};

export interface ScientistSpec {
  skin?: string;
  hair?: string;
  hairStyle?: 'short' | 'bun';
  coat: string;
  glasses?: boolean;
  robot: boolean;
  metal?: string;
  visor?: string;
}

export const SCIENTIST_SPECS: Record<string, ScientistSpec> = {
  LabOne: { skin: '#f0c398', hair: '#5a3825', hairStyle: 'short', coat: '#ffffff', glasses: false, robot: false },
  LabTwo: { skin: '#c98a5e', hair: '#1c1c1c', hairStyle: 'bun', coat: '#dfe6e9', glasses: true, robot: false },
  LabBot: { metal: '#b2bec3', visor: '#00cec9', coat: '#636e72', robot: true },
};

export interface BaseOrganism {
  id: number;
  name: string;
  stats: {
    velocidad: number;
    resistencia: number;
    recuperacion: number;
  };
}

export const BASE_ORGANISMS: BaseOrganism[] = [
  { id: 1, name: 'Veloxis', stats: { velocidad: 82, resistencia: 38, recuperacion: 50 } },
  { id: 2, name: 'Terratox', stats: { velocidad: 34, resistencia: 90, recuperacion: 52 } },
  { id: 3, name: 'Aquafin', stats: { velocidad: 58, resistencia: 58, recuperacion: 72 } },
  { id: 4, name: 'Pyrolix', stats: { velocidad: 68, resistencia: 44, recuperacion: 80 } },
  { id: 5, name: 'Glacero', stats: { velocidad: 40, resistencia: 84, recuperacion: 44 } },
  { id: 6, name: 'Umbraw', stats: { velocidad: 74, resistencia: 48, recuperacion: 56 } },
  { id: 7, name: 'Ferronte', stats: { velocidad: 28, resistencia: 96, recuperacion: 38 } },
  { id: 8, name: 'Volantip', stats: { velocidad: 78, resistencia: 34, recuperacion: 60 } },
  { id: 9, name: 'Fungara', stats: { velocidad: 44, resistencia: 54, recuperacion: 94 } },
  { id: 10, name: 'Cristalum', stats: { velocidad: 50, resistencia: 76, recuperacion: 48 } },
  { id: 11, name: 'Electron', stats: { velocidad: 90, resistencia: 26, recuperacion: 48 } },
  { id: 12, name: 'Muskelon', stats: { velocidad: 54, resistencia: 70, recuperacion: 58 } },
];

export const GENE_MODS: GeneMod[] = [
  {
    id: 1,
    name: 'Fibras de Contracción Rápida',
    filterFrag: 'hue-rotate(-30deg) saturate(1.5)',
    icon: '',
    mods: { velocidad: 18, resistencia: -8, recuperacion: 0 },
    fact: {
      tag: 'real',
      text: "Los músculos reales tienen fibras 'rápidas' (más velocidad, se cansan antes) y 'lentas' (más resistencia). Es una simplificación aplicarlo a un solo gen: en realidad depende de muchos genes y del entrenamiento.",
    },
  },
  {
    id: 2,
    name: 'Piel Queratinizada Reforzada',
    filterFrag: 'sepia(.55) saturate(2)',
    icon: '',
    mods: { velocidad: -8, resistencia: 18, recuperacion: 0 },
    fact: {
      tag: 'real',
      text: 'La queratina es una proteína real que endurece piel, uñas y pelo. Pero un cambio así de grande de un día para el otro no ocurre en la naturaleza: es una exageración del juego.',
    },
  },
  {
    id: 3,
    name: 'Mitocondrias Hiperactivas',
    filterFrag: '',
    icon: '⚡',
    mods: { velocidad: 0, resistencia: -10, recuperacion: 22 },
    fact: {
      tag: 'real',
      text: "Las mitocondrias son las estructuras de la célula que producen energía (ATP). Tener 'más' no te hace recuperar instantáneamente como en el juego, pero sí es real que su cantidad varía según el tejido.",
    },
  },
  {
    id: 4,
    name: 'Edición CRISPR Experimental',
    filterFrag: '',
    icon: '🧬',
    germinal: false,
    mods: { velocidad: 24, resistencia: 0, recuperacion: -14 },
    fact: {
      tag: 'real',
      text: "CRISPR-Cas9 es una herramienta real que permite 'cortar y pegar' ADN con mucha precisión. En la realidad, editar un gen puede tener efectos inesperados en otros genes: por eso se prueba mucho antes de usarla.",
    },
  },
  {
    id: 5,
    name: 'Duplicación Génica',
    filterFrag: '',
    icon: '✨',
    mods: { velocidad: -6, resistencia: 10, recuperacion: 8 },
    fact: {
      tag: 'real',
      text: 'La duplicación de genes es un mecanismo real de la evolución: a veces un gen se copia por error y esa copia extra puede mutar y adquirir una función nueva con el tiempo.',
    },
  },
  {
    id: 6,
    name: 'Mutación Espontánea',
    filterFrag: 'invert(.08) hue-rotate(60deg)',
    icon: '',
    randomMod: true,
    mods: { velocidad: 0, resistencia: 0, recuperacion: 0 },
    fact: {
      tag: 'real',
      text: 'En la vida real la mayoría de las mutaciones espontáneas son neutras (no cambian nada notable) y muchas de las que sí afectan algo son perjudiciales. Las beneficiosas grandes, como acá, son poco frecuentes.',
    },
  },
  {
    id: 7,
    name: 'Terapia Génica Somática',
    filterFrag: '',
    icon: '💉',
    mods: { velocidad: 4, resistencia: 4, recuperacion: 10 },
    fact: {
      tag: 'real',
      text: "Una edición 'somática' modifica células del cuerpo de un individuo, pero no se transmite a su descendencia. Es distinta de una edición 'germinal', que sí pasaría a la siguiente generación.",
    },
  },
  {
    id: 8,
    name: 'Edición de Línea Germinal',
    filterFrag: '',
    icon: '🔬',
    germinal: true,
    mods: { velocidad: 16, resistencia: 10, recuperacion: -6 },
    fact: {
      tag: 'real',
      text: "Una edición 'germinal' se hace en óvulos, espermatozoides o embriones tempranos, y se transmitiría a la descendencia. Por eso genera un debate ético mucho mayor que una edición somática.",
    },
  },
];

export const ABILITIES: Ability[] = [
  { id: 'turbo', name: 'Impulso sin Restricciones', desc: 'Avanza +15% al instante' },
  { id: 'cool', name: 'Protocolo de Contención', desc: 'Fatiga reducida a 0 al instante' },
  { id: 'confuse', name: 'Nube de Feromonas', desc: 'Retrasa y fatiga a los rivales' },
  { id: 'absorb', name: 'Ventaja Regulada', desc: 'Redistribuye avance de rivales hacia vos (+12%)' },
];

export const GENERAL_FACTS = [
  {
    tag: 'real' as const,
    text: "Un gen es un segmento de ADN con la información para fabricar una proteína. Los 'alelos' son las distintas versiones que puede tener un mismo gen.",
  },
  {
    tag: 'real' as const,
    text: 'El ADN tiene forma de doble hélice y está compuesto por cuatro letras químicas (A, T, C, G) que se combinan como un código universal.',
  },
  {
    tag: 'real' as const,
    text: 'La mayoría de las características (como la altura o resistencia) no dependen de un solo gen, sino de la interacción de cientos de genes junto con el ambiente.',
  },
  {
    tag: 'real' as const,
    text: 'Las células madre pueden convertirse en distintos tipos de células del cuerpo. Se investigan para reparar tejidos, con estrictos marcos de bioética.',
  },
  {
    tag: 'real' as const,
    text: 'Modificar la genética de un embrión es mucho más delicado que la de un organismo formado, porque los cambios se heredan de generación en generación.',
  },
  {
    tag: 'real' as const,
    text: 'Expresión génica es el proceso donde la información del ADN se activa para producir proteínas según estímulos celulares y ambientales.',
  },
  {
    tag: 'real' as const,
    text: 'La ingeniería genética actual tiene límites: no se puede simplemente elegir rasgos complejos como inteligencia, ya que son poligénicos y multifactoriales.',
  },
  {
    tag: 'juego' as const,
    text: 'En este juego, cada modificación cambia drásticamente las estadísticas al instante. En la realidad los efectos suelen ser graduales y sutiles.',
  },
  {
    tag: 'juego' as const,
    text: 'Los organismos (Veloxis, Ferronte, etc.) son especies ficticias diseñadas para experimentar los principios básicos de la genética de forma divertida.',
  },
  {
    tag: 'real' as const,
    text: 'Ninguna decisión genética ocurre aislada: los comités de bioética evalúan el conjunto completo de cambios y sus posibles impactos ecológicos.',
  },
];

export const ETHICS_EVENTS: EthicsEvent[] = [
  {
    id: 'germinal',
    prompt:
      'Una de las modificaciones que combinaste es de línea germinal: no solo cambia a este espécimen, sino que se transmitiría a su descendencia. ¿La autorizás?',
    options: [
      {
        label: 'Sí, si ayuda a evitar un problema grave',
        stance: 'autonomy',
        effect: { recuperacion: 6 },
        result:
          "Priorizaste el argumento preventivo: muchos científicos apoyan la edición germinal solo para evitar enfermedades graves hereditarias, no para 'mejoras' estéticas.",
      },
      {
        label: 'No, es un límite que no cruzaría',
        stance: 'precaution',
        effect: { resistencia: 6 },
        result:
          'Elegiste la postura precautoria: como los efectos se heredan y aún conllevan riesgos de efectos fuera de diana, muchos países prohíben hoy la edición germinal.',
      },
      {
        label: 'Depende de quién decida y regule',
        stance: 'governance',
        effect: { velocidad: 6 },
        result:
          "Pusiste el foco en la gobernanza: gran parte del debate real no es un 'sí o no' rotundo, sino qué marcos regulatorios y consensos internacionales supervisan cada avance.",
      },
    ],
  },
  {
    id: 'acceso',
    prompt:
      'Cada modificación que combinás representa biotecnología avanzada. Si existieran mejoras similares en humanos, su alto costo inicial crearía brechas sociales. ¿Qué postura asumís?',
    options: [
      {
        label: 'Sí, podría profundizar desigualdades',
        stance: 'equity',
        effect: { recuperacion: 5 },
        result:
          'Preocupación central en bioética: las tecnologías de vanguardia tienden a beneficiar primero a quienes tienen mayores recursos si no hay políticas de equidad.',
      },
      {
        label: 'La tecnología suele abaratarse con el tiempo',
        stance: 'autonomy',
        effect: { velocidad: 5 },
        result:
          'Argumento histórico válido: la secuenciación del primer genoma humano costó miles de millones de dólares y hoy se realiza por unos pocos cientos.',
      },
      {
        label: 'El Estado debe garantizar el acceso igualitario',
        stance: 'governance',
        effect: { resistencia: 5 },
        result:
          'Postura comunitaria: la salud y la biotecnología transformadora deben ser bienes públicos accesibles mediante coberturas universales.',
      },
    ],
  },
  {
    id: 'no-medico',
    prompt:
      '¿Debería permitirse combinar rasgos genéticos únicamente para mejorar el rendimiento físico o estético en lugar de curar enfermedades?',
    options: [
      {
        label: 'Sí, es decisión libre de cada individuo',
        stance: 'autonomy',
        effect: { velocidad: 5 },
        result:
          'Postura basada en la autonomía personal: cada individuo debería poder decidir sobre su propio cuerpo dentro de márgenes de seguridad médica.',
      },
      {
        label: 'No, debe limitarse a fines terapéuticos',
        stance: 'precaution',
        effect: { resistencia: 5 },
        result:
          'Postura médica clásica: la intervención genética debe buscar reparar patologías, evitando presiones estéticas o dopaje genético en la sociedad.',
      },
      {
        label: 'Solo con comités éticos caso por caso',
        stance: 'governance',
        effect: { recuperacion: 5 },
        result:
          'Postura equilibrada: evaluar individualmente la seguridad, la no coacción y la proporcionalidad del beneficio frente a los riesgos.',
      },
    ],
  },
];

export function abilityForStance(stance: string): Ability {
  const map: Record<string, string> = {
    precaution: 'cool',
    autonomy: 'turbo',
    governance: 'absorb',
    equity: 'confuse',
  };
  const id = map[stance] || 'turbo';
  return ABILITIES.find(a => a.id === id) || ABILITIES[0];
}
