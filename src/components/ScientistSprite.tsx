import React from 'react';
import { scientistSVGString } from '../utils/creatures';

interface ScientistSpriteProps {
  avatarKey: string;
  sizePx?: number;
  className?: string;
}

export const ScientistSprite: React.FC<ScientistSpriteProps> = ({ avatarKey, sizePx = 70, className = '' }) => {
  return (
    <div
      className={`inline-flex items-center justify-center select-none ${className}`}
      style={{ width: sizePx, height: sizePx }}
      dangerouslySetInnerHTML={{ __html: scientistSVGString(avatarKey, sizePx) }}
    />
  );
};
