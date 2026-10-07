import { Coordinates, Driver, LocationPoint, Rider } from './types.js';

export const MADRID_CENTER: Coordinates = {
  lat: 40.4168,
  lng: -3.7038,
};

export const MADRID_PRESETS: LocationPoint[] = [
  {
    name: 'Puerta del Sol',
    address: 'Plaza de la Puerta del Sol, Madrid',
    lat: 40.4168,
    lng: -3.7038,
  },
  {
    name: 'Aeropuerto T4',
    address: 'Av. de la Hispanidad, s/n, Barajas, Madrid',
    lat: 40.4983,
    lng: -3.5676,
  },
  {
    name: 'Estación de Atocha',
    address: 'Plaza del Emperador Carlos V, Madrid',
    lat: 40.4065,
    lng: -3.6907,
  },
  {
    name: 'Estadio Bernabéu',
    address: 'Av. de Concha Espina, 1, Madrid',
    lat: 40.4530,
    lng: -3.6883,
  },
  {
    name: 'Parque del Retiro',
    address: 'Plaza de la Independencia, 7, Madrid',
    lat: 40.4153,
    lng: -3.6844,
  },
];

export const INITIAL_MOCK_DRIVERS: Driver[] = [
  {
    id: 'driver-1',
    name: 'Carlos Gómez',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    vehicle: {
      model: 'Toyota Corolla',
      plate: '4829-KLM',
      color: 'Blanco',
    },
    rating: 4.9,
    status: 'available',
    currentLocation: {
      lat: 40.4200,
      lng: -3.7050,
    },
    heading: 90,
  },
  {
    id: 'driver-2',
    name: 'Lucía Morales',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    vehicle: {
      model: 'Tesla Model 3',
      plate: '9211-MTR',
      color: 'Gris Grafito',
    },
    rating: 4.95,
    status: 'available',
    currentLocation: {
      lat: 40.4120,
      lng: -3.6920,
    },
    heading: 180,
  },
];

export const DEFAULT_MOCK_RIDER: Rider = {
  id: 'rider-1',
  name: 'Alejandro Sanz',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  rating: 4.92,
};

export const DEFAULT_RIDER = DEFAULT_MOCK_RIDER;
export const DEFAULT_DRIVER = INITIAL_MOCK_DRIVERS[0];

export interface VehicleTierOption {
  id: 'standard' | 'comfort' | 'black';
  name: string;
  multiplier: number;
  icon: string;
  etaMinutes: number;
}

export const VEHICLE_TIERS: VehicleTierOption[] = [
  { id: 'standard', name: 'Standard', multiplier: 1.0, icon: 'Car', etaMinutes: 3 },
  { id: 'comfort', name: 'Comfort', multiplier: 1.4, icon: 'Sparkles', etaMinutes: 4 },
  { id: 'black', name: 'Black VIP', multiplier: 2.0, icon: 'Shield', etaMinutes: 6 }
];
