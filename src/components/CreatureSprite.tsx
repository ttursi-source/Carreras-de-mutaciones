import React from 'react';
import { SPECIES } from '../data/gameData';
import { svgBody, modsFilterString, modsBadgesList } from '../utils/creatures';

interface CreatureSpriteProps {
  speciesId: number;
  mods?: Array<{ filterFrag?: string; icon?: string }>;
  sizePx?: number;
  className?: string;
}

export const CreatureSprite: React.FC<CreatureSpriteProps> = ({
  speciesId,
  mods = [],
  sizePx = 80,
  className = '',
}) => {
  const spec = SPECIES[speciesId] || SPECIES[1];
  const filter = modsFilterString(mods);
  const badges = modsBadgesList(mods);

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-end select-none ${className}`}
      style={{ width: sizePx, height: sizePx }}
    >
      {badges.length > 0 && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-1 z-10 pointer-events-none">
          {badges.map((b, i) => (
            <span key={i} className="text-xs animate-bounce" style={{ animationDuration: '1.2s' }}>
              {b}
            </span>
          ))}
        </div>
      )}
      <svg
        viewBox="0 0 100 100"
        width={sizePx}
        height={sizePx}
        className="block"
        style={filter ? { filter } : undefined}
        dangerouslySetInnerHTML={{ __html: svgBody(spec) }}
      />
    </div>
  );
};
