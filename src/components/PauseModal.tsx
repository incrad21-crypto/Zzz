import React, { useRef, useState } from 'react';
import { Download, HardDrive, Keyboard, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  formatSaveTimestamp,
  resetSettingsToDefault,
  SaveSlotId,
  SaveSlotInfo,
} from '../game/saveManager';
import {
  DifficultyMode,
  GameSettings,
  RenderFpsCap,
  SubtitleSize,
  TextSpeed,
  TouchLayout,
  TouchSize,
  UiScale,
} from '../game/types';
import { GameModal } from './GameModal';
import { KeyBindingsEditor } from './KeyBindingsEditor';

interface PauseModalProps {
  settings: GameSettings;
  saveSlots: SaveSlotInfo[];
  onUpdateSettings: (next: GameSettings) => void;
  onSaveNow: () => void;
  onSaveToSlot: (slotId: SaveSlotId) => void;
  onLoadFromSlot: (slotId: SaveSlotId) => void;
  onDeleteSlot: (slotId: SaveSlotId) => void;
  onExportSave: () => void;
  onImportSaveFile: (file: File) => void;
  onResume: () => void;
  onRestart: () => void;
  onExitToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  settings,
  saveSlots,
  onUpdateSettings,
  onSaveNow,
  onSaveToSlot,
  onLoadFromSlot,
  onDeleteSlot,
  onExportSave,
  onImportSaveFile,
  onResume,
  onRestart,
  onExitToTitle,
}) => {
  const [subPanel, setSubPanel] = useState<'settings' | 'keybinds' | 'saves'>('settings');
  const [confirmAction, setConfirmAction] = useState<
    null | 'restart' | 'exit' | 'reset_settings' | { deleteSlot: SaveSlotId }
  >(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    { id: 'compact', label: 'Компакт.' },
    { id: 'normal', label: 'Обычный' },
    { id: 'large', label: 'Крупный' },
  ];

  const touchSizes: { id: TouchSize; label: string }[] = [
    { id: 'small', label: 'Мал.' },
    { id: 'medium', label: 'Сред.' },
    { id: 'large', label: 'Круп.' },
  ];

  const touchLayouts: { id: TouchLayout; label: string }[] = [
    { id: 'standard', label: 'Стандарт' },
    { id: 'swapped', label: 'Зеркально' },
  ];

  const difficulties: { id: DifficultyMode; label: string }[] = [
    { id: 'story', label: 'История' },
    { id: 'standard', label: 'Стандарт' },
    { id: 'tension', label: 'Напряжение' },
  ];

  const fpsCaps: { id: RenderFpsCap; label: string }[] = [
    { id: 0, label: 'Авто' },
    { id: 30, label: '30' },
    { id: 60, label: '60' },
    { id: 120, label: '120' },
  ];

  const mixerChannels: {
    key: 'masterVolume' | 'ambienceVolume' | 'musicVolume' | 'sfxVolume' | 'voiceVolume' | 'uiVolume';
    label: string;
    fallback: number;
  }[] = [
    { key: 'masterVolume', label: 'Общая громкость', fallback: 0.78 },
    { key: 'ambienceVolume', label: 'Эмбиент и дождь', fallback: 0.82 },
    { key: 'musicVolume', label: 'Тревожный фон', fallback: 0.7 },
    { key: 'sfxVolume', label: 'Эффекты и шаги', fallback: 0.9 },
    { key: 'voiceVolume', label: 'Голос и кассеты', fallback: 0.92 },
    { key: 'uiVolume', label: 'Интерфейс', fallback: 0.85 },
  ];

  return (
    <GameModal
      ariaLabel="Пауза и настройки"
      onClose={onResume}
      closeLabel="Продолжить игру"
      zIndexClass="z-40"
      maxWidthClass="max-w-xl"
      backdropClassName="bg-black/80"
      panelClassName="bg-[#080b10] border border-[#2c3747] text-[#dce4ec] p-5 shadow-2xl font-ui"
      headerBorderClassName="border-b border-[#1c232e] pb-2.5 mb-3.5"
      closeButtonClassName="w-8 h-8 flex items-center justify-center border border-[#293342] hover:bg-[#171e29] text-[#b4c0ce] cursor-pointer"
      title={<span className="text-2xl text-[#eef3f8]">Пауза</span>}
      headerExtra={
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubPanel((p) => (p === 'saves' ? 'settings' : 'saves'))}
            className={`flex items-center gap-1.5 px-2.5 py-1 border text-xs font-ui cursor-pointer ${
              subPanel === 'saves'
                ? 'border-[#7cd4ff] bg-[#162738] text-white'
                : 'border-[#2c3747] bg-[#0e141e] text-[#a7b9cc] hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>{subPanel === 'saves' ? 'Настройки' : 'Сохранения'}</span>
          </button>
          <button
            type="button"
            onClick={() => setSubPanel((p) => (p === 'keybinds' ? 'settings' : 'keybinds'))}
            className={`flex items-center gap-1.5 px-2.5 py-1 border text-xs font-ui cursor-pointer ${
              subPanel === 'keybinds'
                ? 'border-[#7cd4ff] bg-[#162738] text-white'
                : 'border-[#2c3747] bg-[#0e141e] text-[#a7b9cc] hover:text-white'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>{subPanel === 'keybinds' ? 'Настройки' : 'Клавиши'}</span>
          </button>
        </div>
      }
    >

        {subPanel === 'keybinds' ? (
          <div className="mb-4 max-h-[min(56vh,420px)] overflow-y-auto pr-1">
            <KeyBindingsEditor
              bindings={settings.keyBindings}
              onChange={(nextBindings) =>
                onUpdateSettings({ ...settings, keyBindings: nextBindings })
              }
            />
          </div>
        ) : subPanel === 'saves' ? (
          <div className="mb-4 max-h-[min(56vh,420px)] overflow-y-auto pr-1 space-y-3 text-xs font-ui">
            <div className="flex flex-wrap items-center justify-between gap-2 border border-[#1f2936] bg-[#0b1018] p-2.5">
              <div>
                <div className="font-medium text-[#dce6f0]">Быстрое сохранение</div>
                <div className="text-[11px] text-[#7a8ea3]">
                  Записывает текущую позицию и обновляет автосейв
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiSfx('confirm');
                  onSaveNow();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#44759b] bg-[#132638] hover:bg-[#1a354d] text-[#d9f0ff] cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Сохранить сейчас</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[#6f859c]">
                Слоты сохранения
              </div>
              {saveSlots.map((slot) => {
                const pendingDelete =
                  typeof confirmAction === 'object' &&
                  confirmAction !== null &&
                  'deleteSlot' in confirmAction &&
                  confirmAction.deleteSlot === slot.slotId;
                return (
                  <div
                    key={slot.slotId}
                    className="flex flex-wrap items-center justify-between gap-2 border border-[#1c2430] bg-[#0a0f16] px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-[#d4e0ec]">{slot.label}</div>
                      {slot.summary ? (
                        <div className="text-[11px] text-[#7c94ad] truncate">
                          {slot.summary.roomName} · {slot.summary.partsInstalled}/8 дет. ·{' '}
                          {slot.summary.totalNotesFound}/{slot.summary.totalNotes} зап.
                          {formatSaveTimestamp(slot.summary.timestamp)
                            ? ` · ${formatSaveTimestamp(slot.summary.timestamp)}`
                            : ''}
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#566473]">Пустой слот</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmAction(null);
                          soundEngine.playUiSfx('confirm');
                          onSaveToSlot(slot.slotId);
                        }}
                        className="px-2 py-1 border border-[#304256] bg-[#111924] hover:bg-[#1a2636] text-[#cfe0f0] cursor-pointer"
                      >
                        Записать
                      </button>
                      {slot.summary && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmAction(null);
                              soundEngine.playUiSfx('click');
                              onLoadFromSlot(slot.slotId);
                            }}
                            className="px-2 py-1 border border-[#3b6a56] bg-[#0e2018] hover:bg-[#153124] text-[#b9f0d6] cursor-pointer"
                          >
                            Загрузить
                          </button>
                          {pendingDelete ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  soundEngine.playUiSfx('cancel');
                                  setConfirmAction(null);
                                  onDeleteSlot(slot.slotId);
                                }}
                                className="px-2 py-1 border border-[#963944] bg-[#301016] hover:bg-[#47161f] text-[#ffd6da] cursor-pointer"
                              >
                                Удалить?
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmAction(null)}
                                className="px-1.5 py-1 border border-[#2c3747] bg-[#10161f] text-[#9cb0c4] cursor-pointer"
                              >
                                Нет
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              aria-label={`Удалить ${slot.label}`}
                              onClick={() => {
                                soundEngine.playUiSfx('click');
                                setConfirmAction({ deleteSlot: slot.slotId });
                              }}
                              className="p-1 border border-[#4a262c] bg-[#1a0d10] hover:bg-[#2a151a] text-[#e89ea5] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border border-[#1f2936] bg-[#0b1018] p-2.5">
              <div className="text-[11px] text-[#8da1b5]">
                Резервная копия файла (.json)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onExportSave}
                  className="flex items-center gap-1.5 px-2.5 py-1 border border-[#2f4054] bg-[#111924] hover:bg-[#192534] text-[#d2e2f0] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Экспорт JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1 border border-[#2f4054] bg-[#111924] hover:bg-[#192534] text-[#d2e2f0] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Импорт JSON</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onImportSaveFile(file);
                    }
                    e.currentTarget.value = '';
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 mb-4 max-h-[min(56vh,420px)] overflow-y-auto pr-1 text-xs font-ui">
            {/* Sound master mute */}
            <div className="flex items-center justify-between">
              <span className="text-[#9eacb9]">Звук и эмбиент</span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, muted: !settings.muted })}
                className="px-3 py-1 border border-[#2f3b4c] bg-[#10161f] hover:bg-[#18212f] text-[#dce4ec] cursor-pointer"
              >
                {settings.muted ? 'Выключен' : 'Включён'}
              </button>
            </div>

            {/* 4-channel Audio Mixer in 2x2 grid */}
            <div className="border border-[#1f2936] bg-[#0b1018] p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-[#6f859c] mb-2">
                Микшер звука
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                {mixerChannels.map((ch) => {
                  const pct = Math.round((settings[ch.key] ?? ch.fallback) * 100);
                  return (
                    <label key={ch.key} className="block">
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="text-[#a8b8c9]">{ch.label}</span>
                        <span className="text-[#7cd4ff] tabular-nums">{pct}%</span>
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

            {/* Subtitle size */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#9eacb9]">Размер субтитров</span>
              <div className="flex items-center gap-1">
                {sizes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, subtitleSize: s.id })}
                    className={`px-2.5 py-1 border cursor-pointer ${
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

            {/* Text speed */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#9eacb9]">Скорость текста</span>
              <div className="flex items-center gap-1">
                {speeds.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, textSpeed: sp.id })}
                    className={`px-2.5 py-1 border cursor-pointer ${
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

            {/* UI scale */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#9eacb9]">Масштаб интерфейса</span>
              <div className="flex items-center gap-1">
                {uiScales.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, uiScale: sc.id })}
                    className={`px-2.5 py-1 border cursor-pointer ${
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

            {/* Game difficulty profile */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#9eacb9]">Режим игры</span>
              <div className="flex items-center gap-1">
                {difficulties.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, difficulty: d.id })}
                    className={`px-2.5 py-1 border cursor-pointer ${
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

            {/* Render FPS cap */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#9eacb9]">Лимит FPS рендера</span>
              <div className="flex items-center gap-1">
                {fpsCaps.map((cap) => (
                  <button
                    key={cap.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, renderFpsCap: cap.id })}
                    className={`px-2.5 py-1 border cursor-pointer font-mono-ui ${
                      (settings.renderFpsCap ?? 0) === cap.id
                        ? 'border-[#7cd4ff] bg-[#162738] text-white'
                        : 'border-[#252f3d] bg-[#0e131b] text-[#8391a1]'
                    }`}
                  >
                    {cap.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Compact 2-column toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="flex items-center justify-between border border-[#1a222e] bg-[#0a0f16] px-2.5 py-1.5">
                <span className="text-[#9eacb9]">Подложка</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, subtitleBg: !settings.subtitleBg })
                  }
                  className="px-2.5 py-0.5 border border-[#2f3b4c] bg-[#10161f] hover:bg-[#18212f] text-[#dce4ec] cursor-pointer"
                >
                  {settings.subtitleBg ? 'Вкл' : 'Выкл'}
                </button>
              </div>

              <div className="flex items-center justify-between border border-[#1a222e] bg-[#0a0f16] px-2.5 py-1.5">
                <span className="text-[#9eacb9]">Тряска камеры</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, screenShake: !settings.screenShake })
                  }
                  className="px-2.5 py-0.5 border border-[#2f3b4c] bg-[#10161f] hover:bg-[#18212f] text-[#dce4ec] cursor-pointer"
                >
                  {settings.screenShake ? 'Вкл' : 'Выкл'}
                </button>
              </div>

              <div className="flex items-center justify-between border border-[#1a222e] bg-[#0a0f16] px-2.5 py-1.5">
                <span className="text-[#9eacb9]">Снизить вспышки</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, reduceFlashes: !settings.reduceFlashes })
                  }
                  className="px-2.5 py-0.5 border border-[#2f3b4c] bg-[#10161f] hover:bg-[#18212f] text-[#dce4ec] cursor-pointer"
                >
                  {settings.reduceFlashes ? 'Вкл' : 'Выкл'}
                </button>
              </div>

              <div className="flex items-center justify-between border border-[#1a222e] bg-[#0a0f16] px-2.5 py-1.5">
                <span className="text-[#9eacb9]">Помехи экрана</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, visualNoise: !settings.visualNoise })
                  }
                  className="px-2.5 py-0.5 border border-[#2f3b4c] bg-[#10161f] hover:bg-[#18212f] text-[#dce4ec] cursor-pointer"
                >
                  {settings.visualNoise ? 'Вкл' : 'Выкл'}
                </button>
              </div>

              <div className="flex items-center justify-between border border-[#1a222e] bg-[#0a0f16] px-2.5 py-1.5">
                <span className="text-[#9eacb9]">Щадящее движение</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, reducedMotion: !settings.reducedMotion })
                  }
                  className="px-2.5 py-0.5 border border-[#2f3b4c] bg-[#10161f] hover:bg-[#18212f] text-[#dce4ec] cursor-pointer"
                >
                  {settings.reducedMotion ? 'Вкл' : 'Выкл'}
                </button>
              </div>

              <div className="flex items-center justify-between border border-[#1a222e] bg-[#0a0f16] px-2.5 py-1.5">
                <span className="text-[#9eacb9]">Вибрация геймпада</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      ...settings,
                      gamepadVibration: !(settings.gamepadVibration ?? true),
                    })
                  }
                  className="px-2.5 py-0.5 border border-[#2f3b4c] bg-[#10161f] hover:bg-[#18212f] text-[#dce4ec] cursor-pointer"
                >
                  {(settings.gamepadVibration ?? true) ? 'Вкл' : 'Выкл'}
                </button>
              </div>

              <div className="sm:col-span-2 border border-[#1a222e] bg-[#0a0f16] px-2.5 py-1.5">
                <label className="block">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[#9eacb9]">Мёртвая зона стика геймпада</span>
                    <span className="text-[#7cd4ff] font-mono-ui tabular-nums">
                      {Math.round((settings.gamepadDeadzone ?? 0.28) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={50}
                    step={2}
                    value={Math.round((settings.gamepadDeadzone ?? 0.28) * 100)}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        gamepadDeadzone: Number(e.target.value) / 100,
                      })
                    }
                    className="w-full accent-[#7cd4ff] cursor-pointer"
                  />
                </label>
              </div>

              <div className="sm:col-span-2 flex items-center justify-between border border-[#1a222e] bg-[#0a0f16] px-2.5 py-1.5">
                <span className="text-[#9eacb9]">Титры звуков (направление аномалий)</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, soundCaptions: !settings.soundCaptions })
                  }
                  className="px-2.5 py-0.5 border border-[#2f3b4c] bg-[#10161f] hover:bg-[#18212f] text-[#dce4ec] cursor-pointer"
                >
                  {settings.soundCaptions ? 'Вкл' : 'Выкл'}
                </button>
              </div>

              <div className="sm:col-span-2 border border-[#1a222e] bg-[#0a0f16] px-2.5 py-1.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#9eacb9]">Сенсорное управление</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, touchControls: !settings.touchControls })
                    }
                    className="px-2.5 py-0.5 border border-[#2f3b4c] bg-[#10161f] hover:bg-[#18212f] text-[#dce4ec] cursor-pointer"
                  >
                    {settings.touchControls ? 'Вкл' : 'Выкл'}
                  </button>
                </div>

                {settings.touchControls && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#182230] text-[11px]">
                    <div className="flex items-center gap-1">
                      <span className="text-[#798b9e] mr-1">Размер:</span>
                      {touchSizes.map((ts) => (
                        <button
                          key={ts.id}
                          type="button"
                          onClick={() => onUpdateSettings({ ...settings, touchSize: ts.id })}
                          className={`px-2 py-0.5 border cursor-pointer ${
                            settings.touchSize === ts.id
                              ? 'border-[#7cd4ff] bg-[#162738] text-white'
                              : 'border-[#252f3d] bg-[#0e131b] text-[#8391a1]'
                          }`}
                        >
                          {ts.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[#798b9e] mr-1">Раскладка:</span>
                      {touchLayouts.map((tl) => (
                        <button
                          key={tl.id}
                          type="button"
                          onClick={() => onUpdateSettings({ ...settings, touchLayout: tl.id })}
                          className={`px-2 py-0.5 border cursor-pointer ${
                            settings.touchLayout === tl.id
                              ? 'border-[#7cd4ff] bg-[#162738] text-white'
                              : 'border-[#252f3d] bg-[#0e131b] text-[#8391a1]'
                          }`}
                        >
                          {tl.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 flex items-center justify-between border border-[#1a222e] bg-[#0a0f16] px-2.5 py-1.5">
                <span className="text-[#9eacb9]">Сбросить все настройки к стандартным</span>
                {confirmAction === 'reset_settings' ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiSfx('confirm');
                        setConfirmAction(null);
                        onUpdateSettings(resetSettingsToDefault());
                      }}
                      className="px-2.5 py-0.5 border border-[#8f5236] bg-[#2a1710] hover:bg-[#3b2016] text-[#ffd7c2] cursor-pointer"
                    >
                      Подтвердить
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      className="px-2 py-0.5 border border-[#2f3b4c] bg-[#10161f] text-[#9cb0c4] cursor-pointer"
                    >
                      Отмена
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiSfx('click');
                      setConfirmAction('reset_settings');
                    }}
                    className="flex items-center gap-1 px-2.5 py-0.5 border border-[#2f3b4c] bg-[#10161f] hover:bg-[#18212f] text-[#dce4ec] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Сбросить</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiSfx('confirm');
              onResume();
            }}
            className="w-full py-2 bg-[#c4d3e3] hover:bg-white text-[#070a0f] font-semibold text-sm cursor-pointer"
          >
            Продолжить [Esc]
          </button>

          {confirmAction === 'restart' ? (
            <div className="flex items-center justify-between gap-2 border border-[#753139] bg-[#1a0c10] px-3 py-2 text-xs">
              <span className="text-[#f0bcc2]">Начать игру сначала? Несохранённый прогресс потеряется.</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiSfx('confirm');
                    setConfirmAction(null);
                    onRestart();
                  }}
                  className="px-2.5 py-1 border border-[#963944] bg-[#361118] hover:bg-[#4d1721] text-white cursor-pointer"
                >
                  Да, сначала
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="px-2.5 py-1 border border-[#2c3747] bg-[#10161f] text-[#b4c2d1] cursor-pointer"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : confirmAction === 'exit' ? (
            <div className="flex items-center justify-between gap-2 border border-[#753139] bg-[#1a0c10] px-3 py-2 text-xs">
              <span className="text-[#f0bcc2]">Выйти в главное меню?</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiSfx('cancel');
                    setConfirmAction(null);
                    onExitToTitle();
                  }}
                  className="px-2.5 py-1 border border-[#963944] bg-[#361118] hover:bg-[#4d1721] text-white cursor-pointer"
                >
                  Выйти
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="px-2.5 py-1 border border-[#2c3747] bg-[#10161f] text-[#b4c2d1] cursor-pointer"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiSfx('click');
                  setConfirmAction('restart');
                }}
                className="py-2 bg-[#111722] hover:bg-[#192232] border border-[#2c3747] text-xs text-[#d5dee8] cursor-pointer"
              >
                Начать сначала
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiSfx('click');
                  setConfirmAction('exit');
                }}
                className="py-2 bg-[#0b0e14] hover:bg-[#141a24] border border-[#222a36] text-xs text-[#9ba8b5] cursor-pointer"
              >
                В главное меню
              </button>
            </div>
          )}
        </div>
    </GameModal>
  );
};
