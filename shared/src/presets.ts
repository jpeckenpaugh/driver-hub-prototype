import { Coordinates, Driver, LocationPoint, Rider } from './types.js';

/**
 * Coordenadas centrales de la zona de demostración: Orlando Tourist Corridor (I-Drive / Universal / Convention Ctr)
 */
export const ORLANDO_CENTER: Coordinates = {
  lat: 28.4500,
  lng: -81.4700,
};

// Compatibilidad retroactiva con nombres anteriores
export const MADRID_CENTER = ORLANDO_CENTER;

/**
 * Puntos de demostración emblemáticos y realistas en Orlando, FL
 */
export const ORLANDO_PRESETS: LocationPoint[] = [
  {
    name: 'Universal Studios Florida',
    address: '6000 Universal Blvd, Orlando, FL 32819',
    lat: 28.4744,
    lng: -81.4678,
  },
  {
    name: 'The Ritz-Carlton Grande Lakes',
    address: '4012 Central Florida Pkwy, Orlando, FL 32837',
    lat: 28.4067,
    lng: -81.4332,
  },
  {
    name: 'Orange County Convention Center',
    address: '9800 International Dr, Orlando, FL 32819',
    lat: 28.4285,
    lng: -81.4647,
  },
  {
    name: "The Capital Grille (Fine Dining)",
    address: '9101 International Dr, Orlando, FL 32819',
    lat: 28.4382,
    lng: -81.4695,
  },
  {
    name: 'Disney Springs (Marketplace)',
    address: '1486 Buena Vista Dr, Lake Buena Vista, FL 32830',
    lat: 28.3712,
    lng: -81.5175,
  },
  {
    name: 'Orlando International Airport (MCO Terminals)',
    address: '1 Jeff Fuqua Blvd, Orlando, FL 32827',
    lat: 28.4312,
    lng: -81.3081,
  },
];

export const MADRID_PRESETS = ORLANDO_PRESETS;

/**
 * Red de carreteras vectoriales offline de Orlando (I-4, International Drive, Universal Blvd, Sand Lake Rd, Beachline SR-528)
 */
export interface RoadSegment {
  name: string;
  type: 'highway' | 'arterial' | 'local';
  coordinates: Coordinates[];
}

export const ORLANDO_OFFLINE_ROADS: RoadSegment[] = [
  // Interstate 4 (I-4 corridor)
  {
    name: 'Interstate 4 (I-4)',
    type: 'highway',
    coordinates: [
      { lat: 28.4950, lng: -81.4500 },
      { lat: 28.4800, lng: -81.4600 },
      { lat: 28.4600, lng: -81.4720 },
      { lat: 28.4450, lng: -81.4850 },
      { lat: 28.4300, lng: -81.4980 },
      { lat: 28.4050, lng: -81.5100 },
      { lat: 28.3750, lng: -81.5250 },
    ],
  },
  // International Drive (I-Drive Main Strip)
  {
    name: 'International Drive',
    type: 'arterial',
    coordinates: [
      { lat: 28.4720, lng: -81.4550 },
      { lat: 28.4550, lng: -81.4630 },
      { lat: 28.4382, lng: -81.4695 }, // Capital Grille
      { lat: 28.4285, lng: -81.4647 }, // Convention Ctr
      { lat: 28.4150, lng: -81.4600 },
      { lat: 28.3900, lng: -81.4750 },
    ],
  },
  // Universal Boulevard
  {
    name: 'Universal Boulevard',
    type: 'arterial',
    coordinates: [
      { lat: 28.4744, lng: -81.4678 }, // Universal Studios
      { lat: 28.4580, lng: -81.4520 },
      { lat: 28.4380, lng: -81.4480 },
      { lat: 28.4250, lng: -81.4490 },
      { lat: 28.4100, lng: -81.4550 },
    ],
  },
  // Sand Lake Road (Restaurant Row connector)
  {
    name: 'W Sand Lake Road',
    type: 'arterial',
    coordinates: [
      { lat: 28.4500, lng: -81.4950 },
      { lat: 28.4500, lng: -81.4720 },
      { lat: 28.4500, lng: -81.4520 },
      { lat: 28.4500, lng: -81.4300 },
    ],
  },
  // SR-528 Beachline Expressway (Connector to MCO Airport)
  {
    name: 'SR-528 Beachline Pkwy',
    type: 'highway',
    coordinates: [
      { lat: 28.4280, lng: -81.4640 },
      { lat: 28.4280, lng: -81.4200 },
      { lat: 28.4300, lng: -81.3600 },
      { lat: 28.4312, lng: -81.3081 }, // MCO
    ],
  },
  // Central Florida Parkway (Connects Ritz-Carlton)
  {
    name: 'Central Florida Pkwy',
    type: 'local',
    coordinates: [
      { lat: 28.4150, lng: -81.4600 },
      { lat: 28.4100, lng: -81.4450 },
      { lat: 28.4067, lng: -81.4332 }, // Ritz-Carlton
    ],
  },
  // Buena Vista Dr connector (Disney Springs)
  {
    name: 'Buena Vista Dr',
    type: 'local',
    coordinates: [
      { lat: 28.3750, lng: -81.5250 },
      { lat: 28.3712, lng: -81.5175 }, // Disney Springs
    ],
  },
];

/**
 * Conductores iniciales posicionados en Orlando, FL
 */
export const INITIAL_MOCK_DRIVERS: Driver[] = [
  {
    id: 'driver-1',
    name: 'Marcus Vance',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    vehicle: {
      model: 'Cadillac Escalade',
      plate: 'ORL-4921',
      color: 'Black Sapphire',
    },
    rating: 4.96,
    status: 'available',
    currentLocation: {
      lat: 28.4420,
      lng: -81.4680, // Cerca de International Dr
    },
    heading: 180,
  },
  {
    id: 'driver-2',
    name: 'Sarah Jenkins',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    vehicle: {
      model: 'Tesla Model Y',
      plate: 'SUN-7720',
      color: 'Pearl White',
    },
    rating: 4.98,
    status: 'available',
    currentLocation: {
      lat: 28.4680,
      lng: -81.4650, // Cerca de Universal Studios
    },
    heading: 90,
  },
];

export const DEFAULT_MOCK_RIDER: Rider = {
  id: 'rider-1',
  name: 'David Miller',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  rating: 4.95,
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
  { id: 'standard', name: 'Orlando UberX', multiplier: 1.0, icon: 'Car', etaMinutes: 3 },
  { id: 'comfort', name: 'Comfort SUV', multiplier: 1.4, icon: 'Sparkles', etaMinutes: 4 },
  { id: 'black', name: 'Executive Black', multiplier: 2.1, icon: 'Shield', etaMinutes: 6 }
];
