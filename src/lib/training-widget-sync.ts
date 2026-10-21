/** Home-screen training widget. Android only; other platforms have none. */
export async function syncTrainingWidgets(): Promise<void> {}

/** Whether the launcher can show its add-widget prompt. */
export async function canPinTrainingWidget(): Promise<boolean> {
  return false;
}

export async function hasTrainingWidget(): Promise<boolean> {
  return false;
}

/** Opens the launcher's add-widget prompt. Resolves false if the launcher refused. */
export async function pinTrainingWidget(): Promise<boolean> {
  return false;
}
