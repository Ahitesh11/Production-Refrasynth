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

export function getDepartmentAverage(deptId: string, entries: any[]): { val: string, unit: string } | null {
  const rows = entries.filter(e => e.departmentId === deptId);
  if (!rows.length) return null;

  const getV = (e: any, k1: string, k2: string, k3?: string) => {
    let v = parseFloat(e.data[k1]);
    if (isNaN(v)) v = parseFloat(e.data[k2]);
    if (isNaN(v) && k3) v = parseFloat(e.data[k3]);
    return !isNaN(v) ? v : NaN;
  };

  const calc = (nums: number[]) => nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : null;

  if (['dgu', 'balling_disc', 'product_house', 'rm'].includes(deptId)) {
    const al2o3 = rows.map(e => getV(e, 'Al2O3', 'al2o3')).filter(v => !isNaN(v));
    const val = calc(al2o3);
    return val ? { val: `${val}%`, unit: 'Al₂O₃' } : null;
  }
  
  if (deptId === 'kiln') {
    const ap = rows.map(e => getV(e, 'AP Composite (24hr)', 'ap_composite', 'AP Composite')).filter(v => !isNaN(v));
    const val = calc(ap);
    return val ? { val: `${val}`, unit: 'AP' } : null;
  }
  
  return null;
}
