import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCurrentShift() {
  const now = new Date();
  const hour = now.getHours();
  
  // Shift A: 06:00 - 14:00
  // Shift B: 14:00 - 22:00
  // Shift C: 22:00 - 06:00
  
  if (hour >= 6 && hour < 14) return 'Shift A';
  if (hour >= 14 && hour < 22) return 'Shift B';
  return 'Shift C';
}
