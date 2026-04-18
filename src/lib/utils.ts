import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const adjustWorkWeek = (date: Date) => {
  const day = date.getDay();
  if (day === 0) {
    return new Date(date.setDate(date.getDate() + 1));
  }
  if (day === 6) {
    return new Date(date.setDate(date.getDate() + 2));
  }
  return date;
};
