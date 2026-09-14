import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareMarkdown(markdown: string, filename: string) {
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  const directory = new Directory(Paths.cache, 'openfit-exports');
  directory.create({ idempotent: true });
  for (const entry of directory.list()) {
    if (entry instanceof File && entry.modificationTime !== null && entry.modificationTime < Date.now() - 86_400_000) entry.delete();
  }
  const file = new File(directory, filename);
  try {
    file.create({ overwrite: true });
    file.write(markdown);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/markdown', UTI: 'net.daringfireball.markdown', dialogTitle: 'Export OpenFit data',
    });
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }
}
