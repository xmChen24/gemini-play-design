import { Play, PlayerRole } from '../types';

const STORAGE_KEY = 'playmaker_plays_v1';

const generateId = () => {
    // Simple ID generator if uuid not available, but usually we'd use a lib.
    // Using random string for MVP independence
    return Math.random().toString(36).substring(2, 15);
};

const EXAMPLE_PLAYS: Play[] = [
  {
    id: 'example-1',
    name: 'Flood Right',
    formation: 'Trips Right',
    tags: ['Zone Beater', 'Medium Yardage'],
    notes: 'Overload the right side of the field. QB reads high to low.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players: [
      { id: 'p1', label: 'QB', role: PlayerRole.OFFENSE, x: 50, y: 80, color: '#2563eb', route: [] },
      { id: 'p2', label: 'C', role: PlayerRole.OFFENSE, x: 50, y: 60, color: '#2563eb', route: [{x: 50, y: 50}, {x: 40, y: 45}] },
      { id: 'p3', label: 'WR1', role: PlayerRole.OFFENSE, x: 85, y: 60, color: '#2563eb', route: [{x: 85, y: 10}] },
      { id: 'p4', label: 'WR2', role: PlayerRole.OFFENSE, x: 75, y: 60, color: '#2563eb', route: [{x: 75, y: 40}, {x: 90, y: 40}] },
      { id: 'p5', label: 'RB', role: PlayerRole.OFFENSE, x: 60, y: 80, color: '#2563eb', route: [{x: 90, y: 70}] },
    ]
  },
  {
    id: 'example-2',
    name: 'Mesh',
    formation: 'Spread',
    tags: ['Man Beater', 'Short Yardage'],
    notes: 'Inside receivers cross close enough to high-five.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players: [
      { id: 'p1', label: 'QB', role: PlayerRole.OFFENSE, x: 50, y: 80, color: '#2563eb', route: [] },
      { id: 'p2', label: 'C', role: PlayerRole.OFFENSE, x: 50, y: 60, color: '#2563eb', route: [{x: 50, y: 50}, {x: 50, y: 40}] },
      { id: 'p3', label: 'SL', role: PlayerRole.OFFENSE, x: 35, y: 60, color: '#2563eb', route: [{x: 35, y: 55}, {x: 65, y: 55}] },
      { id: 'p4', label: 'SR', role: PlayerRole.OFFENSE, x: 65, y: 60, color: '#2563eb', route: [{x: 65, y: 58}, {x: 35, y: 58}] },
      { id: 'p5', label: 'WR', role: PlayerRole.OFFENSE, x: 10, y: 60, color: '#2563eb', route: [{x: 10, y: 20}] },
    ]
  }
];

export const getPlays = (): Play[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(EXAMPLE_PLAYS));
    return EXAMPLE_PLAYS;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const savePlay = (play: Play): void => {
  const plays = getPlays();
  const index = plays.findIndex(p => p.id === play.id);
  if (index >= 0) {
    plays[index] = { ...play, updatedAt: Date.now() };
  } else {
    plays.push({ ...play, createdAt: Date.now(), updatedAt: Date.now() });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plays));
};

export const deletePlay = (id: string): void => {
  const plays = getPlays().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plays));
};

export const createEmptyPlay = (): Play => {
  return {
    id: generateId(),
    name: 'New Play',
    formation: 'Standard',
    tags: [],
    notes: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players: [
      { id: generateId(), label: 'QB', role: PlayerRole.OFFENSE, x: 50, y: 80, color: '#2563eb', route: [] },
      { id: generateId(), label: 'C', role: PlayerRole.OFFENSE, x: 50, y: 60, color: '#2563eb', route: [] },
      { id: generateId(), label: 'L', role: PlayerRole.OFFENSE, x: 20, y: 60, color: '#2563eb', route: [] },
      { id: generateId(), label: 'R', role: PlayerRole.OFFENSE, x: 80, y: 60, color: '#2563eb', route: [] },
      { id: generateId(), label: 'RB', role: PlayerRole.OFFENSE, x: 40, y: 80, color: '#2563eb', route: [] },
    ]
  };
};