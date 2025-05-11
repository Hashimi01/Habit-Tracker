export type HabitType = 'quantitative' | 'commitment';

// Define Achievement interface
export interface Achievement {
  id: string;
  date: string; // ISO Date string
  name: string;
  notes?: string;
}

export interface BaseHabit {
  id: string;
  name: string;
  type: HabitType;
  createdAt: string; // ISO Date string
  // Reminder settings (common)
  reminderTimes?: string[]; // e.g., ["10:00", "18:00", "00:00"]
  // Achievements
  achievements?: Achievement[];
}

export interface QuantitativeHabit extends BaseHabit {
  type: 'quantitative';
  goal: number;
  unit: string; // e.g., 'km', 'pages', 'minutes'
  frequency: 'daily' | 'weekly' | number[]; // Or specific days [0, 1, 6] for Sun, Mon, Sat
  // Logs for quantitative habits
  logs: QuantitativeLog[];
}

export interface CommitmentHabit extends BaseHabit {
  type: 'commitment';
  // Logs for commitment habits
  logs: CommitmentLog[];
  // Streak tracking
  currentStreak: number;
  longestStreak: number;
  lastCheckIn?: string; // ISO Date string - To track consistency
  commitmentPercentage?: number; // Percentage of commitment adherence
}

export interface QuantitativeLog {
  id: string;
  date: string; // ISO Date string
  value: number;
  notes?: string;
}

export interface CommitmentLog {
  id: string;
  date: string; // ISO Date string
  committed: boolean; // Did the user adhere?
  notes?: string;
}

export type Habit = QuantitativeHabit | CommitmentHabit;

// Define types for the navigation stack parameters
export type RootStackParamList = {
  Home: undefined; // Main tab navigator
  AddHabit: undefined; // Add habit screen
  Stats: undefined; // Stats screen
  HabitDetail: { habitId: string }; // Habit detail screen with habitId parameter
};

