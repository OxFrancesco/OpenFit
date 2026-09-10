import { expect, test } from 'bun:test';
import { parseAskInput } from './validation';
test('coach accepts questions without any health connection or summary', () => {
  expect(parseAskInput({question:'Help describe my meal'}).deviceHealth).toBeUndefined();
});
test('coach bounds and sanitizes device summaries', () => {
  const deviceHealth = {source:'Apple Health',range:'Today',metrics:[{id:'steps',label:'Steps',unit:'steps',value:0,secret:'discard'}],exercises:[],sleepSessions:[],arbitrary:'discard'};
  const parsed = parseAskInput({question:'Review',deviceHealth});
  expect(parsed.deviceHealth.metrics[0].value).toBe(0);
  expect(parsed.deviceHealth.metrics[0].secret).toBeUndefined();
  expect(parsed.deviceHealth.arbitrary).toBeUndefined();
  expect(() => parseAskInput({question:'Review',deviceHealth:{...deviceHealth,source:'Google Health'}})).toThrow();
  expect(() => parseAskInput({question:'Review',deviceHealth:{...deviceHealth,metrics:[{...deviceHealth.metrics[0],value:'12'}]}})).toThrow();
  expect(() => parseAskInput({question:'Review',deviceHealth:{...deviceHealth,arbitrary:'x'.repeat(25000)}})).toThrow();
});
