"use client";

import "./globals.scss";
import {useState} from "react";
import {AppContext} from "@/internals/app-context";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

import { Roboto } from 'next/font/google';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../theme';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});


export default function RootLayout({children}) {
  const [appStatus, setAppStatus] = useState({
    loading: true,
    error: null,
    queue: null,
    route: 'queue', // queue, archive, bin
    shiftDown: false,
    clientId: null,
    filters: null
  });



  return (
    <AppContext.Provider value={{appStatus, setAppStatus}}>
      <html lang="en" className={roboto.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>Queue Manager</title>
        <meta name="description" content="ComfyUI Queue Manager frontend"/>
      </head>
      <body className={`route-${appStatus.route}`}>
      <AppRouterCacheProvider>
        <ThemeProvider  theme={theme} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </AppRouterCacheProvider>
      </body>
      </html>
    </AppContext.Provider>
  );
}
