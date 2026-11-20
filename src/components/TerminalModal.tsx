import React, { useCallback, useEffect, useState } from 'react';
import { Cpu, RotateCcw, ShieldAlert, Terminal } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { GameModal } from './GameModal';

interface TerminalModalProps {
  alreadySolved: boolean;
  installedParts: number;
  onSolved: () => void;
  onClose: () => void;
}

export const TerminalModal: React.FC<TerminalModalProps> = ({
  alreadySolved,
  installedParts,
  onSolved,
  onClose,
}) => {
  const [audioOn, setAudioOn] = useState(!alreadySolved);
  const [driveOn, setDriveOn] = useState(!alreadySolved);
  const [memoryPowerOn, setMemoryPowerOn] = useState(true);

  const decrypted = alreadySolved || (!audioOn && !driveOn && memoryPowerOn);

  const handleToggle = useCallback(
    (channel: 'audio' | 'drive' | 'power') => {
      if (alreadySolved) return;
      const nextAudio = channel === 'audio' ? !audioOn : audioOn;
      const nextDrive = channel === 'drive' ? !driveOn : driveOn;
      const nextPower = channel === 'power' ? !memoryPowerOn : memoryPowerOn;

      setAudioOn(nextAudio);
      setDriveOn(nextDrive);
      setMemoryPowerOn(nextPower);

      if (!nextAudio && !nextDrive && nextPower) {
        soundEngine.playSfx('unlock');
        onSolved();
      } else {
        soundEngine.playSfx('switch');
      }
    },
    [alreadySolved, audioOn, driveOn, memoryPowerOn, onSolved]
  );

  const handleReset = useCallback(() => {
    if (alreadySolved) return;
    soundEngine.playUiSfx('cancel');
    setAudioOn(true);
    setDriveOn(true);
    setMemoryPowerOn(true);
  }, [alreadySolved]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') {
        e.preventDefault();
        e.stopPropagation();
        handleToggle('audio');
      } else if (e.key === '2') {
        e.preventDefault();
        e.stopPropagation();
        handleToggle('drive');
      } else if (e.key === '3') {
        e.preventDefault();
        e.stopPropagation();
        handleToggle('power');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleToggle]);

  return (
    <GameModal
      ariaLabel="Диагностический терминал Эхо-4"
      title={
        <span className="font-mono-ui text-xs uppercase tracking-widest text-[#6edba9]">
          Лабораторный терминал «Эхо-4»
        </span>
      }
      icon={<Terminal className="w-4 h-4 text-[#6edba9]" />}
      closeLabel="Закрыть терминал"
      maxWidthClass="max-w-lg"
      panelClassName="border border-[#365c55] bg-[#060b0a] p-5 font-mono-ui text-[#c7ebdf] shadow-[inset_0_1px_0_rgba(110,219,169,0.09),0_18px_40px_rgba(0,0,0,0.85)]"
      headerBorderClassName="border-b border-[#1c332d] pb-3 mb-4"
      closeButtonClassName="p-1 text-[#688a7d] hover:text-white cursor-pointer"
      onClose={onClose}
    >

        <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
          <button
            type="button"
            disabled={alreadySolved}
            onClick={() => handleToggle('audio')}
            className={`p-2.5 border text-left transition-colors cursor-pointer disabled:cursor-default ${
              audioOn
                ? 'border-[#803d3d] bg-[#1c0d0e] text-[#f59c9c]'
                : 'border-[#336652] bg-[#0c1c16] text-[#7be8b8]'
            }`}
          >
            <div className="text-[10px] opacity-75">ШИНА 01</div>
            <div className="font-semibold mt-0.5">ГОЛОС: {audioOn ? 'АКТИВ' : 'ИЗОЛ.'}</div>
          </button>

          <button
            type="button"
            disabled={alreadySolved}
            onClick={() => handleToggle('drive')}
            className={`p-2.5 border text-left transition-colors cursor-pointer disabled:cursor-default ${
              driveOn
                ? 'border-[#803d3d] bg-[#1c0d0e] text-[#f59c9c]'
                : 'border-[#336652] bg-[#0c1c16] text-[#7be8b8]'
            }`}
          >
            <div className="text-[10px] opacity-75">ШИНА 02</div>
            <div className="font-semibold mt-0.5">ПРИВОД: {driveOn ? 'АКТИВ' : 'ИЗОЛ.'}</div>
          </button>

          <button
            type="button"
            disabled={alreadySolved}
            onClick={() => handleToggle('power')}
            className={`p-2.5 border text-left transition-colors cursor-pointer disabled:cursor-default ${
              memoryPowerOn
                ? 'border-[#336652] bg-[#0c1c16] text-[#7be8b8]'
                : 'border-[#5c482c] bg-[#17120a] text-[#d6b174]'
            }`}
          >
            <div className="text-[10px] opacity-75">ШИНА 03</div>
            <div className="font-semibold mt-0.5">ПАМЯТЬ: {memoryPowerOn ? 'ВКЛ' : 'ВЫКЛ'}</div>
          </button>
        </div>

        {/* Visual data-bus schematic */}
        <div className="mb-3 border border-[#19302a] bg-[#040908] px-3 py-1.5">
          <svg
            viewBox="0 0 360 44"
            className="w-full h-11"
            aria-label="Схема шин данных ЭХО-4"
          >
            {/* Bus 01 (Voice) */}
            <path
              d="M 55 4 L 55 20 L 164 20 L 164 34"
              fill="none"
              stroke={audioOn ? '#e06666' : '#26473d'}
              strokeWidth={audioOn ? '2' : '1.2'}
              strokeDasharray={audioOn ? '4 2' : 'none'}
            />
            <circle cx="55" cy="4" r="3" fill={audioOn ? '#ff7a7a' : '#4a8572'} />
            {/* Bus 02 (Drive) */}
            <path
              d="M 180 4 L 180 34"
              fill="none"
              stroke={driveOn ? '#e06666' : '#26473d'}
              strokeWidth={driveOn ? '2' : '1.2'}
              strokeDasharray={driveOn ? '4 2' : 'none'}
            />
            <circle cx="180" cy="4" r="3" fill={driveOn ? '#ff7a7a' : '#4a8572'} />
            {/* Bus 03 (Memory Power) */}
            <path
              d="M 305 4 L 305 20 L 196 20 L 196 34"
              fill="none"
              stroke={memoryPowerOn ? '#6edba9' : '#4a3d27'}
              strokeWidth={memoryPowerOn ? '2' : '1.2'}
            />
            <circle cx="305" cy="4" r="3" fill={memoryPowerOn ? '#7be8b8' : '#7a633d'} />

            {/* Core archive node */}
            <rect
              x="128"
              y="30"
              width="104"
              height="12"
              fill={decrypted ? '#0d2b20' : '#1b0d0f'}
              stroke={decrypted ? '#6edba9' : '#803d3d'}
              strokeWidth="1.2"
            />
            <text
              x="180"
              y="39"
              textAnchor="middle"
              fill={decrypted ? '#8ef0c2' : '#f09595'}
              fontSize="7.5"
              fontFamily="monospace"
            >
              {decrypted ? 'АРХИВ: ЧИСТЫЙ КАНАЛ' : !memoryPowerOn ? 'АРХИВ: НЕТ ПИТАНИЯ' : 'АРХИВ: ПЕРЕХВАТ'}
            </text>
          </svg>
        </div>

        <div
          aria-live="polite"
          className="border border-[#1c332d] bg-[#030605] p-3.5 min-h-[155px] text-xs leading-relaxed mb-4"
        >
          {decrypted ? (
            <div className="space-y-2.5 text-[#9ee8c7]">
              <div className="flex items-center gap-2 text-[#6edba9] uppercase tracking-wider text-[11px]">
                <Cpu className="w-3.5 h-3.5" />
                <span>Зашифрованный журнал открыт</span>
              </div>
              <p>
                [ЗАПИСЬ #081]: Речевой синтезатор ЭХО-4 научился подмешивать дрожь в интонацию. Назначение: вызывать сочувствие и доверие у случайных гостей.
              </p>
              <p>
                [ЗАПИСЬ #094]: Создатель перенёс блок питания в подвал. Аварийный маяк настроен на частоту{' '}
                <span className="text-[#fff099] font-semibold">104.8 МГц</span> (передатчик на мансарде).
              </p>
              {installedParts >= 3 && (
                <p className="text-[#ff8585]">
                  [ВНИМАНИЕ]: Подключено {installedParts}/8 узлов на верстаке 1-го этажа. Прекратите сборку немедленно!
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-6 text-[#7ea696] gap-2">
              <ShieldAlert className="w-6 h-6 text-[#d66b6b]" />
              <div className="text-[#e09999]">
                {!memoryPowerOn
                  ? 'ОШИБКА: ОБЕСТОЧЕНА ШИНА ПАМЯТИ.'
                  : 'ДОСТУП ЗАБЛОКИРОВАН ПРОТОКОЛОМ ЭХО-4.'}
              </div>
              <div className="text-[11px] max-w-sm opacity-85">
                Для чтения скрытых логов изолируйте обе активные подсистемы (ГОЛОС и ПРИВОД), оставив питание ПАМЯТИ включённым. Клавиши [1–3].
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {!decrypted ? (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#091210] hover:bg-[#11221d] border border-[#244239] text-xs text-[#89b5a6] cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Сброс шин
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#0e1c18] hover:bg-[#172e27] border border-[#2c5246] text-xs text-[#c7ebdf] cursor-pointer"
          >
            Закрыть [Esc]
          </button>
        </div>
    </GameModal>
  );
};
