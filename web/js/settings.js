export const settings =  [
  // General settings
  {
    id: 'QueueManager.Basic.PageSize',
    name: 'Jobs per page',
    category: ['Queue Manager', 'Basic', 'Jobs per page'],
    tooltip: 'Number of jobs to display per page in the Queue Manager.',
    type: 'number',
    defaultValue: 100,
    attrs: {
      min: 1,
      step: 1,
      max: 200,
    },
  },
  {
    id: 'QueueManager.Basic.StartMode',
    name: 'Run mode on start',
    category: ['Queue Manager', 'Basic', 'Run mode on start'],
    tooltip: 'Whether the queue should automatically play or be paused when ComfyUI starts.',
    type: 'combo',
    options: [
      'Play',
      'Pause',
      'Last state',
    ],
    defaultValue: 'Last state',
  },

  {
    id: 'QueueManager.Completed.ListOrder',
    name: 'Completed jobs list order',
    category: ['Queue Manager', 'Completed', 'Completed jobs list order'],
    tooltip: 'Order in which completed jobs are displayed in the Completed tab.',
    type: 'combo',
    options: [
      'Newest first',
      'Oldest first',
    ],
    defaultValue: 'Newest first',
  },
];
