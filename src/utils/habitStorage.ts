import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '../types';

const HABITS_STORAGE_KEY = '@HabitTrackerApp:habits';

// Function to get all habits from storage
export const getHabits = async (): Promise<Habit[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(HABITS_STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error('Error reading habits from storage', e);
    return [];
  }
};

// Function to save all habits to storage
export const saveHabits = async (habits: Habit[]): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(habits);
    await AsyncStorage.setItem(HABITS_STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error('Error saving habits to storage', e);
  }
};

// Function to add a new habit
export const addHabit = async (newHabit: Habit): Promise<Habit[]> => {
  try {
    const currentHabits = await getHabits();
    const updatedHabits = [...currentHabits, newHabit];
    await saveHabits(updatedHabits);
    return updatedHabits;
  } catch (e) {
    console.error('Error adding habit', e);
    return await getHabits(); // Return current habits if add fails
  }
};

// Function to update an existing habit
export const updateHabit = async (updatedHabit: Habit): Promise<Habit[]> => {
  try {
    const currentHabits = await getHabits();
    const updatedHabits = currentHabits.map(habit =>
      habit.id === updatedHabit.id ? updatedHabit : habit
    );
    await saveHabits(updatedHabits);
    return updatedHabits;
  } catch (e) {
    console.error('Error updating habit', e);
    return await getHabits(); // Return current habits if update fails
  }
};

// Function to delete a habit by ID
export const deleteHabit = async (habitId: string): Promise<Habit[]> => {
  try {
    const currentHabits = await getHabits();
    const updatedHabits = currentHabits.filter(habit => habit.id !== habitId);
    await saveHabits(updatedHabits);
    return updatedHabits;
  } catch (e) {
    console.error('Error deleting habit', e);
    return await getHabits(); // Return current habits if delete fails
  }
};

// Function to update multiple habits at once
export const updateHabits = async (habits: Habit[]): Promise<Habit[]> => {
  try {
    await saveHabits(habits);
    return habits;
  } catch (e) {
    console.error('Error updating habits', e);
    return await getHabits(); // Return current habits if update fails
  }
};

