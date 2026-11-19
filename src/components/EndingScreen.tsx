import React from 'react';
import { AUDIO_TAPES, SECRETS } from '../game/content';
import { ENDINGS } from '../game/dialogueDirector';
import { EndingId, RunSummary } from '../game/types';

interface EndingScreenProps {
  summary: RunSummary;
  unlockedEndings: EndingId[];
  onPlayAgain: () => void;
  onReturnTitle: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const EndingScreen: React.FC<EndingScreenProps> = ({
  summary,
  unlockedEndings,
  onPlayAgain,
  onReturnTitle,
}) => {
  const ending = ENDINGS[summary.endingId] ?? ENDINGS.awakening;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black p-6 text-[#dce4ec] font-ui">
      <div className="my-auto w-full max-w-xl max-h-[92vh] overflow-y-auto pr-1 text-center space-y-6">
        <div>
          <p
            className="text-xs tracking-[0.14em] mb-2 font-mono-ui"
            style={{ color: ending.accentColor }}
          >
            {ending.numberLabel} · {ending.tag}
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-[#f0f4f8] tracking-wide text-balance">
            {ending.title}
          </h1>
          <p className="text-base italic text-[#a8bacb] mt-3 font-display font-normal">{ending.subtitle}</p>
        </div>

        <p className="text-sm text-[#c5d1de] leading-relaxed border border-[#1d2530] bg-[#080b10] p-4 text-left font-ui">
          {ending.epilogue}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border-y border-[#1e2530] py-4 font-mono-ui">
          <div>
            <div className="text-[11px] text-[#6d7a88]">Время</div>
            <div className="text-lg text-[#eef3f8] mt-1 tabular-nums">
              {formatDuration(summary.playTimeSeconds)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#6d7a88]">Записки</div>
            <div className="text-lg text-[#eef3f8] mt-1 tabular-nums">
              {summary.totalNotesFound ?? summary.notesFound} / {summary.totalNotes ?? 20}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#6d7a88]">Кассеты</div>
            <div className="text-lg text-[#eef3f8] mt-1 tabular-nums">
              {summary.tapesFound} / {AUDIO_TAPES.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#6d7a88]">Тайники</div>
            <div className="text-lg text-[#eef3f8] mt-1 tabular-nums">
              {summary.secretsFound} / {SECRETS.length}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="text-[11px] text-[#6d7a88]">Комнаты</div>
            <div className="text-lg text-[#eef3f8] mt-1 tabular-nums">
              {summary.roomsVisited} / {summary.totalRooms}
            </div>
          </div>
        </div>

        <div className="text-xs font-mono-ui text-[#7c8ea2]">
          Открыто концовок: {unlockedEndings.length} / 3
          {unlockedEndings.length < 3 && (
            <span className="block text-[11px] text-[#5e7185] mt-1">
              Исследуйте записки, терминал 3-го этажа и частоту 104.8 МГц, чтобы открыть все развязки.
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onPlayAgain();
            }}
            className="px-6 py-2.5 bg-[#c4d3e3] hover:bg-white text-[#070a0f] font-semibold text-sm cursor-pointer"
          >
            Начать заново
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onReturnTitle();
            }}
            className="px-5 py-2.5 bg-[#0e131b] hover:bg-[#171f2b] border border-[#2c3645] text-sm text-[#cfd9e3] cursor-pointer"
          >
            Главное меню
          </button>
        </div>
      </div>
    </div>
  );
};
