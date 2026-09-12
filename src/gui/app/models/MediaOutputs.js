export class MediaOutputs {
  files = [];

  constructor(item) {
    const nodes = item?.outputs;
    if (!nodes) return;

    for (const nodeID of Object.keys(nodes)) {
      const outputs = nodes[nodeID];
      const entries = outputs.images || outputs.gifs || outputs.files || [];

      for (const entry of entries) {
        this.files.push({
          filename: entry.filename,
          subfolder: entry.subfolder,
          type: entry.type,
        });
      }
    }
  }

  get total() {
    return this.files.length;
  }
}
