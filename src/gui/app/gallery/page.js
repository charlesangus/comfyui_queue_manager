"use client";

import {useEffect, useState} from "react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CloseIcon from '@mui/icons-material/Close';
import DisabledByDefaultIcon from '@mui/icons-material/DisabledByDefault';
import {baseURL} from "@/internals/config";

export default function Gallery() {
  /**
   * Gallery state
   * @type {Object|null}
   * @property {Array} outputs - Array of output files
   * @property {number} itemIndex - Index of the queue item
   * @property {string} nodeKey - Key of the node in the queue item
   * @property {number} fileIndex - Index of the output file
   * @property {string} workflowName - Name of the workflow
   * @property {string} promptID - ID of the workflow in the queue
   */
  const [ gallery, setGallery ] = useState(null);
  const [ mediaItem, setMediaItem ] = useState(null);


  /**
   * Fetches the gallery metadata and info about item if specified
   * @param item {string|null} - queue item ID
   * @returns {Promise<void>}
   */
  const fetchGallery = async (item) => {
    const itemQuery = item ? `?item=${encodeURIComponent(item)}` : '';

    try {
      const response = await fetch('/queue_manager/gallery' + itemQuery);
      if (!response.ok) {
        throw new Error('Failed to fetch gallery');
      }
      const data = await response.json();
      console.log('Gallery data:', data);
    } catch (error) {
      console.error('Error fetching gallery:', error);
    }
  };

  function closeGallery() {
    // Post message to parent window to close gallery
    window.parent.postMessage({ type: "QM_Gallery_Close" }, "*");
  }

  useEffect(() => {
    /**
     * Messages from iframe
     */
    window.addEventListener("message", (event) => {
      const { type } = event.data;

      // Request to load gallery item
      if (type === "QM_Gallery_Load") {
        console.log('Gallery loaded:', event.data);
        const data = event.data.galleryData;
        const queueItem = data.outputs[data.itemIndex];
        const node = queueItem.outputs[data.nodeKey];
        const file = node.images[data.fileIndex];

        // calculate total of all images in all nodes of the queue item, queueItem.outputs is an object with node keys
        const totalItemImages = Object.values(queueItem.outputs).reduce((acc, node) => {
          if (node.images && Array.isArray(node.images)) {
            return acc + node.images.length;
          }
          return acc;
        }, 0);


        setGallery(event.data.galleryData);

        setMediaItem({
          queueItem: queueItem,
          node: node,
          file: file,
          totalImages: totalItemImages
        });
      }

    }, false);
  }, []);


  return (
    <div className={"gallery-page"}>

      <IconButton size="large" variant="contained" className={"close-button"} onClick={closeGallery}>
        <DisabledByDefaultIcon fontSize="large" />
      </IconButton>

      {gallery &&
      <div className="image-box">
        <header>{gallery.workflowName} <span>({gallery.fileIndex+1} / {mediaItem.totalImages})</span></header>

        <figure>
          <img
            src={baseURL + `api/view?filename=${mediaItem.file.filename}&type=output&subfolder=${mediaItem.file.subfolder}`}
            alt={mediaItem.file.filename}
          />
          <figcaption>
            {/*<Button variant="contained" color="primary" onClick={() => fetchGallery(gallery.itemIndex)}>*/}
            {/*  Reload Gallery*/}
            {/*</Button>*/}
          </figcaption>
        </figure>

        <footer></footer>
      </div>
      }
    </div>
  );
}
