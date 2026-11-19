import React, { useCallback, useEffect, useState } from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { CLOCK_TARGET_HOUR, CLOCK_TARGET_MINUTE } from '../game/rules';
import { GameModal } from './GameModal';

interface ClockModalProps {
  alreadySolved: boolean;
  onSolved: () => void;
  onClose: () => void;
}

export const ClockModal: React.FC<ClockModalProps> = ({
  alreadySolved,
  onSolved,
  onClose,
}) => {
  const [hours, setHours] = useState(alreadySolved ? CLOCK_TARGET_HOUR : 3);
  const [minutes, setMinutes] = useState(alreadySolved ? CLOCK_TARGET_MINUTE : 0);
  const [feedback, setFeedback] = useState<'idle' | 'wrong' | 'solved'>(
    alreadySolved ? 'solved' : 'idle'
  );

  const adjustHours = (delta: number) => {
    if (feedback === 'solved') return;
    soundEngine.playSfx('keypad');
    setFeedback('idle');
    setHours((h) => (h + delta + 24) % 24);
  };

  const adjustMinutes = (delta: number) => {
    if (feedback === 'solved') return;
    soundEngine.playSfx('keypad');
    setFeedback('idle');
    setMinutes((m) => (m + delta + 60) % 60);
  };

  const handleCheck = useCallback(() => {
    if (feedback === 'solved') return;
    if (hours === CLOCK_TARGET_HOUR && minutes === CLOCK_TARGET_MINUTE) {
      soundEngine.playSfx('unlock');
      setFeedback('solved');
      onSolved();
    } else {
      soundEngine.playSfx('locked');
      setFeedback('wrong');
    }
  }, [feedback, hours, minutes, onSolved]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && feedback !== 'solved') {
        e.preventDefault();
        e.stopPropagation();
        handleCheck();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [feedback, handleCheck]);

  const hourAngle = ((hours % 12) + minutes / 60) * 30;
  const minuteAngle = minutes * 6;
  const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return (
    <GameModal
      ariaLabel="Механизм напольных часов"
      title="Напольные часы"
      icon={<Clock className="w-4 h-4 text-[#d4aa4c]" />}
      closeLabel="Закрыть часы"
      maxWidthClass="max-w-sm"
      panelClassName="border border-[#3a4659] bg-[#090d14] p-5 font-ui text-[#d8e2ec] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_40px_rgba(0,0,0,0.85)]"
      headerBorderClassName="border-b border-[#242e3d] pb-3 mb-4"
      onClose={onClose}
    >

        <div className="flex flex-col items-center mb-4">
          <svg
            viewBox="0 0 120 120"
            className="w-36 h-36 mb-3 drop-shadow-[0_0_16px_rgba(0,0,0,0.75)]"
            aria-label={`Циферблат ${formattedTime}`}
          >
            <circle cx="60" cy="60" r="54" fill="#12161e" stroke="#6c5939" strokeWidth="4" />
            <circle cx="60" cy="60" r="47" fill="#181c22" stroke="#364152" strokeWidth="1" />
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
              <line
                key={deg}
                x1="60"
                y1="16"
                x2="60"
                y2={deg % 90 === 0 ? '22' : '19'}
                stroke={deg % 90 === 0 ? '#d4aa4c' : '#657282'}
                strokeWidth={deg % 90 === 0 ? '2' : '1'}
                transform={`rotate(${deg} 60 60)`}
              />
            ))}
            {/* Hour hand */}
            <line
              x1="60"
              y1="60"
              x2="60"
              y2="34"
              stroke="#e5d7b8"
              strokeWidth="3"
              strokeLinecap="square"
              transform={`rotate(${hourAngle} 60 60)`}
            />
            {/* Minute hand */}
            <line
              x1="60"
              y1="60"
              x2="60"
              y2="23"
              stroke="#8ec8e8"
              strokeWidth="2"
              strokeLinecap="square"
              transform={`rotate(${minuteAngle} 60 60)`}
            />
            <circle cx="60" cy="60" r="3.5" fill="#d4aa4c" />
          </svg>

          {/* Brass pendulum & hidden key compartment */}
          <svg
            viewBox="0 0 120 42"
            className="w-32 h-11 mb-2.5"
            aria-hidden="true"
          >
            <rect
              x="26"
              y="2"
              width="68"
              height="38"
              fill={feedback === 'solved' ? '#0c1b14' : '#0b0f16'}
              stroke={feedback === 'solved' ? '#4a8c67' : '#4a3d27'}
              strokeWidth="1.5"
            />
            {feedback === 'solved' ? (
              <g>
                {/* Swung-aside pendulum + glowing brass key */}
                <line x1="60" y1="2" x2="38" y2="28" stroke="#9e7f3a" strokeWidth="1.5" />
                <circle cx="38" cy="30" r="5" fill="#c9a148" />
                <circle cx="67" cy="22" r="5" fill="none" stroke="#ffd875" strokeWidth="2" />
                <line x1="72" y1="22" x2="86" y2="22" stroke="#ffd875" strokeWidth="2" />
                <line x1="81" y1="22" x2="81" y2="27" stroke="#ffd875" strokeWidth="2" />
                <line x1="85" y1="22" x2="85" y2="26" stroke="#ffd875" strokeWidth="2" />
              </g>
            ) : (
              <g
                style={{
                  transformOrigin: '60px 2px',
                  transform: `rotate(${((hours + minutes) % 2 === 0 ? 1 : -1) * 9}deg)`,
                  transition: 'transform 260ms ease-in-out',
                }}
              >
                <line x1="60" y1="2" x2="60" y2="28" stroke="#9e7f3a" strokeWidth="2" />
                <circle cx="60" cy="30" r="7" fill="#c9a148" stroke="#6c5939" strokeWidth="1.5" />
              </g>
            )}
          </svg>

          <div
            className={`px-4 py-1.5 border text-xl tracking-[0.25em] tabular-nums ${
              feedback === 'solved'
                ? 'border-[#3f7a58] bg-[#0e2117] text-[#8ce8b0]'
                : feedback === 'wrong'
                ? 'border-[#8a3535] bg-[#1c0c0e] text-[#ff8a8a]'
                : 'border-[#2c384a] bg-[#05080c] text-[#e8eef5]'
            }`}
          >
            {formattedTime}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
          <div className="border border-[#222d3c] bg-[#0c121b] p-2">
            <div className="text-[10px] text-[#7a8999] text-center mb-1.5 uppercase">Часы</div>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={feedback === 'solved'}
                onClick={() => adjustHours(-1)}
                className="flex-1 py-1.5 bg-[#151e2a] hover:bg-[#1f2c3d] border border-[#2f3d52] cursor-pointer disabled:opacity-45"
              >
                -1 ч
              </button>
              <button
                type="button"
                disabled={feedback === 'solved'}
                onClick={() => adjustHours(1)}
                className="flex-1 py-1.5 bg-[#151e2a] hover:bg-[#1f2c3d] border border-[#2f3d52] cursor-pointer disabled:opacity-45"
              >
                +1 ч
              </button>
            </div>
          </div>

          <div className="border border-[#222d3c] bg-[#0c121b] p-2">
            <div className="text-[10px] text-[#7a8999] text-center mb-1.5 uppercase">Минуты</div>
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                disabled={feedback === 'solved'}
                onClick={() => adjustMinutes(-15)}
                className="py-1.5 bg-[#151e2a] hover:bg-[#1f2c3d] border border-[#2f3d52] cursor-pointer disabled:opacity-45"
              >
                -15
              </button>
              <button
                type="button"
                disabled={feedback === 'solved'}
                onClick={() => adjustMinutes(-5)}
                className="py-1.5 bg-[#151e2a] hover:bg-[#1f2c3d] border border-[#2f3d52] cursor-pointer disabled:opacity-45"
              >
                -5
              </button>
              <button
                type="button"
                disabled={feedback === 'solved'}
                onClick={() => adjustMinutes(5)}
                className="py-1.5 bg-[#151e2a] hover:bg-[#1f2c3d] border border-[#2f3d52] cursor-pointer disabled:opacity-45"
              >
                +5
              </button>
              <button
                type="button"
                disabled={feedback === 'solved'}
                onClick={() => adjustMinutes(15)}
                className="py-1.5 bg-[#151e2a] hover:bg-[#1f2c3d] border border-[#2f3d52] cursor-pointer disabled:opacity-45"
              >
                +15
              </button>
            </div>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-[#8293a6] text-center mb-4">
          {feedback === 'solved'
            ? 'Маятник откинулся в сторону: внутри найден ключ от подвала и батарейка.'
            : feedback === 'wrong'
            ? 'Шестерни прокрутились впустую... В прихожей на 1-м этаже осталась запись на автоответчике.'
            : 'Гравировка на латуни: «Установи час последней записи, чтобы открыть тайник под маятником».'}
        </p>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-[#2c3645] hover:bg-[#171e29] text-xs text-[#b5c2d1] cursor-pointer"
          >
            Закрыть [Esc]
          </button>
          {feedback !== 'solved' && (
            <button
              type="button"
              onClick={handleCheck}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#d4aa4c] hover:bg-[#ebc367] text-[#090c12] text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Проверить ход
            </button>
          )}
        </div>
    </GameModal>
  );
};
