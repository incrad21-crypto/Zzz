import React, { useState } from 'react';
import { Compass, Lock, MapPin, Unlock, Wrench } from 'lucide-react';
import { KeyItemId } from '../game/types';
import { getFloorName, HOUSE_ROOMS } from '../game/world';
import { GameModal } from './GameModal';

interface MapModalProps {
  currentFloor: number;
  currentRoomId: string | null;
  visitedRooms: string[];
  collectedKeys: KeyItemId[];
  discoveredSecrets: string[];
  breakerFixed: boolean;
  onClose: () => void;
}

const FLOORS_TOP_DOWN = [4, 3, 2, 1, 0];

export const MapModal: React.FC<MapModalProps> = ({
  currentFloor,
  currentRoomId,
  visitedRooms,
  collectedKeys,
  discoveredSecrets,
  breakerFixed,
  onClose,
}) => {
  const [selectedFloor, setSelectedFloor] = useState<number>(currentFloor);

  const visibleRooms = HOUSE_ROOMS.filter(
    (r) => !r.isSecret || (r.secretId && discoveredSecrets.includes(r.secretId))
  );
  const visitedCount = visibleRooms.filter((r) => visitedRooms.includes(r.id)).length;

  const accessGates = [
    {
      label: 'Спуск в подвал (1-й эт. → Подвал)',
      unlocked: collectedKeys.includes('basement_key'),
      requirement: 'Нужен ржавый ключ (часы 23:45)',
    },
    {
      label: 'Технический кабинет (3-й этаж)',
      unlocked: collectedKeys.includes('tech_key'),
      requirement: 'Нужен ключ «3-Т» (сейф 0419)',
    },
    {
      label: 'Люк на мансарду (3-й эт. → Мансарда)',
      unlocked: collectedKeys.includes('attic_crowbar'),
      requirement: 'Нужен ломик (под лестницей 1-го этажа)',
    },
    {
      label: 'Вентиляция подвала (Скрытое помещение)',
      unlocked: breakerFixed && discoveredSecrets.includes('secret_basement_vent'),
      requirement: breakerFixed ? 'Щиток переключён — осмотрите решётку' : 'Починить щиток (15A, ≤20A)',
    },
  ];

  const floorRooms = HOUSE_ROOMS.filter((r) => r.floor === selectedFloor);

  return (
    <GameModal
      ariaLabel="Чертёж дома"
      onClose={onClose}
      closeLabel="Закрыть карту"
      zIndexClass="z-30"
      maxWidthClass="max-w-3xl"
      backdropClassName="bg-black/82"
      panelClassName="bg-[#070c13] border border-[#30455e] text-[#dce6f0] p-6 shadow-[inset_0_1px_0_rgba(124,212,255,0.09),0_18px_42px_rgba(0,0,0,0.88)] font-ui"
      headerBorderClassName="border-b border-[#1c2b3d] pb-3 mb-4"
      closeButtonClassName="w-8 h-8 flex items-center justify-center border border-[#2a3c52] hover:bg-[#132030] text-[#b4c7db] cursor-pointer"
      icon={<Compass className="w-5 h-5 text-[#7cd4ff]" />}
      title={<span className="text-2xl text-[#eef5fc]">Чертёж дома</span>}
      subtitle={
        <>
          Исследовано помещений:{' '}
          <span className="font-mono-ui text-[#c2daef]">
            {visitedCount} / {visibleRooms.length}
          </span>
        </>
      }
    >

        {/* 5-floor blueprint stack */}
        <div className="space-y-2 mb-5 bg-[#050910] border border-[#1a293a] p-4">
          {FLOORS_TOP_DOWN.map((fl) => {
            const rooms = HOUSE_ROOMS.filter((r) => r.floor === fl);
            const isSelected = selectedFloor === fl;
            return (
              <div key={fl} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFloor(fl)}
                  className={`w-24 shrink-0 px-2 py-1.5 text-left text-[11px] font-mono-ui border cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-[#7cd4ff] bg-[#12263b] text-[#e6f5ff]'
                      : fl === currentFloor
                      ? 'border-[#38536e] bg-[#0b1622] text-[#a9c8e3]'
                      : 'border-[#192636] bg-[#080e16] text-[#6d8299] hover:text-[#b4c8dc]'
                  }`}
                >
                  {getFloorName(fl)}
                </button>

                <div className="flex-1 grid grid-cols-5 gap-1.5">
                  {rooms.map((room) => {
                    const isSecretHidden =
                      room.isSecret &&
                      (!room.secretId || !discoveredSecrets.includes(room.secretId));
                    const isHere = room.id === currentRoomId;
                    const visited = visitedRooms.includes(room.id);
                    const isWorkbench = room.id === 'f1_pantry';

                    if (isSecretHidden) {
                      return (
                        <div
                          key={room.id}
                          className="h-11 border border-dashed border-[#192533] bg-[#060a10] flex items-center justify-center text-[10px] font-mono-ui text-[#3a4e63]"
                        >
                          Скрыто
                        </div>
                      );
                    }

                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setSelectedFloor(fl)}
                        className={`h-11 px-1.5 border text-left flex flex-col justify-between py-1 transition-colors cursor-pointer ${
                          isHere
                            ? 'border-[#7cd4ff] bg-[#16314a] text-white shadow-[0_0_12px_rgba(124,212,255,0.22)]'
                            : visited
                            ? 'border-[#2c455e] bg-[#0d1926] text-[#bfd3e6] hover:border-[#4b7299]'
                            : 'border-[#1a2634] bg-[#090e15] text-[#5c6f82]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-ui truncate leading-tight">
                            {visited || isHere ? room.name : 'Не осмотрено'}
                          </span>
                          {isHere && <MapPin className="w-3 h-3 text-[#7cd4ff] shrink-0" />}
                          {!isHere && isWorkbench && (
                            <Wrench className="w-3 h-3 text-[#e0b354] shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] font-mono-ui opacity-75 truncate">
                          {isHere ? 'Вы здесь' : isWorkbench ? 'Верстак' : visited ? 'Осмотрено' : '—'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected floor detail + Route / Lock status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-ui">
          <div className="border border-[#1c2b3c] bg-[#09101a] p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-[#7cd4ff] mb-2">
              {getFloorName(selectedFloor)} — комнаты
            </div>
            <ul className="space-y-1.5 text-[11px]">
              {floorRooms.map((r) => {
                const hidden =
                  r.isSecret && (!r.secretId || !discoveredSecrets.includes(r.secretId));
                if (hidden) return null;
                const visited = visitedRooms.includes(r.id);
                const here = r.id === currentRoomId;
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className={here ? 'text-white font-semibold' : visited ? 'text-[#c3d5e6]' : 'text-[#5b6d80]'}>
                      • {visited || here ? r.name : 'Неисследованная комната'}
                    </span>
                    <span className="text-[10px] text-[#6d849c]">
                      {here ? 'Сейчас здесь' : visited ? '✓' : 'Закрыто туманом'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="border border-[#1c2b3c] bg-[#09101a] p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-[#9db4ca] mb-2">
              Проходы и замки
            </div>
            <ul className="space-y-2 text-[11px]">
              {accessGates.map((g) => (
                <li key={g.label} className="flex items-start gap-2">
                  {g.unlocked ? (
                    <Unlock className="w-3.5 h-3.5 text-[#6ee097] shrink-0 mt-0.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-[#d48b63] shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className={g.unlocked ? 'text-[#cdeedd]' : 'text-[#c7d4e2]'}>
                      {g.label}
                    </div>
                    {!g.unlocked && (
                      <div className="text-[10px] text-[#7a8fa4]">{g.requirement}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#1c2b3d] flex items-center justify-between text-[11px] font-mono-ui text-[#73899f]">
          <span>Подсказка: потайные комнаты появляются на чертеже только после открытия.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-[#2c4057] hover:bg-[#132131] text-xs text-[#d5e3f0] cursor-pointer"
          >
            Esc / K — закрыть
          </button>
        </div>
    </GameModal>
  );
};
