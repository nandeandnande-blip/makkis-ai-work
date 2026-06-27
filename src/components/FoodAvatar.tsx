import { useState } from 'react';
import { FoodCategory } from '../types';

interface FoodAvatarProps {
  image?: string;
  name: string;
  category?: FoodCategory | string;
  className?: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  protein: '🍖',
  carb: '🍚',
  fat: '🥑',
  vegetable: '🥬',
  fruit: '🍎',
  dairy: '🥛',
  other: '🍽️',
};

const CATEGORY_BG: Record<string, string> = {
  protein: 'bg-gradient-to-br from-rose-400 to-rose-600',
  carb: 'bg-gradient-to-br from-amber-400 to-amber-600',
  fat: 'bg-gradient-to-br from-yellow-400 to-yellow-600',
  vegetable: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
  fruit: 'bg-gradient-to-br from-orange-400 to-orange-600',
  dairy: 'bg-gradient-to-br from-blue-400 to-blue-600',
  other: 'bg-gradient-to-br from-slate-400 to-slate-600',
};

export default function FoodAvatar({
  image,
  name,
  category = 'other',
  className = '',
}: FoodAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const key = category || 'other';

  if (image && !hasError) {
    return (
      <img
        src={image}
        alt={name}
        className={`rounded-xl object-cover ${className}`}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-xl text-white shadow-sm ${CATEGORY_BG[key] ?? CATEGORY_BG.other} ${className}`}
      title={name}
    >
      <span className="text-lg leading-none">{CATEGORY_EMOJI[key] ?? CATEGORY_EMOJI.other}</span>
    </div>
  );
}
