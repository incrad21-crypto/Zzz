import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { rebindKeyAction } from '../game/controllers/inputController';
import {
  DEFAULT_KEY_BINDINGS,
  KEY_ACTIONS_ORDER,
  KEY_ACTION_LABELS,
  formatKeyCode,
} from '../game/saveManager';
import { KeyAction, KeyBindings } from '../game/types';

interface KeyBindingsEditorProps {
  bindings: KeyBindings;
  onChange: (next: KeyBindings) => void;
}

export const KeyBindingsEditor: React.FC<KeyBindingsEditorProps> = ({ bindings, onChange }) => {
  const [listeningAction, setListeningAction] = useState<KeyAction | null>(null);

  useEffect(() => {
    if (!listeningAction) return;
    const onCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setListeningAction(null);
        return;
      }
      if (e.code === 'MetaLeft' || e.code === 'MetaRight') return;
      onChange(rebindKeyAction(bindings, listeningAction, e.code));
      setListeningAction(null);
    };
    window.addEventListener('keydown', onCapture, true);
    return () => window.removeEventListener('keydown', onCapture, true);
  }, [bindings, listeningAction, onChange]);

  return (
    <div className="border border-[#233042] bg-[#0a0f17] p-2.5 space-y-2 text-[11px] font-mono-ui">
      <div className="flex items-center justify-between gap-2">
        <span aria-live="polite" className="text-[10px] uppercase tracking-wider text-[#7a92ab]">
          {listeningAction
            ? `Нажмите новую клавишу для «${KEY_ACTION_LABELS[listeningAction]}» (Esc — отмена)`
            : 'Нажмите на действие, чтобы переназначить клавишу'}
        </span>
        <button
          type="button"
          onClick={() => {
            setListeningAction(null);
            onChange({ ...DEFAULT_KEY_BINDINGS });
          }}
          className="flex items-center gap-1 px-2 py-0.5 border border-[#2f3d50] bg-[#101824] hover:bg-[#1a2638] text-[10px] text-[#9ec0de] cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Сбросить</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {KEY_ACTIONS_ORDER.map((action) => {
          const isListening = listeningAction === action;
          return (
            <button
              key={action}
              type="button"
              aria-pressed={isListening}
              onClick={() => setListeningAction((cur) => (cur === action ? null : action))}
              className={`flex items-center justify-between px-2.5 py-1.5 border text-left transition-colors cursor-pointer ${
                isListening
                  ? 'border-[#7cd4ff] bg-[#142a40] text-white'
                  : 'border-[#1d2735] bg-[#0d131d] hover:bg-[#131c2a] text-[#b9c8d8]'
              }`}
            >
              <span className="truncate pr-2">{KEY_ACTION_LABELS[action]}</span>
              <span
                className={`px-1.5 py-0.5 border text-[10px] shrink-0 ${
                  isListening
                    ? 'border-[#7cd4ff] bg-[#091522] text-[#7cd4ff] animate-pulse'
                    : 'border-[#334559] bg-[#080d14] text-[#7cd4ff]'
                }`}
              >
                {isListening ? '...' : formatKeyCode(bindings[action])}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
