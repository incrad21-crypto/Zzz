import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Clock,
  Disc,
  Eye,
  Lightbulb,
  Link2,
  Play,
  Radio,
  Volume2,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  ALL_NOTES,
  AUDIO_TAPES,
  BONUS_NOTES,
  INSPECT_OBJECT_CATALOG,
  LORE_NOTES,
  ROOM_RADIO_SIGNALS,
  TIMELINE_ENTRIES,
} from '../game/content';
import { buildClueChains } from '../game/dialogueDirector';
import { countCoreNotes, isTimelineEntryUnlocked } from '../game/rules';
import { AudioTapeId, PartId } from '../game/types';
import { GameModal } from './GameModal';

export interface MysteryProgress {
  phoneListened: boolean;
  clockSolved: boolean;
  safeUnlocked: boolean;
  terminalSolved: boolean;
  breakerFixed: boolean;
  radioTunedSecret: boolean;
}

interface JournalModalProps {
  collectedNotes: string[];
  readNoteIds: string[];
  collectedKeys: string[];
  collectedTapes: AudioTapeId[];
  readTapeIds: AudioTapeId[];
  discoveredRadioSignals: string[];
  inspectedObjects: string[];
  installedParts: PartId[];
  discoveredSecrets: string[];
  observations: string[];
  mysteries: MysteryProgress;
  initialNoteId: string | null;
  onMarkNoteRead: (noteId: string) => void;
  onMarkTapeRead: (tapeId: AudioTapeId) => void;
  onClose: () => void;
}

type JournalTab =
  | 'notes'
  | 'tapes'
  | 'timeline'
  | 'mysteries'
  | 'links'
  | 'objects'
  | 'observations';

export const JournalModal: React.FC<JournalModalProps> = ({
  collectedNotes,
  readNoteIds,
  collectedKeys,
  collectedTapes,
  readTapeIds,
  discoveredRadioSignals,
  inspectedObjects,
  installedParts,
  discoveredSecrets,
  observations,
  mysteries,
  initialNoteId,
  onMarkNoteRead,
  onMarkTapeRead,
  onClose,
}) => {
  const [tab, setTab] = useState<JournalTab>(
    initialNoteId || collectedNotes.length > 0 ? 'notes' : 'observations'
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialNoteId ?? collectedNotes[collectedNotes.length - 1] ?? null
  );
  const [selectedTapeId, setSelectedTapeId] = useState<AudioTapeId | null>(
    collectedTapes[collectedTapes.length - 1] ?? null
  );
  const [playingTapeId, setPlayingTapeId] = useState<AudioTapeId | null>(null);
  const [hintLevels, setHintLevels] = useState<Record<string, number>>({});
  const tapeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tapeTimerRef.current !== null) {
        window.clearTimeout(tapeTimerRef.current);
        tapeTimerRef.current = null;
      }
    };
  }, []);

  // Auto-mark selected note as read when viewing Notes tab
  useEffect(() => {
    if (tab === 'notes' && selectedId && collectedNotes.includes(selectedId)) {
      if (!readNoteIds.includes(selectedId)) {
        onMarkNoteRead(selectedId);
      }
    }
  }, [tab, selectedId, collectedNotes, readNoteIds, onMarkNoteRead]);

  // Auto-mark selected tape as read when viewing Tapes tab
  useEffect(() => {
    if (tab === 'tapes' && selectedTapeId && collectedTapes.includes(selectedTapeId)) {
      if (!readTapeIds.includes(selectedTapeId)) {
        onMarkTapeRead(selectedTapeId);
      }
    }
  }, [tab, selectedTapeId, collectedTapes, readTapeIds, onMarkTapeRead]);

  const selectedNote = ALL_NOTES.find((n) => n.id === selectedId);
  const coreNotesCount = countCoreNotes(collectedNotes);
  const bonusFoundCount = BONUS_NOTES.filter((n) => collectedNotes.includes(n.id)).length;
  const selectedTape = AUDIO_TAPES.find((t) => t.id === selectedTapeId);

  const unreadNotesCount = collectedNotes.filter((id) => !readNoteIds.includes(id)).length;
  const unreadTapesCount = collectedTapes.filter((id) => !readTapeIds.includes(id)).length;

  const inspectedCatalogCount = INSPECT_OBJECT_CATALOG.filter((entry) =>
    inspectedObjects.includes(entry.id)
  ).length;

  const revealNextHint = (mysteryId: string) => {
    setHintLevels((prev) => ({
      ...prev,
      [mysteryId]: Math.min(3, (prev[mysteryId] ?? 0) + 1),
    }));
  };

  const handleSelectNote = (noteId: string) => {
    setSelectedId(noteId);
    if (!readNoteIds.includes(noteId)) {
      onMarkNoteRead(noteId);
    }
  };

  const handleSelectTape = (tapeId: AudioTapeId) => {
    setSelectedTapeId(tapeId);
    if (!readTapeIds.includes(tapeId)) {
      onMarkTapeRead(tapeId);
    }
  };

  const handlePlayTape = (tapeId: AudioTapeId, number: number) => {
    handleSelectTape(tapeId);
    if (tapeTimerRef.current !== null) {
      window.clearTimeout(tapeTimerRef.current);
      tapeTimerRef.current = null;
    }
    setPlayingTapeId(tapeId);
    soundEngine.playTapePlayback(number);
    tapeTimerRef.current = window.setTimeout(() => {
      tapeTimerRef.current = null;
      setPlayingTapeId((cur) => (cur === tapeId ? null : cur));
    }, 1800);
  };

  const mysteryList = [
    {
      id: 'phone',
      title: 'Автоответчик в прихожей (1-й этаж)',
      done: mysteries.phoneListened,
      hints: [
        'В прихожей на первом этаже мигает красный огонёк старого прибора.',
        'Подойдите к тумбе у входной двери и прослушайте кассетный автоответчик [E].',
        'Запись называет время 23:45 — оно пригодится для напольных часов этажом выше.',
      ],
      solvedText: 'Последняя запись сделана в 23:45 — ключ от подвала спрятан под маятником часов.',
    },
    {
      id: 'clock',
      title: 'Напольные часы (2-й этаж, коридор)',
      done: mysteries.clockSolved,
      hints: [
        'Старые напольные часы в коридоре 2-го этажа остановились — стрелки можно перевести вручную.',
        'Нужное время упоминалось в последней кассетной записи в прихожей.',
        'Выставьте на циферблате ровно 23:45, чтобы открыть нишу под маятником и забрать ключ от подвала.',
      ],
      solvedText: 'Тайник открыт: найден ржавый ключ от подвала и запасная батарейка.',
    },
    {
      id: 'safe',
      title: 'Стенной сейф инженера (2-й этаж, кабинет)',
      done: mysteries.safeUnlocked,
      hints: [
        'Код из четырёх цифр записан инженером неподалёку от кабинета и дублируется в эфире.',
        'Осмотрите книжную полку (записка №3): сопоставьте номер протокола «Эхо» и памятное число месяца.',
        'Введите комбинацию 0419, чтобы получить ключ «3-Т» от технического кабинета.',
      ],
      solvedText: 'Вскрыт кодом 0419. Получен ключ от технического кабинета 3-го этажа.',
    },
    {
      id: 'terminal',
      title: 'Терминал «Эхо-4» (3-й этаж, экспериментальная)',
      done: mysteries.terminalSolved,
      hints: [
        'На 3-м этаже остался рабочий CRT-терминал с тремя линиями питания протокола.',
        'Инженер пытался заглушить голос и движение, не теряя архив памяти.',
        'Изолируйте голосовую шину и сервоприводы, оставив питание памяти активным — узнаете частоту 104.8 МГц.',
      ],
      solvedText: 'Расшифрованы логи протокола и аварийная радиочастота 104.8 МГц.',
    },
    {
      id: 'breaker',
      title: 'Силовой электрощиток (Подвал)',
      done: mysteries.breakerFixed,
      hints: [
        'Вентиляционная решётка в подвале заперта магнитным замком — её держит силовой щиток.',
        'Сначала найдите исправный предохранитель 15A в кухонных шкафах на 1-м этаже.',
        'Вставьте предохранитель и отключите тумблер вентиляции, удерживая общую нагрузку в пределах 20A.',
      ],
      solvedText: 'Магнитный замок вентиляции снят — открыт лаз в скрытое помещение.',
    },
    {
      id: 'radio',
      title: 'Чердачная радиостанция (Мансарда)',
      done: mysteries.radioTunedSecret,
      hints: [
        'На мансарде стоит коротковолновый приёмник, до которого можно добраться с помощью ломика.',
        'Аварийную частоту инженера можно узнать после расшифровки терминала на 3-м этаже.',
        'Настройте шкалу приёмника на 104.8 МГц — запись важна для истинной концовки.',
      ],
      solvedText: 'На 104.8 МГц поймано предупреждение: «НЕ собирай Эхо-4».',
    },
  ];

  const solvedCount = mysteryList.filter((m) => m.done).length;
  const clueChains = buildClueChains({
    phoneListened: mysteries.phoneListened,
    clockSolved: mysteries.clockSolved,
    collectedKeys,
    collectedNotes,
    safeUnlocked: mysteries.safeUnlocked,
    breakerFixed: mysteries.breakerFixed,
    terminalSolved: mysteries.terminalSolved,
    radioTunedSecret: mysteries.radioTunedSecret,
    discoveredSecrets,
  });

  const timelineState = {
    collectedNotes,
    collectedTapes,
    installedParts,
    ...mysteries,
  };
  const unlockedTimelineCount = TIMELINE_ENTRIES.filter((entry) =>
    isTimelineEntryUnlocked(timelineState, entry)
  ).length;

  return (
    <GameModal
      ariaLabel="Журнал записок"
      onClose={onClose}
      zIndexClass="z-30"
      maxWidthClass="max-w-4xl"
      backdropClassName="bg-black/80"
      panelClassName="bg-[#070a0f] border border-[#344154] text-[#dce4ec] p-5 md:p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_40px_rgba(0,0,0,0.85)]"
    >
        <div className="border-b border-[#1c232e] pb-3 mb-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-[#eef3f8]">Журнал</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть журнал"
              className="w-8 h-8 flex items-center justify-center border border-[#293342] hover:bg-[#171e29] text-[#b4c0ce] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-[#0e131b] p-1 border border-[#212b38]">
            <button
              type="button"
              onClick={() => setTab('notes')}
              className={`px-2 py-1 text-[11px] cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                tab === 'notes' ? 'bg-[#202b3a] text-white' : 'text-[#7e8d9e] hover:text-white'
              }`}
            >
              <span>
                Записки ({coreNotesCount}/12{bonusFoundCount > 0 ? `+${bonusFoundCount}` : ''})
              </span>
              {unreadNotesCount > 0 && (
                <span className="px-1 bg-[#7cd4ff] text-[#071018] text-[9px] font-mono-ui font-bold">
                  +{unreadNotesCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('tapes')}
              className={`px-2 py-1 text-[11px] cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                tab === 'tapes' ? 'bg-[#202b3a] text-[#f2cf88]' : 'text-[#7e8d9e] hover:text-white'
              }`}
            >
              <Disc className="w-3 h-3 shrink-0" />
              <span>
                Аудио ({collectedTapes.length}/4
                {discoveredRadioSignals.length > 0 ? `+${discoveredRadioSignals.length}` : ''})
              </span>
              {unreadTapesCount > 0 && (
                <span className="px-1.5 bg-[#f2cf88] text-[#171005] text-[10px] font-mono-ui font-semibold">
                  +{unreadTapesCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('timeline')}
              className={`px-2 py-1 text-[11px] cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                tab === 'timeline'
                  ? 'bg-[#202b3a] text-[#a7e0ff]'
                  : 'text-[#7e8d9e] hover:text-white'
              }`}
            >
              <Clock className="w-3 h-3 shrink-0" />
              <span>
                Хроника ({unlockedTimelineCount}/{TIMELINE_ENTRIES.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab('mysteries')}
              className={`px-2 py-1 text-[11px] cursor-pointer whitespace-nowrap ${
                tab === 'mysteries'
                  ? 'bg-[#202b3a] text-white'
                  : 'text-[#7e8d9e] hover:text-white'
              }`}
            >
              Загадки ({solvedCount}/6)
            </button>
            <button
              type="button"
              onClick={() => setTab('links')}
              className={`px-2 py-1 text-[11px] cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                tab === 'links'
                  ? 'bg-[#202b3a] text-[#8ad8ff]'
                  : 'text-[#7e8d9e] hover:text-white'
              }`}
            >
              <Link2 className="w-3 h-3 shrink-0" />
              <span>Связи</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('objects')}
              className={`px-2 py-1 text-[11px] cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                tab === 'objects'
                  ? 'bg-[#202b3a] text-[#a8f0c9]'
                  : 'text-[#7e8d9e] hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3 shrink-0" />
              <span>
                Объекты ({inspectedCatalogCount}/{INSPECT_OBJECT_CATALOG.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab('observations')}
              className={`px-2 py-1 text-[11px] cursor-pointer whitespace-nowrap ${
                tab === 'observations'
                  ? 'bg-[#202b3a] text-white'
                  : 'text-[#7e8d9e] hover:text-white'
              }`}
            >
              Заметки ({observations.length})
            </button>
          </div>
        </div>

        {tab === 'notes' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 min-h-[320px]">
            <div className="md:col-span-5 border-r border-[#1a212c] pr-3 space-y-1 max-h-[360px] overflow-y-auto">
              <div className="text-[10px] uppercase tracking-wider text-[#6e8196] font-mono-ui px-1 pb-1">
                Дневник инженера (1–12)
              </div>
              {LORE_NOTES.map((note) => {
                const found = collectedNotes.includes(note.id);
                const unread = found && !readNoteIds.includes(note.id);
                const active = selectedId === note.id;
                return (
                  <button
                    key={note.id}
                    type="button"
                    disabled={!found}
                    onClick={() => handleSelectNote(note.id)}
                    className={`w-full text-left px-3 py-1.5 text-xs border transition-colors flex items-center justify-between gap-2 ${
                      !found
                        ? 'border-transparent text-[#3d4754] cursor-default'
                        : active
                        ? 'bg-[#151e29] border-[#516d8c] text-white cursor-pointer'
                        : 'border-[#18202a] text-[#b4c2d1] hover:bg-[#10161f] cursor-pointer'
                    }`}
                  >
                    <span className="truncate">
                      <span className="font-mono-ui mr-2">{note.number}.</span>
                      <span>{found ? note.title : 'Не найдено'}</span>
                    </span>
                    {unread && (
                      <span className="text-[10px] font-mono-ui text-[#7cd4ff] shrink-0">
                        не прочтено
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="text-[10px] uppercase tracking-wider text-[#7c6e4f] font-mono-ui px-1 pt-3 pb-1 border-t border-[#1a212c]">
                Архивные документы ({bonusFoundCount}/{BONUS_NOTES.length})
              </div>
              {BONUS_NOTES.map((note) => {
                const found = collectedNotes.includes(note.id);
                const unread = found && !readNoteIds.includes(note.id);
                const active = selectedId === note.id;
                return (
                  <button
                    key={note.id}
                    type="button"
                    disabled={!found}
                    onClick={() => handleSelectNote(note.id)}
                    className={`w-full text-left px-3 py-1.5 text-xs border transition-colors flex items-center justify-between gap-2 ${
                      !found
                        ? 'border-transparent text-[#3d4754] cursor-default'
                        : active
                        ? 'bg-[#1d1911] border-[#8c7344] text-[#f5e7c6] cursor-pointer'
                        : 'border-[#1e1b16] text-[#c4b79b] hover:bg-[#14120d] cursor-pointer'
                    }`}
                  >
                    <span className="truncate">
                      <span className="font-mono-ui mr-2">А{note.number - 12}.</span>
                      <span>{found ? note.title : 'Не найдено'}</span>
                    </span>
                    {unread && (
                      <span className="text-[10px] font-mono-ui text-[#f2cf88] shrink-0">
                        не прочтено
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="md:col-span-7 flex flex-col justify-center px-2">
              {selectedNote && collectedNotes.includes(selectedNote.id) ? (
                <div className="bg-[#0b0f16] border border-[#212b38] p-5">
                  <div className="text-[11px] uppercase tracking-wider text-[#788799] font-mono-ui">
                    {selectedNote.isBonus
                      ? `Архивный документ №${selectedNote.number - 12}`
                      : `Записка №${selectedNote.number}`}{' '}
                    · {selectedNote.locationLabel}
                  </div>
                  <h3 className="text-base font-semibold text-[#eef3f8] mt-1 mb-4">
                    «{selectedNote.title}»
                  </h3>
                  <p className="text-sm text-[#cdd6e0] leading-relaxed whitespace-pre-line">
                    {selectedNote.body}
                  </p>
                </div>
              ) : (
                <div className="text-xs text-[#606d7d] text-center py-12">
                  Выберите найденную записку или документ слева, чтобы прочитать содержимое.
                </div>
              )}
            </div>
          </div>
        ) : tab === 'tapes' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 min-h-[260px]">
              <div className="md:col-span-5 border-r border-[#1a212c] pr-3 space-y-2 max-h-[300px] overflow-y-auto">
                {AUDIO_TAPES.map((tape) => {
                  const found = collectedTapes.includes(tape.id);
                  const unread = found && !readTapeIds.includes(tape.id);
                  const active = selectedTapeId === tape.id;
                  const isPlaying = playingTapeId === tape.id;
                  return (
                    <button
                      key={tape.id}
                      type="button"
                      disabled={!found}
                      onClick={() => handleSelectTape(tape.id)}
                      className={`w-full text-left px-3 py-2.5 border text-xs transition-colors ${
                        !found
                          ? 'border-[#141a22] bg-[#080b10] text-[#45515e] cursor-default'
                          : active
                          ? 'bg-[#1a1610] border-[#8f7140] text-[#f5e3be] cursor-pointer'
                          : 'border-[#202833] bg-[#0b0f16] text-[#c4d0dc] hover:bg-[#111722] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono-ui gap-2">
                        <span>
                          Кассета №{tape.number} {found ? `· ${tape.timestamp}` : ''}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {unread && (
                            <span className="px-1 py-0.2 bg-[#f2cf88] text-[#171005] text-[9px] font-bold">
                              НОВОЕ
                            </span>
                          )}
                          {found && (
                            <span className="text-[10px] text-[#9eb0c2]">
                              {isPlaying ? 'ЗВУЧИТ...' : tape.durationLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-0.5 font-medium">
                        {found ? tape.title : 'Не найдено (ищите кассеты по этажам)'}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="md:col-span-7 flex flex-col justify-center px-2">
                {selectedTape && collectedTapes.includes(selectedTape.id) ? (
                  <div className="bg-[#0b0f16] border border-[#2c3340] p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-[#b8975c] font-mono-ui">
                          Кассета №{selectedTape.number} · {selectedTape.timestamp} ·{' '}
                          {selectedTape.locationLabel}
                        </div>
                        <h3 className="text-base font-semibold text-[#eef3f8] mt-1">
                          «{selectedTape.title}»
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePlayTape(selectedTape.id, selectedTape.number)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-[#5f7e9c] bg-[#132233] hover:bg-[#1c324a] text-xs font-mono-ui text-[#d6eeff] cursor-pointer shrink-0"
                      >
                        {playingTapeId === selectedTape.id ? (
                          <Volume2 className="w-3.5 h-3.5 text-[#7be8b8] animate-pulse" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-[#7cd4ff]" />
                        )}
                        <span>
                          {playingTapeId === selectedTape.id ? 'Воспроизведение...' : 'Воспроизвести'}
                        </span>
                      </button>
                    </div>

                    <div className="h-8 bg-[#05080d] border border-[#1d2734] px-2 flex items-center gap-1">
                      {Array.from({ length: 28 }).map((_, idx) => {
                        const activeBar = playingTapeId === selectedTape.id;
                        const heightPct = activeBar
                          ? 22 + ((idx * 19 + selectedTape.number * 13) % 72)
                          : 18 + ((idx * 7) % 24);
                        return (
                          <div
                            key={idx}
                            className={`flex-1 transition-all duration-150 ${
                              activeBar ? 'bg-[#7cd4ff]' : 'bg-[#2c3b4d]'
                            }`}
                            style={{ height: `${heightPct}%` }}
                          />
                        );
                      })}
                    </div>

                    <p className="text-sm text-[#d4dde6] leading-relaxed font-ui">
                      {selectedTape.transcript}
                    </p>
                    <div className="text-[11px] font-ui text-[#8ba6bf] border-t border-[#1d2633] pt-2.5">
                      Связь: {selectedTape.clueLink}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[#606d7d] text-center py-10 font-ui">
                    Прослушайте автоответчик в прихожей или найдите магнитные кассеты на этажах дома.
                  </div>
                )}
              </div>
            </div>

            {/* Intercepted Room Radio Signals (§13) */}
            <div className="border-t border-[#1c2430] pt-3">
              <div className="flex items-center justify-between mb-2 text-[11px] font-mono-ui text-[#9db4c9]">
                <span className="flex items-center gap-1.5 uppercase tracking-wider">
                  <Radio className="w-3.5 h-3.5 text-[#7cd4ff]" />
                  Перехваченные радиосигналы комнат ({discoveredRadioSignals.length}/
                  {ROOM_RADIO_SIGNALS.length})
                </span>
                <span className="text-[10px] text-[#6d7f92]">
                  Приблизьтесь к источнику помех в комнатах дома
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ROOM_RADIO_SIGNALS.map((sig) => {
                  const found = discoveredRadioSignals.includes(sig.id);
                  return (
                    <div
                      key={sig.id}
                      className={`p-2.5 border text-xs font-ui ${
                        found
                          ? 'bg-[#0a141d] border-[#315573] text-[#d0e6f7]'
                          : 'bg-[#080b10] border-[#18202b] text-[#556372]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono-ui">
                        <span className={found ? 'text-[#7cd4ff] font-semibold' : ''}>
                          {found ? `${sig.freqLabel} · ${sig.roomLabel}` : '??? МГц · Не перехвачено'}
                        </span>
                        <span>{found ? 'Записано' : 'Слабый эфир'}</span>
                      </div>
                      <div className="font-semibold mt-0.5">
                        {found ? sig.title : 'Неизвестная радиопомеха'}
                      </div>
                      {found && (
                        <p className="text-[11px] text-[#aac2d6] mt-1 leading-relaxed">
                          {sig.transcript}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : tab === 'timeline' ? (
          <div className="min-h-[320px] max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
            <div className="text-[11px] font-ui text-[#7c92a8] px-1">
              Хронология событий в доме восстанавливается автоматически из записок, кассет и расшифрованных устройств:
            </div>
            <div className="relative pl-5 space-y-2.5 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-[#243242]">
              {TIMELINE_ENTRIES.map((entry) => {
                const unlocked = isTimelineEntryUnlocked(timelineState, entry);
                return (
                  <div
                    key={entry.id}
                    className={`relative p-3 border text-xs ${
                      unlocked
                        ? 'bg-[#0b1119] border-[#2e4359] text-[#dbe5ef]'
                        : 'bg-[#080b10] border-[#18202b] text-[#556372]'
                    }`}
                  >
                    <span
                      className={`absolute -left-[17px] top-4 w-2.5 h-2.5 border ${
                        unlocked
                          ? 'bg-[#7cd4ff] border-[#bfe8ff]'
                          : 'bg-[#121821] border-[#2e3b4c]'
                      }`}
                    />
                    <div className="flex items-center justify-between gap-2 font-mono-ui">
                      <span className={unlocked ? 'text-[#7cd4ff] font-semibold' : 'text-[#556372]'}>
                        {entry.date}
                      </span>
                      <span className="text-[10px]">
                        {unlocked ? 'Восстановлено' : 'Фрагмент не найден'}
                      </span>
                    </div>
                    <div className="font-semibold mt-0.5">
                      {unlocked ? entry.title : 'Запись не восстановлена'}
                    </div>
                    <p className="text-[11px] leading-relaxed mt-1 opacity-85">
                      {unlocked
                        ? entry.summary
                        : 'Найдите соответствующие страницы дневника, кассеты или приборы, чтобы восстановить эту дату.'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : tab === 'objects' ? (
          <div className="min-h-[320px] max-h-[390px] overflow-y-auto space-y-2.5 pr-1">
            <div className="text-[11px] font-ui text-[#7c92a8] px-1">
              Каталог ключевых объектов для осмотра вблизи (<span className="font-mono-ui">{inspectedCatalogCount}/{INSPECT_OBJECT_CATALOG.length}</span>):
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {INSPECT_OBJECT_CATALOG.map((obj) => {
                const inspected = inspectedObjects.includes(obj.id);
                const checkedHotspots = obj.hotspots.filter((h) =>
                  inspectedObjects.includes(`${obj.id}:${h.id}`)
                );
                return (
                  <div
                    key={obj.id}
                    className={`p-3 border text-xs ${
                      inspected
                        ? 'bg-[#0b1318] border-[#2f525c] text-[#dce8ef]'
                        : 'bg-[#080b10] border-[#18202b] text-[#5c6a78]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-mono-ui text-[10px]">
                      <span className={inspected ? 'text-[#89e0c2]' : 'text-[#586777]'}>
                        {obj.locationLabel}
                      </span>
                      <span>
                        {inspected
                          ? `Улики: ${checkedHotspots.length}/${obj.hotspots.length}`
                          : 'Не осмотрено'}
                      </span>
                    </div>
                    <div className="font-semibold mt-0.5 text-[#e6eff7]">
                      {inspected ? obj.title : 'Неосмотренный объект'}
                    </div>
                    <p className="text-[11px] mt-1 leading-relaxed opacity-85">
                      {inspected
                        ? obj.summary
                        : 'Подойдите к предмету и нажмите действие [E], чтобы осмотреть его вблизи.'}
                    </p>
                    {inspected && (
                      <div className="mt-2 pt-2 border-t border-[#1c2b35] space-y-1 font-mono-ui text-[10px]">
                        {obj.hotspots.map((h) => {
                          const done = inspectedObjects.includes(`${obj.id}:${h.id}`);
                          return (
                            <div
                              key={h.id}
                              className={done ? 'text-[#9ee8be]' : 'text-[#6c7d8f]'}
                            >
                              {done ? '✓' : '○'} {h.label}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : tab === 'observations' ? (
          <div className="min-h-[320px] max-h-[380px] overflow-y-auto space-y-2 pr-1">
            {observations.length === 0 ? (
              <div className="text-xs text-[#606d7d] py-8 text-center">Записей пока нет.</div>
            ) : (
              [...observations].reverse().map((obs, idx) => (
                <div
                  key={idx}
                  className="px-3.5 py-2.5 bg-[#0b0f16] border border-[#1d2530] text-xs text-[#c5d0dc]"
                >
                  {obs}
                </div>
              ))
            )}
          </div>
        ) : tab === 'mysteries' ? (
          <div className="min-h-[320px] max-h-[380px] overflow-y-auto space-y-2 pr-1">
            {mysteryList.map((m) => {
              const level = hintLevels[m.id] ?? 0;
              return (
                <div
                  key={m.id}
                  className={`px-3.5 py-2.5 border text-xs ${
                    m.done
                      ? 'bg-[#0c1914] border-[#2c5743] text-[#cdeedd]'
                      : 'bg-[#0b0f16] border-[#1f2936] text-[#9fb0c2]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold">
                      {m.done ? (
                        <CheckCircle2 className="w-4 h-4 text-[#6ee097] shrink-0" />
                      ) : (
                        <CircleHelp className="w-4 h-4 text-[#7cd4ff] shrink-0" />
                      )}
                      <span>{m.title}</span>
                    </div>
                    {!m.done && level < 3 && (
                      <button
                        type="button"
                        onClick={() => revealNextHint(m.id)}
                        className="flex items-center gap-1 px-2 py-0.5 border border-[#2c3b4f] bg-[#101824] hover:bg-[#192638] text-[10px] font-mono-ui text-[#99c8eb] cursor-pointer"
                      >
                        <Lightbulb className="w-3 h-3" />
                        <span>Подсказка ({level + 1}/3)</span>
                      </button>
                    )}
                  </div>
                  {m.done ? (
                    <p className="mt-1 pl-6 text-[11px] leading-relaxed opacity-90">
                      {m.solvedText}
                    </p>
                  ) : level === 0 ? (
                    <p className="mt-1 pl-6 text-[11px] text-[#6d7f92]">
                      Не решено. Исследуйте комнаты или откройте постепенную подсказку справа.
                    </p>
                  ) : (
                    <div className="mt-1.5 pl-6 space-y-1">
                      {m.hints.slice(0, level).map((hText, i) => (
                        <p key={i} className="text-[11px] leading-relaxed text-[#b9cde0]">
                          <span className="font-mono-ui text-[#7cd4ff] mr-1.5">[{i + 1}]</span>
                          {hText}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="min-h-[320px] max-h-[400px] overflow-y-auto space-y-2.5 pr-1">
            <div className="text-[11px] font-ui text-[#7c92a8] px-1">
              Цепочки расследования автоматически обновляются по мере нахождения улик и ключей:
            </div>
            {clueChains.map((chain) => {
              const allDone = chain.steps.every((s) => s.done);
              return (
                <div
                  key={chain.id}
                  className={`p-3 border ${
                    allDone
                      ? 'bg-[#0b1915] border-[#2e5d4a]'
                      : 'bg-[#0a0f17] border-[#1f2c3c]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#e2ebf5]">{chain.title}</span>
                    <span className="text-[10px] font-mono-ui text-[#7d95ad]">
                      {chain.steps.filter((s) => s.done).length} / {chain.steps.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono-ui text-[11px]">
                    {chain.steps.map((step, idx) => (
                      <React.Fragment key={step.label}>
                        <div
                          className={`px-2.5 py-1 border flex items-center gap-1.5 ${
                            step.done
                              ? 'border-[#3b7a5d] bg-[#10261d] text-[#a7f0c7]'
                              : 'border-[#222f40] bg-[#0c121b] text-[#6d7f93]'
                          }`}
                        >
                          <span>{step.done ? '✓' : '○'}</span>
                          <span>{step.label}</span>
                        </div>
                        {idx < chain.steps.length - 1 && (
                          <ArrowRight className="w-3.5 h-3.5 text-[#495c70] shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 pt-3 border-t border-[#1c232e] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-[#2c3645] hover:bg-[#171e29] text-xs text-[#d5dee8] cursor-pointer"
          >
            Esc / J — закрыть
          </button>
        </div>
    </GameModal>
  );
};
