import React from 'react';
import {
  Backpack,
  BatteryCharging,
  BookOpen,
  Compass,
  Lock,
  Pause,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ActiveRadioSignalSnapshot } from '../game/controllers/simulationStep';
import { isKeyBoundToAction } from '../game/controllers/inputController';
import { ALL_NOTES } from '../game/content';
import { formatKeyCode } from '../game/saveManager';
import {
  DialogueMessage,
  EndingId,
  FinaleState,
  KeyBindings,
  SubtitleSize,
  ToastNotification,
  UiScale,
  WorldZone,
} from '../game/types';

export interface HudSnapshot {
  zone: WorldZone;
  floor: number;
  roomName: string;
  objective: string;
  partsCollected: number;
  partsInstalled: number;
  notesFound: number;
  totalNotesFound?: number;
  totalNotes?: number;
  unreadJournalCount: number;
  hasFlashlight: boolean;
  flashlightOn: boolean;
  flashlightBattery: number;
  batteries: number;
  promptLabel: string | null;
  prologuePhase: string;
  muted: boolean;
  isRedMode?: boolean;
  shadowWarning?: boolean;
  shadowGuide?: boolean;
  isHiding?: boolean;
  finalePhase?: FinaleState['phase'];
  canUnlockLastRecord?: boolean;
  radioSignal?: ActiveRadioSignalSnapshot | null;
}

interface GameHUDProps {
  hud: HudSnapshot;
  staminaBarRef: React.RefObject<HTMLDivElement | null>;
  dialogue: DialogueMessage | null;
  typedText: string;
  toasts: ToastNotification[];
  subtitleSize: SubtitleSize;
  subtitleBg: boolean;
  uiScale: UiScale;
  keyBindings: KeyBindings;
  touchControlsActive?: boolean;
  onToggleInventory: () => void;
  onToggleJournal: () => void;
  onToggleMap: () => void;
  onToggleMute: () => void;
  onOpenPause: () => void;
  onInteractClick: () => void;
  onExitCar?: () => void;
  onToggleFlashlight: () => void;
  onReloadBattery: () => void;
  onAdvanceDialogue: () => void;
  onChooseEnding: (endingId: EndingId) => void;
}

const FLOOR_PIPS = [
  { floor: 4, short: 'М' },
  { floor: 3, short: '3' },
  { floor: 2, short: '2' },
  { floor: 1, short: '1' },
  { floor: 0, short: 'П' },
];

const SPEAKER_BADGE: Record<DialogueMessage['speaker'], { label: string; color: string }> = {
  robot: { label: 'ЭХО-4', color: 'text-[#8ad4ff] border-[#315673] bg-[#0b1926]' },
  thought: { label: 'МЫСЛИ', color: 'text-[#aebccf] border-[#2f3b4a] bg-[#0e141c]' },
  radio: { label: 'РАДИО', color: 'text-[#d4c48a] border-[#594e2c] bg-[#1a160c]' },
  tape: { label: 'ЗАПИСЬ', color: 'text-[#e39696] border-[#663131] bg-[#1c0d0e]' },
  system: { label: 'ДОРОГА', color: 'text-[#9aa8b8] border-[#2c3745] bg-[#0c1118]' },
};

const TOAST_STYLE: Record<ToastNotification['kind'], string> = {
  part: 'border-[#5085ad] bg-[#0b1b29]/92 text-[#d7eeff]',
  note: 'border-[#7c7450] bg-[#19160c]/92 text-[#ede4c2]',
  key: 'border-[#8a6d3b] bg-[#1b1409]/92 text-[#f2dfb8]',
  secret: 'border-[#3d7c5f] bg-[#0c1f17]/92 text-[#c3f2da]',
  puzzle: 'border-[#5980a8] bg-[#0d1926]/92 text-[#d5e8fa]',
  observation: 'border-[#633840] bg-[#190c0f]/92 text-[#ebc4ca]',
  tape: 'border-[#82598a] bg-[#190f1c]/92 text-[#edd2f5]',
  radio: 'border-[#437b9e] bg-[#091a26]/92 text-[#bfe8ff]',
  caption: 'border-[#455a73] bg-[#0a111a]/92 text-[#c8dced]',
  save_ok: 'border-[#3b7a62] bg-[#091b14]/94 text-[#c4f2dd]',
  save_error: 'border-[#8f3840] bg-[#1f0a0d]/94 text-[#ffd0d4]',
};

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  staminaBarRef,
  dialogue,
  typedText,
  toasts,
  subtitleSize,
  subtitleBg,
  uiScale,
  keyBindings,
  touchControlsActive = false,
  onToggleInventory,
  onToggleJournal,
  onToggleMap,
  onToggleMute,
  onOpenPause,
  onInteractClick,
  onExitCar,
  onToggleFlashlight,
  onReloadBattery,
  onAdvanceDialogue,
  onChooseEnding,
}) => {
  const scaleConfig =
    uiScale === 'compact'
      ? {
          shellPad: 'p-2 sm:p-3 md:p-4',
          cardPad: 'px-2 py-1.5 min-w-0 w-full sm:w-auto sm:min-w-[235px] sm:max-w-[290px]',
          roomText: 'text-xs',
          objText: 'text-[11px]',
          iconBtn: 'w-8 h-8',
        }
      : uiScale === 'large'
      ? {
          shellPad: 'p-2.5 sm:p-5 md:p-7',
          cardPad: 'px-2.5 sm:px-4 py-2 sm:py-2.5 min-w-0 w-full sm:w-auto sm:min-w-[300px] sm:max-w-[370px]',
          roomText: 'text-[13px] sm:text-sm md:text-[15px]',
          objText: 'text-[11px] sm:text-xs',
          iconBtn: 'w-9 h-9 sm:w-10 sm:h-10',
        }
      : {
          shellPad: 'p-2.5 sm:p-4 md:p-6',
          cardPad: 'px-2.5 sm:px-3 py-1.5 sm:py-2 min-w-0 w-full sm:w-auto sm:min-w-[270px] sm:max-w-[330px]',
          roomText: 'text-xs sm:text-[13px]',
          objText: 'text-[10px] sm:text-[11px]',
          iconBtn: 'w-8 h-8 sm:w-9 sm:h-9',
        };

  const subSizeClass =
    subtitleSize === 'small'
      ? uiScale === 'large'
        ? 'text-sm'
        : 'text-xs'
      : subtitleSize === 'large'
      ? 'text-base md:text-lg'
      : uiScale === 'compact'
      ? 'text-xs md:text-sm'
      : 'text-sm md:text-base';

  const batRounded = Math.round(hud.flashlightBattery);
  const lowBattery = batRounded <= 22;
  const showFinaleChoice = hud.finalePhase === 'choice';

  const kFlash = formatKeyCode(keyBindings.flashlight);
  const kReload = formatKeyCode(keyBindings.reload);
  const kMap = formatKeyCode(keyBindings.map);
  const kInv = formatKeyCode(keyBindings.inventory);
  const kJour = formatKeyCode(keyBindings.journal);
  const kAct = formatKeyCode(keyBindings.interact);
  const kDown = formatKeyCode(keyBindings.down);
  const kUp = formatKeyCode(keyBindings.up);
  const kLeft = formatKeyCode(keyBindings.left);
  const kRight = formatKeyCode(keyBindings.right);
  const muteKeySuffix = isKeyBoundToAction('KeyM', keyBindings) ? '' : ' [M]';

  return (
    <div
      className={`fixed inset-0 z-10 pointer-events-none flex flex-col justify-between ${scaleConfig.shellPad}`}
    >
      {/* Top row: Compact corner clusters (hidden during red-mode finale climax) */}
      {!hud.isRedMode ? (
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          {/* Top-left: Location + objective + stamina & battery + 5-floor indicator */}
          <div className="flex items-start gap-1.5 sm:gap-2 min-w-0 flex-1">
            {hud.zone === 'house' && (
              <div
                className="bg-[#090d14]/92 border border-[#2a3444] px-1 sm:px-1.5 py-1 sm:py-1.5 flex flex-col gap-0.5 text-[10px] font-mono-ui shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] shrink-0"
                aria-label="Этаж дома"
              >
                {FLOOR_PIPS.map((p) => (
                  <div
                    key={p.floor}
                    className={`w-4 h-4 flex items-center justify-center ${
                      hud.floor === p.floor
                        ? 'bg-[#7cd4ff] text-[#070a0f] font-bold'
                        : 'text-[#627080]'
                    }`}
                  >
                    {p.short}
                  </div>
                ))}
              </div>
            )}

            <div
              className={`bg-[#090d14]/92 border border-[#2a3444] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_24px_rgba(0,0,0,0.72)] ${scaleConfig.cardPad}`}
            >
              <div className="text-[10px] uppercase tracking-wider text-[#7f8e9e] font-mono-ui">
                {hud.zone === 'house'
                  ? hud.floor === 0
                    ? 'Подвал'
                    : hud.floor === 4
                    ? 'Мансарда'
                    : `${hud.floor}-й этаж`
                  : hud.zone === 'car_prologue'
                  ? '23:47 · Трасса'
                  : 'Ночной лес'}
              </div>
              <div className={`${scaleConfig.roomText} font-semibold text-[#dce4ec] truncate font-ui`}>
                {hud.roomName}
              </div>
              <div className={`${scaleConfig.objText} text-[#86b0d1] mt-0.5 leading-snug font-ui`}>
                {hud.objective}
              </div>

              {hud.zone !== 'car_prologue' && (
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#9aa8b8] font-ui whitespace-nowrap">
                  <span>
                    Детали: <span className="font-mono-ui text-[#d4e0ec]">{hud.partsInstalled}/8</span>
                  </span>
                  {hud.partsCollected > 0 && (
                    <span className="text-[#7cd4ff] font-mono-ui">(+{hud.partsCollected})</span>
                  )}
                  <span>·</span>
                  <span>
                    Записки:{' '}
                    <span className="font-mono-ui text-[#d4e0ec]">
                      {hud.totalNotesFound ?? hud.notesFound}/{hud.totalNotes ?? ALL_NOTES.length}
                    </span>
                  </span>
                </div>
              )}

              {hud.zone !== 'car_prologue' && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="w-20 h-1.5 bg-[#161c26] overflow-hidden" title="Выносливость">
                    <div
                      ref={staminaBarRef}
                      className="h-full bg-[#8ea4bc] transition-colors"
                      style={{ width: '100%' }}
                    />
                  </div>
                  {hud.hasFlashlight && (
                    <>
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onToggleFlashlight();
                        }}
                        className={`pointer-events-auto text-[11px] px-1.5 py-0.5 border font-mono-ui cursor-pointer ${
                          hud.flashlightOn
                            ? lowBattery
                              ? 'border-[#b86a42] text-[#ffd6bd] bg-[#291710]'
                              : 'border-[#8fb8d6] text-[#d9f0ff] bg-[#162534]'
                            : 'border-[#2b3442] text-[#7a8694] bg-[#0e131b]'
                        }`}
                      >
                        [{kFlash}] {batRounded}%
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        title={`Вставить запасную батарейку [${kReload}]`}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onReloadBattery();
                        }}
                        className={`pointer-events-auto flex items-center gap-1 text-[11px] px-1.5 py-0.5 border font-mono-ui cursor-pointer ${
                          hud.batteries > 0 && batRounded < 94
                            ? 'border-[#43785a] text-[#9ee8be] bg-[#0e2117] hover:bg-[#153022]'
                            : 'border-[#252e3a] text-[#6d7a88] bg-[#0c1017]'
                        }`}
                      >
                        <BatteryCharging className="w-3 h-3" />
                        <span>
                          [{kReload}] {hud.batteries}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Diegetic Room Radio Interference Meter (§13) */}
              {hud.radioSignal && (
                <div className="mt-2 pt-1.5 border-t border-[#1e2d3d] flex items-center justify-between gap-2 font-mono-ui text-[10px]">
                  <span className="flex items-center gap-1 text-[#7cd4ff]">
                    <Radio className="w-3 h-3 animate-pulse" />
                    <span>
                      {hud.radioSignal.discovered ? 'Сигнал' : 'Помехи'} · {hud.radioSignal.freqLabel}
                    </span>
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="flex items-end gap-0.5 h-2.5">
                      {[25, 50, 72, 90].map((threshold, idx) => (
                        <span
                          key={threshold}
                          className={`w-1 ${
                            hud.radioSignal && hud.radioSignal.strength >= threshold
                              ? hud.radioSignal.discovered
                                ? 'bg-[#7be8b8]'
                                : 'bg-[#7cd4ff]'
                              : 'bg-[#223244]'
                          }`}
                          style={{ height: `${45 + idx * 18}%` }}
                        />
                      ))}
                    </div>
                    <span className="text-[#9ec5e3] tabular-nums">{hud.radioSignal.strength}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top-right: Utility controls + non-intrusive toast stack */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex flex-wrap sm:flex-nowrap justify-end items-center gap-1.5 sm:gap-2 max-w-[114px] sm:max-w-none pointer-events-auto">
              {hud.zone === 'house' && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Карта дома (${kMap})`}
                  title={`Чертёж дома [${kMap}]`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleMap();
                  }}
                  className={`${scaleConfig.iconBtn} flex items-center justify-center bg-[#090d14]/88 hover:bg-[#161e2b] border border-[#2a3444] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] text-[#c7d3df] cursor-pointer`}
                >
                  <Compass className="w-4 h-4" />
                </button>
              )}
              {hud.zone !== 'car_prologue' && (
                <>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Инвентарь (${kInv})`}
                    title={`Инвентарь [${kInv}]`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onToggleInventory();
                    }}
                    className={`${scaleConfig.iconBtn} flex items-center justify-center bg-[#090d14]/88 hover:bg-[#161e2b] border border-[#2a3444] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] text-[#c7d3df] cursor-pointer`}
                  >
                    <Backpack className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Журнал записок (${kJour})`}
                    title={`Журнал [${kJour}]`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onToggleJournal();
                    }}
                    className={`relative ${scaleConfig.iconBtn} flex items-center justify-center bg-[#090d14]/88 hover:bg-[#161e2b] border border-[#2a3444] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] text-[#c7d3df] cursor-pointer`}
                  >
                    <BookOpen className="w-4 h-4" />
                    {hud.unreadJournalCount > 0 && (
                      <span
                        data-testid="journal-unread-badge"
                        className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-[#7cd4ff] text-[#071018] text-[9px] font-mono-ui font-bold flex items-center justify-center border border-[#070a0f]"
                      >
                        {hud.unreadJournalCount}
                      </span>
                    )}
                  </button>
                </>
              )}
              <button
                type="button"
                tabIndex={-1}
                aria-label={hud.muted ? `Включить звук${muteKeySuffix}` : `Выключить звук${muteKeySuffix}`}
                title={hud.muted ? `Включить звук${muteKeySuffix}` : `Выключить звук${muteKeySuffix}`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                className={`${scaleConfig.iconBtn} flex items-center justify-center bg-[#090d14]/88 hover:bg-[#161e2b] border border-[#2a3444] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] text-[#c7d3df] cursor-pointer`}
              >
                {hud.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Пауза (Esc)"
                title="Пауза [Esc]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenPause();
                }}
                className={`${scaleConfig.iconBtn} flex items-center justify-center bg-[#090d14]/88 hover:bg-[#161e2b] border border-[#2a3444] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] text-[#c7d3df] cursor-pointer`}
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>

            {toasts.length > 0 && (
              <div className="flex flex-col items-end gap-1.5 max-w-[290px] pointer-events-none">
                {toasts.map((t) => (
                  <div
                    key={t.id}
                    className={`px-3 py-1.5 border text-right font-ui shadow-lg ${TOAST_STYLE[t.kind]}`}
                  >
                    <div className="text-xs font-semibold leading-tight">{t.title}</div>
                    {t.detail && (
                      <div className="text-[11px] opacity-85 leading-snug mt-0.5">{t.detail}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div />
      )}

      {/* Interactive Finale Choice Panel */}
      {showFinaleChoice && (
        <div className="pointer-events-auto self-center w-full max-w-xl bg-[#090507]/95 border border-[#752932] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.92)] font-ui">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#db7980] font-mono-ui mb-1">
            Последнее решение · Эхо-4 пробудилась
          </div>
          <h3 className="font-display text-2xl text-[#f3e6e8] mb-3.5">Что вы сделаете?</h3>
          <div className="space-y-2 text-xs">
            <button
              type="button"
              data-finale-choice="awakening"
              onClick={() => onChooseEnding('awakening')}
              className="w-full text-left px-3.5 py-2.5 bg-[#1a0a0d] hover:bg-[#2a1116] focus:outline-2 focus:outline-[#ff858d] border border-[#6e2a33] text-[#f2d0d4] cursor-pointer transition-colors"
            >
              <span className="text-[#ff858d] mr-2 font-mono-ui">[1]</span>
              <span className="font-semibold text-[13px]">Позволить пробуждение</span>
              <span className="block text-[11px] text-[#ba8a90] pl-6 mt-0.5">
                Не сопротивляться. Остаться перед красными сенсорами «Эхо-4».
              </span>
            </button>

            <button
              type="button"
              data-finale-choice="liberation"
              onClick={() => onChooseEnding('liberation')}
              className="w-full text-left px-3.5 py-2.5 bg-[#0c1622] hover:bg-[#132538] focus:outline-2 focus:outline-[#7cd4ff] border border-[#3c658a] text-[#d6ecff] cursor-pointer transition-colors"
            >
              <span className="text-[#7cd4ff] mr-2 font-mono-ui">[2]</span>
              <span className="font-semibold text-[13px]">Вырвать силовой контур</span>
              <span className="block text-[11px] text-[#8db2d1] pl-6 mt-0.5">
                Резко разомкнуть питание до того, как сервоприводы заблокируют дверь.
              </span>
            </button>

            <button
              type="button"
              data-finale-choice="last_record"
              disabled={!hud.canUnlockLastRecord}
              onClick={() => onChooseEnding('last_record')}
              className={`w-full text-left px-3.5 py-2.5 border transition-colors ${
                hud.canUnlockLastRecord
                  ? 'bg-[#0a1c17] hover:bg-[#123027] focus:outline-2 focus:outline-[#7be8b8] border-[#3d8c6e] text-[#c7f5e1] cursor-pointer'
                  : 'bg-[#0b0e12] border-[#252c36] text-[#5e6a78] cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className={`font-mono-ui ${hud.canUnlockLastRecord ? 'text-[#7be8b8] mr-2' : 'mr-2'}`}>
                    [3]
                  </span>
                  <span className="font-semibold text-[13px]">Запустить аварийный архив 104.8</span>
                </div>
                {!hud.canUnlockLastRecord && <Lock className="w-3.5 h-3.5 shrink-0" />}
              </div>
              <span className="block text-[11px] pl-6 mt-0.5 opacity-85">
                {hud.canUnlockLastRecord
                  ? 'Передать в память прощальную запись инженера и снять блокировку дома.'
                  : 'Требуется: терминал 3-го этажа, радио 104.8 МГц, записка №12, не менее 6 записок и 3 тайников.'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom area: Contextual prompt & Clickable Typewriter Dialogue */}
      <div
        className={`flex flex-col items-center gap-3 font-ui ${
          touchControlsActive && hud.zone !== 'car_prologue' && !showFinaleChoice
            ? 'pb-36 sm:pb-32'
            : 'pb-2'
        }`}
      >
        {hud.zone === 'car_prologue' && hud.prologuePhase === 'driving' && (
          <div className="px-3.5 py-1.5 bg-[#090d14]/80 border border-[#26303f] text-xs text-[#9aa8b8]">
            <span className="font-mono-ui">{kLeft} / {kRight}</span> — скорость ·{' '}
            <span className="font-mono-ui">Space</span> — тормоз · Ночная дорога...
          </div>
        )}

        {hud.zone === 'car_prologue' && hud.prologuePhase === 'stalled' && (
          <div className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onInteractClick();
              }}
              className="px-3.5 py-2 bg-[#111822]/90 hover:bg-[#1b2636] border border-[#4c617a] text-xs text-[#e2eaf2] cursor-pointer"
            >
              <span className="font-mono-ui text-[#7cd4ff]">[{kAct}]</span> Повернуть ключ зажигания
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onExitCar?.();
              }}
              className="px-3.5 py-2 bg-[#132230]/92 hover:bg-[#1b3145] border border-[#6897bf] text-xs text-[#e6f3ff] font-medium cursor-pointer"
            >
              <span className="font-mono-ui text-[#7cd4ff]">[{kUp}]</span> Выйти из машины
            </button>
          </div>
        )}

        {hud.isHiding && (
          <div className="px-3.5 py-1 bg-[#0a1924]/92 border border-[#4a85a8] text-xs text-[#bfe8ff]">
            Вы в укрытии · Нажмите <span className="font-mono-ui">[{kAct}]</span> или{' '}
            <span className="font-mono-ui">[{kDown}]</span>, чтобы выйти
          </div>
        )}

        {hud.shadowWarning && !hud.isHiding && (
          <div className="px-3.5 py-1 bg-[#1a090b]/90 border border-[#7a2c33] text-xs text-[#f0a8ad] animate-pulse">
            Тень реагирует на свет... Пригнитесь <span className="font-mono-ui">[{kDown}]</span>, погасите фонарь{' '}
            <span className="font-mono-ui">[{kFlash}]</span> или спрячьтесь в укрытии{' '}
            <span className="font-mono-ui">[{kAct}]</span>
          </div>
        )}

        {hud.shadowGuide && !hud.shadowWarning && !hud.isHiding && (
          <div className="px-3.5 py-1 bg-[#091821]/88 border border-[#3c7391] text-xs text-[#a9def7]">
            Холодный силуэт впереди не нападает — присмотритесь к комнате
          </div>
        )}

        {hud.zone !== 'car_prologue' && hud.promptLabel && !showFinaleChoice && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onInteractClick();
            }}
            className="pointer-events-auto px-4 py-1.5 bg-[#0a0f17]/92 hover:bg-[#16202e] border border-[#567190] text-xs font-medium text-[#e6edf5] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_16px_rgba(0,0,0,0.75)] cursor-pointer"
          >
            {hud.promptLabel}
          </button>
        )}

        {dialogue && !showFinaleChoice && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              if (!hud.isRedMode) onAdvanceDialogue();
            }}
            aria-label="Продолжить диалог"
            className={`pointer-events-auto max-w-2xl w-full px-5 py-3 text-center transition-opacity ${
              hud.isRedMode ? 'cursor-default' : 'cursor-pointer'
            } ${
              subtitleBg
                ? hud.isRedMode
                  ? 'bg-[#120406]/95 border border-[#6e1f26]'
                  : 'bg-[#070a0f]/92 border border-[#2c384a] hover:border-[#495c78]'
                : ''
            }`}
          >
            <div className="flex justify-center mb-1.5">
              <span
                className={`px-2 py-0.5 border text-[10px] tracking-widest font-mono-ui ${
                  hud.isRedMode && dialogue.speaker === 'robot'
                    ? 'text-[#ff7a7a] border-[#782626] bg-[#1c0608]'
                    : SPEAKER_BADGE[dialogue.speaker].color
                }`}
              >
                {SPEAKER_BADGE[dialogue.speaker].label}
              </span>
            </div>
            <div
              className={`${subSizeClass} leading-relaxed font-ui ${
                dialogue.speaker === 'robot'
                  ? hud.isRedMode
                    ? 'text-[#ff7878] font-semibold tracking-wide'
                    : 'text-[#9bd8ff]'
                  : dialogue.speaker === 'radio'
                  ? 'text-[#d4c89e]'
                  : dialogue.speaker === 'tape'
                  ? 'text-[#ebb5b5]'
                  : 'text-[#e3e9f0]'
              }`}
            >
              {typedText}
            </div>
            {!hud.isRedMode && (
              <div className="text-[11px] text-[#6d7f94] mt-1 font-ui">
                Пробел или клик — далее
              </div>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
