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
    id: 'QueueManager.Basic.InteractiveRunMode',
    name: 'Interactive run mode',
    category: ['Queue Manager', 'Basic', 'Interactive run mode'],
    tooltip: 'How interactive runs (single node / partial workflow execution from the canvas) are scheduled relative to the queue. Off: the run waits its normal turn in the queue. Front of queue: the run jumps to the front and starts once the current job finishes. Interrupt and requeue: the run also interrupts whatever job is currently executing, requeuing it directly behind the interactive prompt; this loses the interrupted job\'s in-flight progress, though ComfyUI\'s node cache typically lets it skip already-completed nodes on retry.',
    type: 'combo',
    options: [
      'Off',
      'Front of queue',
      'Interrupt and requeue',
    ],
    defaultValue: 'Front of queue',
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
