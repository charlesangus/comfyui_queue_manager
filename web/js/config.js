// export const QM_ENVIRONMENT = "development"; // Any other value will be treated as production
export const QM_ENVIRONMENT = "production";


export const QM_DEV_URL = "http://localhost:3000"; // The URL of the development server for nextjs project. Check front end README for Cross-Origin issues
export const QM_PROD_URL = window.location.protocol + "//" + window.location.host +
  "/extensions/comfyui_queue_manager/.gui/index.html"; // The path where the build sits in the comfyui frontend

// Envo dependant manager URLs
export const QueueManagerURL = QM_ENVIRONMENT === "development" ? QM_DEV_URL : QM_PROD_URL;
export const QueueManagerOrigin = QM_ENVIRONMENT === "development" ? QM_DEV_URL : window.location.origin;

export const QM_THEME_VARS = [
  '--fg-color',
  '--bg-color',
  '--comfy-menu-bg',
  '--comfy-menu-secondary-bg',
  '--comfy-input-bg',
  '--input-text',
  '--descrip-text',
  '--drag-text',
  '--error-text',
  '--border-color',
  '--tr-even-bg-color',
  '--tr-odd-bg-color',
  '--content-bg',
  '--content-fg',
  '--content-hover-bg',
  '--content-hover-fg',
  '--bar-shadow',
  '--p-toolbar-background',
  '--p-primary-color',
  '--p-primary-contrast-color',
  '--p-content-border-color',
  '--p-text-color',
  '--p-text-muted-color',
  '--p-surface-0',
  '--p-surface-50',
  '--p-surface-100',
  '--p-surface-200',
  '--p-surface-300',
  '--p-surface-400',
  '--p-surface-500',
  '--p-surface-600',
  '--p-surface-700',
  '--p-surface-800',
  '--p-surface-900',
];
