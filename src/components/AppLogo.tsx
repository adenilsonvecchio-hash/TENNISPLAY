import React from 'react';
import logoImg from '../assets/images/realistic_tennis_ball_1786391824933.jpg';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
  subtitleText?: string;
  tennisColor?: string;
  playColor?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  showSubtitle = false,
  className = '',
  subtitleText = '',
  tennisColor,
  playColor
}) => {
  const sizeClasses = {
    sm: {
      box: 'w-8 h-8 sm:w-9 sm:h-9 rounded-xl p-0.5',
      title: 'text-base sm:text-lg',
      subtitle: 'text-[10px]'
    },
    md: {
      box: 'w-10 h-10 sm:w-11 sm:h-11 rounded-2xl p-0.5 sm:p-1',
      title: 'text-xl sm:text-2xl',
      subtitle: 'text-xs'
    },
    lg: {
      box: 'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl p-1',
      title: 'text-2xl sm:text-3xl',
      subtitle: 'text-sm'
    },
    xl: {
      box: 'w-16 h-16 sm:w-18 sm:h-18 rounded-3xl p-1.5',
      title: 'text-4xl sm:text-5xl',
      subtitle: 'text-base'
    }
  };

  const currentSize = sizeClasses[size];
  const finalTennisColor = tennisColor || 'text-[#0F172A]';
  const finalPlayColor = playColor || 'text-[#ccff00]';

  return (
    <div className={`flex items-center gap-2 sm:gap-2.5 select-none whitespace-nowrap shrink-0 ${className}`}>
      {/* Icon with white rounded background & soft slate outline */}
      <div className={`shrink-0 bg-white border border-slate-200 shadow-2xs flex items-center justify-center overflow-hidden ${currentSize.box}`}>
        <img
          src={logoImg}
          alt="TennisPlay"
          className="w-full h-full object-cover rounded-xl"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      <div className="flex flex-col justify-center">
        <div
          className={`font-logo font-black leading-none uppercase tracking-tight flex items-center ${currentSize.title}`}
          style={{ letterSpacing: '-0.04em' }}
        >
          <span className={finalTennisColor}>
            TENNIS
          </span>
          <span
            className={finalPlayColor}
            style={{
              WebkitTextStroke: '1.6px #0F172A',
              paintOrder: 'stroke fill',
            }}
          >
            PLAY
          </span>
        </div>
        {showSubtitle && (
          <span className={`font-semibold text-slate-600 block mt-0.5 ${currentSize.subtitle}`}>
            {subtitleText}
          </span>
        )}
      </div>
    </div>
  );
};

