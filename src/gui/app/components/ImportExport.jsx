import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import { styled } from '@mui/material/styles';
import useEvent from "react-use-event-hook";
import { baseURL } from "../internals/config";
import { useAppStore } from "../stores/appStore";

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

export function ImportExport({ route }) {
  const uploadQueue = useEvent(async (e) => {
    if (!e.target.files || !e.target.files.length === 0) {
      return;
    }

    const file = e.target.files[0];

    const formData = new FormData();
    formData.append("queue_json", file);
    formData.append("client_id", useAppStore.getState().clientId);

    const comfyApiKey = localStorage.getItem("comfy_api_key");
    if (comfyApiKey) {
      formData.append("api_key_comfy_org", comfyApiKey);
    }

    if (route === 'archive') {
      formData.append("archive", true);
    }

    try {
      const response = await fetch(`${baseURL}queue_manager/import`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      console.log("Queue imported successfully", data);

      e.target.value = "";

    } catch (error) {
      console.error("Error importing queue:", error);
    }
  });

  if (!['queue', 'archive'].includes(route)) {
    return null;
  }

  return (
    <form
      method="post"
      encType="multipart/form-data"
      className={"import-form"}
    >
      <label className="qm-btn">
        <DriveFolderUploadOutlinedIcon/>&nbsp;&nbsp;Import {route === 'queue' ? 'Queue' : 'Archive'}
        <VisuallyHiddenInput
          type="file"
          onChange={uploadQueue}
          multiple
          name="queue_json"
          accept=".json"
          required
        />
      </label>
    </form>
  );
}
