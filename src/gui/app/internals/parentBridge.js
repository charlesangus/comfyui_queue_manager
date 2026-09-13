export const QM_QUEUE_STATUS_UPDATED = "QM_queueStatusUpdated";
export const QM_PARENT_KEYPRESS = "QM_ParentKeypress";
export const QM_QUEUE_MANAGER_HELLO = "QM_QueueManager_Hello";
export const QM_SETTING_CHANGED = "QM_Setting_Changed";
export const QM_LOAD_WORKFLOW = "QM_LoadWorkflow";

export const msgLoadWorkflow = (workflow, number) => {
  window.parent.postMessage(
    { type: QM_LOAD_WORKFLOW, workflow, number },
    "*"
  );
};
