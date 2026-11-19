import React, { useState } from 'react';
import { Zap, ShieldCheck, AlertTriangle } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { GameModal } from './GameModal';

interface BreakerModalProps {
  hasFuse: boolean;
  alreadyFixed: boolean;
  onSolved: () => void;
  onClose: () => void;
}

interface SwitchItem {
  id: string;
  label: string;
  amps: number;
  defaultOn: boolean;
}

const BREAKER_SWITCHES: SwitchItem[] = [
  { id: 'lights', label: 'Дежурный свет подвала', amps: 6, defaultOn: true },
  { id: 'boiler', label: 'Насос котельной', amps: 8, defaultOn: true },
  { id: 'vent', label: 'Замок вентиляции (высокое напр.)', amps: 10, defaultOn: true },
  { id: 'bypass', label: 'Аварийный шунт разблокировки', amps: 5, defaultOn: false },
];

export const BreakerModal: React.FC<BreakerModalProps> = ({
  hasFuse,
  alreadyFixed,
  onSolved,
  onClose,
}) => {
  const [fuseInserted, setFuseInserted] = useState(alreadyFixed);
  const [switches, setSwitches] = useState<Record<string, boolean>>(() => ({
    lights: true,
    boiler: true,
    vent: !alreadyFixed,
    bypass: alreadyFixed,
  }));

  const totalAmps = BREAKER_SWITCHES.reduce(
    (sum, sw) => sum + (switches[sw.id] ? sw.amps : 0),
    0
  );
  const overloaded = totalAmps > 20;
  const ventCleared = fuseInserted && !switches.vent && switches.bypass && !overloaded;

  const toggleSwitch = (id: string) => {
    if (alreadyFixed || !fuseInserted) {
      soundEngine.playSfx('locked');
      return;
    }
    const next = { ...switches, [id]: !switches[id] };
    const nextAmps = BREAKER_SWITCHES.reduce(
      (sum, sw) => sum + (next[sw.id] ? sw.amps : 0),
      0
    );
    setSwitches(next);
    if (nextAmps > 20) {
      soundEngine.playSfx('spark');
    } else {
      soundEngine.playSfx('flashlight');
    }

    if (fuseInserted && !next.vent && next.bypass && nextAmps <= 20) {
      soundEngine.playSfx('unlock');
      onSolved();
    }
  };

  const handleInsertFuse = () => {
    if (!hasFuse || fuseInserted) return;
    soundEngine.playSfx('pickup');
    setFuseInserted(true);
  };

  return (
    <GameModal
      ariaLabel="Силовой электрощиток подвала"
      title={
        <>
          Силовой электрощиток (<span className="font-mono-ui text-sm">20А</span>)
        </>
      }
      icon={<Zap className="w-4 h-4 text-[#e0b354]" />}
      closeLabel="Закрыть щиток"
      maxWidthClass="max-w-md"
      panelClassName="border border-[#3a4659] bg-[#0a0f16] p-5 font-ui text-[#d8e2ec] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_40px_rgba(0,0,0,0.85)]"
      headerBorderClassName="border-b border-[#25303f] pb-3 mb-4"
      onClose={onClose}
    >

        <div className="mb-4 flex items-center justify-between border border-[#243040] bg-[#06090e] px-3 py-2.5 text-xs">
          <div>
            <div className="text-[#8d9eb0]">Гнездо предохранителя 15A:</div>
            <div className={fuseInserted ? 'text-[#77df9c]' : 'text-[#df7c7c]'}>
              {fuseInserted ? 'Предохранитель установлен' : hasFuse ? 'Гнездо пусто (есть в кармане)' : 'Нет предохранителя (ищите на кухне 1-го эт.)'}
            </div>
          </div>
          {!fuseInserted && (
            <button
              type="button"
              disabled={!hasFuse}
              onClick={handleInsertFuse}
              className={`px-3 py-1.5 border text-xs ${
                hasFuse
                  ? 'bg-[#2a4d6e] hover:bg-[#37648f] border-[#6698c9] text-white cursor-pointer'
                  : 'bg-[#10161e] border-[#26303d] text-[#556372] cursor-not-allowed'
              }`}
            >
              Вставить
            </button>
          )}
        </div>

        {/* Live Amperage Load Gauge (0..29A with 20A safe limit marker) */}
        <div className="mb-4 border border-[#1f2a38] bg-[#06090e] px-3 py-2">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="uppercase tracking-wider text-[#7a8ea3]">Нагрузка линии</span>
            <span
              className={`tabular-nums font-semibold ${
                overloaded ? 'text-[#ff7a7a]' : ventCleared ? 'text-[#7be8b8]' : 'text-[#8ad4ff]'
              }`}
            >
              {totalAmps}A / 20A MAX
            </span>
          </div>
          <div className="relative h-2.5 bg-[#101721] border border-[#223042] overflow-hidden">
            <div
              className="h-full transition-all duration-150"
              style={{
                width: `${Math.min(100, Math.round((totalAmps / 28) * 100))}%`,
                backgroundColor: overloaded ? '#e05a5a' : ventCleared ? '#63d494' : '#5e9fd1',
              }}
            />
            {/* 20A safe threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#e6c265]"
              style={{ left: `${Math.round((20 / 28) * 100)}%` }}
              title="Предел 20A"
            />
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {BREAKER_SWITCHES.map((sw) => {
            const on = switches[sw.id];
            return (
              <button
                key={sw.id}
                type="button"
                onClick={() => toggleSwitch(sw.id)}
                disabled={!fuseInserted || alreadyFixed}
                className={`w-full flex items-center justify-between px-3 py-2 border text-left text-xs transition-colors ${
                  !fuseInserted
                    ? 'border-[#1d2530] bg-[#090d13] text-[#596675] cursor-not-allowed'
                    : on
                    ? 'border-[#446382] bg-[#12202e] text-[#e6eff7] hover:bg-[#17293b] cursor-pointer'
                    : 'border-[#25303f] bg-[#0c1118] text-[#8d9eb0] hover:bg-[#121a24] cursor-pointer'
                }`}
              >
                <span>
                  {sw.label} <span className="text-[#788a9c]">({sw.amps}A)</span>
                </span>
                <span
                  className={`px-2 py-0.5 border text-[10px] ${
                    on
                      ? 'border-[#54a874] bg-[#132b1c] text-[#8be8ad]'
                      : 'border-[#5c3030] bg-[#1e0f10] text-[#d98484]'
                  }`}
                >
                  {on ? 'ВКЛ' : 'ВЫКЛ'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-[#25303f] pt-3 text-xs">
          <div className="flex items-center gap-2">
            {overloaded ? (
              <>
                <AlertTriangle className="w-4 h-4 text-[#ff6b6b]" />
                <span className="text-[#ff7a7a]">Перегрузка цепи: {totalAmps}A / 20A</span>
              </>
            ) : ventCleared || alreadyFixed ? (
              <>
                <ShieldCheck className="w-4 h-4 text-[#6ee097]" />
                <span className="text-[#87ebb0]">Вентиляция обесточена — путь открыт!</span>
              </>
            ) : (
              <span className="text-[#91a3b5]">
                Нагрузка: {totalAmps}A / 20A · Отключите замок и включите шунт
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-1.5 border text-xs cursor-pointer ${
              ventCleared || alreadyFixed
                ? 'bg-[#173626] hover:bg-[#1f4733] border-[#4ca674] text-[#b8f5cd] font-semibold'
                : 'bg-[#141c27] hover:bg-[#1f2b3b] border-[#324054] text-[#d8e2ec]'
            }`}
          >
            {ventCleared || alreadyFixed ? 'Закрыть и пройти' : 'Закрыть'}
          </button>
        </div>
    </GameModal>
  );
};
