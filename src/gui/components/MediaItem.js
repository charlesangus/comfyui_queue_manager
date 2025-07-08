import {memo} from "react";
import {baseURL} from "@/internals/config";


export const MediaItem = memo(function MediaItem({filename, subfolder}) {
  const ext = filename.split('.').pop().toLowerCase();

  const src = `${baseURL}api/view?filename=${filename}` +
              `&type=output&subfolder=${subfolder}`;


  return (
    <div className={"media-item"}>
      {(ext === 'mp4' || ext === 'webm')
        ? (
          <video
            className="comfy-video-main galleria-image"
            controls
          >
            <source src={src} type={`video/${ext}`} />
          </video>
        )
        : (
          <img
            src={src}
            className="comfy-image-main galleria-image"
            alt={filename}
          />
        )
      }
    </div>
  );
});
