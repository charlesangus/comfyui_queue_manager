import { describe, it, expect } from 'vitest';
import { MediaOutputs } from './MediaOutputs';

describe('MediaOutputs', () => {
  describe('images only', () => {
    it('flattens a single node with images into files array', () => {
      const item = {
        outputs: {
          '1': {
            images: [
              { filename: 'img1.png', subfolder: '', type: 'output' },
              { filename: 'img2.png', subfolder: '', type: 'output' },
            ],
          },
        },
      };

      const mediaOutputs = new MediaOutputs(item);

      expect(mediaOutputs.files).toHaveLength(2);
      expect(mediaOutputs.files[0]).toEqual({
        filename: 'img1.png',
        subfolder: '',
        type: 'output',
      });
      expect(mediaOutputs.files[1]).toEqual({
        filename: 'img2.png',
        subfolder: '',
        type: 'output',
      });
    });
  });

  describe('gifs only', () => {
    it('flattens a single node with gifs into files array', () => {
      const item = {
        outputs: {
          '2': {
            gifs: [
              { filename: 'anim.gif', subfolder: 'gifs', type: 'output' },
            ],
          },
        },
      };

      const mediaOutputs = new MediaOutputs(item);

      expect(mediaOutputs.files).toHaveLength(1);
      expect(mediaOutputs.files[0]).toEqual({
        filename: 'anim.gif',
        subfolder: 'gifs',
        type: 'output',
      });
    });
  });

  describe('files only', () => {
    it('flattens a single node with files into files array', () => {
      const item = {
        outputs: {
          '3': {
            files: [
              { filename: 'data.json', subfolder: 'exports', type: 'output' },
            ],
          },
        },
      };

      const mediaOutputs = new MediaOutputs(item);

      expect(mediaOutputs.files).toHaveLength(1);
      expect(mediaOutputs.files[0]).toEqual({
        filename: 'data.json',
        subfolder: 'exports',
        type: 'output',
      });
    });
  });

  describe('multiple nodes', () => {
    it('merges outputs from multiple nodes into a single flat list', () => {
      const item = {
        outputs: {
          '1': {
            images: [
              { filename: 'img1.png', subfolder: '', type: 'output' },
            ],
          },
          '2': {
            gifs: [
              { filename: 'anim.gif', subfolder: 'gifs', type: 'output' },
            ],
          },
          '3': {
            files: [
              { filename: 'data.json', subfolder: 'exports', type: 'output' },
            ],
          },
        },
      };

      const mediaOutputs = new MediaOutputs(item);

      expect(mediaOutputs.files).toHaveLength(3);
      expect(mediaOutputs.files[0].filename).toBe('img1.png');
      expect(mediaOutputs.files[1].filename).toBe('anim.gif');
      expect(mediaOutputs.files[2].filename).toBe('data.json');
    });

    it('handles multiple outputs from multiple nodes', () => {
      const item = {
        outputs: {
          '1': {
            images: [
              { filename: 'img1.png', subfolder: '', type: 'output' },
              { filename: 'img2.png', subfolder: '', type: 'output' },
            ],
          },
          '2': {
            images: [
              { filename: 'img3.png', subfolder: 'other', type: 'output' },
            ],
          },
        },
      };

      const mediaOutputs = new MediaOutputs(item);

      expect(mediaOutputs.files).toHaveLength(3);
    });
  });

  describe('missing outputs', () => {
    it('produces empty files array when item has no outputs', () => {
      const item = {};

      const mediaOutputs = new MediaOutputs(item);

      expect(mediaOutputs.files).toEqual([]);
    });

    it('produces empty files array when item is null', () => {
      const mediaOutputs = new MediaOutputs(null);

      expect(mediaOutputs.files).toEqual([]);
    });

    it('produces empty files array when item is undefined', () => {
      const mediaOutputs = new MediaOutputs(undefined);

      expect(mediaOutputs.files).toEqual([]);
    });
  });

  describe('node with no output arrays', () => {
    it('skips nodes that lack images, gifs, and files', () => {
      const item = {
        outputs: {
          '1': {
            images: [
              { filename: 'img1.png', subfolder: '', type: 'output' },
            ],
          },
          '2': {
            other: 'value',
          },
          '3': {
            gifs: [
              { filename: 'anim.gif', subfolder: 'gifs', type: 'output' },
            ],
          },
        },
      };

      const mediaOutputs = new MediaOutputs(item);

      expect(mediaOutputs.files).toHaveLength(2);
      expect(mediaOutputs.files[0].filename).toBe('img1.png');
      expect(mediaOutputs.files[1].filename).toBe('anim.gif');
    });
  });

  describe('total getter', () => {
    it('returns the total number of files', () => {
      const item = {
        outputs: {
          '1': {
            images: [
              { filename: 'img1.png', subfolder: '', type: 'output' },
              { filename: 'img2.png', subfolder: '', type: 'output' },
            ],
          },
          '2': {
            gifs: [
              { filename: 'anim.gif', subfolder: 'gifs', type: 'output' },
            ],
          },
        },
      };

      const mediaOutputs = new MediaOutputs(item);

      expect(mediaOutputs.total).toBe(3);
    });

    it('returns zero for empty outputs', () => {
      const item = {};

      const mediaOutputs = new MediaOutputs(item);

      expect(mediaOutputs.total).toBe(0);
    });

    it('total matches files.length', () => {
      const item = {
        outputs: {
          '1': {
            images: [
              { filename: 'img1.png', subfolder: '', type: 'output' },
            ],
          },
          '2': {
            files: [
              { filename: 'file1.txt', subfolder: '', type: 'output' },
              { filename: 'file2.txt', subfolder: '', type: 'output' },
            ],
          },
        },
      };

      const mediaOutputs = new MediaOutputs(item);

      expect(mediaOutputs.total).toBe(mediaOutputs.files.length);
    });
  });
});
