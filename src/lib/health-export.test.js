import { expect, test } from 'bun:test';
import { buildHealthMarkdown, HEALTH_AI_PROMPT } from './health-export';

const base = {
  createdAt: '2026-09-14T10:00:00Z', source: 'Health Connect', snapshot: null,
  goals: [{ label: 'Steps', value: 8000, unit: 'steps' }], workouts: [],
};

test('exports prompt and goals with an explicit disconnected health state', () => {
  const md = buildHealthMarkdown(base);
  expect(md).toContain(HEALTH_AI_PROMPT);
  expect(md).toContain('Device health is not connected');
  expect(md).toContain('| Steps | 8000 | steps |');
});

test('preserves zero, missing values, daily measurements, sessions and all logs without raw data', () => {
  const md = buildHealthMarkdown({ ...base,
    snapshot: {
      rangeLabel: 'Aug 16 to Sep 14',
      metrics: [{ id: 'steps', label: 'Steps', unit: 'steps', value: 0, status: 'loaded', dailyValues: [{ date: '2026-09-14', value: 0 }] },
        { id: 'weight', label: 'Weight', unit: 'kg', value: null, status: 'empty' }],
      sleepSessions: [{ id: 'sleep', kind: 'sleep', minutesAsleep: 400, minutesInSleepPeriod: null }],
      exercises: [{ id: 'walk', type: 'walking', name: 'Walk', activeMinutes: 20, caloriesKcal: null, distanceKm: 1, steps: 1500 }],
      raw: { rollups: { token: 'must-not-export' }, exercises: {}, sleep: {} },
    },
    workouts: Array.from({ length: 125 }, (_, i) => ({ id: String(i), exerciseId: 'squat', exerciseName: 'Squat', performedAt: `entry-${i}`, sets: 3, reps: 5, weightKg: 40, enteredUnit: 'kg', notes: 'a|b\n<script>' })),
  });
  expect(md).toContain('| Steps | 0 | steps | loaded |');
  expect(md).toContain('| Weight | Unknown | kg | empty |');
  expect(md).toContain('| 2026-09-14 | Steps | 0 | steps |');
  expect(md).toContain('| sleep | Unknown | Unknown | 400 | Unknown |');
  expect(md).toContain('| Walk | walking | Unknown | Unknown | 20 | Unknown | 1 | 1500 |');
  expect(md).toContain('entry-124');
  expect(md).toContain('a&#124;b &lt;script&gt;');
  expect(md).not.toContain('must-not-export');
});
