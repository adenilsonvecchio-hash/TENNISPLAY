import React from 'react';
import logoImg from '../assets/images/realistic_tennis_ball_1786391824933.jpg';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
  subtitleText?: string;
  textColor?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  showSubtitle = false,
  className = '',
  subtitleText = '',
  textColor
}) => {
  const sizeClasses = {
    sm: {
      box: 'w-7 h-7 sm:w-8 sm:h-8 rounded-xl border-slate-200 p-0.5',
      title: 'text-xs sm:text-sm',
      subtitle: 'text-[10px]'
    },
    md: {
      box: 'w-10 h-10 rounded-2xl border-slate-200 p-1',
      title: 'text-lg sm:text-xl',
      subtitle: 'text-xs'
    },
    lg: {
      box: 'w-12 h-12 rounded-2xl border-slate-200 p-1',
      title: 'text-2xl',
      subtitle: 'text-sm'
    },
    xl: {
      box: 'w-16 h-16 rounded-3xl border-slate-200 p-1.5',
      title: 'text-3xl sm:text-4xl',
      subtitle: 'text-base'
    }
  };

  const currentSize = sizeClasses[size];
  const colorClass = textColor || 'text-slate-900';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Icon with white rounded background & soft slate outline */}
      <div className={`shrink-0 bg-white border border-slate-300 shadow-xs flex items-center justify-center overflow-hidden ${currentSize.box}`}>
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

      <div>
        <span className={`font-black tracking-tight block leading-none ${colorClass} ${currentSize.title}`}>
          TennisPlay
        </span>
        {showSubtitle && (
          <span className={`font-semibold text-slate-600 block mt-0.5 ${currentSize.subtitle}`}>
            {subtitleText}
          </span>
        )}
      </div>
    </div>
  );
};

