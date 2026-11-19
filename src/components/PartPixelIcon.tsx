import React from 'react';
import { PartId } from '../game/types';

interface PartPixelIconProps {
  partId: PartId;
  dimmed?: boolean;
  className?: string;
}

export const PartPixelIcon: React.FC<PartPixelIconProps> = ({
  partId,
  dimmed = false,
  className = 'w-6 h-6',
}) => {
  const hi = dimmed ? '#525f70' : '#ebf4fc';
  const metal = dimmed ? '#3d4754' : '#bccad9';
  const mid = dimmed ? '#2f3742' : '#8596aa';
  const dark = dimmed ? '#1f252e' : '#4b5969';
  const accent = dimmed ? '#2f3d4a' : '#73e2ff';
  const copper = dimmed ? '#4c3f2e' : '#d69e4e';

  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} shrink-0`}
      aria-hidden="true"
    >
      {(partId === 'left_arm' || partId === 'right_arm') && (
        <>
          <path d="M2 11 C3 8.5, 6 8.5, 9 9.5 L9 14 C6 14.5, 3 14, 2 11 Z" fill={metal} stroke={dark} strokeWidth="0.9" />
          <circle cx="10.5" cy="11.8" r="2.1" fill={mid} stroke={dark} strokeWidth="0.8" />
          <circle cx="10.5" cy="11.8" r="0.9" fill={copper} />
          <path d="M12 10 L17.5 10.5 L18 13.5 L12 13.5 Z" fill={hi} stroke={dark} strokeWidth="0.8" />
          <path d="M18 10.5 L22 9 M18 11.5 L22.5 11.5 M18 12.6 L22 13.8 M17.5 13.4 L20.5 15.2" stroke={accent} strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
      {(partId === 'left_leg' || partId === 'right_leg') && (
        <>
          <path d="M7 3 L12.5 3 L11.5 10.5 L7.5 10.5 Z" fill={hi} stroke={dark} strokeWidth="0.9" />
          <circle cx="9.5" cy="11.8" r="2" fill={mid} stroke={dark} strokeWidth="0.8" />
          <circle cx="9.5" cy="11.8" r="0.8" fill={accent} />
          <path d="M8 13.5 L12 13.5 L13.5 18.5 L9 18.5 Z" fill={metal} stroke={dark} strokeWidth="0.9" />
          <path d="M9 18.5 L14.5 18.5 L18.5 21 L9 21 Z" fill={dark} />
        </>
      )}
      {partId === 'chest_panel' && (
        <>
          <path
            d="M4 5 L20 5 L18.5 12 C17.5 15, 16 17, 15.5 20 L8.5 20 C8 17, 6.5 15, 5.5 12 Z"
            fill={metal}
            stroke={dark}
            strokeWidth="1"
          />
          <path d="M6.5 8 Q9 10.5 11 8 M13 8 Q15 10.5 17.5 8" stroke={mid} strokeWidth="1" fill="none" />
          <circle cx="12" cy="12.8" r="3" fill="#0f1822" stroke={dark} strokeWidth="0.8" />
          <circle cx="12" cy="12.8" r="1.7" fill={accent} />
          <rect x="8.5" y="17" width="2" height="1" fill={copper} />
          <rect x="13.5" y="17" width="2" height="1" fill={copper} />
        </>
      )}
      {partId === 'head' && (
        <>
          <path
            d="M5 10 C5 4, 19 4, 19 10 L20 18 L16.5 18 L16 11 L8 11 L7.5 18 L4 18 Z"
            fill={dimmed ? '#4a4536' : '#decb8d'}
            stroke={dimmed ? '#2f2c23' : '#85774b'}
            strokeWidth="0.8"
          />
          <path d="M8 10 C8 7, 16 7, 16 10 L15.5 16 C15 18.5, 13.5 20, 12 20 C10.5 20, 9 18.5, 8.5 16 Z" fill={metal} stroke={dark} strokeWidth="0.8" />
          <path d="M7 9 Q12 6 17 9" stroke={dimmed ? '#5c5644' : '#f4e7bd'} strokeWidth="1.6" fill="none" />
          <circle cx="10" cy="13.5" r="1.1" fill="#101822" />
          <circle cx="14" cy="13.5" r="1.1" fill="#101822" />
          <circle cx="10" cy="13.5" r="0.5" fill={accent} />
          <circle cx="14" cy="13.5" r="0.5" fill={accent} />
        </>
      )}
      {partId === 'face_panel' && (
        <>
          <path
            d="M6.5 6 C6.5 3.5, 17.5 3.5, 17.5 6 L17 13 C16.5 17.5, 14.2 20.5, 12 20.5 C9.8 20.5, 7.5 17.5, 7 13 Z"
            fill={dimmed ? '#3e464f' : '#eef4fa'}
            stroke={dark}
            strokeWidth="0.9"
          />
          <path d="M8.2 9.5 Q9.5 8.5 10.8 9.5 M13.2 9.5 Q14.5 8.5 15.8 9.5" stroke={mid} strokeWidth="0.8" fill="none" />
          <path d="M8.3 11.2 Q9.6 10.3 11 11.2 Q9.6 12.1 8.3 11.2 Z" fill="#141c26" />
          <path d="M13 11.2 Q14.4 10.3 15.7 11.2 Q14.4 12.1 13 11.2 Z" fill="#141c26" />
          <circle cx="9.7" cy="11.2" r="0.5" fill={accent} />
          <circle cx="14.3" cy="11.2" r="0.5" fill={accent} />
          <path d="M10.2 16.5 Q12 15.8 13.8 16.5 Q12 17.5 10.2 16.5 Z" fill={dimmed ? '#333b42' : '#b56e75'} />
        </>
      )}
      {partId === 'power_core' && (
        <>
          <rect x="7" y="3" width="3" height="3" rx="0.5" fill={copper} />
          <rect x="14" y="3" width="3" height="3" rx="0.5" fill={copper} />
          <rect x="5" y="6" width="14" height="14" rx="3" fill={mid} stroke={dark} strokeWidth="1" />
          <circle cx="12" cy="13" r="4.5" fill="#0d1722" stroke={dark} strokeWidth="0.8" />
          <circle cx="12" cy="13" r="2.7" fill={accent} />
          <circle cx="11" cy="12" r="0.9" fill={hi} />
        </>
      )}
    </svg>
  );
};
