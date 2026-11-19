import React, { useState } from 'react';
import { BatteryCharging, Disc, KeyRound, Search, Wrench } from 'lucide-react';
import {
  AUDIO_TAPES,
  KEY_DESCRIPTIONS,
  KEY_LABELS,
  KEY_ORIGINS,
  ROBOT_PARTS,
  SECRETS,
} from '../game/content';
import { AudioTapeId, KeyItemId, PartId } from '../game/types';
import { GameModal } from './GameModal';
import { PartPixelIcon } from './PartPixelIcon';

interface InventoryModalProps {
  collectedParts: PartId[];
  installedParts: PartId[];
  collectedKeys: KeyItemId[];
  collectedTapes: AudioTapeId[];
  discoveredSecrets: string[];
  flashlightBattery: number;
  batteries: number;
  onReloadBattery: () => void;
  onClose: () => void;
}

type InventoryTab = 'overview' | 'parts' | 'gear' | 'secrets';

export const InventoryModal: React.FC<InventoryModalProps> = ({
  collectedParts,
  installedParts,
  collectedKeys,
  collectedTapes,
  discoveredSecrets,
  flashlightBattery,
  batteries,
  onReloadBattery,
  onClose,
}) => {
  const [tab, setTab] = useState<InventoryTab>('overview');
  const batPct = Math.round(flashlightBattery);

  return (
    <GameModal
      ariaLabel="Инвентарь"
      onClose={onClose}
      closeLabel="Закрыть инвентарь"
      zIndexClass="z-30"
      maxWidthClass="max-w-3xl"
      panelClassName="bg-[#070a0f] border border-[#344154] text-[#dce4ec] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_40px_rgba(0,0,0,0.85)] font-ui"
      headerBorderClassName="border-b border-[#1c232e] pb-3 mb-4"
      closeButtonClassName="w-8 h-8 flex items-center justify-center border border-[#293342] hover:bg-[#171e29] text-[#b4c0ce] cursor-pointer"
      title={<span className="text-2xl text-[#eef3f8]">Инвентарь</span>}
      headerExtra={
        <div className="flex flex-wrap items-center gap-1 bg-[#0e131b] p-1 border border-[#212b38] font-ui">
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={`px-2.5 py-1 text-xs cursor-pointer ${
              tab === 'overview' ? 'bg-[#202b3a] text-white' : 'text-[#7e8d9e] hover:text-white'
            }`}
          >
            Обзор
          </button>
          <button
            type="button"
            onClick={() => setTab('parts')}
            className={`px-2.5 py-1 text-xs cursor-pointer flex items-center gap-1 ${
              tab === 'parts' ? 'bg-[#202b3a] text-[#8ad8ff]' : 'text-[#7e8d9e] hover:text-white'
            }`}
          >
            <Wrench className="w-3 h-3" />
            <span>Детали <span className="font-mono-ui">({installedParts.length + collectedParts.length}/8)</span></span>
          </button>
          <button
            type="button"
            onClick={() => setTab('gear')}
            className={`px-2.5 py-1 text-xs cursor-pointer flex items-center gap-1 ${
              tab === 'gear' ? 'bg-[#202b3a] text-[#f2cf88]' : 'text-[#7e8d9e] hover:text-white'
            }`}
          >
            <KeyRound className="w-3 h-3" />
            <span>Ключи и кассеты</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('secrets')}
            className={`px-2.5 py-1 text-xs cursor-pointer flex items-center gap-1 ${
              tab === 'secrets' ? 'bg-[#202b3a] text-[#8ce8b0]' : 'text-[#7e8d9e] hover:text-white'
            }`}
          >
            <Search className="w-3 h-3" />
            <span>Тайники <span className="font-mono-ui">({discoveredSecrets.length}/{SECRETS.length})</span></span>
          </button>
        </div>
      }
    >

        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-medium text-[#8a9bae] mb-3">
                Детали механизма (<span className="font-mono-ui">{installedParts.length + collectedParts.length} / 8</span>)
              </div>
              <div className="space-y-1.5">
                {ROBOT_PARTS.map((part) => {
                  const isInstalled = installedParts.includes(part.id);
                  const isOwned = collectedParts.includes(part.id);
                  return (
                    <div
                      key={part.id}
                      className={`flex items-center justify-between px-3 py-2 border text-xs ${
                        isInstalled
                          ? 'bg-[#0e1821] border-[#33536e] text-[#c4e6ff]'
                          : isOwned
                          ? 'bg-[#141c24] border-[#618fb5] text-[#f0f5fa]'
                          : 'bg-[#0b0e13] border-[#1f2835] text-[#788799]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PartPixelIcon
                          partId={part.id}
                          dimmed={!isInstalled && !isOwned}
                          className="w-5 h-5"
                        />
                        <span className="truncate font-medium">
                          {isInstalled || isOwned ? part.name : `${part.order}. Узел не найден`}
                        </span>
                      </div>
                      <span className="font-mono-ui shrink-0">
                        {isInstalled ? 'Установлено' : isOwned ? 'В рюкзаке' : 'Отсутствует'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4">
              <div className="border border-[#273445] bg-[#0a1018] p-3">
                <div className="flex items-center justify-between text-xs font-mono-ui mb-2">
                  <span className="text-[#9cb2c9]">Питание фонарика</span>
                  <span className={batPct <= 22 ? 'text-[#f09b6c]' : 'text-[#8ce8b0]'}>
                    {batPct}% · Запасных: {batteries} шт.
                  </span>
                </div>
                <div className="w-full h-2 bg-[#141b24] border border-[#253140] overflow-hidden mb-2.5">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${batPct}%`,
                      backgroundColor: batPct <= 22 ? '#d98454' : '#7cd4ff',
                    }}
                  />
                </div>
                <button
                  type="button"
                  disabled={batteries <= 0 || batPct >= 94}
                  onClick={onReloadBattery}
                  className={`w-full py-1.5 border text-xs font-mono-ui flex items-center justify-center gap-1.5 ${
                    batteries > 0 && batPct < 94
                      ? 'bg-[#13291d] hover:bg-[#1b3a29] border-[#43785a] text-[#9ee8be] cursor-pointer'
                      : 'bg-[#0e131b] border-[#222a36] text-[#5e6c7c] cursor-not-allowed'
                  }`}
                >
                  <BatteryCharging className="w-3.5 h-3.5" />
                  Заменить батарейку [R]
                </button>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider text-[#7e8d9e] mb-2 font-mono-ui">
                  Ключи и снаряжение ({collectedKeys.length})
                </div>
                {collectedKeys.length === 0 ? (
                  <div className="text-xs text-[#596573] border border-[#19202a] bg-[#0b0e13] p-3">
                    Пока нет важных предметов.
                  </div>
                ) : (
                  <ul className="space-y-1.5 max-h-[145px] overflow-y-auto pr-1">
                    {collectedKeys.map((key) => (
                      <li
                        key={key}
                        className="px-3 py-2 bg-[#10161e] border border-[#2c3847] text-xs text-[#dde5ed]"
                      >
                        <div className="font-medium">{KEY_LABELS[key] ?? key}</div>
                        {KEY_DESCRIPTIONS[key] && (
                          <div className="text-[11px] text-[#7f8f9e] mt-0.5 leading-snug">
                            {KEY_DESCRIPTIONS[key]}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono-ui text-xs">
                <div className="border border-[#1f2936] bg-[#0a0f16] p-2.5">
                  <div className="text-[10px] text-[#7e8d9e]">Аудиокассеты</div>
                  <div className="text-sm text-[#f2cf88] mt-0.5">{collectedTapes.length} / 4</div>
                </div>
                <div className="border border-[#1f2936] bg-[#0a0f16] p-2.5">
                  <div className="text-[10px] text-[#7e8d9e]">Тайники</div>
                  <div className="text-sm text-[#8ce8b0] mt-0.5">
                    {discoveredSecrets.length} / {SECRETS.length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'parts' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
            {ROBOT_PARTS.map((part) => {
              const isInstalled = installedParts.includes(part.id);
              const isOwned = collectedParts.includes(part.id);
              const known = isInstalled || isOwned;
              return (
                <div
                  key={part.id}
                  className={`p-3 border text-xs ${
                    isInstalled
                      ? 'bg-[#0e1821] border-[#33536e] text-[#c4e6ff]'
                      : isOwned
                      ? 'bg-[#141c24] border-[#618fb5] text-[#f0f5fa]'
                      : 'bg-[#0b0e13] border-[#1f2835] text-[#6d7c8e]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <PartPixelIcon partId={part.id} dimmed={!known} className="w-5 h-5" />
                      <span>{known ? part.name : `${part.order}. Неизвестный узел`}</span>
                    </div>
                    <span className="font-mono-ui text-[10px]">
                      {isInstalled ? 'Установлено' : isOwned ? 'В рюкзаке' : 'Не найдено'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-85 leading-relaxed">
                    {known
                      ? part.description
                      : 'Исследуйте этажи дома, закрытые ящики и потайные ниши.'}
                  </p>
                  {known && (
                    <div className="text-[10px] font-mono-ui text-[#7c9ab5] mt-1.5">
                      Место находки: {part.locationHint}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'gear' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[360px] overflow-y-auto pr-1">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#7e8d9e] mb-2 font-mono-ui">
                Ключи и инструменты ({collectedKeys.length})
              </div>
              {collectedKeys.length === 0 ? (
                <div className="text-xs text-[#596573] border border-[#19202a] bg-[#0b0e13] p-3">
                  Снаряжение пока не найдено.
                </div>
              ) : (
                <div className="space-y-2">
                  {collectedKeys.map((key) => {
                    const meta = KEY_ORIGINS[key];
                    return (
                      <div
                        key={key}
                        className="p-3 bg-[#10161e] border border-[#2c3847] text-xs"
                      >
                        <div className="font-semibold text-[#eef3f8]">{KEY_LABELS[key] ?? key}</div>
                        <div className="text-[11px] text-[#9eb0c2] mt-1">
                          {KEY_DESCRIPTIONS[key]}
                        </div>
                        {meta && (
                          <div className="mt-1.5 pt-1.5 border-t border-[#1d2734] text-[10px] font-mono-ui text-[#7da3c4] space-y-0.5">
                            <div>Найдено: {meta.origin}</div>
                            <div>Назначение: {meta.unlocks}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-[#b8975c] mb-2 font-mono-ui flex items-center gap-1.5">
                <Disc className="w-3.5 h-3.5" />
                <span>Аудиокассеты ({collectedTapes.length} / 4)</span>
              </div>
              <div className="space-y-2">
                {AUDIO_TAPES.map((tape) => {
                  const owned = collectedTapes.includes(tape.id);
                  return (
                    <div
                      key={tape.id}
                      className={`p-3 border text-xs ${
                        owned
                          ? 'bg-[#17130d] border-[#6e5833] text-[#f0dec0]'
                          : 'bg-[#0a0d12] border-[#1a222d] text-[#556372]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono-ui text-[10px]">
                        <span>Кассета №{tape.number}</span>
                        <span>{owned ? tape.timestamp : 'Не найдено'}</span>
                      </div>
                      <div className="font-semibold mt-0.5">
                        {owned ? tape.title : 'Запись не найдена'}
                      </div>
                      {owned && (
                        <div className="text-[10px] text-[#bfa77e] mt-1">
                          {tape.clueLink} · Прослушивание в журнале [J]
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'secrets' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
            {SECRETS.map((sec) => {
              const found = discoveredSecrets.includes(sec.id);
              return (
                <div
                  key={sec.id}
                  className={`p-3 border text-xs ${
                    found
                      ? 'bg-[#0c1a15] border-[#31634c] text-[#d0f0df]'
                      : 'bg-[#0a0d12] border-[#1a222d] text-[#566473]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-mono-ui text-[10px]">
                    <span>{sec.floorLabel}</span>
                    <span>{found ? 'Открыт' : 'Скрыт'}</span>
                  </div>
                  <div className="font-semibold mt-0.5">{found ? sec.name : 'Неизвестный тайник'}</div>
                  <p className="text-[11px] mt-1 leading-relaxed opacity-85">
                    {found
                      ? sec.description
                      : 'Осматривайте картины, зеркала, шкафы, манекены и вентиляционные решётки.'}
                  </p>
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
            Esc — закрыть
          </button>
        </div>
    </GameModal>
  );
};
