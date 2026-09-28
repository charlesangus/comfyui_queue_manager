import {
  uiSetup,
  handleAPIEvents,
  registerSidebar,
  hookQueuePrompt,
} from './js/functions.js';
import {settings} from './js/settings.js';

import { app } from '../../scripts/app.js';

/**
 * Main function wrapping plugin's core functionality
 */
app.registerExtension({
	name: "ComfyUIQueueManager",

  async setup() {
    setTimeout(uiSetup);

    handleAPIEvents();

    registerSidebar();

    hookQueuePrompt();
  },

  settings
})
