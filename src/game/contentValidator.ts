import {
  ALL_NOTES,
  AUDIO_TAPES,
  INSPECT_OBJECT_CATALOG,
  KEY_LABELS,
  LORE_NOTES,
  PART_BY_ID,
  ROOM_RADIO_SIGNALS,
  SECRETS,
} from './content';
import {
  FLOOR_BOUNDS,
  FOREST_MAX_X,
  FOREST_MIN_X,
  HOUSE_FLOOR_Y,
  HOUSE_PROPS,
  HOUSE_ROOMS,
  WORLD_INTERACTABLES,
} from './world';

export interface ContentValidationReport {
  valid: boolean;
  errors: string[];
  stats: {
    rooms: number;
    props: number;
    interactables: number;
    coreNotes: number;
    totalNotes: number;
    parts: number;
    secrets: number;
    tapes: number;
    radioSignals: number;
  };
}

export function validateGameContent(): ContentValidationReport {
  const errors: string[] = [];

  const noteIds = new Set<string>();
  for (const n of ALL_NOTES) {
    if (noteIds.has(n.id)) errors.push(`Duplicate note ID: ${n.id}`);
    noteIds.add(n.id);
  }

  const secretIds = new Set<string>();
  for (const s of SECRETS) {
    if (secretIds.has(s.id)) errors.push(`Duplicate secret ID: ${s.id}`);
    secretIds.add(s.id);
  }

  const tapeIds = new Set<string>(AUDIO_TAPES.map((t) => t.id));
  const partIds = new Set<string>(Object.keys(PART_BY_ID));
  const keyIds = new Set<string>(Object.keys(KEY_LABELS));
  const inspectIds = new Set<string>(INSPECT_OBJECT_CATALOG.map((e) => e.id));

  const roomIds = new Set<string>();
  const roomById = new Map<string, (typeof HOUSE_ROOMS)[number]>();
  for (const r of HOUSE_ROOMS) {
    if (roomIds.has(r.id)) errors.push(`Duplicate room ID: ${r.id}`);
    roomIds.add(r.id);
    roomById.set(r.id, r);
    if (!(r.floor in HOUSE_FLOOR_Y)) {
      errors.push(`Room ${r.id} has invalid floor ${r.floor}`);
    }
    if (r.width <= 0) {
      errors.push(`Room ${r.id} has non-positive width ${r.width}`);
    }
    if (r.windowX !== undefined && (r.windowX < r.x || r.windowX > r.x + r.width)) {
      errors.push(`Room ${r.id} windowX=${r.windowX} outside room [${r.x}, ${r.x + r.width}]`);
    }
    if (r.lampX !== undefined && (r.lampX < r.x || r.lampX > r.x + r.width)) {
      errors.push(`Room ${r.id} lampX=${r.lampX} outside room [${r.x}, ${r.x + r.width}]`);
    }
  }

  for (let i = 0; i < HOUSE_ROOMS.length; i++) {
    const a = HOUSE_ROOMS[i]!;
    for (let j = i + 1; j < HOUSE_ROOMS.length; j++) {
      const b = HOUSE_ROOMS[j]!;
      if (a.floor !== b.floor) continue;
      if (a.isSecret || b.isSecret) continue;
      const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      if (overlap > 1) {
        errors.push(`Rooms ${a.id} and ${b.id} overlap on floor ${a.floor} by ${overlap}px`);
      }
    }
  }

  const propHalfWidths: Record<string, (floor: number) => number> = {
    exit_door: () => 13,
    coat_rack: () => 7,
    mirror: () => 10,
    phone: () => 9,
    key_shelf: () => 10,
    sofa: () => 25,
    photos: () => 10,
    fireplace: () => 22,
    tv: () => 12,
    bookshelf: () => 15,
    fridge: () => 12,
    kitchen_table: () => 24,
    kitchen_counter: () => 14,
    sink: (fl) => (fl === 2 ? 14 : 12),
    cabinet: () => 13,
    archive_cabinets: () => 13,
    painting: () => 11,
    cellar_door: () => 13,
    workbench_tools: (fl) => (fl === 3 ? 34 : 17),
    bed: () => 25,
    side_table: () => 10,
    safe: () => 11,
    wardrobe: () => 16,
    grandfather_clock: () => 11,
    bathtub: () => 22,
    boxes: () => 16,
    monitors: () => 17,
    hatch_frame: () => 16,
    mannequin: () => 7,
    toys: () => 8,
    radio_station: () => 14,
    floor_hatch: () => 16,
    vent_grate: () => 11,
    breaker_panel: () => 10,
    storage_rack: () => 13,
    boiler: () => 16,
    pipes: () => 16,
    pipe_valve: () => 10,
  };

  // Props whose visual silhouettes rise into or above the window band (y - 37)
  const tallProps = new Set([
    'exit_door',
    'coat_rack',
    'mirror',
    'photos',
    'fireplace',
    'bookshelf',
    'fridge',
    'cabinet',
    'archive_cabinets',
    'painting',
    'cellar_door',
    'workbench_tools',
    'wardrobe',
    'grandfather_clock',
    'monitors',
    'hatch_frame',
    'mannequin',
    'radio_station',
    'breaker_panel',
    'storage_rack',
    'boiler',
    'pipes',
  ]);

  const propIds = new Set<string>();
  const floorPropsMap = new Map<number, typeof HOUSE_PROPS>();
  for (const p of HOUSE_PROPS) {
    if (propIds.has(p.id)) errors.push(`Duplicate prop ID: ${p.id}`);
    propIds.add(p.id);
    const bounds = (FLOOR_BOUNDS as Record<number, { minX: number; maxX: number }>)[p.floor];
    if (!bounds) {
      errors.push(`Prop ${p.id} has invalid floor ${p.floor}`);
    } else if (p.x < bounds.minX - 20 || p.x > bounds.maxX + 20) {
      errors.push(`Prop ${p.id} x=${p.x} outside floor ${p.floor} bounds [${bounds.minX}, ${bounds.maxX}]`);
    }

    const hw = propHalfWidths[p.type]?.(p.floor) ?? 12;
    const containingRoom = HOUSE_ROOMS.find(
      (r) => r.floor === p.floor && p.x >= r.x && p.x <= r.x + r.width
    );
    if (!containingRoom) {
      errors.push(`Prop ${p.id} (floor ${p.floor}, x=${p.x}) is not inside any room`);
    } else {
      if (p.x - hw < containingRoom.x - 1 || p.x + hw > containingRoom.x + containingRoom.width + 1) {
        errors.push(
          `Prop ${p.id} span [${p.x - hw}, ${p.x + hw}] overflows room ${containingRoom.id} [${containingRoom.x}, ${containingRoom.x + containingRoom.width}]`
        );
      }
      if (
        tallProps.has(p.type) &&
        containingRoom.hasWindow &&
        containingRoom.windowX !== undefined
      ) {
        const winOverlap =
          Math.min(p.x + hw, containingRoom.windowX + 17) -
          Math.max(p.x - hw, containingRoom.windowX - 17);
        if (winOverlap > 0) {
          errors.push(
            `Tall prop ${p.id} overlaps window in room ${containingRoom.id} by ${winOverlap}px`
          );
        }
      }
    }

    const list = floorPropsMap.get(p.floor) ?? [];
    list.push(p);
    floorPropsMap.set(p.floor, list);
  }

  for (const [floor, props] of floorPropsMap.entries()) {
    for (let i = 0; i < props.length; i++) {
      const a = props[i]!;
      const aHw = propHalfWidths[a.type]?.(floor) ?? 12;
      for (let j = i + 1; j < props.length; j++) {
        const b = props[j]!;
        const isConnectedPipePair =
          (a.id === 'p_pipes' && b.id === 'p_valve0') ||
          (b.id === 'p_pipes' && a.id === 'p_valve0');
        if (isConnectedPipePair) continue;
        const bHw = propHalfWidths[b.type]?.(floor) ?? 12;
        const overlap = Math.min(a.x + aHw, b.x + bHw) - Math.max(a.x - aHw, b.x - bHw);
        if (overlap > 1) {
          errors.push(`Props ${a.id} and ${b.id} overlap on floor ${floor} by ${overlap}px`);
        }
      }
    }
  }

  const forestInteractables = WORLD_INTERACTABLES.filter((i) => i.zone === 'forest');
  for (let i = 0; i < forestInteractables.length; i++) {
    const a = forestInteractables[i]!;
    for (let j = i + 1; j < forestInteractables.length; j++) {
      const b = forestInteractables[j]!;
      if (Math.abs(a.x - b.x) < 20) {
        errors.push(`Forest interactables ${a.id} and ${b.id} are too close (${Math.abs(a.x - b.x)}px)`);
      }
    }
  }

  const interactableIds = new Set<string>();
  for (const item of WORLD_INTERACTABLES) {
    if (interactableIds.has(item.id)) errors.push(`Duplicate interactable ID: ${item.id}`);
    interactableIds.add(item.id);

    if (item.zone === 'forest') {
      if (item.x < FOREST_MIN_X || item.x > FOREST_MAX_X) {
        errors.push(`Forest interactable ${item.id} x=${item.x} outside forest bounds`);
      }
    } else {
      const floor = item.floor;
      const b = floor !== undefined ? (FLOOR_BOUNDS as Record<number, { minX: number; maxX: number }>)[floor] : undefined;
      if (!b) {
        errors.push(`House interactable ${item.id} missing valid floor`);
      } else if (item.x < b.minX - 10 || item.x > b.maxX + 10) {
        errors.push(`House interactable ${item.id} x=${item.x} outside floor ${floor} bounds`);
      }
    }

    if (item.partId && !partIds.has(item.partId)) {
      errors.push(`Interactable ${item.id} references unknown partId ${item.partId}`);
    }
    if (item.noteId && !noteIds.has(item.noteId)) {
      errors.push(`Interactable ${item.id} references unknown noteId ${item.noteId}`);
    }
    if (item.keyId && !keyIds.has(item.keyId)) {
      errors.push(`Interactable ${item.id} references unknown keyId ${item.keyId}`);
    }
    if (item.tapeId && !tapeIds.has(item.tapeId)) {
      errors.push(`Interactable ${item.id} references unknown tapeId ${item.tapeId}`);
    }
    if (item.secretId && !secretIds.has(item.secretId)) {
      errors.push(`Interactable ${item.id} references unknown secretId ${item.secretId}`);
    }
    if (item.requiresSecret && !secretIds.has(item.requiresSecret)) {
      errors.push(`Interactable ${item.id} requires unknown secret ${item.requiresSecret}`);
    }
    if (item.requiresKey && !keyIds.has(item.requiresKey)) {
      errors.push(`Interactable ${item.id} requires unknown key ${item.requiresKey}`);
    }
    if (item.inspectId && !inspectIds.has(item.inspectId)) {
      errors.push(`Interactable ${item.id} references unknown inspectId ${item.inspectId}`);
    }
    if (item.kind === 'secret_trigger' && !item.secretId) {
      errors.push(`Secret trigger ${item.id} missing secretId`);
    }
    if (item.targetFloor !== undefined) {
      const tb = (FLOOR_BOUNDS as Record<number, { minX: number; maxX: number }>)[item.targetFloor];
      if (!tb) {
        errors.push(`Interactable ${item.id} references invalid targetFloor ${item.targetFloor}`);
      } else if (item.targetX !== undefined) {
        if (item.targetX < tb.minX - 10 || item.targetX > tb.maxX + 10) {
          errors.push(
            `Interactable ${item.id} targetX=${item.targetX} outside floor ${item.targetFloor} bounds`
          );
        }
      }
    } else if (item.targetZone === 'forest' && item.targetX !== undefined) {
      if (item.targetX < FOREST_MIN_X || item.targetX > FOREST_MAX_X) {
        errors.push(`Interactable ${item.id} targetX=${item.targetX} outside forest bounds`);
      }
    }
  }

  for (const sig of ROOM_RADIO_SIGNALS) {
    const room = roomById.get(sig.roomId);
    if (!room) {
      errors.push(`Radio signal ${sig.id} references unknown room ${sig.roomId}`);
    } else {
      if (sig.floor !== room.floor) {
        errors.push(`Radio signal ${sig.id} floor ${sig.floor} != room ${room.id} floor ${room.floor}`);
      }
      if (sig.x < room.x || sig.x > room.x + room.width) {
        errors.push(
          `Radio signal ${sig.id} x=${sig.x} outside room ${room.id} [${room.x}, ${room.x + room.width}]`
        );
      }
    }
  }

  // Reachability checks across all catalogs
  const reachableParts = new Set(
    WORLD_INTERACTABLES.map((i) => i.partId).filter((v): v is NonNullable<typeof v> => Boolean(v))
  );
  for (const partId of partIds) {
    if (!reachableParts.has(partId as never)) {
      errors.push(`Robot part ${partId} is not placed in WORLD_INTERACTABLES`);
    }
  }

  const reachableNotes = new Set(
    WORLD_INTERACTABLES.map((i) => i.noteId).filter((v): v is string => Boolean(v))
  );
  for (const noteId of noteIds) {
    if (!reachableNotes.has(noteId)) {
      errors.push(`Note ${noteId} is not placed in WORLD_INTERACTABLES`);
    }
  }

  const reachableTapes = new Set<string>(
    WORLD_INTERACTABLES.map((i) => i.tapeId).filter((v): v is NonNullable<typeof v> => Boolean(v))
  );
  if (WORLD_INTERACTABLES.some((i) => i.id === 'f1_phone' && i.inspectId === 'phone_tape')) {
    reachableTapes.add('tape_01');
  }
  for (const tapeId of tapeIds) {
    if (!reachableTapes.has(tapeId)) {
      errors.push(`Audio tape ${tapeId} has no pickup or inspect source`);
    }
  }

  const reachableSecrets = new Set<string>(
    WORLD_INTERACTABLES.map((i) => i.secretId).filter((v): v is string => Boolean(v))
  );
  if (inspectIds.has('mirror')) reachableSecrets.add('secret_mirror_whisper');
  if (inspectIds.has('attic_mannequin')) reachableSecrets.add('secret_attic_badge');
  for (const secretId of secretIds) {
    if (!reachableSecrets.has(secretId)) {
      errors.push(`Secret ${secretId} has no trigger or inspect hotspot`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      rooms: HOUSE_ROOMS.length,
      props: HOUSE_PROPS.length,
      interactables: WORLD_INTERACTABLES.length,
      coreNotes: LORE_NOTES.length,
      totalNotes: ALL_NOTES.length,
      parts: partIds.size,
      secrets: SECRETS.length,
      tapes: AUDIO_TAPES.length,
      radioSignals: ROOM_RADIO_SIGNALS.length,
    },
  };
}
