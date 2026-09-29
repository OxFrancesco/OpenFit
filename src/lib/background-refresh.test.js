import { expect, test } from 'bun:test';
import { spawnSync } from 'bun';

// Keep native-module substitutes out of the rest of the test runner.
function runScenario(scenario) {
  const result = spawnSync([process.execPath, '--eval', `
    import { expect, mock } from 'bun:test';
    const platform = { OS: 'android' };
    const entries = new Map();
    const tasks = new Map();
    let enabled = true;
    let permission = true;
    let available = true;
    let registered = false;
    const register = mock(async () => { registered = true; });
    const unregister = mock(async () => { registered = false; });
    let changeOwnerDuringRead = false;
    const fetch = mock(async () => {
      if (changeOwnerDuringRead) enabled = false;
      return { metrics: [{ id: 'steps', value: 4321 }], exercises: [], sleepSessions: [] };
    });
    const session = mock(async () => null);
    const sync = mock(async () => {});
    mock.module('react-native', () => ({ Platform: platform, AppState: { currentState: 'background' } }));
    mock.module('expo-task-manager', () => ({
      defineTask: (name, task) => tasks.set(name, task),
      isTaskRegisteredAsync: async () => registered,
    }));
    mock.module('expo-background-task', () => ({
      BackgroundTaskResult: { Success: 1, Failed: 2 },
      BackgroundTaskStatus: { Available: 1, Restricted: 2 },
      getStatusAsync: async () => available ? 1 : 2,
      registerTaskAsync: register,
      unregisterTaskAsync: unregister,
    }));
    mock.module('expo-secure-store', () => ({
      getItemAsync: async key => key === 'openfit.device-health-owner.v1' ? enabled ? 'connected-user' : null : entries.get(key) ?? null,
      setItemAsync: async (key, value) => entries.set(key, value),
    }));
    mock.module('./src/lib/clerk-session', () => ({ clerkSession: session }));
    mock.module('./src/lib/device-health', () => ({
      healthSourceName: 'Health Connect',
      openHealthSettings: async () => {},
      requestDeviceHealth: async () => {},
      canReadDeviceHealthInBackground: async () => permission,
      readDeviceHealth: fetch,
    }));
    mock.module('./src/lib/dashboard-prefs', () => ({
      loadDashboardPrefs: async () => (await import('./src/lib/dashboard-prefs-core')).defaultPrefs(),
    }));
    mock.module('./src/lib/widget-sync', () => ({ syncWidgets: sync }));
    const { registerWidgetRefresh, unregisterWidgetRefresh, WIDGET_REFRESH_TASK } =
      await import('./src/lib/background-refresh');
    ${scenario}
  `], { cwd: new URL('../..', import.meta.url).pathname });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
}

test('Android schedules widget updates without reopening the app', () => runScenario(`
  await registerWidgetRefresh();
  expect(register).toHaveBeenCalledWith(WIDGET_REFRESH_TASK, { minimumInterval: 15 });
`));

test('repeated registration does not postpone a pending refresh', () => runScenario(`
  await registerWidgetRefresh();
  await registerWidgetRefresh();
  expect(register).toHaveBeenCalledTimes(1);
`));

test('sign-out cancels Android background refresh', () => runScenario(`
  registered = true;
  await unregisterWidgetRefresh();
  expect(unregister).toHaveBeenCalledWith(WIDGET_REFRESH_TASK);
`));

test('cold background task reads fresh metrics without a mounted Clerk session', () => runScenario(`
  expect(await tasks.get(WIDGET_REFRESH_TASK)()).toBe(1);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(sync).toHaveBeenCalledTimes(1);
  expect(sync.mock.calls[0][0].metricsById.steps.value).toBe(4321);
  expect(session).not.toHaveBeenCalled();
`));

test('launcher-driven headless refresh updates the persisted snapshot without Clerk', () => runScenario(`
  const { refreshWidgetMetrics } = await import('./src/widgets/android/refresh-data');
  const data = await refreshWidgetMetrics(['steps']);
  expect(data.metricsById.steps.value).toBe(4321);
  expect(JSON.parse(entries.get('fitty.widget_data')).metricsById.steps.value).toBe(4321);
  expect(session).not.toHaveBeenCalled();
`));

test('background task preserves the snapshot without Health Connect background permission', () => runScenario(`
  permission = false;
  expect(await tasks.get(WIDGET_REFRESH_TASK)()).toBe(1);
  expect(fetch).not.toHaveBeenCalled();
  expect(sync).not.toHaveBeenCalled();
`));

test('disconnected accounts do not read health data', () => runScenario(`
  enabled = false;
  expect(await tasks.get(WIDGET_REFRESH_TASK)()).toBe(1);
  expect(fetch).not.toHaveBeenCalled();
`));

test('disconnect during a read discards the result', () => runScenario(`
  changeOwnerDuringRead = true;
  expect(await tasks.get(WIDGET_REFRESH_TASK)()).toBe(1);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(sync).not.toHaveBeenCalled();
`));

test('iOS keeps its existing interval and web does not register', () => runScenario(`
  platform.OS = 'ios';
  await registerWidgetRefresh();
  expect(register).toHaveBeenCalledWith(WIDGET_REFRESH_TASK, { minimumInterval: 30 });
  platform.OS = 'web';
  await registerWidgetRefresh();
  expect(register).toHaveBeenCalledTimes(1);
`));

test('restricted background execution does not register a task', () => runScenario(`
  available = false;
  await registerWidgetRefresh();
  expect(register).not.toHaveBeenCalled();
`));
