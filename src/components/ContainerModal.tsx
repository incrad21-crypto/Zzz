import React, { useEffect } from 'react';
import { BatteryCharging, BookOpen, KeyRound, PackageOpen } from 'lucide-react';
import { KEY_LABELS, LORE_NOTES, PART_BY_ID } from '../game/content';
import { KeyItemId, PartId } from '../game/types';
import { WORLD_INTERACTABLES } from '../game/world';
import { GameModal } from './GameModal';
import { PartPixelIcon } from './PartPixelIcon';

interface ContainerModalProps {
  containerId: string;
  isAlreadyLooted?: boolean;
  collectedParts: PartId[];
  installedParts: PartId[];
  collectedKeys: KeyItemId[];
  collectedNotes: string[];
  interactKeyCode?: string;
  interactKeyLabel?: string;
  reloadKeyLabel?: string;
  onCollectAll: (openNoteAfter?: boolean) => void;
  onClose: () => void;
}

export const ContainerModal: React.FC<ContainerModalProps> = ({
  containerId,
  isAlreadyLooted = false,
  collectedParts,
  installedParts,
  collectedKeys,
  collectedNotes,
  interactKeyCode = 'KeyE',
  interactKeyLabel = 'E',
  reloadKeyLabel = 'R',
  onCollectAll,
  onClose,
}) => {
  const item = WORLD_INTERACTABLES.find((i) => i.id === containerId);

  const hasPart =
    !isAlreadyLooted &&
    Boolean(item?.partId) &&
    !collectedParts.includes(item!.partId!) &&
    !installedParts.includes(item!.partId!);
  const partDef = hasPart && item?.partId ? PART_BY_ID[item.partId] : null;

  const hasKey = !isAlreadyLooted && Boolean(item?.keyId) && !collectedKeys.includes(item!.keyId!);
  const keyLabel = hasKey && item?.keyId ? KEY_LABELS[item.keyId] ?? item.keyId : null;

  const hasNote = !isAlreadyLooted && Boolean(item?.noteId) && !collectedNotes.includes(item!.noteId!);
  const noteDef = hasNote && item?.noteId ? LORE_NOTES.find((n) => n.id === item.noteId) ?? null : null;

  const batteryCount = isAlreadyLooted ? 0 : (item?.batteryCount ?? 0);
  const hasAnyLoot = Boolean(partDef || keyLabel || noteDef || batteryCount > 0);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === interactKeyCode || e.code === 'KeyE' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onCollectAll(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [interactKeyCode, item, onCollectAll]);

  if (!item) return null;

  return (
    <GameModal
      ariaLabel={`Обыск: ${item.label}`}
      title={item.label}
      icon={<PackageOpen className="w-4 h-4 text-[#7cd4ff] shrink-0" />}
      closeLabel="Закрыть контейнер"
      onClose={onClose}
    >

        {item.lootFlavor && (
          <p className="text-[13px] text-[#9fb0c2] leading-relaxed mb-4">
            {item.lootFlavor}
          </p>
        )}

        <div className="space-y-2.5 mb-5">
          {partDef && item.partId && (
            <div className="flex items-center gap-3 px-3 py-2.5 border border-[#4e789e] bg-[#0f1924]">
              <PartPixelIcon partId={item.partId} className="w-7 h-7" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#e8f4ff]">
                  Деталь механизма: {partDef.name}
                </div>
                <div className="text-xs text-[#8da8c2] leading-snug mt-0.5">
                  {partDef.description}
                </div>
              </div>
            </div>
          )}

          {keyLabel && (
            <div className="flex items-center gap-3 px-3 py-2.5 border border-[#6e5a36] bg-[#18140d]">
              <KeyRound className="w-5 h-5 text-[#e3be5d] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#f5e1a4]">{keyLabel}</div>
                <div className="text-xs text-[#ad9c78] mt-0.5">Ключевой предмет</div>
              </div>
            </div>
          )}

          {noteDef && (
            <div className="flex items-center gap-3 px-3 py-2.5 border border-[#4b5869] bg-[#10151d]">
              <BookOpen className="w-5 h-5 text-[#c7d3e0] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#eef3f8]">
                  Записка <span className="font-mono-ui">№{noteDef.number}</span>: «{noteDef.title}»
                </div>
                <div className="text-xs text-[#8594a6] mt-0.5">
                  Рукописная страница инженера
                </div>
              </div>
            </div>
          )}

          {batteryCount > 0 && (
            <div className="flex items-center gap-3 px-3 py-2.5 border border-[#365c4b] bg-[#0d1914]">
              <BatteryCharging className="w-5 h-5 text-[#6ee097] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#b8f5cd]">
                  Батарейка для фонарика (<span className="font-mono-ui">{batteryCount} шт.</span>)
                </div>
                <div className="text-xs text-[#7ea88e] mt-0.5">
                  Пополняет заряд кнопкой <span className="font-mono-ui">[{reloadKeyLabel}]</span>
                </div>
              </div>
            </div>
          )}

          {!hasAnyLoot && (
            <div className="px-3 py-4 border border-[#1f2733] bg-[#0b0f15] text-xs text-[#798899] text-center">
              {item.emptyText ?? 'Внутри пусто — только пыль и старые обрывки бумаги.'}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#1e2734] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-[#2c3645] hover:bg-[#171e29] text-xs text-[#b5c2d1] cursor-pointer"
          >
            Закрыть <span className="font-mono-ui opacity-80">[Esc]</span>
          </button>
          {noteDef && (
            <button
              type="button"
              onClick={() => onCollectAll(true)}
              className="px-3 py-1.5 bg-[#1b2938] hover:bg-[#25374a] border border-[#4c6c8c] text-xs text-[#e2eef8] cursor-pointer"
            >
              Забрать и прочитать
            </button>
          )}
          <button
            type="button"
            onClick={() => onCollectAll(false)}
            className="px-4 py-1.5 bg-[#7cd4ff] hover:bg-[#a6e3ff] text-[#070a0f] text-xs font-semibold cursor-pointer"
          >
            {hasAnyLoot ? 'Забрать всё' : 'Проверено'} <span className="font-mono-ui">[{interactKeyLabel}]</span>
          </button>
        </div>
    </GameModal>
  );
};
