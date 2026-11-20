import React, { useEffect, useRef, useState } from 'react';
import {
  Backpack,
  BatteryCharging,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flashlight,
  Hand,
  Pause,
} from 'lucide-react';
import { KeyBindings, TouchLayout, TouchSize, WorldZone } from '../game/types';

interface TouchControlsProps {
  visible: boolean;
  zone: WorldZone;
  hasFlashlight: boolean;
  flashlightOn: boolean;
  batteries: number;
  promptLabel: string | null;
  isHiding: boolean;
  unreadJournalCount: number;
  touchSize: TouchSize;
  touchLayout: TouchLayout;
  keyBindings: KeyBindings;
  onHoldKey: (code: string, pressed: boolean) => void;
  onInteract: () => void;
  onToggleFlashlight: () => void;
  onReloadBattery: () => void;
  onToggleInventory: () => void;
  onToggleJournal: () => void;
  onToggleMap: () => void;
  onOpenPause: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  visible,
  zone,
  hasFlashlight,
  flashlightOn,
  batteries,
  promptLabel,
  isHiding,
  unreadJournalCount,
  touchSize,
  touchLayout,
  keyBindings,
  onHoldKey,
  onInteract,
  onToggleFlashlight,
  onReloadBattery,
  onToggleInventory,
  onToggleJournal,
  onToggleMap,
  onOpenPause,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [knobOffset, setKnobOffset] = useState(0); // -1..1 normalized horizontal drag
  const [heldButtons, setHeldButtons] = useState<Record<string, boolean>>({});
  const activePointerRef = useRef<number | null>(null);

  const leftCode = keyBindings.left;
  const rightCode = keyBindings.right;
  const runCode = keyBindings.run;
  const crouchCode = keyBindings.down;

  useEffect(() => {
    const releaseAll = () => {
      activePointerRef.current = null;
      setKnobOffset(0);
      setHeldButtons({});
      onHoldKey(leftCode, false);
      onHoldKey(rightCode, false);
      onHoldKey(runCode, false);
      onHoldKey(crouchCode, false);
    };

    if (!visible) {
      releaseAll();
      return;
    }

    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [visible, leftCode, rightCode, runCode, crouchCode, onHoldKey]);

  if (!visible) return null;

  const sizeConfig =
    touchSize === 'small'
      ? {
          padW: 'w-24 sm:w-28 h-11 sm:h-12',
          knobPx: 28,
          actionBtn: 'h-11 px-3 sm:px-3.5 text-[11px]',
          smallBtn: 'px-2 sm:px-2.5 py-1.5 text-[10px]',
        }
      : touchSize === 'large'
      ? {
          padW: 'w-32 sm:w-40 h-14 sm:h-16',
          knobPx: 38,
          actionBtn: 'h-14 sm:h-16 px-4 sm:px-6 text-xs sm:text-sm',
          smallBtn: 'px-2.5 sm:px-3.5 py-2 text-[11px] sm:text-xs',
        }
      : {
          padW: 'w-28 sm:w-34 h-12 sm:h-14',
          knobPx: 32,
          actionBtn: 'h-12 sm:h-14 px-3.5 sm:px-5 text-xs',
          smallBtn: 'px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-[11px]',
        };

  const applyStick = (clientX: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const maxTravel = Math.max(24, rect.width / 2 - sizeConfig.knobPx / 2 - 4);
    const delta = clientX - center;
    const clamped = Math.max(-maxTravel, Math.min(maxTravel, delta));
    const norm = clamped / maxTravel;
    setKnobOffset(norm);

    const deadzone = 0.22;
    onHoldKey(leftCode, norm < -deadzone);
    onHoldKey(rightCode, norm > deadzone);
  };

  const releaseStick = () => {
    activePointerRef.current = null;
    setKnobOffset(0);
    onHoldKey(leftCode, false);
    onHoldKey(rightCode, false);
  };

  const setHoldState = (code: string, pressed: boolean) => {
    setHeldButtons((prev) => (prev[code] === pressed ? prev : { ...prev, [code]: pressed }));
    onHoldKey(code, pressed);
  };

  const bindHold = (code: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable in synthetic test events
      }
      setHoldState(code, true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setHoldState(code, false);
    },
    onLostPointerCapture: () => setHoldState(code, false),
    onPointerCancel: () => setHoldState(code, false),
  });

  const movementCluster = (
    <div className="pointer-events-auto flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Бег"
          aria-pressed={Boolean(heldButtons[runCode])}
          {...bindHold(runCode)}
          className={`${sizeConfig.smallBtn} border transition-colors ${
            heldButtons[runCode]
              ? 'bg-[#1e3147] border-[#7cd4ff] text-white'
              : 'bg-[#0b111a]/88 active:bg-[#1e3147] border-[#324357] text-[#c7d6e6]'
          }`}
        >
          Бег
        </button>
        <button
          type="button"
          aria-label="Присесть"
          aria-pressed={Boolean(heldButtons[crouchCode])}
          {...bindHold(crouchCode)}
          className={`${sizeConfig.smallBtn} border transition-colors ${
            heldButtons[crouchCode]
              ? 'bg-[#1e3147] border-[#7cd4ff] text-white'
              : 'bg-[#0b111a]/88 active:bg-[#1e3147] border-[#324357] text-[#c7d6e6]'
          }`}
        >
          Присед
        </button>
      </div>

      {/* Virtual Horizontal Analog Joystick Pad */}
      <div
        ref={padRef}
        role="slider"
        aria-label="Виртуальный джойстик движения"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(knobOffset * 100)}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          activePointerRef.current = e.pointerId;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Ignore synthetic environments without pointer capture
          }
          applyStick(e.clientX);
        }}
        onPointerMove={(e) => {
          if (activePointerRef.current !== e.pointerId) return;
          e.preventDefault();
          e.stopPropagation();
          applyStick(e.clientX);
        }}
        onPointerUp={(e) => {
          if (activePointerRef.current !== e.pointerId) return;
          e.preventDefault();
          e.stopPropagation();
          releaseStick();
        }}
        onPointerCancel={releaseStick}
        className={`relative ${sizeConfig.padW} bg-[#090f17]/90 border border-[#3a4f66] flex items-center justify-between px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}
      >
        <ChevronLeft
          className={`w-4 h-4 transition-colors ${
            knobOffset < -0.22 ? 'text-[#7cd4ff]' : 'text-[#5b7085]'
          }`}
        />
        <ChevronRight
          className={`w-4 h-4 transition-colors ${
            knobOffset > 0.22 ? 'text-[#7cd4ff]' : 'text-[#5b7085]'
          }`}
        />
        <div
          className="absolute top-1/2 left-1/2 rounded-full bg-[#1a2c40] border-2 border-[#7cd4ff] shadow-[0_0_12px_rgba(124,212,255,0.35)] pointer-events-none transition-transform duration-75"
          style={{
            width: `${sizeConfig.knobPx}px`,
            height: `${sizeConfig.knobPx}px`,
            transform: `translate(calc(-50% + ${Math.round(knobOffset * 38)}px), -50%)`,
          }}
        />
      </div>
    </div>
  );

  const actionCluster = (
    <div
      className={`pointer-events-auto flex flex-col gap-2 ${
        touchLayout === 'swapped' ? 'items-start' : 'items-end'
      }`}
    >
      {/* Quick utility row: Map (house), Inventory, Journal, Pause */}
      <div className="flex flex-wrap justify-end items-center gap-1 sm:gap-1.5">
        {zone === 'house' && (
          <button
            type="button"
            aria-label="Карта дома"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleMap}
            className="px-2 sm:px-2.5 py-1.5 bg-[#0b111a]/88 active:bg-[#19283a] border border-[#2f4054] text-[10px] text-[#bfd0e0] flex items-center gap-1"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Карта</span>
          </button>
        )}
        <button
          type="button"
          aria-label="Инвентарь"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleInventory}
          className="px-2 sm:px-2.5 py-1.5 bg-[#0b111a]/88 active:bg-[#19283a] border border-[#2f4054] text-[10px] text-[#bfd0e0] flex items-center gap-1"
        >
          <Backpack className="w-3.5 h-3.5" />
          <span>Инв.</span>
        </button>
        <button
          type="button"
          aria-label="Журнал"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleJournal}
          className="relative px-2 sm:px-2.5 py-1.5 bg-[#0b111a]/88 active:bg-[#19283a] border border-[#2f4054] text-[10px] text-[#bfd0e0] flex items-center gap-1"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Журн.</span>
          {unreadJournalCount > 0 && (
            <span className="w-2 h-2 bg-[#7cd4ff] rounded-full" />
          )}
        </button>
        <button
          type="button"
          aria-label="Пауза"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onOpenPause}
          className="px-2 py-1.5 bg-[#0b111a]/88 active:bg-[#19283a] border border-[#2f4054] text-[10px] text-[#bfd0e0]"
        >
          <Pause className="w-3.5 h-3.5" />
        </button>
      </div>

      {hasFlashlight && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Заменить батарейку"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onReloadBattery}
            className={`${sizeConfig.smallBtn} bg-[#0b111a]/88 active:bg-[#173024] border border-[#324357] text-[#a9e8c3] flex items-center gap-1`}
          >
            <BatteryCharging className="w-3.5 h-3.5" />
            <span>{batteries}</span>
          </button>
          <button
            type="button"
            aria-label="Фонарик"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleFlashlight}
            className={`${sizeConfig.smallBtn} border flex items-center gap-1 ${
              flashlightOn
                ? 'bg-[#17283a]/92 border-[#6fa8d6] text-[#d9f0ff]'
                : 'bg-[#0b111a]/88 border-[#324357] text-[#9eb0c2]'
            }`}
          >
            <Flashlight className="w-3.5 h-3.5" />
            <span>Свет</span>
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label="Действие"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onInteract}
        className={`${sizeConfig.actionBtn} border font-semibold flex items-center gap-2 ${
          promptLabel || isHiding
            ? 'bg-[#172c40]/95 active:bg-[#234361] border-[#78b7e6] text-white'
            : 'bg-[#0b111a]/85 border-[#2c3b4d] text-[#8396aa]'
        }`}
      >
        <Hand className="w-4 h-4" />
        <span>{isHiding ? 'Выйти' : 'Действие'}</span>
      </button>
    </div>
  );

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 px-[max(0.625rem,env(safe-area-inset-left))] pr-[max(0.625rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))] sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-end justify-between gap-2 pointer-events-none select-none touch-none font-ui"
      aria-label="Сенсорное управление"
    >
      {touchLayout === 'swapped' ? (
        <>
          {actionCluster}
          {movementCluster}
        </>
      ) : (
        <>
          {movementCluster}
          {actionCluster}
        </>
      )}
    </div>
  );
};
