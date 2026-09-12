'use client';
import { createTheme } from '@mui/material/styles';

export function buildTheme(dark) {
  return createTheme({
    palette: {
      mode: dark ? 'dark' : 'light',
      background: {
        default: 'var(--qm-bg)',
        paper: 'var(--qm-surface)',
      },
      text: {
        primary: 'var(--qm-fg)',
        secondary: 'var(--qm-fg-muted)',
      },
      primary: {
        main: 'var(--qm-primary)',
        contrastText: 'var(--qm-primary-fg)',
      },
      error: {
        main: 'var(--qm-danger)',
      },
      divider: 'var(--qm-border)',
    },
    typography: {
      fontFamily: 'var(--qm-font)',
    },
  });
}
