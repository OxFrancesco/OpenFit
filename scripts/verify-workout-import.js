import { analyzeSchedule, SCHEDULE_READER_MODEL } from '../src/lib/workout-schedule-server';

const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error('Set OPENROUTER_API_KEY in the server environment first.');
const imagePath = process.argv[2];
const result = await analyzeSchedule({
  language: 'English',
  text: imagePath ? '' : 'Scheda palestra. Lunedì: Panca piana con bilanciere 4 serie da 8 ripetizioni, 60 kg, recupero 90 secondi. Mercoledì: Lat machine presa larga 3x12, 40 kg. Venerdì: Squat con bilanciere 3x5. Non inventare carichi mancanti.',
  ...(imagePath ? { attachment: { name: imagePath.split('/').at(-1), mimeType: imagePath.endsWith('.pdf') ? 'application/pdf' : 'image/png', data: Buffer.from(await Bun.file(imagePath).arrayBuffer()).toString('base64') } } : {}),
}, key);
if (result.entries.length !== 3) throw new Error(`Expected 3 entries, received ${result.entries.length}`);
const expected = ['barbell-bench-press', 'lat-pulldown', 'back-squat'];
for (const [index, id] of expected.entries()) {
  if (result.entries[index].exerciseId !== id) throw new Error(`Entry ${index} matched ${result.entries[index].exerciseId}, expected ${id}`);
}
console.log(JSON.stringify({ model: SCHEDULE_READER_MODEL, input: imagePath ? imagePath.split('.').at(-1) : 'text', result }, null, 2));
