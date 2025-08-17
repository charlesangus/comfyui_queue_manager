import {useEffect, useState} from "react";

export default function GalleryProgressBar({galleryItems, mediaItem, onItemClick}) {
  if (galleryItems.length === 0 || !mediaItem) {
    return null; // No items to display
  }

  let currentImageIndex = 1; // Current image index in the gallery

  // total images in all nodes in the current item
  const totalImages = mediaItem.queueItem.outputs.reduce((total, node, nodeIndex) => {
      const imagesCount = (node.images?.length || 0) + (node.gifs?.length || 0);

      if (nodeIndex < mediaItem.nodeIndex) {
        currentImageIndex += imagesCount;
      } else if (nodeIndex === mediaItem.nodeIndex) {
        currentImageIndex += mediaItem.fileIndex;
      }

      return total + (node.images?.length || 0) + (node.gifs?.length || 0);
  }, 0);

  const itemProgress = currentImageIndex / totalImages * 100;

  return (
    <div className="gallery-progress-bar" style={{'--item-progress': itemProgress+'%'}}>
      {galleryItems.map((item, index) => (
        <div
          key={item.index}
          className={`progress-item${index < mediaItem.itemIndex ? ' active' : ''}${index === mediaItem.itemIndex ? ' current' : ''}`}
          onClick={() => onItemClick(index)}
        >
        </div>
      ))}
    </div>
  );

}
