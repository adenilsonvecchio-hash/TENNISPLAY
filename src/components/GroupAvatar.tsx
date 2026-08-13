import React, { useState } from 'react';
import { Grupo } from '../types';
import { Camera } from 'lucide-react';
import { getGroupPublicImageUrl } from '../lib/groupImage';

interface GroupAvatarProps {
  group: Grupo | null | undefined;
  isOwner?: boolean;
  onClickEdit?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'rounded-2xl' | 'rounded-full';
  className?: string;
}

export function GroupAvatar({
  group,
  isOwner = false,
  onClickEdit,
  size = 'md',
  shape = 'rounded-2xl',
  className = ''
}: GroupAvatarProps) {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    xs: 'w-8 h-8 text-xs',
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-xl',
    lg: 'w-16 h-16 text-2xl',
    xl: 'w-24 h-24 text-3xl'
  }[size];

  const badgeSizes = {
    xs: 'w-4 h-4 p-0.5',
    sm: 'w-5 h-5 p-1',
    md: 'w-6 h-6 p-1',
    lg: 'w-7 h-7 p-1.5',
    xl: 'w-8 h-8 p-1.5'
  }[size];

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
    xl: 'w-5 h-5'
  }[size];

  const imageUrl = getGroupPublicImageUrl(group?.imagem_path) || group?.logo_url;

  return (
    <div className={`relative inline-block shrink-0 ${sizeClasses} ${className}`}>
      {/* Avatar Container */}
      <div
        className={`w-full h-full ${shape} overflow-hidden bg-[#0F172A] text-slate-200 flex items-center justify-center font-black border border-slate-200/80 shadow-2xs relative ${
          isOwner ? 'group cursor-pointer' : ''
        }`}
        onClick={isOwner ? onClickEdit : undefined}
      >
        {imageUrl && !hasError ? (
          <img
            src={imageUrl}
            alt={`Logo de ${group?.nome || 'Grupo'}`}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="select-none">🎾</span>
        )}

        {/* Hover overlay for owner */}
        {isOwner && (
          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
            <Camera className={iconSizes} />
          </div>
        )}
      </div>

      {/* Edit Badge Button for Owner ONLY */}
      {isOwner && (
        <button
          type="button"
          onClick={onClickEdit}
          aria-label="Alterar imagem do grupo"
          title="Alterar imagem do grupo"
          className={`absolute -bottom-1 -right-1 ${badgeSizes} bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-md border-2 border-white flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 z-10`}
        >
          <Camera className={iconSizes} />
        </button>
      )}
    </div>
  );
}
