import React, {useContext, useState} from "react";
// import {AppContext} from "@/internals/app-context";
import {baseURL} from "@/internals/config";

export default function MediaItem({file}) {
  // const {appStatus, setAppStatus} = useContext(AppContext)

  const ext = file.filename.split('.').pop().toLowerCase();
  const key = `${file.subfolder}/${file.filename}`;   // stable key

  const src = `${baseURL}api/view?filename=${file.filename}` +
              `&type=output&subfolder=${file.subfolder}`;


  return (
    <div className={"media-item"}>
      {(ext === 'mp4' || ext === 'webm')
        ? (
          <video
            key={key}
            src={src}
            className="comfy-video-main galleria-image"
            controls
          />
        )
        : (
          <img
            key={key}
            src={src}
            className="comfy-image-main galleria-image"
            alt={file.filename}
          />
        )
      }
    </div>
  );
}
