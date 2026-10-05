import React, { useState, useEffect, useRef } from 'react';
import { ScannerLogic } from './scannerLogic';
import { ScannerBridge } from './scannerBridge';
import { Strategy } from './strategies';
import { useScannerFeed } from './useScannerFeed'; // 1. Import your hook
import './FloatingAI.css';
 
const scanner = new ScannerLogic();

export const FloatingAI: React.FC = () => {
  // 2. Invoke the feed hook so it starts listening to live websocket market ticks on mount
  useScannerFeed();

  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  // ... rest of your component code stays identical
