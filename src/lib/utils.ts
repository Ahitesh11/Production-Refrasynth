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

export function parseGlobalDate(d: any): number {
  if (!d) return 0;
  const s = String(d).trim();
  if (!s) return 0;

  // Handle DD/MM/YYYY HH:mm:ss format (e.g., "09/03/2026 12:34:21")
  const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(.*))?/);
  if (match) {
    const p1 = parseInt(match[1], 10);
    const p2 = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    const time = match[4] ? `T${match[4]}` : 'T00:00:00';
    
    // JS Date parses ISO 8601 strictly as YYYY-MM-DD
    // If p2 > 12, it must be MM/DD/YYYY
    if (p2 > 12 && p1 <= 12) {
      const parsed = new Date(`${year}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}${time}`).getTime();
      if (!isNaN(parsed)) return parsed;
    } else {
      // Treat as DD/MM/YYYY
      const parsed = new Date(`${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}${time}`).getTime();
      if (!isNaN(parsed)) return parsed;
    }
  }

  // Fallback
  const parsed = new Date(s).getTime();
  return isNaN(parsed) ? 0 : parsed;
}
