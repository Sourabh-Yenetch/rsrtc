
export enum Language {
  ENGLISH = 'en-IN',
  HINDI = 'hi-IN',
}

export interface Location {
  en: string;
  hi: string;
}

export interface Bus {
  id: string;
  name: string;
  type: 'Express' | 'Deluxe' | 'Volvo' | 'Sleeper';
  from: Location;
  to: Location;
  departureTime: string; // HH:mm
  arrivalTime: string; // HH:mm
  duration: string; // Xh Ym
  fare: number;
  platform: number;
  route: Location[];
}
