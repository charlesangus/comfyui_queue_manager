import Modal from "@mui/material/Modal";
import IconButton from "@mui/material/IconButton";
import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import OpenInNewSharpIcon from "@mui/icons-material/OpenInNewSharp";
import ArrowBackIosNewSharpIcon from "@mui/icons-material/ArrowBackIosNewSharp";
import ArrowForwardIosSharpIcon from "@mui/icons-material/ArrowForwardIosSharp";
import { MediaItem, viewURL } from "./MediaItem";

export function Lightbox({ files, index, onIndexChange, onClose }) {
  const file = files[index];
  const count = files.length;

  const step = (delta) => onIndexChange((index + delta + count) % count);

  // The Modal is portaled out of the panel, but React still bubbles its events up to the card and the panel's
  // shortcut handler, so stop them here. Escape is left to the Modal, which closes and stops it itself.
  function handleKeyDown(event) {
    if (event.key === "Escape") return;
    event.stopPropagation();
    if (event.key === "ArrowLeft") step(-1);
    else if (event.key === "ArrowRight") step(1);
  }

  function handleClick(event) {
    event.stopPropagation();
    if (event.target.tagName === "IMG") window.open(viewURL(file), "_blank");
    else if (!event.target.closest("video, .lightbox-toolbar, .lightbox-nav")) onClose();
  }

  return (
    <Modal open onClose={onClose}>
      <div className="qm-lightbox" onClick={handleClick} onKeyDown={handleKeyDown} tabIndex={-1}>
        <div className="lightbox-toolbar">
          <span className="lightbox-title" title={file.filename}>{file.filename}</span>
          {count > 1 ? <span className="lightbox-counter">{index + 1} / {count}</span> : null}
          <IconButton size="small" color="inherit" title="Open in new tab" onClick={() => window.open(viewURL(file), "_blank")}>
            <OpenInNewSharpIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="inherit" title="Close (Esc)" onClick={onClose}>
            <CloseSharpIcon fontSize="small" />
          </IconButton>
        </div>

        <div className="lightbox-stage">
          {count > 1 ? (
            <IconButton className="lightbox-nav prev" color="inherit" title="Previous (←)" onClick={() => step(-1)}>
              <ArrowBackIosNewSharpIcon />
            </IconButton>
          ) : null}

          <MediaItem file={file} autoplay className="lightbox-media" />

          {count > 1 ? (
            <IconButton className="lightbox-nav next" color="inherit" title="Next (→)" onClick={() => step(1)}>
              <ArrowForwardIosSharpIcon />
            </IconButton>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
