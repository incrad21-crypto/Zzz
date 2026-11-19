import React, { useEffect, useRef, useState } from 'react';
import { ROBOT_PARTS } from '../game/content';
import { PartId } from '../game/types';
import { GameModal } from './GameModal';

const PART_HIGHLIGHT_ZONES: Record<PartId, { cx: number; cy: number; r: number }> = {
  head: { cx: 90, cy: 42, r: 26 },
  face_panel: { cx: 90, cy: 46, r: 18 },
  chest_panel: { cx: 90, cy: 100, r: 26 },
  power_core: { cx: 90, cy: 98, r: 16 },
  left_arm: { cx: 56, cy: 114, r: 24 },
  right_arm: { cx: 124, cy: 114, r: 24 },
  left_leg: { cx: 78, cy: 180, r: 25 },
  right_leg: { cx: 102, cy: 180, r: 25 },
};

interface AssemblyModalProps {
  collectedParts: PartId[];
  installedParts: PartId[];
  onInstallPart: (partId: PartId) => void;
  onClose: () => void;
}

export const AssemblyModal: React.FC<AssemblyModalProps> = ({
  collectedParts,
  installedParts,
  onInstallPart,
  onClose,
}) => {
  const [assemblingPartId, setAssemblingPartId] = useState<PartId | null>(null);
  const installTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (installTimerRef.current !== null) {
        window.clearTimeout(installTimerRef.current);
      }
    };
  }, []);

  const handleInstallClick = (partId: PartId) => {
    if (assemblingPartId !== null) return;
    if (installedParts.length >= 7) {
      onInstallPart(partId);
      return;
    }
    setAssemblingPartId(partId);
    installTimerRef.current = window.setTimeout(() => {
      installTimerRef.current = null;
      setAssemblingPartId(null);
      onInstallPart(partId);
    }, 320);
  };

  const count = installedParts.length;
  const indicatorColor = count >= 7 ? '#ff4b4b' : count >= 4 ? '#c76bff' : '#5cd4ff';

  const has = (id: PartId) => installedParts.includes(id) || assemblingPartId === id;

  return (
    <GameModal
      ariaLabel="Верстак — сборка Эхо-4"
      onClose={onClose}
      closeLabel="Закрыть верстак"
      zIndexClass="z-30"
      maxWidthClass="max-w-3xl"
      backdropClassName="bg-black/75"
      panelClassName="bg-[#090c12] border border-[#344154] text-[#dce4ec] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_40px_rgba(0,0,0,0.85)] font-ui"
      headerBorderClassName="border-b border-[#1d2530] pb-3 mb-5"
      closeButtonClassName="w-8 h-8 flex items-center justify-center border border-[#293342] hover:bg-[#171e29] text-[#b4c0ce] cursor-pointer"
      title={<span className="text-2xl text-[#e8eef5]">Верстак: восстановление</span>}
      subtitle={
        <span className="text-[#90a1b5]">
          Установлено узлов: <span className="font-mono-ui text-[#c7dcf0]">{count} / 8</span>
        </span>
      }
    >

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left: Anatomical feminine schematic of Echo-4 */}
          <div className="md:col-span-5 flex flex-col items-center justify-center bg-[#06080d] border border-[#1a212c] py-5 px-4">
            <svg viewBox="0 0 180 240" className="w-48 h-64" aria-hidden="true">
              {/* Surgical cradle stand & cleanly routed outer floor conduits */}
              <rect x="22" y="218" width="136" height="5" rx="1" fill="#2c3440" />
              <rect x="28" y="223" width="12" height="10" fill="#1d242e" />
              <rect x="140" y="223" width="12" height="10" fill="#1d242e" />
              <path d="M56 82 C34 115, 28 175, 30 218" stroke="#223040" strokeWidth="1.6" fill="none" strokeDasharray="3 2" />
              <path d="M124 82 C146 115, 152 175, 150 218" stroke="#3b232a" strokeWidth="1.6" fill="none" strokeDasharray="3 2" />

              {/* Back hair silhouette when head is mounted */}
              {has('head') && (
                <path
                  d="M62 42 C60 14, 120 14, 118 42 L122 82 C115 84, 110 80, 108 74 L106 50 L74 50 L72 74 C70 80, 65 84, 58 82 Z"
                  fill="#cbb97f"
                  stroke="#7c7048"
                  strokeWidth="1"
                />
              )}

              {/* Head cranium / softly rounded hair dome */}
              <path
                d="M66 40 C66 18, 114 18, 114 40 C114 57, 103 69, 90 69 C77 69, 66 57, 66 40 Z"
                fill={has('head') ? '#e6d59c' : '#141a22'}
                stroke={has('head') ? '#877b52' : '#2a3442'}
                strokeDasharray={has('head') ? undefined : '3 3'}
                strokeWidth="1.2"
              />

              {/* Oval porcelain female face mask / internal cranium */}
              <path
                d="M75 35 C75 26, 105 26, 105 35 L104 49 C104 59, 97 65, 90 65 C83 65, 76 59, 76 49 Z"
                fill={has('face_panel') ? '#eef3f7' : '#19212b'}
                stroke={has('face_panel') ? '#8e9ead' : '#313e4f'}
                strokeWidth="1.2"
              />

              {/* Swept ash-blonde bangs framing forehead & cheekbones when head is installed */}
              {has('head') && (
                <path
                  d="M70 35 C74 20, 106 20, 110 35 C103 31, 96 35, 90 29 C84 35, 77 31, 70 35 Z"
                  fill="#f2e4b3"
                />
              )}

              {/* Arched brows, almond optical eyes, nose shadow & parted lips */}
              <path d="M79 40 Q83 38 86 40" stroke={has('face_panel') ? '#6a6f7a' : '#2c3847'} strokeWidth="1" fill="none" />
              <path d="M94 40 Q97 38 101 40" stroke={has('face_panel') ? '#6a6f7a' : '#2c3847'} strokeWidth="1" fill="none" />
              <path d="M79 44 Q83 41 87 44 Q83 46 79 44 Z" fill="#0d131a" />
              <path d="M93 44 Q97 41 101 44 Q97 46 93 44 Z" fill="#0d131a" />
              <circle cx="83" cy="43.8" r="1.4" fill={indicatorColor} />
              <circle cx="97" cy="43.8" r="1.4" fill={indicatorColor} />
              <line x1="90" y1="45" x2="90" y2="51" stroke={has('face_panel') ? '#bcc7d4' : '#26313d'} strokeWidth="1" />
              {has('face_panel') ? (
                <path d="M85 56 Q90 54.5 95 56 Q90 58.2 85 56 Z" fill="#a8626b" />
              ) : (
                <line x1="86" y1="56" x2="94" y2="56" stroke="#2c3847" strokeWidth="1" />
              )}

              {/* Slender neck with hydraulic tendons & collarbones */}
              <rect x="85" y="65" width="10" height="11" rx="2" fill="#465261" />
              <line x1="88" y1="66" x2="88" y2="75" stroke="#7d8d9e" strokeWidth="1.2" />
              <line x1="92" y1="66" x2="92" y2="75" stroke="#7d8d9e" strokeWidth="1.2" />
              <path d="M62 78 Q74 73 90 75 Q106 73 118 78 L114 83 L66 83 Z" fill="#323d4a" />
              <circle cx="62" cy="82" r="4.5" fill="#526173" stroke="#28313d" strokeWidth="1" />
              <circle cx="118" cy="82" r="4.5" fill="#526173" stroke="#28313d" strokeWidth="1" />

              {/* Hourglass Female Torso Frame / Porcelain Bust Cuirass */}
              <path
                d="M66 79 C66 79, 114 79, 114 79 L111 98 C108 108, 103 114, 102 124 L78 124 C77 114, 72 108, 69 98 Z"
                fill={has('chest_panel') ? '#e3ebf2' : '#141a22'}
                stroke={has('chest_panel') ? '#8797a8' : '#3b4757'}
                strokeWidth="1.2"
              />
              {has('chest_panel') ? (
                <>
                  {/* Bust & clavicular anatomical contouring */}
                  <path d="M72 88 Q80 94 87 88" stroke="#9aa9b8" strokeWidth="1.1" fill="none" />
                  <path d="M93 88 Q100 94 108 88" stroke="#9aa9b8" strokeWidth="1.1" fill="none" />
                  <path d="M75 112 L84 114 M105 112 L96 114" stroke="#9aa9b8" strokeWidth="1" />
                </>
              ) : (
                <>
                  <path d="M73 86 Q90 89 107 86" stroke="#313e4d" strokeWidth="2.5" fill="none" />
                  <path d="M74 94 Q90 97 106 94" stroke="#313e4d" strokeWidth="2.5" fill="none" />
                  <path d="M78 112 Q90 114 102 112" stroke="#313e4d" strokeWidth="2.2" fill="none" />
                  <rect x="88" y="81" width="4" height="41" fill="#3b4859" />
                </>
              )}

              {/* Circular Heart-like Power Core Chamber */}
              <circle
                cx="90"
                cy="98"
                r="9.5"
                fill={has('power_core') ? '#0f1c26' : '#0d1117'}
                stroke="#536375"
                strokeWidth="1.5"
              />
              <circle
                cx="90"
                cy="98"
                r="6"
                fill={has('power_core') ? indicatorColor : '#131922'}
                opacity={has('power_core') ? 0.92 : 0.7}
              />
              {has('power_core') && <circle cx="88.5" cy="96.5" r="2" fill="#ffffff" opacity="0.7" />}

              {/* Slim Waist & Contoured Feminine Pelvis */}
              <rect x="78" y="124" width="24" height="7" rx="2" fill="#465363" />
              <path
                d="M76 131 L104 131 L110 143 C106 149, 98 151, 90 147 C82 151, 74 149, 70 143 Z"
                fill="#5f6f80"
                stroke="#394452"
                strokeWidth="1"
              />

              {/* Left Arm (Slender Upper Arm, Elbow Hinge, Tapered Forearm & Fingers) */}
              <g opacity={has('left_arm') ? 1 : 0.45}>
                <path
                  d="M57 83 L63 83 L60 112 L53 112 Z"
                  fill={has('left_arm') ? '#cfd9e3' : '#12171e'}
                  stroke={has('left_arm') ? '#6a7685' : '#2a3442'}
                  strokeDasharray={has('left_arm') ? undefined : '3 3'}
                />
                <circle cx="56.5" cy="113" r="3.5" fill={has('left_arm') ? '#6b7a8c' : '#232c38'} />
                <path
                  d="M53 115 L60 115 L57 143 L52 143 Z"
                  fill={has('left_arm') ? '#e0e9f2' : '#12171e'}
                  stroke={has('left_arm') ? '#6a7685' : '#2a3442'}
                  strokeDasharray={has('left_arm') ? undefined : '3 3'}
                />
                <path
                  d="M52 144 L57 144 L56 154 M54 145 L53 155 M56 145 L58 153"
                  stroke={has('left_arm') ? '#b6c4d4' : '#2a3442'}
                  strokeWidth="1.4"
                  fill="none"
                />
              </g>

              {/* Right Arm */}
              <g opacity={has('right_arm') ? 1 : 0.45}>
                <path
                  d="M117 83 L123 83 L127 112 L120 112 Z"
                  fill={has('right_arm') ? '#cfd9e3' : '#12171e'}
                  stroke={has('right_arm') ? '#6a7685' : '#2a3442'}
                  strokeDasharray={has('right_arm') ? undefined : '3 3'}
                />
                <circle cx="123.5" cy="113" r="3.5" fill={has('right_arm') ? '#6b7a8c' : '#232c38'} />
                <path
                  d="M120 115 L127 115 L128 143 L123 143 Z"
                  fill={has('right_arm') ? '#e0e9f2' : '#12171e'}
                  stroke={has('right_arm') ? '#6a7685' : '#2a3442'}
                  strokeDasharray={has('right_arm') ? undefined : '3 3'}
                />
                <path
                  d="M123 144 L128 144 L124 154 M126 145 L127 155 M124 145 L122 153"
                  stroke={has('right_arm') ? '#b6c4d4' : '#2a3442'}
                  strokeWidth="1.4"
                  fill="none"
                />
              </g>

              {/* Left Leg (Contoured Thigh, Patella Knee, Shapely Calf & Arched Foot) */}
              <g opacity={has('left_leg') ? 1 : 0.45}>
                <path
                  d="M71 146 L86 146 L83 178 L73 178 Z"
                  fill={has('left_leg') ? '#c4cfd9' : '#12171e'}
                  stroke={has('left_leg') ? '#6a7685' : '#2a3442'}
                  strokeDasharray={has('left_leg') ? undefined : '3 3'}
                />
                <circle cx="78" cy="180" r="3.8" fill={has('left_leg') ? '#687687' : '#232c38'} />
                <path
                  d="M73 183 L83 183 L81 213 L75 213 Z"
                  fill={has('left_leg') ? '#dce5ef' : '#12171e'}
                  stroke={has('left_leg') ? '#6a7685' : '#2a3442'}
                  strokeDasharray={has('left_leg') ? undefined : '3 3'}
                />
                <path
                  d="M74 213 L81 213 L82 218 L70 218 Z"
                  fill={has('left_leg') ? '#8796a6' : '#1b222c'}
                />
              </g>

              {/* Right Leg */}
              <g opacity={has('right_leg') ? 1 : 0.45}>
                <path
                  d="M94 146 L109 146 L107 178 L97 178 Z"
                  fill={has('right_leg') ? '#c4cfd9' : '#12171e'}
                  stroke={has('right_leg') ? '#6a7685' : '#2a3442'}
                  strokeDasharray={has('right_leg') ? undefined : '3 3'}
                />
                <circle cx="102" cy="180" r="3.8" fill={has('right_leg') ? '#687687' : '#232c38'} />
                <path
                  d="M97 183 L107 183 L105 213 L99 213 Z"
                  fill={has('right_leg') ? '#dce5ef' : '#12171e'}
                  stroke={has('right_leg') ? '#6a7685' : '#2a3442'}
                  strokeDasharray={has('right_leg') ? undefined : '3 3'}
                />
                <path
                  d="M99 213 L106 213 L110 218 L98 218 Z"
                  fill={has('right_leg') ? '#8796a6' : '#1b222c'}
                />
              </g>

              {assemblingPartId && (
                <g className="pointer-events-none">
                  <circle
                    cx={PART_HIGHLIGHT_ZONES[assemblingPartId].cx}
                    cy={PART_HIGHLIGHT_ZONES[assemblingPartId].cy}
                    r={PART_HIGHLIGHT_ZONES[assemblingPartId].r}
                    fill="#7cd4ff"
                    fillOpacity="0.14"
                    stroke="#7cd4ff"
                    strokeWidth="2"
                    className="animate-pulse"
                  />
                  <circle
                    cx={PART_HIGHLIGHT_ZONES[assemblingPartId].cx}
                    cy={PART_HIGHLIGHT_ZONES[assemblingPartId].cy}
                    r={PART_HIGHLIGHT_ZONES[assemblingPartId].r * 0.55}
                    fill="none"
                    stroke="#c9f0ff"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                </g>
              )}
            </svg>
            <div className="text-xs text-[#90a1b5] mt-2 font-mono-ui text-center">
              {count === 0 && 'Индикатор: едва тлеет синим'}
              {count > 0 && count <= 3 && 'Индикатор: синий · приводы вздрагивают'}
              {count >= 4 && count <= 6 && 'Индикатор: тревожный фиолетовый отблеск'}
              {count === 7 && 'Не хватает последнего узла — блока питания'}
            </div>
          </div>

          {/* Right: 8 Part Slots (ready-to-install first, then missing, then installed) */}
          <div className="md:col-span-7 space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {[...ROBOT_PARTS]
              .sort((a, b) => {
                const rank = (id: PartId) =>
                  installedParts.includes(id) ? 2 : collectedParts.includes(id) ? 0 : 1;
                return rank(a.id) - rank(b.id) || a.order - b.order;
              })
              .map((part) => {
              const isInstalled = installedParts.includes(part.id);
              const isOwned = collectedParts.includes(part.id);

              return (
                <div
                  key={part.id}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 border ${
                    isInstalled
                      ? 'bg-[#101923] border-[#2f4b66]'
                      : isOwned
                      ? 'bg-[#141c24] border-[#4e779c]'
                      : 'bg-[#0b0e14] border-[#1c232e]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#e2e9f0] truncate">
                      {part.order}. {part.name}
                    </div>
                    <div className="text-xs text-[#8898a8] truncate">
                      {isInstalled
                        ? 'Закреплено на каркасе'
                        : isOwned
                        ? 'Лежит в рюкзаке — можно ставить'
                        : `Ещё не найдено · ${part.locationHint}`}
                    </div>
                  </div>

                  {isInstalled ? (
                    <span className="text-xs text-[#7cd4ff] font-mono-ui shrink-0">Готово</span>
                  ) : assemblingPartId === part.id ? (
                    <span className="px-3 py-1.5 bg-[#193347] border border-[#7cd4ff] text-[#c7eeff] text-xs font-semibold shrink-0 animate-pulse">
                      Монтаж...
                    </span>
                  ) : isOwned ? (
                    <button
                      type="button"
                      disabled={assemblingPartId !== null}
                      onClick={() => handleInstallClick(part.id)}
                      className="px-3 py-1.5 bg-[#7cd4ff] hover:bg-[#a6e3ff] disabled:opacity-50 text-[#070b10] text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      Установить
                    </button>
                  ) : (
                    <span className="text-xs text-[#5d6c7d] font-mono-ui shrink-0">Пусто</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-[#1d2530] flex items-center justify-between text-xs text-[#8c9cad]">
          <span>Узлы можно крепить по одному по мере находок.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-[#2c3645] hover:bg-[#171e29] text-[#d5dee8] cursor-pointer"
          >
            Закрыть [Esc]
          </button>
        </div>
    </GameModal>
  );
};
