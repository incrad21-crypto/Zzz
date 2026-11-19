import React, { useEffect, useState } from 'react';
import { Keyboard, Settings, Volume2, VolumeX } from 'lucide-react';
import { formatKeyCode, formatSaveTimestamp } from '../game/saveManager';
import {
  DifficultyMode,
  GameSettings,
  SubtitleSize,
  TextSpeed,
  TouchLayout,
  TouchSize,
  UiScale,
} from '../game/types';
import { KeyBindingsEditor } from './KeyBindingsEditor';

export interface SaveSummaryInfo {
  partsInstalled: number;
  notesFound: number;
  totalNotesFound?: number;
  totalNotes?: number;
  roomName: string;
  playMinutes: number;
  timestamp?: number;
}

interface TitleScreenProps {
  hasSave: boolean;
  saveSummary?: SaveSummaryInfo | null;
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  onStartNew: () => void;
  onContinue: () => void;
  onPanelOpenChange?: (open: boolean) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSave,
  saveSummary,
  settings,
  onUpdateSettings,
  onStartNew,
  onContinue,
  onPanelOpenChange,
}) => {
  const [panel, setPanel] = useState<'none' | 'settings' | 'controls'>('none');

  useEffect(() => {
    onPanelOpenChange?.(panel !== 'none');
  }, [panel, onPanelOpenChange]);

  const sizes: { id: SubtitleSize; label: string }[] = [
    { id: 'small', label: 'Малый' },
    { id: 'medium', label: 'Средний' },
    { id: 'large', label: 'Крупный' },
  ];
  const speeds: { id: TextSpeed; label: string }[] = [
    { id: 'slow', label: 'Медленно' },
    { id: 'normal', label: 'Обычная' },
    { id: 'fast', label: 'Быстро' },
  ];
  const uiScales: { id: UiScale; label: string }[] = [
    { id: 'compact', label: 'Компактный' },
    { id: 'normal', label: 'Обычный' },
    { id: 'large', label: 'Крупный' },
  ];
  const difficulties: { id: DifficultyMode; label: string }[] = [
    { id: 'story', label: 'История' },
    { id: 'standard', label: 'Стандарт' },
    { id: 'tension', label: 'Напряжение' },
  ];
  const touchSizes: { id: TouchSize; label: string }[] = [
    { id: 'small', label: 'Компакт.' },
    { id: 'medium', label: 'Средн.' },
    { id: 'large', label: 'Крупн.' },
  ];
  const touchLayouts: { id: TouchLayout; label: string }[] = [
    { id: 'standard', label: 'Слева ход' },
    { id: 'swapped', label: 'Справа ход' },
  ];

  const kb = settings.keyBindings;
  const continueStamp = formatSaveTimestamp(saveSummary?.timestamp);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between gap-3 p-6 md:px-12 md:py-7 pointer-events-none">
      {/* Top-right sound toggle */}
      <div className="shrink-0 flex justify-end pointer-events-auto">
        <button
          type="button"
          onClick={() => onUpdateSettings({ ...settings, muted: !settings.muted })}
          aria-label={settings.muted ? 'Включить звук' : 'Выключить звук'}
          className="flex items-center gap-2 px-3 py-2 bg-[#090e16]/85 hover:bg-[#141d2b] border border-[#2a3647] text-xs font-mono-ui text-[#c7d4e2] cursor-pointer"
        >
          {settings.muted ? <VolumeX className="w-4 h-4 text-[#d98484]" /> : <Volume2 className="w-4 h-4 text-[#7cd4ff]" />}
          <span>{settings.muted ? 'Звук выкл.' : 'Звук вкл.'}</span>
        </button>
      </div>

      {/* Left atmospheric title hero & interactive drawers */}
      <div className="min-h-0 flex-1 flex flex-col justify-center max-w-xl pointer-events-auto">
        <div className={panel === 'none' ? 'mb-4' : 'mb-2'}>
          <svg
            viewBox="0 0 520 112"
            className="w-full max-w-[460px] h-auto drop-shadow-[0_4px_18px_rgba(0,0,0,0.85)]"
            aria-label="Тихий голос — The Quiet Voice"
          >
            <g transform="translate(4, 14)">
              <rect x="0" y="18" width="38" height="2" fill="#3a4c5e" />
              <circle cx="19" cy="19" r="11" fill="#0c131c" stroke="#5aa9d6" strokeWidth="1.5" />
              <circle cx="19" cy="19" r="4.5" fill="#7cd4ff" opacity="0.88" />
              <rect x="17" y="17" width="4" height="4" fill="#e6f7ff" />
            </g>
            <text
              x="54"
              y="48"
              fill="#e4eaf0"
              fontFamily="'Cormorant Garamond', Georgia, serif"
              fontSize="40"
              fontWeight="700"
              letterSpacing="3"
            >
              ТИХИЙ ГОЛОС
            </text>
            <text
              x="56"
              y="72"
              fill="#7c90a6"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="11"
              letterSpacing="5"
            >
              THE QUIET VOICE
            </text>
            <line x1="56" y1="86" x2="380" y2="86" stroke="#253242" strokeWidth="1" />
          </svg>
        </div>

        <p className={`text-sm text-[#a6b5c4] max-w-md leading-relaxed ${panel === 'none' ? 'mb-6' : 'mb-3.5'}`}>
          Ночная дорога оборвалась в глубине леса. В старом доме ждёт та, кто просит лишь о небольшой помощи.
        </p>

        <div className={`flex flex-wrap items-center gap-3 ${panel === 'none' ? 'mb-4' : 'mb-2.5'}`}>
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartNew();
            }}
            className="px-6 py-3 bg-[#c4d3e3] hover:bg-white text-[#070a0f] font-semibold text-sm tracking-wide transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cd4ff]"
          >
            Начать путь
          </button>

          {hasSave && (
            <button
              type="button"
              title={continueStamp ? `${saveSummary?.roomName ?? ''} · ${continueStamp}` : saveSummary?.roomName}
              onClick={(e) => {
                e.currentTarget.blur();
                onContinue();
              }}
              className="px-5 py-3 bg-[#101824]/95 hover:bg-[#192436] text-[#e1eaf2] border border-[#3a4d66] text-sm tracking-wide transition-colors cursor-pointer text-left"
            >
              <span>Продолжить</span>
              {saveSummary && (
                <span className="ml-2 text-[11px] text-[#7cd4ff] font-mono-ui">
                  ({saveSummary.partsInstalled}/8 дет. ·{' '}
                  {saveSummary.totalNotesFound ?? saveSummary.notesFound}/
                  {saveSummary.totalNotes ?? 20} зап.
                  {continueStamp ? ` · ${continueStamp}` : ''})
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => setPanel((p) => (p === 'settings' ? 'none' : 'settings'))}
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-ui cursor-pointer ${
              panel === 'settings'
                ? 'bg-[#172332] border-[#618cb5] text-white'
                : 'bg-[#090e16]/85 border-[#253142] text-[#9eb0c2] hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Настройки
          </button>
          <button
            type="button"
            onClick={() => setPanel((p) => (p === 'controls' ? 'none' : 'controls'))}
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-ui cursor-pointer ${
              panel === 'controls'
                ? 'bg-[#172332] border-[#618cb5] text-white'
                : 'bg-[#090e16]/85 border-[#253142] text-[#9eb0c2] hover:text-white'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            Управление
          </button>
        </div>

        {panel === 'settings' && (
          <div className="max-w-lg max-h-[min(42vh,340px)] overflow-y-auto bg-[#080c13]/95 border border-[#2c394b] p-4 space-y-3 text-xs font-ui shadow-xl">
            <div className="border border-[#1f2936] bg-[#0b1018] p-2.5 space-y-2">
              <div className="text-[11px] font-medium text-[#7b92a8]">Микшер звука</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                {(
                  [
                    { key: 'masterVolume', label: 'Общая громкость' },
                    { key: 'ambienceVolume', label: 'Эмбиент и дождь' },
                    { key: 'sfxVolume', label: 'Эффекты и шаги' },
                    { key: 'voiceVolume', label: 'Голос и кассеты' },
                  ] as const
                ).map((ch) => {
                  const pct = Math.round(settings[ch.key] * 100);
                  return (
                    <label key={ch.key} className="block">
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="text-[#a8b8c9]">{ch.label}</span>
                        <span className="text-[#7cd4ff] font-mono-ui tabular-nums">{pct}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={pct}
                        disabled={settings.muted}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...settings,
                            [ch.key]: Number(e.target.value) / 100,
                          })
                        }
                        className="w-full accent-[#7cd4ff] cursor-pointer disabled:opacity-40"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#95a6b8]">Режим игры</span>
              <div className="flex gap-1">
                {difficulties.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, difficulty: d.id })}
                    className={`px-2 py-1 border cursor-pointer ${
                      settings.difficulty === d.id
                        ? 'border-[#7cd4ff] bg-[#162738] text-white'
                        : 'border-[#252f3d] bg-[#0e131b] text-[#8391a1]'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#95a6b8]">Размер субтитров</span>
              <div className="flex gap-1">
                {sizes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, subtitleSize: s.id })}
                    className={`px-2 py-1 border cursor-pointer ${
                      settings.subtitleSize === s.id
                        ? 'border-[#7cd4ff] bg-[#162738] text-white'
                        : 'border-[#252f3d] bg-[#0e131b] text-[#8391a1]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#95a6b8]">Скорость текста</span>
              <div className="flex gap-1">
                {speeds.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, textSpeed: sp.id })}
                    className={`px-2 py-1 border cursor-pointer ${
                      settings.textSpeed === sp.id
                        ? 'border-[#7cd4ff] bg-[#162738] text-white'
                        : 'border-[#252f3d] bg-[#0e131b] text-[#8391a1]'
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#95a6b8]">Масштаб интерфейса</span>
              <div className="flex gap-1">
                {uiScales.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, uiScale: sc.id })}
                    className={`px-2 py-1 border cursor-pointer ${
                      settings.uiScale === sc.id
                        ? 'border-[#7cd4ff] bg-[#162738] text-white'
                        : 'border-[#252f3d] bg-[#0e131b] text-[#8391a1]'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(
                [
                  { key: 'subtitleBg', label: 'Подложка субтитров' },
                  { key: 'screenShake', label: 'Тряска камеры' },
                  { key: 'reduceFlashes', label: 'Снизить вспышки' },
                  { key: 'visualNoise', label: 'Помехи экрана' },
                  { key: 'soundCaptions', label: 'Титры звуков' },
                  { key: 'touchControls', label: 'Сенсорное управление' },
                ] as const
              ).map((toggle) => (
                <div
                  key={toggle.key}
                  className="flex items-center justify-between gap-2 border border-[#1a2432] bg-[#0b1018] px-2.5 py-1.5"
                >
                  <span className="text-[#95a6b8] truncate">{toggle.label}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, [toggle.key]: !settings[toggle.key] })
                    }
                    className={`px-2.5 py-0.5 border font-mono-ui shrink-0 cursor-pointer ${
                      settings[toggle.key]
                        ? 'border-[#4b85b3] bg-[#15283a] text-[#dceeff]'
                        : 'border-[#2f3b4c] bg-[#10161f] text-[#8a98a8]'
                    }`}
                  >
                    {settings[toggle.key] ? 'Вкл' : 'Выкл'}
                  </button>
                </div>
              ))}
            </div>

            {settings.touchControls && (
              <div className="space-y-2 border-t border-[#1e2736] pt-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#95a6b8]">Размер кнопок</span>
                  <div className="flex gap-1">
                    {touchSizes.map((sz) => (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, touchSize: sz.id })}
                        className={`px-2 py-1 border cursor-pointer ${
                          settings.touchSize === sz.id
                            ? 'border-[#7cd4ff] bg-[#162738] text-white'
                            : 'border-[#252f3d] bg-[#0e131b] text-[#8391a1]'
                        }`}
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#95a6b8]">Раскладка касания</span>
                  <div className="flex gap-1">
                    {touchLayouts.map((ly) => (
                      <button
                        key={ly.id}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, touchLayout: ly.id })}
                        className={`px-2 py-1 border cursor-pointer ${
                          settings.touchLayout === ly.id
                            ? 'border-[#7cd4ff] bg-[#162738] text-white'
                            : 'border-[#252f3d] bg-[#0e131b] text-[#8391a1]'
                        }`}
                      >
                        {ly.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {panel === 'controls' && (
          <div className="max-w-lg max-h-[min(42vh,340px)] overflow-y-auto bg-[#080c13]/95 border border-[#2c394b] p-3 shadow-xl">
            <KeyBindingsEditor
              bindings={settings.keyBindings}
              onChange={(nextBindings) =>
                onUpdateSettings({ ...settings, keyBindings: nextBindings })
              }
            />
          </div>
        )}
      </div>

      {/* Bottom safe margin hint */}
      <div className="shrink-0 text-xs text-[#7c8a99] tracking-wide font-mono-ui">
        {formatKeyCode(kb.left)} / {formatKeyCode(kb.right)} Движение · {formatKeyCode(kb.run)} Бег ·{' '}
        {formatKeyCode(kb.interact)} Действие · {formatKeyCode(kb.flashlight)} Фонарик ·{' '}
        {formatKeyCode(kb.reload)} Батарейка · {formatKeyCode(kb.map)} Карта ·{' '}
        {formatKeyCode(kb.inventory)} Инвентарь · {formatKeyCode(kb.journal)} Журнал · Esc Пауза
      </div>
    </div>
  );
};
