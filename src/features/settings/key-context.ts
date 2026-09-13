'use client';

import type { useXcityKeyState } from './hooks/use-xcity-key';
import { createContext } from 'react';

export const XcityKeyContext = createContext<ReturnType<typeof useXcityKeyState> | null>(null);
