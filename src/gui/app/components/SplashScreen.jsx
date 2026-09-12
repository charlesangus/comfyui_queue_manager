import Button from "@mui/material/Button";
import CloseSharpIcon from '@mui/icons-material/CloseSharp';

export function SplashScreen({onClick}) {
  return (
    <div className="splash-screen">
      <Button className={"close"} onClick={onClick}>
        <CloseSharpIcon />
      </Button>
      <div className="splash-content">
        <h1>ComfyUI Queue Manager</h1>
        <h4 className={"sub"}>Version: v0.2.0</h4>
        <h4 className={"sub"}>Released: 12<sup>th</sup> September 2026</h4>
        <h2>What's new?</h2>
        <h3>Output thumbnails</h3>
        <p>The lightbox view is gone. Completed jobs now show a row of output thumbnails; click one to open the full file in a new browser tab.</p>
        <p><br/>
          <i>For more details check the updated manual on Github: <a href={"https://github.com/QuietNoise/comfyui_queue_manager?tab=readme-ov-file#manual"} target={"_blank"} rel="noreferrer">Queue Manager Manual</a>.</i><br/>
          <i>For full Release Notes view <a href={"https://github.com/QuietNoise/comfyui_queue_manager/blob/main/CHANGELOG.md"} target={"_blank"} rel="noreferrer">Changelog</a>.</i><br />
          <i>Leave a feedback or report an issue here <a href={"https://github.com/QuietNoise/comfyui_queue_manager/issues"} target={"_blank"} rel="noreferrer">Issues</a>. </i>
        </p>

      </div>
    </div>
  );
}
