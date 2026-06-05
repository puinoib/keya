declare const __APP_VERSION__: string;

interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

type FileSystemPermissionState = 'granted' | 'denied' | 'prompt';

interface FilePickerOptions {
  mode?: 'read' | 'readwrite';
  startIn?: FileSystemHandle | WellKnownDirectory;
}

type WellKnownDirectory =
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos';

interface FileSystemHandlePermissionTarget {
  queryPermission?(
    descriptor?: FileSystemPermissionDescriptor
  ): Promise<FileSystemPermissionState>;
  requestPermission?(
    descriptor?: FileSystemPermissionDescriptor
  ): Promise<FileSystemPermissionState>;
}

interface FileSystemDirectoryHandle extends FileSystemHandlePermissionTarget {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface Window {
  showDirectoryPicker?(
    options?: FilePickerOptions
  ): Promise<FileSystemDirectoryHandle>;
  __legacyFile?: File;
}
