import { validateGameContent, validateProgressionGraph } from './contentValidator';

const content = validateGameContent();
const progression = validateProgressionGraph();

console.log(
  `[validate] rooms=${content.stats.rooms} parts=${content.stats.parts} notes=${content.stats.totalNotes} secrets=${content.stats.secrets} tapes=${content.stats.tapes} signals=${content.stats.radioSignals}`
);
console.log(
  `[validate] progression: rooms=${progression.reachableRooms.length}/${content.stats.rooms}, parts=${progression.reachableParts.length}/${content.stats.parts}, notes=${progression.reachableNotes.length}/${content.stats.totalNotes}, secrets=${progression.reachableSecrets.length}/${content.stats.secrets}, endings=${progression.reachableEndings.join(',')}`
);

if (!content.valid || !progression.valid) {
  const allErrors = Array.from(new Set([...content.errors, ...progression.errors]));
  for (const err of allErrors) {
    console.error(`[validate] ERROR: ${err}`);
  }
  process.exit(1);
}

console.log('[validate] OK: all geometry, content catalogs, and progression graph invariants verified.');
