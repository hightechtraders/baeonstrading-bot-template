import React, { useState, useEffect } from 'react';
import { ScannerBridge } from '../../Aiscanner/scannerBridge';
import './ManualTraderTab.scss';

function ProfessionalDigitGauge({ digit, percentage, isSelected, trendMode }) {
  const circleRadius = 18;
  const lineThickness = 3.5;
  const pathCircumference = 2 * Math.PI * circleRadius;
  
  const operationalScale = 15;
  const scaledValue = Math.min(percentage, operationalScale);
  const strokeOffsetProgress = pathCircumference - (scaledValue / operationalScale) * pathCircumference;
  
  let themeConfig = {
    labelColor: '#9ca3af',
    valueColor: 'var(--text-prominent)',
    trackColor: 'rgba(255, 255, 255, 0.08)',
    activeColor: '#6b7280',
    background: 'transparent',
    glow: 'none'
  };

  if (trendMode === 'selected' || isSelected) {
    themeConfig = {
      labelColor: '#818cf8',
      valueColor: '#ffffff',
      trackColor: '#1e1b4b',
      activeColor: '#6366f1',
      background: 'rgba(99, 102, 241, 0.15)',
      glow: '0 0 12px rgba(99, 102, 241, 0.4)'
    };
  } else if (trendMode === 'high') {
    themeConfig = {
