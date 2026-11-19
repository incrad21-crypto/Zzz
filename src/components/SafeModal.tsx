import React, { useCallback, useEffect, useState } from 'react';
import { Lock, Delete, CornerDownLeft } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { GameModal } from './GameModal';

interface SafeModalProps {
  onSubmitCode: (code: string) => boolean;
  onClose: () => void;
}

export const SafeModal: React.FC<SafeModalProps> = ({ onSubmitCode, onClose }) => {
  const [digits, setDigits] = useState('');
  const [status, setStatus] = useState<'idle' | 'error' | 'unlocked'>('idle');

  const pushDigit = useCallback(
    (d: string) => {
      if (status === 'unlocked' || digits.length >= 4) return;
      soundEngine.playSfx('flashlight');
      setStatus('idle');
      setDigits((prev) => prev + d);
    },
    [digits.length, status]
  );

  const handleBackspace = useCallback(() => {
    if (status === 'unlocked') return;
    setStatus('idle');
    setDigits((prev) => prev.slice(0, -1));
  }, [status]);

  const handleSubmit = useCallback(() => {
    if (digits.length < 4 || status === 'unlocked') return;
    const ok = onSubmitCode(digits);
    if (ok) {
      soundEngine.playSfx('unlock');
      setStatus('unlocked');
    } else {
      soundEngine.playSfx('locked');
      setStatus('error');
      setDigits('');
    }
  }, [digits, onSubmitCode, status]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        e.stopPropagation();
        pushDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleBackspace, handleSubmit, pushDigit]);

  const displaySlots = [0, 1, 2, 3].map((idx) => digits[idx] ?? '_').join(' ');
  const dialAngle =
    status === 'unlocked'
      ? 180
      : digits.split('').reduce((acc, ch, i) => acc + (Number(ch) + 1) * (i % 2 === 0 ? 36 : -28), 0);

  return (
    <GameModal
      ariaLabel="Стенной сейф инженера"
      title="Сейф инженера"
      icon={<Lock className="w-4 h-4 text-[#d1a854]" />}
      closeLabel="Закрыть сейф"
      maxWidthClass="max-w-xs"
      panelClassName="border border-[#3a4659] bg-[#0a0f16] p-5 font-ui text-[#d8e2ec] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_40px_rgba(0,0,0,0.85)]"
      headerBorderClassName="border-b border-[#25303f] pb-3 mb-4"
      onClose={onClose}
    >

        {/* Mechanical rotary dial & 4-LED status row */}
        <div className="flex items-center justify-center gap-4 mb-3">
          <svg
            viewBox="0 0 80 80"
            className="w-16 h-16 shrink-0"
            aria-hidden="true"
          >
            <circle cx="40" cy="40" r="35" fill="#101721" stroke="#3c4c63" strokeWidth="2.5" />
            <polygon points="40,2 37,8 43,8" fill={status === 'unlocked' ? '#7be8b8' : '#d1a854'} />
            <g
              style={{
                transformOrigin: '40px 40px',
                transform: `rotate(${dialAngle}deg)`,
                transition: 'transform 220ms ease-out',
              }}
            >
              <circle cx="40" cy="40" r="24" fill="#182230" stroke="#536884" strokeWidth="1.5" />
              {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((deg) => (
                <line
                  key={deg}
                  x1="40"
                  y1="17"
                  x2="40"
                  y2="22"
                  stroke="#90a7c2"
                  strokeWidth="1.2"
                  transform={`rotate(${deg} 40 40)`}
                />
              ))}
              <circle cx="40" cy="40" r="7" fill="#0c1118" stroke="#d1a854" strokeWidth="1.5" />
            </g>
          </svg>
          <div className="flex flex-col gap-1.5">
            <div className="text-[11px] font-medium text-[#8a9db3]">
              {status === 'unlocked' ? 'Ригель открыт' : status === 'error' ? 'Ошибка кода' : 'Замок закрыт'}
            </div>
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3].map((idx) => {
                const filled = idx < digits.length || status === 'unlocked';
                return (
                  <span
                    key={idx}
                    className={`w-2.5 h-2.5 border ${
                      status === 'unlocked'
                        ? 'bg-[#6ee097] border-[#9ff2be] shadow-[0_0_6px_#6ee097]'
                        : status === 'error'
                        ? 'bg-[#d95b5b] border-[#ff8a8a]'
                        : filled
                        ? 'bg-[#7cd4ff] border-[#b5e8ff]'
                        : 'bg-[#101721] border-[#2f3d50]'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div
          className={`mb-4 border px-3 py-2.5 text-center font-mono-ui text-2xl tracking-[0.35em] ${
            status === 'error'
              ? 'border-[#8c3636] bg-[#1c0c0e] text-[#ff7a7a]'
              : status === 'unlocked'
              ? 'border-[#3f7a58] bg-[#0d1f16] text-[#8ce8b0]'
              : 'border-[#2b3748] bg-[#05080c] text-[#9be0ff]'
          }`}
        >
          {status === 'unlocked' ? 'ОТКР' : displaySlots}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <button
              key={n}
              type="button"
              disabled={status === 'unlocked'}
              onClick={() => pushDigit(n)}
              className="py-2 bg-[#141c27] hover:bg-[#1e2a3a] border border-[#2c384a] text-sm font-mono-ui text-[#e3ecf5] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={status === 'unlocked'}
            onClick={handleBackspace}
            aria-label="Стереть"
            className="py-2 bg-[#141c27] hover:bg-[#23191d] border border-[#2c384a] text-xs text-[#b5c2d1] flex items-center justify-center cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Delete className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={status === 'unlocked'}
            onClick={() => pushDigit('0')}
            className="py-2 bg-[#141c27] hover:bg-[#1e2a3a] border border-[#2c384a] text-sm font-mono-ui text-[#e3ecf5] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={digits.length < 4 || status === 'unlocked'}
            aria-label="Ввести код"
            className={`py-2 border text-xs flex items-center justify-center ${
              digits.length === 4 && status !== 'unlocked'
                ? 'bg-[#2a4966] hover:bg-[#386085] border-[#5988b3] text-white cursor-pointer'
                : 'bg-[#0e141c] border-[#212a36] text-[#556373] cursor-not-allowed'
            }`}
          >
            <CornerDownLeft className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#8495a8] text-center leading-relaxed">
          {status === 'unlocked'
            ? 'Замок открыт — ключ «3-Т» забран из ячейки.'
            : status === 'error'
            ? 'Неверный код. Ищите дату сборки в бумагах кабинета.'
            : 'Четыре цифры (можно набирать с клавиатуры)'}
        </p>
    </GameModal>
  );
};
