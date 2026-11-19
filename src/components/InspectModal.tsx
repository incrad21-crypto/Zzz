import React, { useEffect, useRef, useState } from 'react';
import { Check, Eye, Play, Sparkles, Volume2 } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { InspectTargetId } from '../game/types';
import { GameModal } from './GameModal';

interface InspectHotspot {
  id: string;
  label: string;
  description: string;
  secretLabel?: string;
  isPlayTape?: boolean;
}

interface InspectModalProps {
  targetId: InspectTargetId;
  installedParts: number;
  inspectedObjects: string[];
  discoveredSecrets: string[];
  onInspectHotspot: (targetId: InspectTargetId, hotspotId: string) => void;
  onClose: () => void;
}

export const InspectModal: React.FC<InspectModalProps> = ({
  targetId,
  installedParts,
  inspectedObjects,
  discoveredSecrets,
  onInspectHotspot,
  onClose,
}) => {
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [playingTape, setPlayingTape] = useState(false);
  const tapeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveHotspotId(null);
    setPlayingTape(false);
    if (tapeTimerRef.current !== null) {
      window.clearTimeout(tapeTimerRef.current);
      tapeTimerRef.current = null;
    }
  }, [targetId]);

  useEffect(() => {
    return () => {
      if (tapeTimerRef.current !== null) {
        window.clearTimeout(tapeTimerRef.current);
        tapeTimerRef.current = null;
      }
    };
  }, []);

  const stageAltered =
    (targetId === 'tv_screen' && installedParts >= 3) ||
    ((targetId === 'mirror' || targetId === 'portrait' || targetId === 'forest_car') &&
      installedParts >= 4) ||
    (targetId === 'attic_mannequin' && installedParts >= 5);

  const meta: Record<
    InspectTargetId,
    { title: string; subtitle: string; summary: string; hotspots: InspectHotspot[] }
  > = {
    phone_tape: {
      title: 'АВТООТВЕТЧИК · КАССЕТА №04',
      subtitle: 'Прихожая · 1-й этаж',
      summary:
        'Старый кассетный автоответчик с тёплым диодом записи. Плёнка уже перемотана на последнее входящее сообщение от 23:45.',
      hotspots: [
        {
          id: 'cassette_play',
          label: 'Воспроизвести запись (23:45)',
          isPlayTape: true,
          description:
            '[23:45 · Голос инженера]: «...Если часы на втором этаже снова встанут — выставь на них 23:45... Ключ от подвала спрятан под маятником...» [После щелчка — тихий женский шёпот]: «...ты ведь поможешь мне проснуться?..»',
        },
        {
          id: 'tape_counter',
          label: 'Осмотреть счётчик плёнки',
          description:
            'Механический счётчик замер на отметке «04:19» — кто-то переслушивал этот фрагмент десятки раз, пока лента не начала осыпаться.',
        },
        {
          id: 'cord_cut',
          label: 'Проверить телефонную линию',
          description:
            'Шнур к городской розетке аккуратно перекушен кусачками. Автоответчик работает исключительно от резервной батареи, а звонок пришёл изнутри дома.',
        },
      ],
    },
    mirror: {
      title: 'ЗЕРКАЛО В ПРИХОЖЕЙ',
      subtitle: 'Прихожая · 1-й этаж',
      summary: stageAltered
        ? 'Мутное стекло покрыто холодной испариной. В глубине отражения на мгновение угадывается неподвижный силуэт у двери кладовой.'
        : 'Старинное зеркало в тяжёлой деревянной раме. В комнате темно, но стекло отражает коридор с пугающей задержкой.',
      hotspots: [
        {
          id: 'glass_surface',
          label: 'Всмотреться в отражение',
          description: stageAltered
            ? 'Позади твоего плеча в отражении мелькают два тусклых красных огонька — но, обернувшись, ты видишь лишь пустой коридор.'
            : 'Стекло мутное, покрытое мелкими точками амальгамы. В полутьме кажется, что собственное отражение моргнуло на долю секунды позже тебя.',
        },
        {
          id: 'frame_scratch',
          label: 'Ощупать отставшую раму',
          secretLabel: discoveredSecrets.includes('secret_mirror_whisper')
            ? 'Тайник открыт'
            : 'Скрытая улика',
          description:
            'Под отслоившимся краем багета ножом выцарапана торопливая надпись инженера: «Она стоит здесь по ночам и учится двигать губами. Она смотрит, когда ты не смотришь».',
        },
      ],
    },
    portrait: {
      title: 'СЕМЕЙНЫЙ ПОРТРЕТ',
      subtitle: 'Гостиная · 1-й этаж',
      summary: stageAltered
        ? 'Стекло рамки треснуло по диагонали. Вместо семейного фото внутри теперь зернистый снимок пустого верстака и тени в проёме.'
        : 'Выцветшая фотография инженера и улыбающейся женщины у этого самого дома. Вторая рамка рядом исцарапана иглой.',
      hotspots: [
        {
          id: 'photo_faces',
          label: 'Рассмотреть лица на снимке',
          description: stageAltered
            ? 'Чем дольше смотришь на чёрно-белую тень в дверном проёме кладовой, тем отчётливее кажется, что фигура сделала полшага ближе к краю снимка.'
            : 'Светлые волосы женщины, линия скул и чуть застывшая полуулыбка... Они пугающе точно совпадают с очертаниями маски «Эхо-4».',
        },
        {
          id: 'back_inscription',
          label: 'Заглянуть на оборот рамки',
          description:
            'На картонном заднике химическим карандашом написано: «Марина, октябрь. Прости, что не смог отпустить тишину в этом доме».',
        },
      ],
    },
    tv_screen: {
      title: 'СТАРЫЙ КИНЕСКОПНЫЙ ТЕЛЕВИЗОР',
      subtitle: 'Гостиная · 1-й этаж',
      summary: stageAltered
        ? 'Экран шипит холодным белым шумом, хотя сетевая вилка давно выдернута. В ряби помех проступают очертания женского силуэта.'
        : 'Пыльный корпус с деревянной облицовкой. Кинескоп мёртв, но стекло всё ещё хранит слабый статический заряд.',
      hotspots: [
        {
          id: 'crt_glass',
          label: 'Присмотреться к экрану',
          description: stageAltered
            ? 'Сквозь снег помех проступает изображение этой самой гостиной — снятое сверху, будто из угла под потолком. На экране ты стоишь прямо перед телевизором.'
            : 'На тёмном выпуклом стекле видны тонкие отпечатки ладоней. Слишком ровные, без линий кожи.',
        },
        {
          id: 'power_cord',
          label: 'Проверить шнур питания',
          description:
            'Кабель питания вырван из розетки с корнем и валяется на ковре. Питание на экран физически не может поступать.',
        },
      ],
    },
    attic_mannequin: {
      title: 'ПОРТНОВСКИЙ МАНЕКЕН',
      subtitle: 'Мансарда · 4-й этаж',
      summary: stageAltered
        ? 'Манекен точно стоял в дальнем углу. Сейчас он развёрнут корпусом к чердачному люку, словно прислушивается к шагам на лестнице.'
        : 'Старый деревянный манекен, использовавшийся инженером для примерки внешней полимерной оболочки прототипа.',
      hotspots: [
        {
          id: 'chalk_marks',
          label: 'Изучить меловую разметку',
          description:
            'Углём и мелом отмечены точки крепления шарниров: «C-04-L / C-04-R», осевой баланс плеч и скрытый замок лицевой панели.',
        },
        {
          id: 'collar_badge',
          label: 'Проверить шов под воротником',
          secretLabel: discoveredSecrets.includes('secret_attic_badge')
            ? 'Тайник открыт'
            : 'Скрытая улика',
          description:
            'Под потёртой тесьмой зашита алюминиевая бирка «ПРОТОТИП «ЭХО-03» · СПИСАН». Значит, «Эхо-4» была далеко не первой попыткой...',
        },
      ],
    },
    forest_car: {
      title: 'ЗАГЛОХШИЙ АВТОМОБИЛЬ',
      subtitle: 'Ночная лесная дорога',
      summary: stageAltered
        ? 'Дождь стекает по холодному капоту. На запотевшем лобовом стекле изнутри салона проявилась свежая надпись пальцем.'
        : 'Поднятый капот пахнет сыростью и подпалённой изоляцией. Машина мертва — в глуши связи нет.',
      hotspots: [
        {
          id: 'engine_bay',
          label: 'Осмотреть стартер и клеммы',
          description:
            'Аккумулятор разряжен в ноль, будто что-то вытянуло весь заряд за считаные секунды. Проводка цела, но реле зажигания сплавилось.',
        },
        {
          id: 'windshield_note',
          label: 'Осмотреть лобовое стекло',
          description: stageAltered
            ? 'На стекле с внутренней стороны чёткими печатными буквами выведено: «ВОЗВРАЩАЙСЯ В КЛАДОВУЮ. НЕ БРОСАЙ МЕНЯ».'
            : 'Стекло залито ночным ливнем. Сквозь ветви впереди горит единственное тусклое окно старого дома.',
        },
      ],
    },
  };

  const current = meta[targetId];
  const selectedHotspot =
    current.hotspots.find((h) => h.id === activeHotspotId) ?? current.hotspots[0];

  const handleSelectHotspot = (hotspot: InspectHotspot) => {
    setActiveHotspotId(hotspot.id);
    if (tapeTimerRef.current !== null) {
      window.clearTimeout(tapeTimerRef.current);
      tapeTimerRef.current = null;
    }
    if (hotspot.isPlayTape) {
      setPlayingTape(true);
      soundEngine.playTapePlayback(1);
      tapeTimerRef.current = window.setTimeout(() => {
        tapeTimerRef.current = null;
        setPlayingTape(false);
      }, 1800);
    } else {
      setPlayingTape(false);
      soundEngine.playSfx('paper');
    }
    onInspectHotspot(targetId, hotspot.id);
  };

  useEffect(() => {
    const spots = meta[targetId].hotspots;
    const onKey = (e: KeyboardEvent) => {
      const idx = e.key === '1' ? 0 : e.key === '2' ? 1 : e.key === '3' ? 2 : -1;
      if (idx >= 0 && spots[idx]) {
        e.preventDefault();
        e.stopPropagation();
        const spot = spots[idx];
        setActiveHotspotId(spot.id);
        if (tapeTimerRef.current !== null) {
          window.clearTimeout(tapeTimerRef.current);
          tapeTimerRef.current = null;
        }
        if (spot.isPlayTape) {
          setPlayingTape(true);
          soundEngine.playTapePlayback(1);
          tapeTimerRef.current = window.setTimeout(() => {
            tapeTimerRef.current = null;
            setPlayingTape(false);
          }, 1800);
        } else {
          setPlayingTape(false);
          soundEngine.playSfx('paper');
        }
        onInspectHotspot(targetId, spot.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [targetId, onInspectHotspot]);

  return (
    <GameModal
      ariaLabel={`Осмотр: ${current.title}`}
      onClose={onClose}
      closeLabel="Закрыть осмотр"
      zIndexClass="z-40"
      maxWidthClass="max-w-2xl"
      backdropClassName="bg-black/84"
      panelClassName="bg-[#070b11] border border-[#38495e] text-[#dce5ee] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_50px_rgba(0,0,0,0.9)] font-ui"
      headerBorderClassName="border-b border-[#1d2836] pb-3 mb-4"
      closeButtonClassName="w-8 h-8 flex items-center justify-center border border-[#2b3748] hover:bg-[#17202d] text-[#b4c2d1] cursor-pointer"
      icon={<Eye className="w-4 h-4 text-[#7cd4ff]" />}
      title={<span className="text-lg md:text-xl text-[#eef4fa] leading-tight">{current.title}</span>}
      subtitle={<span className="text-[11px] text-[#8396ab]">{current.subtitle}</span>}
    >

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Pixel-Art Close-Up SVG Canvas */}
          <div className="md:col-span-6 border border-[#243242] bg-[#04070b] p-3 flex flex-col justify-between">
            <svg
              viewBox="0 0 180 120"
              className="w-full h-auto border border-[#18222e] bg-[#090e16]"
              style={{ imageRendering: 'pixelated' }}
              aria-label={current.title}
            >
              {targetId === 'phone_tape' && (
                <>
                  <rect x="18" y="22" width="144" height="78" fill="#1d242e" stroke="#455569" strokeWidth="2" />
                  <rect x="28" y="32" width="90" height="42" fill="#0d131a" stroke="#2c3a4c" />
                  {/* Twin spinning reels */}
                  <circle cx="52" cy="53" r="11" fill="#1b2633" stroke="#8097b0" strokeWidth="1.5" />
                  <circle cx="94" cy="53" r="11" fill="#1b2633" stroke="#8097b0" strokeWidth="1.5" />
                  <rect
                    x="50"
                    y="45"
                    width="4"
                    height="16"
                    fill="#d4a65a"
                    className={playingTape ? 'animate-spin origin-[52px_53px]' : ''}
                  />
                  <rect
                    x="92"
                    y="45"
                    width="4"
                    height="16"
                    fill="#d4a65a"
                    className={playingTape ? 'animate-spin origin-[94px_53px]' : ''}
                  />
                  {/* Tape counter & LED */}
                  <rect x="126" y="34" width="28" height="14" fill="#070a0f" stroke="#2e3d4f" />
                  <text x="130" y="44" fill="#8ce8b0" fontSize="7" fontFamily="monospace">
                    23:45
                  </text>
                  <circle
                    cx="140"
                    cy="62"
                    r="4"
                    fill={playingTape ? '#5bd98b' : '#e05252'}
                    className="animate-pulse"
                  />
                  {/* Waveform bars */}
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
                    const h = playingTape ? 5 + ((i * 7 + 3) % 12) : 2;
                    return (
                      <rect
                        key={i}
                        x={30 + i * 9}
                        y={88 - h}
                        width="5"
                        height={h}
                        fill={playingTape ? '#7cd4ff' : '#314254'}
                      />
                    );
                  })}
                </>
              )}

              {targetId === 'mirror' && (
                <>
                  <rect x="38" y="10" width="104" height="100" fill="#4f3e2e" stroke="#755d45" strokeWidth="3" />
                  <rect x="46" y="18" width="88" height="84" fill="#233240" />
                  {/* Reflection corridor lines */}
                  <rect x="52" y="24" width="76" height="72" fill="#17232e" />
                  <rect x="66" y="36" width="48" height="60" fill="#0e161f" />
                  {/* Crack & sheen */}
                  <line x1="54" y1="26" x2="66" y2="54" stroke="rgba(210,235,255,0.25)" strokeWidth="1.5" />
                  <line x1="118" y1="74" x2="132" y2="92" stroke="rgba(210,235,255,0.22)" strokeWidth="1" />
                  {stageAltered && (
                    <>
                      <rect x="82" y="48" width="16" height="44" fill="#080a0f" />
                      <rect x="85" y="40" width="10" height="10" fill="#080a0f" />
                      <rect x="87" y="44" width="2" height="2" fill="#ff4747" />
                      <rect x="91" y="44" width="2" height="2" fill="#ff4747" />
                    </>
                  )}
                  {/* Loose frame corner highlight */}
                  <rect x="38" y="84" width="6" height="14" fill="#8f6c47" />
                </>
              )}

              {targetId === 'portrait' && (
                <>
                  <rect x="28" y="14" width="124" height="92" fill="#4a3a2a" stroke="#755e46" strokeWidth="3" />
                  <rect x="36" y="22" width="108" height="76" fill={stageAltered ? '#140b0d' : '#635b4f'} />
                  {stageAltered ? (
                    <>
                      <rect x="48" y="68" width="84" height="8" fill="#3a2526" />
                      <rect x="108" y="30" width="20" height="48" fill="#090608" />
                      <rect x="114" y="40" width="3" height="3" fill="#ff4a4a" />
                      <rect x="120" y="40" width="3" height="3" fill="#ff4a4a" />
                      <line x1="42" y1="24" x2="136" y2="94" stroke="#855a5e" strokeWidth="1" />
                    </>
                  ) : (
                    <>
                      {/* Engineer silhouette */}
                      <rect x="58" y="44" width="20" height="44" fill="#2b2620" />
                      <rect x="62" y="30" width="12" height="14" fill="#b39c82" />
                      {/* Woman silhouette with scratched face */}
                      <rect x="94" y="48" width="20" height="40" fill="#3a332b" />
                      <rect x="98" y="34" width="12" height="14" fill="#c7b299" />
                      <line x1="97" y1="36" x2="111" y2="46" stroke="#241c16" strokeWidth="1.5" />
                      <line x1="111" y1="36" x2="97" y2="46" stroke="#241c16" strokeWidth="1.5" />
                    </>
                  )}
                </>
              )}

              {targetId === 'tv_screen' && (
                <>
                  <rect x="22" y="18" width="136" height="86" fill="#3b3026" stroke="#615040" strokeWidth="2" />
                  <rect x="32" y="28" width="92" height="66" fill={stageAltered ? '#263645' : '#11161c'} stroke="#222a33" strokeWidth="2" />
                  {stageAltered ? (
                    <>
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
                        <rect
                          key={row}
                          x={36 + ((row * 17) % 24)}
                          y={32 + row * 8}
                          width={46}
                          height="2"
                          fill="rgba(190,220,245,0.35)"
                        />
                      ))}
                      <rect x="68" y="44" width="18" height="44" fill="rgba(8,12,18,0.75)" />
                      <rect x="72" y="36" width="10" height="10" fill="rgba(8,12,18,0.75)" />
                      <rect x="74" y="40" width="2" height="2" fill="#8ad8ff" />
                      <rect x="78" y="40" width="2" height="2" fill="#8ad8ff" />
                    </>
                  ) : (
                    <line x1="42" y1="38" x2="62" y2="54" stroke="rgba(160,185,205,0.16)" strokeWidth="2" />
                  )}
                  {/* Knobs */}
                  <circle cx="141" cy="44" r="6" fill="#231c17" stroke="#7d6c5a" />
                  <circle cx="141" cy="64" r="6" fill="#231c17" stroke="#7d6c5a" />
                  <rect x="134" y="78" width="14" height="10" fill="#1a1410" />
                </>
              )}

              {targetId === 'attic_mannequin' && (
                <>
                  {/* Tripod wood pedestal */}
                  <rect x="87" y="84" width="6" height="24" fill="#4f3e2e" />
                  <polygon points="90,103 65,112 72,113 90,107 108,113 115,112" fill="#5e4b38" />
                  {/* Slender neck & turned wooden finial */}
                  <rect x="85" y="25" width="10" height="10" rx="2" fill="#7d6b52" />
                  <ellipse cx="90" cy="21" rx="7" ry="6" fill="#6d5c45" stroke="#4f4030" strokeWidth="1" />
                  {/* Feminine hourglass dressmaker bust */}
                  <path
                    d="M71 38 Q90 32 109 38 L106 54 Q100 62 98 70 L105 84 Q90 88 75 84 L82 70 Q80 62 74 54 Z"
                    fill="#9c896c"
                    stroke="#5e503d"
                    strokeWidth="1.6"
                  />
                  {/* Bust & waist chalk engineering lines */}
                  <path d="M74 49 Q82 54 89 49 M91 49 Q98 54 106 49" stroke="#e4eef7" strokeWidth="1" strokeDasharray="3 2" fill="none" />
                  <line x1="90" y1="36" x2="90" y2="84" stroke="#e4eef7" strokeWidth="1" strokeDasharray="3 2" />
                  <line x1="78" y1="68" x2="102" y2="68" stroke="#d4a65a" strokeWidth="1" strokeDasharray="2 2" />
                  {/* Hidden collar badge */}
                  <rect x="84" y="33" width="12" height="4.5" fill="#d4aa4c" stroke="#614a1a" strokeWidth="0.6" />
                </>
              )}

              {targetId === 'forest_car' && (
                <>
                  <rect x="16" y="54" width="148" height="44" fill="#314052" stroke="#526780" strokeWidth="2" />
                  <polygon points="36,54 54,24 126,24 144,54" fill="#182534" stroke="#526780" strokeWidth="2" />
                  {stageAltered ? (
                    <>
                      <text x="48" y="42" fill="#b8d9f5" fontSize="7" fontFamily="monospace">
                        ВОЗВРАЩАЙСЯ
                      </text>
                      <text x="54" y="50" fill="#b8d9f5" fontSize="6" fontFamily="monospace">
                        В КЛАДОВУЮ
                      </text>
                    </>
                  ) : (
                    <>
                      <line x1="58" y1="28" x2="52" y2="48" stroke="rgba(160,195,225,0.35)" strokeWidth="1" />
                      <line x1="98" y1="28" x2="92" y2="48" stroke="rgba(160,195,225,0.35)" strokeWidth="1" />
                    </>
                  )}
                  <rect x="26" y="66" width="22" height="10" fill="#6b5c3b" />
                  <rect x="132" y="66" width="22" height="10" fill="#6b5c3b" />
                </>
              )}
            </svg>

            <p className="text-xs leading-relaxed text-[#9cb0c4] mt-3">{current.summary}</p>
          </div>

          {/* Interactive Hotspots & Detail Reader */}
          <div className="md:col-span-6 flex flex-col justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium text-[#7a8fa6] mb-2">
                Точки осмотра
              </div>
              <div className="space-y-1.5">
                {current.hotspots.map((spot) => {
                  const isActive = selectedHotspot?.id === spot.id;
                  const seen = inspectedObjects.includes(`${targetId}:${spot.id}`);
                  return (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => handleSelectHotspot(spot)}
                      className={`w-full text-left px-3 py-2 border text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#132030] border-[#6194bd] text-white'
                          : 'bg-[#0b1018] border-[#222f40] text-[#b4c4d4] hover:bg-[#101824]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {spot.isPlayTape ? (
                          playingTape ? (
                            <Volume2 className="w-3.5 h-3.5 text-[#6ee097] animate-pulse shrink-0" />
                          ) : (
                            <Play className="w-3.5 h-3.5 text-[#7cd4ff] shrink-0" />
                          )
                        ) : seen ? (
                          <Check className="w-3.5 h-3.5 text-[#6ee097] shrink-0" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-[#d4aa4c] shrink-0" />
                        )}
                        <span>{spot.label}</span>
                      </span>
                      {spot.secretLabel && (
                        <span className="text-[10px] px-1.5 py-0.5 border border-[#4a6957] bg-[#0f2419] text-[#8be8b3]">
                          {spot.secretLabel}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedHotspot && (
              <div className="border border-[#243242] bg-[#0b1017] p-3.5 min-h-[115px]">
                <div className="text-[11px] font-medium text-[#7cd4ff] mb-1.5">
                  {selectedHotspot.label}
                </div>
                <p className="text-[13px] leading-relaxed text-[#d3dfeb]">
                  {selectedHotspot.description}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#1d2836] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-[#304054] bg-[#101722] hover:bg-[#192434] text-xs text-[#dce5ee] cursor-pointer"
          >
            Отойти <span className="font-mono-ui opacity-80">[Esc]</span>
          </button>
        </div>
    </GameModal>
  );
};
