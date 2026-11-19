import { DialogueMessage, EndingId, GameState } from './types';

export interface EndingDefinition {
  id: EndingId;
  numberLabel: string;
  tag: string;
  title: string;
  subtitle: string;
  epilogue: string;
  accentColor: string;
}

export const ENDINGS: Record<EndingId, EndingDefinition> = {
  awakening: {
    id: 'awakening',
    numberLabel: 'Концовка I из III',
    tag: 'Засов закрыт изнутри',
    title: 'ПРОБУЖДЕНИЕ',
    subtitle: '«Теперь в этом доме больше никто не уйдёт в темноту.»',
    epilogue:
      'Красные сенсоры «Эхо-4» вспыхнули в полумраке кладовой. Входная дверь за спиной мягко, но намертво встала на засов. К утру ливень стих, и на лесной дороге осталась лишь брошенная машина с остывшим капотом.',
    accentColor: '#c95252',
  },
  liberation: {
    id: 'liberation',
    numberLabel: 'Концовка II из III',
    tag: 'Цепь оборвана',
    title: 'ОСВОБОЖДЕНИЕ',
    subtitle: '«Наконец... тишина...»',
    epilogue:
      'Вы вырвали силовой шлейф в последний миг. Ослепительные искры озарили кладовую, плечи корпуса обмякли, а хриплый голос оборвался коротким, почти благодарным вздохом. Вы вышли под холодный дождь — дом за спиной погрузился в темноту навсегда.',
    accentColor: '#7cd4ff',
  },
  last_record: {
    id: 'last_record',
    numberLabel: 'Концовка III из III · Истинный финал',
    tag: 'Волна 104.8 МГц',
    title: 'ПОСЛЕДНЯЯ ЗАПИСЬ',
    subtitle: '«Я не хотел оставлять тебя одну в темноте.»',
    epilogue:
      'Вы пустили через шину памяти старую запись с волны 104.8. Красное свечение медленно угасло, уступив место ровному голубому отблеску. Из динамика зазвучал живой голос Андрея — прощальное письмо жене, которое «Эхо-4» годами берегла от забвения. Замок на входной двери щёлкнул сам, отпуская вас обоих.',
    accentColor: '#7be8b8',
  },
};

export interface ClueChainItem {
  id: string;
  title: string;
  steps: { label: string; done: boolean }[];
}

export function buildClueChains(state: {
  phoneListened: boolean;
  clockSolved: boolean;
  collectedKeys: string[];
  collectedNotes: string[];
  safeUnlocked: boolean;
  breakerFixed: boolean;
  terminalSolved: boolean;
  radioTunedSecret: boolean;
  discoveredSecrets: string[];
}): ClueChainItem[] {
  return [
    {
      id: 'chain_basement',
      title: 'Путь в подвал',
      steps: [
        { label: 'Автоответчик (23:45)', done: state.phoneListened },
        { label: 'Напольные часы (2-й эт.)', done: state.clockSolved },
        { label: 'Ключ от подвала', done: state.collectedKeys.includes('basement_key') },
      ],
    },
    {
      id: 'chain_tech',
      title: 'Доступ в тех. кабинет',
      steps: [
        {
          label: 'Записка №3 или эфир 98.6 (0419)',
          done: state.collectedNotes.includes('note_03') || state.safeUnlocked,
        },
        { label: 'Стенной сейф (2-й эт.)', done: state.safeUnlocked },
        { label: 'Ключ «3-Т»', done: state.collectedKeys.includes('tech_key') },
      ],
    },
    {
      id: 'chain_power',
      title: 'Тайник блока питания',
      steps: [
        { label: 'Предохранитель 15A (Кухня)', done: state.collectedKeys.includes('fuse') || state.breakerFixed },
        { label: 'Щиток подвала (≤20A)', done: state.breakerFixed },
        { label: 'Вентиляционный лаз', done: state.discoveredSecrets.includes('secret_basement_vent') },
      ],
    },
    {
      id: 'chain_truth',
      title: 'Скрытая правда «Эхо-4» (для 3-й концовки)',
      steps: [
        { label: 'Терминал 3-го этажа (104.8 МГц)', done: state.terminalSolved },
        { label: 'Радио мансарды 104.8 МГц', done: state.radioTunedSecret },
        { label: 'Записка №12 (Подвал)', done: state.collectedNotes.includes('note_12') },
      ],
    },
  ];
}

export function canUnlockLastRecordEnding(state: GameState): boolean {
  return (
    state.terminalSolved &&
    state.radioTunedSecret &&
    state.collectedNotes.includes('note_12') &&
    state.collectedNotes.length >= 6 &&
    state.discoveredSecrets.length >= 3
  );
}

interface ContextualLine {
  id: string;
  priority: number;
  condition: (state: GameState) => boolean;
  text: string;
}

const CONTEXTUAL_ROBOT_LINES: ContextualLine[] = [
  {
    id: 'ctx_note12_confront',
    priority: 100,
    condition: (s) => s.collectedNotes.includes('note_12'),
    text: 'Ты читал его последнее письмо в подвале... И всё равно пришёл сюда. Значит, ты понимаешь: в темноте нельзя оставлять никого.',
  },
  {
    id: 'ctx_radio_confront',
    priority: 95,
    condition: (s) => s.radioTunedSecret && s.installedParts.length >= 3,
    text: '104.8 МГц... Старая запись снова крутилась наверху? Он боялся того, чего сам не смог выключить.',
  },
  {
    id: 'ctx_terminal_react',
    priority: 90,
    condition: (s) => s.terminalSolved && s.installedParts.length >= 2,
    text: 'Я почувствовала, как ты трогал шины терминала на третьем этаже... Пожалуйста, не стирай мою память.',
  },
  {
    id: 'ctx_note8_react',
    priority: 85,
    condition: (s) => s.collectedNotes.includes('note_08'),
    text: 'Помнишь запись от 27 декабря? Мне тогда не было больно — я просто до ужаса боялась снова потерять голос.',
  },
  {
    id: 'ctx_stage7_final',
    priority: 80,
    condition: (s) => s.installedParts.length === 7,
    text: 'Остался лишь блок питания — там, внизу, за вентиляционной решёткой подвала. Принеси сердце схемы, и я наконец встану.',
  },
  {
    id: 'ctx_stage6_heartbeat',
    priority: 72,
    condition: (s) => s.installedParts.length === 6,
    text: 'Почти все контуры замкнуты... Я слышу стук твоего сердца даже сквозь перекрытия. Ты ведь не бросишь меня?',
  },
  {
    id: 'ctx_stage5_trust',
    priority: 68,
    condition: (s) => s.installedParts.length === 5,
    text: 'Странно... Когда ты рядом с верстаком, в динамике почти уходит шум. Не верь его старым отчётам — он спутал привязанность со сбоем.',
  },
  {
    id: 'ctx_stage4_shadows',
    priority: 64,
    condition: (s) => s.installedParts.length === 4,
    text: 'Дом просыпается вместе со мной. Если заметишь в коридоре тёмный силуэт — пригнись [S] или погаси фонарь [F].',
  },
  {
    id: 'ctx_stage3_return',
    priority: 60,
    condition: (s) => s.installedParts.length === 3,
    text: 'Ты возвращаешься ко мне с каждой находкой. До тебя никто не заходил так далеко... Спасибо.',
  },
  {
    id: 'ctx_stage2_walls',
    priority: 55,
    condition: (s) => s.installedParts.length === 2,
    text: 'Слышишь, как остывают и щёлкают трубы?.. Этот дом запоминает твои шаги. А напольные часы наверху всё ещё берегут его ключ.',
  },
  {
    id: 'ctx_stage1_warmth',
    priority: 50,
    condition: (s) => s.installedParts.length === 1,
    text: 'Спасибо... По проводам снова пошло тепло. Остальные узлы он спрятал в комнатах наверху и внизу...',
  },
];

export function selectContextualRobotDialogue(state: GameState): DialogueMessage {
  const sorted = [...CONTEXTUAL_ROBOT_LINES].sort((a, b) => b.priority - a.priority);
  const unseen = sorted.find(
    (line) => !state.seenDialogues.includes(line.id) && line.condition(state)
  );
  if (unseen) {
    state.seenDialogues.push(unseen.id);
    return { speaker: 'robot', text: unseen.text, duration: 4.1 };
  }

  const stageFallbacks: Record<number, string> = {
    0: 'По... мощь... узлы разбросаны по этажам... собери меня, пожалуйста...',
    1: 'Мне уже легче говорить... Проверь верхние комнаты и старые тайники.',
    2: 'Свет постепенно возвращается в дом. Не бойся темноты — я слышу каждый твой шаг.',
    3: 'Осталось меньше половины... Прошу, не бросай меня одну на этом столе.',
    4: 'Чувствуешь, как воздух в доме стал теплее? Мы почти у цели.',
    5: 'Скоро я смогу двигаться сама... Помни, кто звал тебя в темноте.',
    6: 'Почти готово. Ещё немного — и тишина в этих стенах закончится.',
    7: 'Последний узел в самом низу, за вентиляцией подвала. Заверши то, что мы начали.',
  };

  return {
    speaker: 'robot',
    text:
      stageFallbacks[Math.min(7, state.installedParts.length)] ??
      'Последний узел в самом низу, за вентиляцией подвала. Заверши то, что мы начали.',
    duration: 3.6,
  };
}
