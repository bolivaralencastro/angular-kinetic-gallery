export type ContextMenuAction =
  | 'toggleTheme'
  | 'togglePlayback'
  | 'toggleFullscreen'
  | 'info'
  | 'createGallery'
  | 'capturePhoto'
  | 'editGallery'
  | 'deleteGallery';

export interface ContextMenuGroup {
  label: string;
  actions: ContextMenuAction[];
}
