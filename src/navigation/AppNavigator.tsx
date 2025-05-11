import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, I18nManager, Image } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import AddHabitScreen from '../screens/AddHabitScreen';
import StatsScreen from '../screens/StatsScreen';
import HabitDetailScreen from '../screens/HabitDetailScreen';
import AboutScreen from '../screens/AboutScreen';
import { RootStackParamList } from '../types';
import { COLORS } from '../theme';

// Force RTL layout direction
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// Icon component for the tabs
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => (
  <View
    style={{
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 10,
      width: 90, // Increase width for tab icons
    }}
  >
    <Text
      style={{
        fontSize: 24,
        color: focused ? COLORS.primary : COLORS.grayMedium,
      }}
    >
      {name === 'Home' ? '🏠' : name === 'Stats' ? '📊' : '➕'}
    </Text>
    <Text
      style={{
        fontSize: 13,
        color: focused ? COLORS.primary : COLORS.grayMedium,
        marginTop: 3,
        includeFontPadding: false,
        textAlign: 'center',
        textAlignVertical: 'center',
        width: '100%',
        paddingHorizontal: 2,
        height: 20, // Fixed height for text container
      }}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {name === 'Home' ? 'الرئيسية' : name === 'Stats' ? 'الإحصاء' : 'إضافة'}
    </Text>
  </View>
);

// Tab Navigator
const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          height: 75, // Slightly increased height
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          elevation: 10,
          shadowColor: COLORS.shadow,
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 5,
          paddingBottom: 5,
        },
        tabBarShowLabel: false,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="AddHabitTab"
        component={AddHabitScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Add" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="StatsTab"
        component={StatsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Stats" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="About"
        component={AboutScreen}
        options={{
          tabBarLabel: 'عن التطبيق',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="info-circle" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.primary,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerTitle: () => (
            <Image
              source={require('../assets/logo.png')}
              style={{ width: 35, height: 35, resizeMode: 'contain' }}
            />
          ),
          headerTitleAlign: 'center',
        }}
      >
        <Stack.Screen
          name="Home"
          component={TabNavigator}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="AddHabit"
          component={AddHabitScreen}
          options={{
            title: 'إضافة عادة جديدة',
          }}
        />
        <Stack.Screen
          name="HabitDetail"
          component={HabitDetailScreen}
          options={{
            headerShown: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

