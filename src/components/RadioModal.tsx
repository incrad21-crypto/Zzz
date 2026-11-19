import React, { useCallback, useEffect, useState } from 'react';
import { Radio, ChevronLeft, ChevronRight } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { GameModal } from './GameModal';

interface RadioModalProps {
  alreadyTuned: boolean;
  onTuneSecret: () => void;
  onClose: () => void;
}

interface BroadcastStation {
  freq: number;
  label: string;
  transcript: string;
  isSecret?: boolean;
}

const STATIONS: BroadcastStation[] = [
  {
    freq: 924,
    label: 'Метеосводка (обрыв)',
    transcript: '...[шипение]... ночной шторм в лесном секторе... видимость менее пяти метров... не покидайте...',
  },
  {
    freq: 986,
    label: 'Номерная передача',
    transcript: '«Ноль... четыре... девятнадцать...» — повторяющийся женский голос удивительно похож на робота в кладовой.',
  },
  {
    freq: 1048,
    label: 'Аварийная петля инженера',
    transcript:
      '«Если кто-то слушает это... я спрятал блок питания в подвале за вентиляцией. Отключите цепь на щитке и НЕ собирайте Эхо-4!»',
    isSecret: true,
  },
];

export const RadioModal: React.FC<RadioModalProps> = ({
  alreadyTuned,
  onTuneSecret,
  onClose,
}) => {
  const [freqTenths, setFreqTenths] = useState(alreadyTuned ? 1048 : 960);

  const activeStation = STATIONS.find((s) => Math.abs(s.freq - freqTenths) <= 2) ?? null;
  const closestDist = Math.min(...STATIONS.map((s) => Math.abs(s.freq - freqTenths)));
  const signalStrength = Math.max(0.08, Math.min(1, 1 - closestDist / 32));

  const stepFreq = useCallback(
    (delta: number) => {
      setFreqTenths((prev) => {
        const next = Math.max(880, Math.min(1080, prev + delta));
        const hit = STATIONS.find((s) => Math.abs(s.freq - next) <= 2);
        if (hit) {
          soundEngine.playSfx(hit.isSecret ? 'robot' : 'pickup');
          if (hit.isSecret) {
            onTuneSecret();
          }
        } else {
          soundEngine.playSfx('spark');
        }
        return next;
      });
    },
    [onTuneSecret]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 12 : 2;
      if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        e.stopPropagation();
        stepFreq(-step);
      } else if (e.key === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        e.stopPropagation();
        stepFreq(step);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepFreq]);

  return (
    <GameModal
      ariaLabel="Чердачная радиостанция"
      title={
        <>
          Радиоприёмник (<span className="font-mono-ui text-xs">88.0–108.0</span> МГц)
        </>
      }
      icon={<Radio className="w-4 h-4 text-[#7cd4ff]" />}
      closeLabel="Выключить радио"
      maxWidthClass="max-w-md"
      panelClassName="border border-[#3a4659] bg-[#0a0f16] p-5 font-ui text-[#d8e2ec] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_40px_rgba(0,0,0,0.85)]"
      headerBorderClassName="border-b border-[#25303f] pb-3 mb-4"
      onClose={onClose}
    >

        <div className="border border-[#273445] bg-[#05080c] p-4 mb-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-2xl font-mono-ui text-[#8cd8ff] tabular-nums">
              {(freqTenths / 10).toFixed(1)} <span className="text-xs text-[#698099]">МГц</span>
            </span>
            <span
              className={`text-xs font-mono-ui ${
                activeStation ? 'text-[#7fe0a5]' : 'text-[#7f93a8]'
              }`}
            >
              Сигнал: {Math.round(signalStrength * 100)}%
            </span>
          </div>

          {/* Analog frequency scale with station markers and glowing tuning needle */}
          <div className="relative h-7 bg-[#0a1018] border border-[#1f2c3d] mb-2.5 overflow-hidden">
            <div className="absolute inset-x-2 top-1/2 h-[1px] bg-[#243448]" />
            {STATIONS.map((s) => {
              const leftPct = ((s.freq - 880) / 200) * 100;
              const isCurrent = activeStation?.freq === s.freq;
              return (
                <div
                  key={s.freq}
                  title={`${(s.freq / 10).toFixed(1)} МГц`}
                  className="absolute top-0 bottom-0 flex flex-col items-center justify-between py-0.5 -translate-x-1/2"
                  style={{ left: `${leftPct}%` }}
                >
                  <span
                    className={`w-1.5 h-1.5 ${
                      isCurrent
                        ? 'bg-[#6ee097] shadow-[0_0_6px_#6ee097]'
                        : s.isSecret
                        ? 'bg-[#d9b35b]/80'
                        : 'bg-[#4f6d8a]'
                    }`}
                  />
                  <span className="text-[8px] text-[#60748a] tabular-nums">
                    {(s.freq / 10).toFixed(1)}
                  </span>
                </div>
              );
            })}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#ff7a7a] shadow-[0_0_8px_rgba(255,122,122,0.85)] transition-all duration-100"
              style={{ left: `${((freqTenths - 880) / 200) * 100}%` }}
            />
          </div>

          {/* Live 16-bar signal waveform visualizer */}
          <div
            className="h-9 bg-[#070c12] border border-[#1c2836] px-2 py-1.5 flex items-end justify-between gap-1 mb-3"
            aria-hidden="true"
          >
            {Array.from({ length: 16 }, (_, idx) => {
              const phase = (freqTenths * 0.37 + idx * 0.85) % 6.28;
              const harmonic = activeStation
                ? 0.42 + 0.55 * Math.abs(Math.sin(phase * 1.4))
                : 0.14 + 0.42 * signalStrength * Math.abs(Math.sin(phase * 2.7 + idx));
              const hPct = Math.max(12, Math.min(100, Math.round(harmonic * 100)));
              return (
                <div
                  key={idx}
                  className="flex-1 transition-all duration-100"
                  style={{
                    height: `${hPct}%`,
                    backgroundColor: activeStation
                      ? activeStation.isSecret
                        ? '#e8c468'
                        : '#6ee097'
                      : '#4779a1',
                  }}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => stepFreq(-12)}
              className="px-2.5 py-1.5 bg-[#141c27] hover:bg-[#1e2a3a] border border-[#2d3b4f] text-xs cursor-pointer"
            >
              -1.2
            </button>
            <button
              type="button"
              onClick={() => stepFreq(-2)}
              aria-label="Частота ниже"
              className="flex-1 py-1.5 bg-[#141c27] hover:bg-[#1e2a3a] border border-[#2d3b4f] text-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Настройка
            </button>
            <button
              type="button"
              onClick={() => stepFreq(2)}
              aria-label="Частота выше"
              className="flex-1 py-1.5 bg-[#141c27] hover:bg-[#1e2a3a] border border-[#2d3b4f] text-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              Настройка <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => stepFreq(12)}
              className="px-2.5 py-1.5 bg-[#141c27] hover:bg-[#1e2a3a] border border-[#2d3b4f] text-xs cursor-pointer"
            >
              +1.2
            </button>
          </div>
        </div>

        <div className="border border-[#243040] bg-[#080c12] p-3 min-h-[82px] mb-4">
          {activeStation ? (
            <>
              <div className="text-[11px] uppercase tracking-wider text-[#7fe0a5] mb-1">
                Поймана частота: {activeStation.label}
              </div>
              <p className="text-xs leading-relaxed text-[#dbe6f0]">{activeStation.transcript}</p>
            </>
          ) : (
            <p className="text-xs text-[#69788a] italic">
              ...[белый шум эфира]... Попробуйте подстроить частоту в районе 92.4, 98.6 или 104.8 МГц.
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#141c27] hover:bg-[#1f2b3b] border border-[#324054] text-xs text-[#d8e2ec] cursor-pointer"
          >
            Закрыть [Esc]
          </button>
        </div>
    </GameModal>
  );
};
