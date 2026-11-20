import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD, HudSnapshot } from './components/GameHUD';
import { SaveSummaryInfo, TitleScreen } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';

const AssemblyModal = lazy(() =>
  import('./components/AssemblyModal').then((m) => ({ default: m.AssemblyModal }))
);
const BreakerModal = lazy(() =>
  import('./components/BreakerModal').then((m) => ({ default: m.BreakerModal }))
);
const ClockModal = lazy(() =>
  import('./components/ClockModal').then((m) => ({ default: m.ClockModal }))
);
const ContainerModal = lazy(() =>
  import('./components/ContainerModal').then((m) => ({ default: m.ContainerModal }))
);
const EndingScreen = lazy(() =>
  import('./components/EndingScreen').then((m) => ({ default: m.EndingScreen }))
);
const InspectModal = lazy(() =>
  import('./components/InspectModal').then((m) => ({ default: m.InspectModal }))
);
const InventoryModal = lazy(() =>
  import('./components/InventoryModal').then((m) => ({ default: m.InventoryModal }))
);
const JournalModal = lazy(() =>
  import('./components/JournalModal').then((m) => ({ default: m.JournalModal }))
);
const MapModal = lazy(() =>
  import('./components/MapModal').then((m) => ({ default: m.MapModal }))
);
const PauseModal = lazy(() =>
  import('./components/PauseModal').then((m) => ({ default: m.PauseModal }))
);
const RadioModal = lazy(() =>
  import('./components/RadioModal').then((m) => ({ default: m.RadioModal }))
);
const SafeModal = lazy(() =>
  import('./components/SafeModal').then((m) => ({ default: m.SafeModal }))
);
const TerminalModal = lazy(() =>
  import('./components/TerminalModal').then((m) => ({ default: m.TerminalModal }))
);
import { soundEngine } from './game/audio';
import { ALL_NOTES, AUDIO_TAPES, PART_BY_ID, SECRETS } from './game/content';
import { vibrateGamepad } from './game/controllers/gamepadController';
import { isKeyBoundToAction, matchesKeyAction } from './game/controllers/inputController';
import { runSimulationStep } from './game/controllers/simulationStep';
import { canUnlockLastRecordEnding } from './game/dialogueDirector';
import { gameDiagnostics, installGlobalDiagnosticsHandle } from './game/diagnostics';
import { GameLoop } from './game/engine/GameLoop';
import { GameRuntime } from './game/engine/GameRuntime';
import { gameEventBus } from './game/eventBus';
import { getCurrentRoomId, trackVisitedRoom } from './game/horrorDirector';
import { VIRTUAL_H, VIRTUAL_W } from './game/renderer';
import {
  chooseFinaleEnding,
  collectContainerLoot,
  countAllNotes,
  countCoreNotes,
  countUnreadJournalEntries,
  createInitialGameState,
  findNearestInteractable,
  getCurrentObjective,
  getCurrentRoomName,
  installPartOnRobot,
  markNoteAsRead,
  markTapeAsRead,
  recordInspectHotspotDiscovery,
  recordRadioSecret,
  reloadFlashlightBattery,
  solveBreakerPuzzle,
  solveClockPuzzle,
  solveTerminalPuzzle,
  submitSafeCode,
  toggleHidingSpot,
  triggerInteraction,
} from './game/rules';
import {
  deleteSaveSlot,
  exportSavePayload,
  formatKeyCode,
  importSavePayload,
  listSaveSlots,
  loadFromSlot,
  loadSaveWithRecovery,
  loadSettingsWithStatus,
  loadUnlockedEndings,
  readSaveSummary,
  saveSettings,
  saveToSlot,
  saveUnlockedEndings,
  SaveSlotId,
  SaveSlotInfo,
  writeSaveWithBackup,
} from './game/saveManager';
import { registerGameEventListeners } from './game/systems/eventListeners';
import {
  AudioTapeId,
  DialogueMessage,
  EndingId,
  GameSettings,
  GameState,
  InspectTargetId,
  PartId,
  RunSummary,
  ToastNotification,
} from './game/types';
import { FOREST_GROUND_Y, HOUSE_ROOMS } from './game/world';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopRef = useRef<GameLoop | null>(null);
  const staminaBarRef = useRef<HTMLDivElement | null>(null);
  const [runtime] = useState(() => new GameRuntime(false));

  const bindingsRepairedRef = useRef(false);
  const [settings, setSettings] = useState<GameSettings>(() => {
    const loaded = loadSettingsWithStatus();
    bindingsRepairedRef.current = loaded.bindingsRepaired;
    const s = loaded.settings;
    soundEngine.setMuted(s.muted);
    soundEngine.setMixerVolumes({
      master: s.masterVolume,
      ambience: s.ambienceVolume,
      music: s.musicVolume,
      sfx: s.sfxVolume,
      voice: s.voiceVolume,
      ui: s.uiVolume,
    });
    return s;
  });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [screen, setScreen] = useState<GameState['screen']>('title');
  const [activeOverlay, setActiveOverlay] = useState<GameState['activeOverlay']>('none');
  const [activeContainerId, setActiveContainerId] = useState<string | null>(null);
  const [activeInspectId, setActiveInspectId] = useState<InspectTargetId | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [, setJournalReadRev] = useState(0);
  const [saveSummary, setSaveSummary] = useState<SaveSummaryInfo | null>(() => readSaveSummary());
  const [saveSlots, setSaveSlots] = useState<SaveSlotInfo[]>(() => listSaveSlots());
  const [unlockedEndings, setUnlockedEndings] = useState<EndingId[]>(() => loadUnlockedEndings());
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const toastIdRef = useRef(1);
  const toastTimersRef = useRef<number[]>([]);
  const modalAutoCloseTimerRef = useRef<number | null>(null);
  const [titlePanelOpen, setTitlePanelOpen] = useState(false);
  const titlePanelOpenRef = useRef(false);
  titlePanelOpenRef.current = titlePanelOpen;
  const hasSave = Boolean(saveSummary);

  const [hud, setHud] = useState<HudSnapshot>({
    zone: 'car_prologue',
    floor: 1,
    roomName: 'Автомобиль · Лесная дорога',
    objective: 'Держать дорогу вперёд',
    partsCollected: 0,
    partsInstalled: 0,
    notesFound: 0,
    totalNotesFound: 0,
    totalNotes: ALL_NOTES.length,
    unreadJournalCount: 0,
    hasFlashlight: false,
    flashlightOn: false,
    flashlightBattery: 100,
    batteries: 1,
    promptLabel: null,
    prologuePhase: 'driving',
    muted: settings.muted,
    isRedMode: false,
    shadowWarning: false,
    shadowGuide: false,
    isHiding: false,
    finalePhase: 'rising',
    canUnlockLastRecord: false,
    radioSignal: null,
  });

  const [dialogue, setDialogue] = useState<DialogueMessage | null>(null);
  const [typedText, setTypedText] = useState('');
  const [runSummary, setRunSummary] = useState<RunSummary>({
    playTimeSeconds: 0,
    partsInstalled: 0,
    notesFound: 0,
    tapesFound: 0,
    secretsFound: 0,
    roomsVisited: 0,
    totalRooms: HOUSE_ROOMS.length,
    endingId: 'awakening',
  });

  useEffect(() => {
    document.body.dataset.state = screen;
  }, [screen]);

  useEffect(() => {
    if (screen !== 'playing' || activeOverlay !== 'none') {
      runtime.clearInput();
    }
  }, [activeOverlay, runtime, screen]);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((t) => window.clearTimeout(t));
      toastTimersRef.current = [];
      if (modalAutoCloseTimerRef.current !== null) {
        window.clearTimeout(modalAutoCloseTimerRef.current);
        modalAutoCloseTimerRef.current = null;
      }
    };
  }, []);

  const syncDialogueState = useCallback(() => {
    const rt = runtime.dialogue;
    runtime.state.activeDialogue = rt.active;
    runtime.state.dialogueQueue = rt.queue;
    setDialogue(rt.active);
    setTypedText(rt.active ? rt.active.text.slice(0, Math.floor(rt.visibleChars)) : '');
  }, [runtime]);

  const pushToast = useCallback(
    (kind: ToastNotification['kind'], title: string, detail?: string) => {
      const id = toastIdRef.current++;
      setToasts((prev) => [...prev.slice(-2), { id, kind, title, detail }]);
      const timer = window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
        toastTimersRef.current = toastTimersRef.current.filter((t) => t !== timer);
      }, 3600);
      toastTimersRef.current.push(timer);
    },
    []
  );

  useEffect(() => {
    installGlobalDiagnosticsHandle();
    const unregister = registerGameEventListeners();
    const unsubShadow = gameEventBus.on('shadow:event', ({ kind }) => {
      if (kind === 'startled') {
        vibrateGamepad(260, 0.5, 0.8, settingsRef.current.gamepadVibration ?? true);
      }
    });
    const unsubPart = gameEventBus.on('part:installed', ({ installedCount }) => {
      if (installedCount >= 8) {
        vibrateGamepad(360, 0.45, 0.75, settingsRef.current.gamepadVibration ?? true);
      } else {
        vibrateGamepad(90, 0.25, 0.4, settingsRef.current.gamepadVibration ?? true);
      }
    });
    if (bindingsRepairedRef.current) {
      bindingsRepairedRef.current = false;
      pushToast(
        'puzzle',
        'Клавиши управления исправлены',
        'Обнаруженный конфликт привязок автоматически устранён'
      );
    }
    return () => {
      unsubShadow();
      unsubPart();
      unregister();
    };
  }, [pushToast]);

  useEffect(() => {
    return () => {
      runtime.dispose();
      soundEngine.dispose();
    };
  }, [runtime]);

  const recordUnlockedEnding = useCallback((endingId: EndingId) => {
    gameEventBus.emit('ending:reached', { endingId });
    setUnlockedEndings((prev) => {
      if (prev.includes(endingId)) return prev;
      const next = [...prev, endingId];
      saveUnlockedEndings(next);
      return next;
    });
  }, []);

  const persistSave = useCallback(
    (st: GameState, showSuccessToast = false) => {
      const res = writeSaveWithBackup(st);
      if (res.success) {
        setSaveSummary(res.summary);
        gameEventBus.emit('save:persisted', { timestamp: res.timestamp });
        if (showSuccessToast) {
          pushToast('save_ok', 'Игра сохранена', res.summary.roomName);
        }
      } else {
        pushToast('save_error', 'Ошибка сохранения', res.message);
      }
    },
    [pushToast]
  );

  const enqueueDialogues = useCallback(
    (msgs: DialogueMessage[], interrupt = false) => {
      if (msgs.length === 0) return;
      runtime.enqueueDialogues(msgs, interrupt);
      syncDialogueState();
    },
    [runtime, syncDialogueState]
  );

  const handleAdvanceDialogue = useCallback(() => {
    if (runtime.advanceActiveDialogue()) {
      syncDialogueState();
    }
  }, [runtime, syncDialogueState]);

  const syncDiscreteHud = useCallback((st: GameState, promptLabel: string | null) => {
    const roomName = getCurrentRoomName(st);
    const objective = getCurrentObjective(st);
    const batteryRounded = Math.round(st.player.flashlightBattery);
    const coreNotesCount = countCoreNotes(st.collectedNotes);
    const totalNotesCount = countAllNotes(st.collectedNotes);
    const totalNotes = ALL_NOTES.length;
    const unreadJournalCount = countUnreadJournalEntries(st).total;
    const isRedMode = st.finale.active && st.finale.phase !== 'rising';
    const finalePhase = st.finale.active ? st.finale.phase : undefined;
    const canUnlockLastRecord = canUnlockLastRecordEnding(st);
    const shadowNearby =
      st.shadowEncounter.active &&
      st.player.zone === 'house' &&
      st.player.floor === st.shadowEncounter.floor &&
      Math.abs(st.player.x - st.shadowEncounter.x) < 185;
    const shadowWarning = shadowNearby && st.shadowEncounter.behavior !== 'guide';
    const shadowGuide = shadowNearby && st.shadowEncounter.behavior === 'guide';
    const isHiding = st.player.isHiding;
    const radioSignal = runtime.timers.activeRadioSignal;

    setHud((prev) => {
      const sameRadio =
        prev.radioSignal?.id === radioSignal?.id &&
        prev.radioSignal?.strength === radioSignal?.strength &&
        prev.radioSignal?.discovered === radioSignal?.discovered;

      if (
        prev.zone === st.player.zone &&
        prev.floor === st.player.floor &&
        prev.roomName === roomName &&
        prev.objective === objective &&
        prev.partsCollected === st.collectedParts.length &&
        prev.partsInstalled === st.installedParts.length &&
        prev.notesFound === coreNotesCount &&
        prev.totalNotesFound === totalNotesCount &&
        prev.totalNotes === totalNotes &&
        prev.unreadJournalCount === unreadJournalCount &&
        prev.hasFlashlight === st.player.hasFlashlight &&
        prev.flashlightOn === st.player.flashlightOn &&
        prev.flashlightBattery === batteryRounded &&
        prev.batteries === st.player.batteries &&
        prev.promptLabel === promptLabel &&
        prev.prologuePhase === st.prologue.phase &&
        prev.muted === settingsRef.current.muted &&
        prev.isRedMode === isRedMode &&
        prev.shadowWarning === shadowWarning &&
        prev.shadowGuide === shadowGuide &&
        prev.isHiding === isHiding &&
        prev.finalePhase === finalePhase &&
        prev.canUnlockLastRecord === canUnlockLastRecord &&
        sameRadio
      ) {
        return prev;
      }
      return {
        zone: st.player.zone,
        floor: st.player.floor,
        roomName,
        objective,
        partsCollected: st.collectedParts.length,
        partsInstalled: st.installedParts.length,
        notesFound: coreNotesCount,
        totalNotesFound: totalNotesCount,
        totalNotes,
        unreadJournalCount,
        hasFlashlight: st.player.hasFlashlight,
        flashlightOn: st.player.flashlightOn,
        flashlightBattery: batteryRounded,
        batteries: st.player.batteries,
        promptLabel,
        prologuePhase: st.prologue.phase,
        muted: settingsRef.current.muted,
        isRedMode,
        shadowWarning,
        shadowGuide,
        isHiding,
        finalePhase,
        canUnlockLastRecord,
        radioSignal: radioSignal ? { ...radioSignal } : null,
      };
    });
  }, [runtime]);

  const startNewGame = useCallback(
    (skipPrologue = false, clearDialogue = false) => {
      if (modalAutoCloseTimerRef.current !== null) {
        window.clearTimeout(modalAutoCloseTimerRef.current);
        modalAutoCloseTimerRef.current = null;
      }
      const fresh = createInitialGameState(skipPrologue);
      fresh.screen = 'playing';
      runtime.resetSession(fresh);
      syncDialogueState();
      setTitlePanelOpen(false);
      setActiveOverlay('none');
      setActiveContainerId(null);
      setActiveInspectId(null);
      setSelectedNoteId(null);
      setScreen('playing');

      if (!clearDialogue) {
        if (!skipPrologue) {
          enqueueDialogues(
            [
              {
                speaker: 'system',
                text: '23:47. Лесная дорога. Сильный дождь.',
                duration: 3.4,
              },
            ],
            true
          );
        } else {
          enqueueDialogues(
            [
              {
                speaker: 'thought',
                text: 'Машина окончательно заглохла. В багажнике должен быть фонарик [E].',
                duration: 3.6,
              },
            ],
            true
          );
        }
      }
      syncDiscreteHud(fresh, null);
    },
    [enqueueDialogues, runtime, syncDialogueState, syncDiscreteHud]
  );

  const applyLoadedGameState = useCallback(
    (loaded: GameState, dialogueText: string, toastTitle?: string, toastDetail?: string) => {
      if (modalAutoCloseTimerRef.current !== null) {
        window.clearTimeout(modalAutoCloseTimerRef.current);
        modalAutoCloseTimerRef.current = null;
      }
      loaded.screen = 'playing';
      runtime.resetSession(loaded);
      syncDialogueState();
      setTitlePanelOpen(false);
      setActiveOverlay('none');
      setActiveContainerId(null);
      setActiveInspectId(null);
      setSelectedNoteId(null);
      setScreen('playing');
      syncDiscreteHud(loaded, null);
      if (toastTitle) {
        pushToast('save_ok', toastTitle, toastDetail);
      }
      enqueueDialogues(
        [
          {
            speaker: 'thought',
            text: dialogueText,
            duration: 2.6,
          },
        ],
        true
      );
    },
    [enqueueDialogues, pushToast, runtime, syncDialogueState, syncDiscreteHud]
  );

  const continueSavedGame = useCallback(() => {
    soundEngine.markUserGesture();
    const { state: loaded, recoveredFromBackup, corruptedPrimary, migratedFrom } = loadSaveWithRecovery();
    if (!loaded) {
      if (corruptedPrimary) {
        pushToast('save_error', 'Сохранение повреждено', 'Загружена новая игра');
      }
      startNewGame(false);
      return;
    }
    const toastTitle = recoveredFromBackup
      ? 'Восстановлена резервная копия'
      : migratedFrom !== null
      ? `Сохранение обновлено (v${migratedFrom} → v4)`
      : undefined;
    applyLoadedGameState(
      loaded,
      recoveredFromBackup
        ? 'Восстановлена резервная запись. Возвращаюсь к поискам...'
        : 'Возвращаюсь к поискам...',
      toastTitle
    );
  }, [applyLoadedGameState, pushToast, startNewGame]);

  const handleSaveNow = useCallback(() => {
    persistSave(runtime.state, true);
    setSaveSlots(listSaveSlots());
  }, [persistSave, runtime]);

  const handleSaveToSlot = useCallback(
    (slotId: SaveSlotId) => {
      const res = saveToSlot(slotId, runtime.state);
      setSaveSlots(listSaveSlots());
      if (res.success) {
        pushToast('save_ok', 'Сохранено в слот', res.summary.roomName);
      } else {
        pushToast('save_error', 'Не удалось сохранить слот', res.message);
      }
    },
    [pushToast, runtime]
  );

  const handleLoadFromSlot = useCallback(
    (slotId: SaveSlotId) => {
      const { state: loaded, corrupted } = loadFromSlot(slotId);
      if (!loaded) {
        pushToast(
          'save_error',
          corrupted ? 'Слот повреждён' : 'Слот пуст',
          'Выберите другой слот или начните путь заново'
        );
        return;
      }
      applyLoadedGameState(loaded, 'Запись из слота загружена.', 'Загрузка выполнена');
    },
    [applyLoadedGameState, pushToast]
  );

  const handleDeleteSlot = useCallback(
    (slotId: SaveSlotId) => {
      deleteSaveSlot(slotId);
      setSaveSlots(listSaveSlots());
      pushToast('save_ok', 'Слот очищен');
    },
    [pushToast]
  );

  const handleExportSave = useCallback(() => {
    try {
      const json = exportSavePayload(runtime.state);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `the-quiet-voice-save-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      pushToast('save_ok', 'Файл сохранения скачан');
    } catch (err) {
      gameDiagnostics.recordError('app.exportSave', err);
      pushToast('save_error', 'Не удалось экспортировать сохранение');
    }
  }, [pushToast, runtime]);

  const handleImportSaveFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const res = importSavePayload(text);
        if (!res.state) {
          pushToast('save_error', 'Ошибка импорта', res.error ?? 'Некорректный файл');
          return;
        }
        const writeRes = writeSaveWithBackup(res.state);
        if (writeRes.success) {
          setSaveSummary(writeRes.summary);
        }
        setSaveSlots(listSaveSlots());
        applyLoadedGameState(
          res.state,
          'Импортированное сохранение загружено.',
          'Сохранение импортировано',
          res.migratedFrom !== null ? `Миграция с v${res.migratedFrom}` : undefined
        );
      } catch (err) {
        gameDiagnostics.recordError('app.importSave', err);
        pushToast('save_error', 'Ошибка чтения файла сохранения');
      }
    },
    [applyLoadedGameState, pushToast]
  );

  // Handle ?autostart=1 query param on boot
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const isHouse = params.get('house') === '1';
      const skipPrologue = params.get('forest') === '1' || isHouse;
      startNewGame(skipPrologue, isHouse);
      if (isHouse) {
        const st = runtime.state;
        st.player.zone = 'house';
        st.player.floor = 1;
        st.player.x = params.get('foyer') === '1' ? 128 : 975;
        st.player.y = 448;
        st.player.hasFlashlight = true;
        st.player.flashlightOn = true;
        st.collectedKeys.push('flashlight');
        st.collectedNotes.push('note_01');
        if (params.get('almost') === '1') {
          st.robotFirstMet = true;
          st.installedParts.push(
            'left_arm',
            'right_arm',
            'left_leg',
            'right_leg',
            'chest_panel',
            'head',
            'face_panel'
          );
          st.collectedParts.push('power_core');
          st.atmospheric.tvStaticTriggered = true;
          st.atmospheric.portraitChanged = true;
          st.atmospheric.mannequinMoved = true;
        } else {
          st.collectedParts.push('left_arm');
        }
        trackVisitedRoom(st);
        syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
      }
    }
  }, [runtime, startNewGame, syncDiscreteHud]);

  const updateSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    soundEngine.setMuted(next.muted);
    soundEngine.setMixerVolumes({
      master: next.masterVolume,
      ambience: next.ambienceVolume,
      music: next.musicVolume,
      sfx: next.sfxVolume,
      voice: next.voiceVolume,
      ui: next.uiVolume,
    });
    saveSettings(next);
    loopRef.current?.setRenderFpsCap(next.renderFpsCap ?? 0);
    setHud((prev) => ({ ...prev, muted: next.muted }));
  }, []);

  const handleToggleMute = useCallback(() => {
    soundEngine.markUserGesture();
    updateSettings({ ...settingsRef.current, muted: !settingsRef.current.muted });
  }, [updateSettings]);

  const handleToggleFlashlight = useCallback(() => {
    const st = runtime.state;
    if (st.screen !== 'playing' || !st.player.hasFlashlight) return;
    soundEngine.markUserGesture();
    st.player.flashlightOn = !st.player.flashlightOn;
    soundEngine.playSfx('flashlight');
    syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
  }, [runtime, syncDiscreteHud]);

  const handleReloadBattery = useCallback(() => {
    const st = runtime.state;
    if (st.screen !== 'playing' || st.player.zone === 'car_prologue') return;
    soundEngine.markUserGesture();
    const res = reloadFlashlightBattery(st);
    soundEngine.playSfx(res.reloaded ? 'battery' : 'locked');
    if (res.reloaded) {
      persistSave(st);
    }
    enqueueDialogues([res.dialogue], true);
    syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
  }, [enqueueDialogues, persistSave, runtime, syncDiscreteHud]);

  const handleMarkNoteRead = useCallback(
    (noteId: string) => {
      const st = runtime.state;
      if (markNoteAsRead(st, noteId)) {
        setJournalReadRev((r) => r + 1);
        syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
      }
    },
    [runtime, syncDiscreteHud]
  );

  const handleMarkTapeRead = useCallback(
    (tapeId: AudioTapeId) => {
      const st = runtime.state;
      if (markTapeAsRead(st, tapeId)) {
        setJournalReadRev((r) => r + 1);
        syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
      }
    },
    [runtime, syncDiscreteHud]
  );

  const exitCarToForest = useCallback(() => {
    const st = runtime.state;
    st.player.zone = 'forest';
    st.player.x = 105;
    st.player.y = FOREST_GROUND_Y;
    st.player.vx = 0;
    st.prologue.phase = 'stalled';
    soundEngine.playSfx('door');
    enqueueDialogues(
      [
        {
          speaker: 'thought',
          text: 'Тишина в лесу пугает. Поищу фонарик в багажнике [E] и посмотрю, что дальше по дороге.',
          duration: 3.6,
        },
      ],
      true
    );
    syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
  }, [enqueueDialogues, runtime, syncDiscreteHud]);

  const handleInteract = useCallback(() => {
    const st = runtime.state;
    if (st.screen !== 'playing' || st.activeOverlay !== 'none' || st.finale.active) return;
    soundEngine.markUserGesture();

    if (st.player.zone === 'car_prologue') {
      if (st.prologue.phase === 'stalled') {
        st.prologue.ignitionAttempts += 1;
        soundEngine.playSfx('ignition');
        if (st.prologue.ignitionAttempts < 2) {
          enqueueDialogues(
            [
              {
                speaker: 'thought',
                text: 'Стартер лишь щёлкает... Попробую ещё раз [E] или выйду [W].',
                duration: 2.8,
              },
            ],
            true
          );
        } else {
          exitCarToForest();
        }
      }
      return;
    }

    const nearest = findNearestInteractable(st);
    if (!nearest) return;

    const prevParts = st.collectedParts.length;
    const prevNotes = st.collectedNotes.length;
    const prevTapes = st.collectedTapes.length;
    const prevKeys = st.collectedKeys.length;
    const prevSecrets = st.discoveredSecrets.length;
    const prevHiding = st.player.isHiding;

    const result = triggerInteraction(st, nearest);
    if (result.sfx === 'hide') {
      soundEngine.playHideSfx(st.player.isHiding);
    } else if (result.sfx !== 'none') {
      soundEngine.playSfx(result.sfx);
    }

    if (st.player.isHiding !== prevHiding) {
      gameEventBus.emit('player:hide_changed', {
        isHiding: st.player.isHiding,
        spotId: st.player.hidingSpotId,
      });
    }

    if (st.collectedParts.length > prevParts) {
      const addedPartId = st.collectedParts[st.collectedParts.length - 1];
      if (addedPartId) {
        gameEventBus.emit('part:collected', { partId: addedPartId });
        pushToast('part', 'Найдена деталь', PART_BY_ID[addedPartId]?.name ?? nearest.label);
      }
    } else if (st.collectedTapes.length > prevTapes) {
      const addedTapeId = st.collectedTapes[st.collectedTapes.length - 1];
      if (addedTapeId) {
        const tape = AUDIO_TAPES.find((t) => t.id === addedTapeId);
        gameEventBus.emit('tape:collected', { tapeId: addedTapeId });
        pushToast(
          'tape',
          'Найдена аудиокассета',
          tape ? `№${tape.number}: ${tape.title}` : 'Добавлено в журнал [J]'
        );
      }
    } else if (st.collectedNotes.length > prevNotes) {
      const addedNoteId = st.collectedNotes[st.collectedNotes.length - 1];
      if (addedNoteId) {
        gameEventBus.emit('note:collected', { noteId: addedNoteId });
        pushToast('note', 'Найдена записка', 'Добавлено в журнал [J]');
      }
    } else if (st.collectedKeys.length > prevKeys) {
      pushToast('key', 'Получен предмет', nearest.label);
    } else if (st.discoveredSecrets.length > prevSecrets) {
      const addedSecret = st.discoveredSecrets[st.discoveredSecrets.length - 1];
      if (addedSecret) {
        gameEventBus.emit('secret:discovered', { secretId: addedSecret });
        pushToast('secret', 'Открыт тайник', nearest.label);
      }
    }

    if (result.dialogues.length > 0) {
      enqueueDialogues(result.dialogues, true);
    } else if (runtime.dialogue.active) {
      runtime.clearDialogues();
      syncDialogueState();
    }
    if (result.openOverlay) {
      runtime.keysHeld.clear();
      st.activeOverlay = result.openOverlay;
      st.activeContainerId = result.activeContainerId ?? null;
      st.activeInspectId = result.activeInspectId ?? null;
      setActiveContainerId(result.activeContainerId ?? null);
      setActiveInspectId(result.activeInspectId ?? null);
      setActiveOverlay(result.openOverlay);
      if (result.activeInspectId) {
        gameEventBus.emit('inspect:opened', { inspectId: result.activeInspectId });
      }
      if (result.selectedNoteId) {
        setSelectedNoteId(result.selectedNoteId);
      }
    }
    if (result.shouldSave) {
      persistSave(st);
    }
    syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
  }, [enqueueDialogues, exitCarToForest, persistSave, pushToast, runtime, syncDialogueState, syncDiscreteHud]);

  const handleInstallPart = useCallback(
    (partId: PartId) => {
      const st = runtime.state;
      soundEngine.markUserGesture();
      const res = installPartOnRobot(st, partId);
      if (!res.success) return;

      gameEventBus.emit('part:installed', {
        partId,
        installedCount: st.installedParts.length,
      });

      soundEngine.playSfx(res.triggeredFinale ? 'finale' : 'install');
      if (res.triggeredFinale) {
        setActiveOverlay('none');
      } else {
        pushToast(
          'part',
          `Деталь установлена (${st.installedParts.length}/8)`,
          PART_BY_ID[partId]?.name
        );
        if (res.dialogues.length > 0) {
          enqueueDialogues(res.dialogues, true);
        }
      }
      persistSave(st);
      syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
    },
    [enqueueDialogues, persistSave, pushToast, runtime, syncDiscreteHud]
  );

  const handleChooseEnding = useCallback(
    (endingId: EndingId) => {
      const st = runtime.state;
      if (!st.finale.active || st.finale.phase !== 'choice') return;
      if (endingId === 'last_record' && !canUnlockLastRecordEnding(st)) return;
      soundEngine.markUserGesture();
      const msg = chooseFinaleEnding(st, endingId);
      soundEngine.playSfx(
        endingId === 'awakening' ? 'finale' : endingId === 'liberation' ? 'spark' : 'unlock'
      );
      enqueueDialogues([msg], true);
      syncDiscreteHud(st, null);
    },
    [enqueueDialogues, runtime, syncDiscreteHud]
  );

  const closeActiveOverlay = useCallback(() => {
    if (modalAutoCloseTimerRef.current !== null) {
      window.clearTimeout(modalAutoCloseTimerRef.current);
      modalAutoCloseTimerRef.current = null;
    }
    runtime.state.activeOverlay = 'none';
    runtime.state.activeContainerId = null;
    runtime.state.activeInspectId = null;
    setActiveContainerId(null);
    setActiveInspectId(null);
    setActiveOverlay('none');
  }, [runtime]);

  const handleInspectHotspot = useCallback(
    (targetId: InspectTargetId, hotspotId: string) => {
      const st = runtime.state;
      const res = recordInspectHotspotDiscovery(st, targetId, hotspotId);
      if (res.discoveredSecretId) {
        const sec = SECRETS.find((s) => s.id === res.discoveredSecretId);
        gameEventBus.emit('secret:discovered', { secretId: res.discoveredSecretId });
        pushToast('secret', 'Открыт тайник', sec?.name ?? 'Скрытая улика');
        persistSave(st);
      } else if (res.collectedTapeId) {
        const tape = AUDIO_TAPES.find((t) => t.id === res.collectedTapeId);
        gameEventBus.emit('tape:collected', { tapeId: res.collectedTapeId });
        pushToast(
          'tape',
          'Запись сохранена',
          tape ? `Кассета №${tape.number}: ${tape.title}` : 'Доступно в журнале [J]'
        );
        persistSave(st);
      } else if (res.observation) {
        pushToast('observation', 'Новая зацепка', 'Записано в журнал [J]');
        persistSave(st);
      }
      syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
    },
    [persistSave, pushToast, runtime, syncDiscreteHud]
  );

  const handleTouchHoldKey = useCallback((code: string, pressed: boolean) => {
    soundEngine.markUserGesture();
    if (pressed) {
      runtime.keysHeld.add(code);
    } else {
      runtime.keysHeld.delete(code);
    }
  }, [runtime]);

  const handleCollectContainer = useCallback(
    (openNoteAfter = false) => {
      const st = runtime.state;
      const cid = st.activeContainerId;
      if (!cid) {
        closeActiveOverlay();
        return;
      }
      const loot = collectContainerLoot(st, cid);
      if (loot.claimed) {
        soundEngine.playSfx(loot.noteTakenId ? 'paper' : 'pickup');
        if (loot.partTaken) {
          pushToast(
            'part',
            'Найдена деталь',
            loot.batteriesTaken > 0 ? `${loot.partTaken} (+${loot.batteriesTaken} бат.)` : loot.partTaken
          );
        } else if (loot.keyTaken) {
          pushToast('key', 'Найден предмет', loot.keyTaken);
        } else if (loot.noteTakenId) {
          pushToast('note', 'Найдена записка', 'Сохранено в журнале [J]');
        } else if (loot.batteriesTaken > 0) {
          pushToast('key', 'Найдена батарейка', `Зарядных элементов: +${loot.batteriesTaken}`);
        }
      }
      st.activeContainerId = null;
      setActiveContainerId(null);
      if (openNoteAfter && loot.noteTakenId) {
        st.activeOverlay = 'journal';
        setActiveOverlay('journal');
        setSelectedNoteId(loot.noteTakenId);
      } else {
        st.activeOverlay = 'none';
        setActiveOverlay('none');
        enqueueDialogues(loot.dialogues, true);
      }
      persistSave(st);
      syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
    },
    [closeActiveOverlay, enqueueDialogues, persistSave, pushToast, runtime, syncDiscreteHud]
  );

  const handleSafeCodeSubmit = useCallback(
    (code: string) => {
      const st = runtime.state;
      const res = submitSafeCode(st, code);
      enqueueDialogues([res.dialogue], true);
      if (res.success) {
        gameEventBus.emit('puzzle:solved', { puzzle: 'safe' });
        pushToast('puzzle', 'Сейф вскрыт', 'Получен ключ «3-Т»');
        persistSave(st);
        syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
        if (modalAutoCloseTimerRef.current !== null) {
          window.clearTimeout(modalAutoCloseTimerRef.current);
        }
        modalAutoCloseTimerRef.current = window.setTimeout(() => {
          modalAutoCloseTimerRef.current = null;
          if (runtime.state.activeOverlay === 'safe') {
            runtime.state.activeOverlay = 'none';
            setActiveOverlay('none');
          }
        }, 950);
      }
      return res.success;
    },
    [enqueueDialogues, persistSave, pushToast, runtime, syncDiscreteHud]
  );

  const handleClockSolved = useCallback(() => {
    const st = runtime.state;
    const res = solveClockPuzzle(st);
    enqueueDialogues([res.dialogue], true);
    if (!res.alreadySolved) {
      gameEventBus.emit('puzzle:solved', { puzzle: 'clock' });
      pushToast('puzzle', 'Часы 23:45 открыты', 'Получен ключ от подвала');
    }
    persistSave(st);
    syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
    if (modalAutoCloseTimerRef.current !== null) {
      window.clearTimeout(modalAutoCloseTimerRef.current);
    }
    modalAutoCloseTimerRef.current = window.setTimeout(() => {
      modalAutoCloseTimerRef.current = null;
      if (runtime.state.activeOverlay === 'clock') {
        runtime.state.activeOverlay = 'none';
        setActiveOverlay('none');
      }
    }, 950);
  }, [enqueueDialogues, persistSave, pushToast, runtime, syncDiscreteHud]);

  const handleTerminalSolved = useCallback(() => {
    const st = runtime.state;
    const wasSolved = st.terminalSolved;
    solveTerminalPuzzle(st);
    if (!wasSolved) {
      gameEventBus.emit('puzzle:solved', { puzzle: 'terminal' });
      pushToast('puzzle', 'Терминал расшифрован', 'Частота 104.8 МГц записана в журнал');
    }
    persistSave(st);
    syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
    enqueueDialogues(
      [
        {
          speaker: 'thought',
          text: 'Терминал расшифровал логи: аварийная частота для радиостанции на мансарде — 104.8 МГц.',
          duration: 3.8,
        },
      ],
      true
    );
  }, [enqueueDialogues, persistSave, pushToast, runtime, syncDiscreteHud]);

  const handleBreakerSolved = useCallback(() => {
    const st = runtime.state;
    const wasFixed = st.breakerFixed;
    solveBreakerPuzzle(st);
    if (!wasFixed) {
      gameEventBus.emit('puzzle:solved', { puzzle: 'breaker' });
      pushToast('puzzle', 'Щиток переключён', 'Вентиляция подвала разблокирована');
    }
    persistSave(st);
    syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
    enqueueDialogues(
      [
        {
          speaker: 'thought',
          text: 'Щёлкает реле: вентиляция обесточена, магнитный замок на решётке снят.',
          duration: 3.6,
        },
      ],
      true
    );
  }, [enqueueDialogues, persistSave, pushToast, runtime, syncDiscreteHud]);

  const handleRadioSecret = useCallback(() => {
    const st = runtime.state;
    if (!st.radioTunedSecret) {
      recordRadioSecret(st);
      gameEventBus.emit('puzzle:solved', { puzzle: 'radio' });
      pushToast('secret', 'Поймана частота 104.8 МГц', 'Запись инженера сохранена в журнале');
      persistSave(st);
      syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
      enqueueDialogues(
        [
          {
            speaker: 'radio',
            text: '104.8 МГц — запись инженера сохранена в журнале [J].',
            duration: 3.4,
          },
        ],
        true
      );
    }
  }, [enqueueDialogues, persistSave, pushToast, runtime, syncDiscreteHud]);

  const openPauseMenu = useCallback(() => {
    setSaveSlots(listSaveSlots());
    runtime.state.screen = 'paused';
    setScreen('paused');
    runtime.keysHeld.clear();
  }, [runtime]);

  const returnToTitleScreen = useCallback(() => {
    closeActiveOverlay();
    const summary = readSaveSummary();
    setSaveSummary(summary);
    setSaveSlots(listSaveSlots());
    runtime.state.screen = 'title';
    setScreen('title');
  }, [closeActiveOverlay, runtime]);

  const toggleOverlay = useCallback((target: 'inventory' | 'journal' | 'map') => {
    const st = runtime.state;
    if (st.screen !== 'playing' || st.player.zone === 'car_prologue' || st.finale.active) return;
    if (target === 'map' && st.player.zone !== 'house') return;
    if (st.activeOverlay === target) {
      st.activeOverlay = 'none';
      setActiveOverlay('none');
    } else {
      if (target === 'map') {
        trackVisitedRoom(st);
      }
      st.activeOverlay = target;
      setActiveOverlay(target);
      if (target === 'journal' && st.collectedNotes.length > 0) {
        const firstUnread = st.collectedNotes.find((id) => !st.readNoteIds.includes(id));
        const latest = st.collectedNotes[st.collectedNotes.length - 1] ?? null;
        setSelectedNoteId(firstUnread ?? latest);
      }
    }
  }, [runtime]);

  // Keyboard listener on window honoring custom KeyBindings via inputController
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      soundEngine.markUserGesture();
      const code = e.code;
      const bindings = settingsRef.current.keyBindings;

      if (code === 'Tab' || matchesKeyAction(code, 'inventory', bindings)) {
        if (runtime.state.screen === 'playing' && runtime.state.activeOverlay === 'none') {
          e.preventDefault();
        }
      }

      const st = runtime.state;

      if (e.isComposing) return;
      const targetEl = e.target as HTMLElement | null;
      const isInteractiveEl = Boolean(
        targetEl?.closest('button, input, select, textarea, a, [role="button"]')
      );

      if (st.screen === 'title') {
        if ((code === 'Enter' || code === 'Space') && !titlePanelOpenRef.current && !isInteractiveEl) {
          e.preventDefault();
          startNewGame(false);
        }
        return;
      }

      if (st.screen === 'gameover') {
        return;
      }

      if (code === 'Escape' || (code === 'KeyP' && !isKeyBoundToAction(code, bindings))) {
        e.preventDefault();
        if (st.activeOverlay !== 'none') {
          closeActiveOverlay();
          return;
        }
        if (st.screen === 'playing') {
          openPauseMenu();
        } else if (st.screen === 'paused') {
          st.screen = 'playing';
          setScreen('playing');
        }
        return;
      }

      if (st.screen !== 'playing') return;

      // Finale interactive choice hotkeys [1] / [2] / [3]
      if (st.finale.active && st.finale.phase === 'choice' && !e.repeat) {
        if (code === 'Digit1') {
          e.preventDefault();
          handleChooseEnding('awakening');
          return;
        }
        if (code === 'Digit2') {
          e.preventDefault();
          handleChooseEnding('liberation');
          return;
        }
        if (code === 'Digit3' && canUnlockLastRecordEnding(st)) {
          e.preventDefault();
          handleChooseEnding('last_record');
          return;
        }
      }

      if (matchesKeyAction(code, 'inventory', bindings)) {
        if (code === 'Tab' && st.activeOverlay !== 'none') {
          return;
        }
        toggleOverlay('inventory');
        return;
      }
      if (matchesKeyAction(code, 'journal', bindings)) {
        toggleOverlay('journal');
        return;
      }
      if (matchesKeyAction(code, 'map', bindings)) {
        toggleOverlay('map');
        return;
      }
      if (code === 'KeyM' && !isKeyBoundToAction(code, bindings)) {
        handleToggleMute();
        return;
      }
      if (
        matchesKeyAction(code, 'reload', bindings) &&
        !e.repeat &&
        (st.activeOverlay === 'none' || st.activeOverlay === 'inventory')
      ) {
        handleReloadBattery();
        return;
      }

      if (st.activeOverlay !== 'none') return;

      if (!e.repeat) {
        runtime.keysJustPressed.add(code);
        if (
          code === 'Space' &&
          st.player.zone !== 'car_prologue' &&
          runtime.dialogue.active &&
          !matchesKeyAction(code, 'interact', bindings) &&
          !matchesKeyAction(code, 'flashlight', bindings)
        ) {
          e.preventDefault();
          handleAdvanceDialogue();
          return;
        }
        if (matchesKeyAction(code, 'interact', bindings)) {
          handleInteract();
        } else if (matchesKeyAction(code, 'flashlight', bindings)) {
          handleToggleFlashlight();
        } else if (
          matchesKeyAction(code, 'up', bindings) &&
          st.player.zone === 'car_prologue' &&
          st.prologue.phase === 'stalled'
        ) {
          exitCarToForest();
        } else if (
          matchesKeyAction(code, 'down', bindings) &&
          st.player.isHiding &&
          st.player.hidingSpotId
        ) {
          const res = toggleHidingSpot(st, st.player.hidingSpotId);
          soundEngine.playHideSfx(false);
          gameEventBus.emit('player:hide_changed', { isHiding: false, spotId: null });
          enqueueDialogues([res.dialogue], true);
          syncDiscreteHud(st, findNearestInteractable(st)?.promptLabel ?? null);
        } else if (
          matchesKeyAction(code, 'up', bindings) ||
          matchesKeyAction(code, 'down', bindings)
        ) {
          const near = findNearestInteractable(st);
          if (near && near.kind === 'stairs') {
            if (
              (matchesKeyAction(code, 'up', bindings) && (near.targetFloor ?? 0) > (near.floor ?? 0)) ||
              (matchesKeyAction(code, 'down', bindings) && (near.targetFloor ?? 0) < (near.floor ?? 0))
            ) {
              handleInteract();
            }
          }
        }
      }

      runtime.keysHeld.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      runtime.keysHeld.delete(e.code);
    };

    const clearHeld = () => {
      runtime.clearInput();
    };

    const onVisibilityChange = () => {
      clearHeld();
      soundEngine.handleVisibilityChange(document.hidden);
    };

    const onPointerDown = () => {
      soundEngine.markUserGesture();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('blur', clearHeld);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('blur', clearHeld);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [
    closeActiveOverlay,
    enqueueDialogues,
    exitCarToForest,
    handleAdvanceDialogue,
    handleChooseEnding,
    handleInteract,
    handleReloadBattery,
    handleToggleFlashlight,
    handleToggleMute,
    openPauseMenu,
    runtime,
    startNewGame,
    syncDiscreteHud,
    toggleOverlay,
  ]);

  const gamepadActionsRef = useRef({
    handleInteract,
    handleAdvanceDialogue,
    handleToggleFlashlight,
    handleReloadBattery,
    toggleOverlay,
    closeActiveOverlay,
    exitCarToForest,
    openPauseMenu,
    returnToTitleScreen,
    startNewGame,
    continueSavedGame,
  });
  gamepadActionsRef.current = {
    handleInteract,
    handleAdvanceDialogue,
    handleToggleFlashlight,
    handleReloadBattery,
    toggleOverlay,
    closeActiveOverlay,
    exitCarToForest,
    openPauseMenu,
    returnToTitleScreen,
    startNewGame,
    continueSavedGame,
  };

  // Main fixed-timestep (60Hz) simulation & render loop via GameLoop + GameRuntime
  useEffect(() => {
    const simCallbacks = {
      enqueueDialogues,
      pushToast,
      persistSave,
      onFinaleFinished: (summary: RunSummary) => {
        runtime.clearDialogues();
        syncDialogueState();
        recordUnlockedEnding(summary.endingId);
        setRunSummary(summary);
        setScreen('gameover');
      },
      updateStaminaBar: (stamina: number, exhausted: boolean) => {
        if (staminaBarRef.current) {
          staminaBarRef.current.style.width = `${Math.round(stamina)}%`;
          staminaBarRef.current.style.backgroundColor = exhausted ? '#a84a4a' : '#8ea4bc';
        }
      },
    };

    let currentGamepadHeld: { left: boolean; right: boolean; run: boolean; crouch: boolean } | undefined;

    const loop = new GameLoop({
      isHidden: () => typeof document !== 'undefined' && document.hidden,
      onSimulationStep: (fixedStep, timeSec) => {
        const st = runtime.state;
        if (st.screen !== 'playing') return;
        runSimulationStep(
          st,
          fixedStep,
          timeSec,
          runtime.keysHeld,
          settingsRef.current.keyBindings,
          runtime.timers,
          simCallbacks,
          {
            difficulty: settingsRef.current.difficulty,
            soundCaptions: settingsRef.current.soundCaptions,
            gamepadHeld: currentGamepadHeld,
          }
        );
      },
      onFrameSync: (dt) => {
        const st = runtime.state;
        const timers = runtime.timers;
        const gp = runtime.pollGamepad(settingsRef.current.gamepadDeadzone ?? 0.28);
        currentGamepadHeld = gp.connected
          ? { left: gp.left, right: gp.right, run: gp.run, crouch: gp.down }
          : undefined;

        if (gp.connected) {
          const actions = gamepadActionsRef.current;
          const stepGamepadFocus = (container: HTMLElement | null): boolean => {
            if (!container) return false;
            const focusables = Array.from(
              container.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
              )
            ).filter((el) => el.getClientRects().length > 0);
            if (focusables.length === 0) return false;
            const activeEl = document.activeElement as HTMLElement | null;
            const activeIdx = activeEl ? focusables.indexOf(activeEl) : -1;
            const isRange =
              activeEl instanceof HTMLInputElement && activeEl.type === 'range';
            if (isRange && (gp.justLeft || gp.justRight)) {
              const step = Number(activeEl.step) || 1;
              const min = Number(activeEl.min) || 0;
              const max = Number(activeEl.max) || 100;
              const cur = Number(activeEl.value) || 0;
              const next = Math.max(
                min,
                Math.min(max, cur + (gp.justRight ? step : -step))
              );
              const descriptor = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value'
              );
              descriptor?.set?.call(activeEl, String(next));
              activeEl.dispatchEvent(new Event('input', { bubbles: true }));
              activeEl.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            if (gp.justUp || gp.justLeft) {
              const prevIdx = activeIdx <= 0 ? focusables.length - 1 : activeIdx - 1;
              const el = focusables[prevIdx];
              el?.focus();
              el?.scrollIntoView({ block: 'nearest' });
              return true;
            }
            if (gp.justDown || gp.justRight) {
              const nextIdx =
                activeIdx < 0 || activeIdx >= focusables.length - 1 ? 0 : activeIdx + 1;
              const el = focusables[nextIdx];
              el?.focus();
              el?.scrollIntoView({ block: 'nearest' });
              return true;
            }
            if (gp.justInteract && activeIdx >= 0) {
              focusables[activeIdx]?.click();
              return true;
            }
            return false;
          };

          if (st.screen === 'title') {
            const titleRoot = document.querySelector<HTMLElement>('[data-title-screen="true"]');
            if (gp.justCancel && titlePanelOpenRef.current) {
              window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
            } else if (!stepGamepadFocus(titleRoot) && gp.justInteract && !titlePanelOpenRef.current) {
              soundEngine.markUserGesture();
              if (readSaveSummary()) {
                actions.continueSavedGame();
              } else {
                actions.startNewGame(false);
              }
            }
          } else if (st.screen === 'gameover') {
            const endingRoot = document.querySelector<HTMLElement>('[data-ending-screen="true"]');
            if (!stepGamepadFocus(endingRoot)) {
              if (gp.justInteract) {
                soundEngine.markUserGesture();
                actions.startNewGame(false);
              } else if (gp.justCancel) {
                actions.returnToTitleScreen();
              }
            }
          } else if (gp.justPause) {
            if (st.screen === 'playing') {
              if (st.activeOverlay !== 'none') {
                actions.closeActiveOverlay();
              } else {
                actions.openPauseMenu();
              }
            } else if (st.screen === 'paused') {
              st.screen = 'playing';
              setScreen('playing');
            }
          } else if (gp.justCancel) {
            if (st.screen === 'playing' && st.activeOverlay !== 'none') {
              actions.closeActiveOverlay();
            } else if (st.screen === 'paused') {
              st.screen = 'playing';
              setScreen('playing');
            }
          } else if (
            st.screen === 'paused' ||
            (st.screen === 'playing' && st.activeOverlay !== 'none')
          ) {
            const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
            if (!stepGamepadFocus(dialog) && gp.justInteract && dialog) {
              dialog.querySelector<HTMLElement>('button:not([disabled])')?.click();
            }
          } else if (st.screen === 'playing' && st.finale.active && st.finale.phase === 'choice') {
            const buttons = Array.from(
              document.querySelectorAll<HTMLButtonElement>('[data-finale-choice]:not([disabled])')
            );
            if (buttons.length > 0) {
              const activeIdx = buttons.findIndex((b) => b === document.activeElement);
              if (gp.justUp || gp.justLeft) {
                const prevIdx = activeIdx <= 0 ? buttons.length - 1 : activeIdx - 1;
                buttons[prevIdx]?.focus();
              } else if (gp.justDown || gp.justRight) {
                const nextIdx = activeIdx < 0 || activeIdx >= buttons.length - 1 ? 0 : activeIdx + 1;
                buttons[nextIdx]?.focus();
              } else if (gp.justInteract) {
                const targetBtn = activeIdx >= 0 ? buttons[activeIdx] : buttons[0];
                targetBtn?.click();
              }
            }
          } else if (st.screen === 'playing' && st.activeOverlay === 'none' && !st.finale.active) {
            if (gp.justInteract) {
              if (
                st.player.zone !== 'car_prologue' &&
                runtime.dialogue.active &&
                !findNearestInteractable(st)
              ) {
                actions.handleAdvanceDialogue();
              } else {
                actions.handleInteract();
              }
            }
            if (gp.justFlashlight) actions.handleToggleFlashlight();
            if (gp.justReload) actions.handleReloadBattery();
            if (gp.justMap) {
              actions.toggleOverlay(st.player.zone === 'house' ? 'map' : 'journal');
            }
            if (
              gp.up &&
              st.player.zone === 'car_prologue' &&
              st.prologue.phase === 'stalled'
            ) {
              actions.exitCarToForest();
            }
          }
        }

        if (st.screen === 'playing') {
          if (st.player.zone !== 'forest' && timers.rainPauseTimer > 0) {
            timers.rainPauseTimer = 0;
          }

          if (runtime.tickDialogueAndAudio(dt, settingsRef.current.textSpeed)) {
            syncDialogueState();
          }

          const near =
            st.activeOverlay === 'none' && !st.finale.active ? findNearestInteractable(st) : null;
          syncDiscreteHud(st, near?.promptLabel ?? null);
        }

        runtime.syncAmbience();
      },
      onRender: (dt, timeSec) => {
        const st = runtime.state;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx && st.screen !== 'gameover') {
          const modalOpen =
            st.screen === 'playing' && (st.activeOverlay !== 'none' || st.finale.phase === 'choice');
          if (!modalOpen || Math.floor(timeSec * 8) !== Math.floor((timeSec - dt) * 8)) {
            const near =
              st.screen === 'playing' && st.activeOverlay === 'none' && !st.finale.active
                ? findNearestInteractable(st)
                : null;
            runtime.renderer.render(
              ctx,
              st,
              timeSec,
              dt,
              near,
              runtime.timers.rainPauseTimer > 0,
              {
                screenShake: settingsRef.current.screenShake,
                reduceFlashes: settingsRef.current.reduceFlashes,
                visualNoise: settingsRef.current.visualNoise,
                reducedMotion: Boolean(settingsRef.current.reducedMotion),
                paused: st.screen === 'paused',
              }
            );
          }
        }
      },
      onAfterFrame: () => {
        runtime.keysJustPressed.clear();
      },
    }, settingsRef.current.renderFpsCap ?? 0);

    loopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      if (loopRef.current === loop) {
        loopRef.current = null;
      }
    };
  }, [enqueueDialogues, persistSave, pushToast, recordUnlockedEnding, runtime, syncDialogueState, syncDiscreteHud]);

  return (
    <main className="relative w-screen h-screen bg-[#04060a] overflow-hidden flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={VIRTUAL_W}
        height={VIRTUAL_H}
        data-testid="game-canvas"
        className="w-full h-full object-contain pixelated"
      />

      {screen === 'title' && (
        <TitleScreen
          hasSave={hasSave}
          saveSummary={saveSummary}
          settings={settings}
          onUpdateSettings={(next) => {
            soundEngine.markUserGesture();
            updateSettings(next);
          }}
          onStartNew={() => {
            soundEngine.markUserGesture();
            startNewGame(false);
          }}
          onContinue={continueSavedGame}
          onPanelOpenChange={setTitlePanelOpen}
        />
      )}

      {screen === 'playing' && (
        <GameHUD
          hud={hud}
          staminaBarRef={staminaBarRef}
          dialogue={dialogue}
          typedText={typedText}
          toasts={toasts}
          subtitleSize={settings.subtitleSize}
          subtitleBg={settings.subtitleBg}
          uiScale={settings.uiScale}
          keyBindings={settings.keyBindings}
          touchControlsActive={
            settings.touchControls &&
            activeOverlay === 'none' &&
            !runtime.state.finale.active &&
            hud.zone !== 'car_prologue'
          }
          onToggleInventory={() => toggleOverlay('inventory')}
          onToggleJournal={() => toggleOverlay('journal')}
          onToggleMap={() => toggleOverlay('map')}
          onToggleMute={handleToggleMute}
          onOpenPause={openPauseMenu}
          onInteractClick={handleInteract}
          onExitCar={exitCarToForest}
          onToggleFlashlight={handleToggleFlashlight}
          onReloadBattery={handleReloadBattery}
          onAdvanceDialogue={handleAdvanceDialogue}
          onChooseEnding={handleChooseEnding}
        />
      )}

      {screen === 'playing' && (
        <TouchControls
          visible={
            settings.touchControls &&
            activeOverlay === 'none' &&
            !runtime.state.finale.active &&
            hud.zone !== 'car_prologue'
          }
          zone={hud.zone}
          hasFlashlight={hud.hasFlashlight}
          flashlightOn={hud.flashlightOn}
          batteries={hud.batteries}
          promptLabel={hud.promptLabel}
          isHiding={Boolean(hud.isHiding)}
          unreadJournalCount={hud.unreadJournalCount}
          touchSize={settings.touchSize}
          touchLayout={settings.touchLayout}
          keyBindings={settings.keyBindings}
          onHoldKey={handleTouchHoldKey}
          onInteract={handleInteract}
          onToggleFlashlight={handleToggleFlashlight}
          onReloadBattery={handleReloadBattery}
          onToggleInventory={() => toggleOverlay('inventory')}
          onToggleJournal={() => toggleOverlay('journal')}
          onToggleMap={() => toggleOverlay('map')}
          onOpenPause={openPauseMenu}
        />
      )}

      <Suspense fallback={null}>
        {screen === 'playing' && activeOverlay === 'assembly' && (
          <AssemblyModal
            collectedParts={runtime.state.collectedParts}
            installedParts={runtime.state.installedParts}
            onInstallPart={handleInstallPart}
            onClose={closeActiveOverlay}
          />
        )}

        {screen === 'playing' && activeOverlay === 'inventory' && (
          <InventoryModal
            collectedParts={runtime.state.collectedParts}
            installedParts={runtime.state.installedParts}
            collectedKeys={runtime.state.collectedKeys}
            collectedTapes={runtime.state.collectedTapes}
            discoveredSecrets={runtime.state.discoveredSecrets}
            flashlightBattery={runtime.state.player.flashlightBattery}
            batteries={runtime.state.player.batteries}
            reloadKeyLabel={formatKeyCode(settings.keyBindings.reload)}
            journalKeyLabel={formatKeyCode(settings.keyBindings.journal)}
            onReloadBattery={handleReloadBattery}
            onClose={closeActiveOverlay}
          />
        )}

        {screen === 'playing' && activeOverlay === 'journal' && (
          <JournalModal
            collectedNotes={runtime.state.collectedNotes}
            readNoteIds={runtime.state.readNoteIds}
            collectedKeys={runtime.state.collectedKeys}
            collectedTapes={runtime.state.collectedTapes}
            readTapeIds={runtime.state.readTapeIds}
            discoveredRadioSignals={runtime.state.discoveredRadioSignals}
            inspectedObjects={runtime.state.inspectedObjects}
            installedParts={runtime.state.installedParts}
            discoveredSecrets={runtime.state.discoveredSecrets}
            observations={runtime.state.journalObservations}
            mysteries={{
              phoneListened: runtime.state.phoneListened,
              clockSolved: runtime.state.clockSolved,
              safeUnlocked: runtime.state.safeUnlocked,
              terminalSolved: runtime.state.terminalSolved,
              breakerFixed: runtime.state.breakerFixed,
              radioTunedSecret: runtime.state.radioTunedSecret,
            }}
            initialNoteId={selectedNoteId}
            journalKeyLabel={formatKeyCode(settings.keyBindings.journal)}
            onMarkNoteRead={handleMarkNoteRead}
            onMarkTapeRead={handleMarkTapeRead}
            onClose={closeActiveOverlay}
          />
        )}

        {screen === 'playing' && activeOverlay === 'map' && (
          <MapModal
            currentFloor={runtime.state.player.floor}
            currentRoomId={getCurrentRoomId(runtime.state)}
            visitedRooms={runtime.state.visitedRooms}
            collectedKeys={runtime.state.collectedKeys}
            discoveredSecrets={runtime.state.discoveredSecrets}
            breakerFixed={runtime.state.breakerFixed}
            mapKeyLabel={formatKeyCode(settings.keyBindings.map)}
            onClose={closeActiveOverlay}
          />
        )}

        {screen === 'playing' && activeOverlay === 'inspect' && activeInspectId && (
          <InspectModal
            targetId={activeInspectId}
            installedParts={runtime.state.installedParts.length}
            inspectedObjects={runtime.state.inspectedObjects}
            discoveredSecrets={runtime.state.discoveredSecrets}
            onInspectHotspot={handleInspectHotspot}
            onClose={closeActiveOverlay}
          />
        )}

        {screen === 'playing' && activeOverlay === 'container' && activeContainerId && (
          <ContainerModal
            containerId={activeContainerId}
            isAlreadyLooted={runtime.state.lootedContainers.includes(activeContainerId)}
            collectedParts={runtime.state.collectedParts}
            installedParts={runtime.state.installedParts}
            collectedKeys={runtime.state.collectedKeys}
            collectedNotes={runtime.state.collectedNotes}
            interactKeyCode={settings.keyBindings.interact}
            interactKeyLabel={formatKeyCode(settings.keyBindings.interact)}
            reloadKeyLabel={formatKeyCode(settings.keyBindings.reload)}
            onCollectAll={handleCollectContainer}
            onClose={closeActiveOverlay}
          />
        )}

        {screen === 'playing' && activeOverlay === 'safe' && (
          <SafeModal onSubmitCode={handleSafeCodeSubmit} onClose={closeActiveOverlay} />
        )}

        {screen === 'playing' && activeOverlay === 'clock' && (
          <ClockModal
            alreadySolved={runtime.state.clockSolved}
            onSolved={handleClockSolved}
            onClose={closeActiveOverlay}
          />
        )}

        {screen === 'playing' && activeOverlay === 'terminal' && (
          <TerminalModal
            alreadySolved={runtime.state.terminalSolved}
            installedParts={runtime.state.installedParts.length}
            onSolved={handleTerminalSolved}
            onClose={closeActiveOverlay}
          />
        )}

        {screen === 'playing' && activeOverlay === 'breaker' && (
          <BreakerModal
            hasFuse={runtime.state.collectedKeys.includes('fuse')}
            alreadyFixed={runtime.state.breakerFixed}
            onSolved={handleBreakerSolved}
            onClose={closeActiveOverlay}
          />
        )}

        {screen === 'playing' && activeOverlay === 'radio' && (
          <RadioModal
            alreadyTuned={runtime.state.radioTunedSecret}
            onTuneSecret={handleRadioSecret}
            onClose={closeActiveOverlay}
          />
        )}

        {screen === 'paused' && (
          <PauseModal
            settings={settings}
            saveSlots={saveSlots}
            onUpdateSettings={updateSettings}
            onSaveNow={handleSaveNow}
            onSaveToSlot={handleSaveToSlot}
            onLoadFromSlot={handleLoadFromSlot}
            onDeleteSlot={handleDeleteSlot}
            onExportSave={handleExportSave}
            onImportSaveFile={handleImportSaveFile}
            onResume={() => {
              runtime.state.screen = 'playing';
              setScreen('playing');
            }}
            onRestart={() => startNewGame(false)}
            onExitToTitle={returnToTitleScreen}
          />
        )}

        {screen === 'gameover' && (
          <EndingScreen
            summary={runSummary}
            unlockedEndings={unlockedEndings}
            onPlayAgain={() => startNewGame(false)}
            onReturnTitle={returnToTitleScreen}
          />
        )}
      </Suspense>
    </main>
  );
}
