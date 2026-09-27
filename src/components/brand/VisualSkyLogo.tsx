import React from 'react';

interface VisualSkyLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  horizontal?: boolean;
}

export const VisualSkyLogo: React.FC<VisualSkyLogoProps> = ({ 
  size = 'md', 
  showText = true,
  className = '',
  horizontal = true
}) => {
  const iconDimensions = {
    sm: { width: 30, height: 28 },
    md: { width: 38, height: 34 },
    lg: { width: 48, height: 44 },
    xl: { width: 64, height: 58 }
  };

  const textStyles = {
    sm: 'text-sm tracking-tight',
    md: 'text-base font-black tracking-tight',
    lg: 'text-xl font-black tracking-tight',
    xl: 'text-2xl font-black tracking-tight'
  };

  const currentDim = iconDimensions[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Visual Sky VS Monogram Emblem SVG */}
      <svg 
        width={currentDim.width} 
        height={currentDim.height} 
        viewBox="0 0 320 280" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 hover:scale-105"
      >
        <defs>
          <linearGradient id="v_cyan_grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00B2FE" />
            <stop offset="60%" stopColor="#0077FE" />
            <stop offset="100%" stopColor="#0050E6" />
          </linearGradient>

          <linearGradient id="v_dark_purple_grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F1225" />
            <stop offset="50%" stopColor="#35103E" />
            <stop offset="100%" stopColor="#7E1559" />
          </linearGradient>

          <linearGradient id="s_cyan_grad" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#00C9FF" />
            <stop offset="50%" stopColor="#0080FF" />
            <stop offset="100%" stopColor="#3664E6" />
          </linearGradient>

          <linearGradient id="s_magenta_grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6C1EAF" />
            <stop offset="50%" stopColor="#BF1578" />
            <stop offset="100%" stopColor="#FF2A65" />
          </linearGradient>
        </defs>

        <g>
          {/* V Left Stem */}
          <path d="M 20 20 L 70 20 L 125 200 L 78 200 Z" fill="url(#v_cyan_grad)" />
          {/* V Right Intersection */}
          <path d="M 78 200 L 125 200 L 175 20 L 130 20 Z" fill="url(#v_dark_purple_grad)" />
          
          {/* S Upper Loop */}
          <path d="M 170 20 C 235 20, 275 55, 275 95 C 275 130, 240 155, 175 160 L 155 162 C 145 163, 140 168, 140 173 C 140 178, 145 183, 155 184 L 270 184 C 270 220, 270 220, 230 220 L 150 220 C 105 220, 75 185, 75 145 C 75 110, 110 85, 175 80 L 195 78 C 205 77, 210 72, 210 67 C 210 62, 205 57, 195 56 L 120 56 L 140 20 Z" fill="url(#s_cyan_grad)" />
          
          {/* S Lower Loop */}
          <path d="M 135 155 C 150 150, 185 150, 220 155 C 265 162, 280 190, 280 220 C 280 260, 240 280, 175 280 L 85 280 L 105 240 L 175 240 C 205 240, 220 230, 220 215 C 220 200, 205 190, 175 188 L 135 185 Z" fill="url(#s_magenta_grad)" />
        </g>
      </svg>

      {showText && (
        horizontal ? (
          <div className="flex items-center gap-1.5 leading-none">
            <span className={`${textStyles[size]} bg-gradient-to-r from-[#00A3FF] via-[#0080FF] to-[#607AFE] bg-clip-text text-transparent`}>
              VISUAL
            </span>
            <span className={`${textStyles[size]} bg-gradient-to-r from-[#8E44AD] via-[#D81B60] to-[#E91E63] bg-clip-text text-transparent`}>
              SKY
            </span>
          </div>
        ) : (
          <div className="flex flex-col leading-tight">
            <span className={`${textStyles[size]} bg-gradient-to-r from-[#00A3FF] via-[#0080FF] to-[#607AFE] bg-clip-text text-transparent`}>
              VISUAL
            </span>
            <span className={`${textStyles[size]} bg-gradient-to-r from-[#8E44AD] via-[#D81B60] to-[#E91E63] bg-clip-text text-transparent`}>
              SKY
            </span>
          </div>
        )
      )}
    </div>
  );
};
