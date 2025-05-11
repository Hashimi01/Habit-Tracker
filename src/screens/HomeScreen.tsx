import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert,
  Image,
  StatusBar,
  I18nManager,
  Dimensions,
  Platform,
  Animated,
  Easing
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getHabits, deleteHabit } from '../utils/habitStorage';
import { Habit, RootStackParamList, CommitmentHabit, CommitmentLog } from '../types';
import { COLORS, SPACING } from '../theme';

// Force RTL layout direction
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const { width } = Dimensions.get('window');

// Define navigation prop type specifically for HomeScreen
type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Home'
>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [habits, setHabits] = useState<Habit[]>([]);
  const scrollY = new Animated.Value(0);

  // Add the pulse animation logic
  // Create a pulse animation for the Add button
  const [pulseAnim] = useState(new Animated.Value(1));
  
  // Start the pulse animation when the component mounts
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        })
      ])
    ).start();
  }, []);

  const loadHabits = useCallback(async () => {
    const storedHabits = await getHabits();
    
    // Calculate commitment percentages for commitment habits if not already set
    const updatedHabits = storedHabits.map(habit => {
      if (habit.type === 'commitment') {
        const commitmentHabit = habit as CommitmentHabit;
        if (commitmentHabit.logs.length > 0 && !('commitmentPercentage' in commitmentHabit)) {
          const totalLogs = commitmentHabit.logs.length;
          const committedLogs = commitmentHabit.logs.filter((log: CommitmentLog) => log.committed).length;
          const commitmentPercentage = (committedLogs / totalLogs) * 100;
          
          // Update the habit with the calculated percentage
          return {
            ...commitmentHabit,
            commitmentPercentage: commitmentPercentage
          };
        }
      }
      return habit;
    });
    
    // Save the updated habits if any percentages were calculated
    const needsUpdate = updatedHabits.some((habit, index) => 
      habit.type === 'commitment' && 
      'commitmentPercentage' in habit && habit.commitmentPercentage !== undefined && 
      storedHabits[index].type === 'commitment' && 
      !('commitmentPercentage' in storedHabits[index] as any)
    );
    
    if (needsUpdate) {
      // Import the updateHabits function
      const { updateHabits } = require('../utils/habitStorage');
      await updateHabits(updatedHabits);
    }
    
    setHabits(updatedHabits);
  }, []);

  // useFocusEffect runs when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadHabits();
    }, [loadHabits])
  );

  const handleDeleteHabit = async (habitId: string, habitName: string) => {
    Alert.alert(
      'تأكيد الحذف',
      `هل أنت متأكد من حذف "${habitName}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { 
          text: 'حذف', 
          onPress: async () => {
            try {
              const updatedHabits = await deleteHabit(habitId);
              setHabits(updatedHabits);
            } catch (error) {
              console.error('Failed to delete habit:', error);
              Alert.alert('خطأ', 'حدث خطأ أثناء حذف العادة.');
            }
          },
          style: 'destructive'
        },
      ]
    );
  };

  const getHabitIcon = (type: string) => {
    if (type === 'quantitative') {
      return '📊'; // Chart emoji for quantitative habits
    } else {
      return '✅'; // Checkbox emoji for commitment habits
    }
  };

  const getHabitGradient = (type: string) => {
    if (type === 'quantitative') {
      return [COLORS.primaryLight, COLORS.primary]; // Gradient for quantitative habits
    } else {
      return [COLORS.secondaryLight, COLORS.secondary]; // Gradient for commitment habits
    }
  };

  const getProgressColor = (percentage?: number) => {
    if (!percentage) return COLORS.grayLight;
    if (percentage < 30) return COLORS.error;
    if (percentage < 70) return COLORS.warning;
    return COLORS.success;
  };

  const renderHabit = ({ item, index }: { item: Habit, index: number }) => {
    // Calculate progress for commitment habits
    let progress = 0;
    if (item.type === 'commitment' && 'commitmentPercentage' in item && item.commitmentPercentage !== undefined) {
      progress = item.commitmentPercentage / 100;
    }
    
    const progressColor = getProgressColor(
      item.type === 'commitment' && 'commitmentPercentage' in item 
        ? item.commitmentPercentage 
        : undefined
    );

    return (
      <Animated.View
        style={[
          styles.habitCardContainer,
          {
            transform: [
              { 
                scale: scrollY.interpolate({
                  inputRange: [
                    -100, 
                    0, 
                    (index * (80 + SPACING.md) + 50), 
                    ((index + 1) * (80 + SPACING.md) + 50)
                  ],
                  outputRange: [1, 1, 1, 0.97],
                  extrapolate: 'clamp'
                }) 
              }
            ],
            opacity: scrollY.interpolate({
              inputRange: [
                -50, 
                0, 
                (index * (80 + SPACING.md) + 100), 
                ((index + 1) * (80 + SPACING.md) + 100)
              ],
              outputRange: [1, 1, 1, 0.6],
              extrapolate: 'clamp'
            })
          }
        ]}
      >
    <TouchableOpacity 
      style={styles.habitCard}
      onPress={() => navigation.navigate('HabitDetail', { habitId: item.id })}
          activeOpacity={0.9}
    >
          <View 
            style={[
              styles.habitIconContainer,
              { backgroundColor: item.type === 'quantitative' ? 'rgba(74, 111, 165, 0.15)' : 'rgba(255, 126, 103, 0.15)' }
            ]}
          >
        <Text style={styles.habitIcon}>{getHabitIcon(item.type)}</Text>
      </View>
      
      <View style={styles.habitInfo}>
        <Text style={styles.habitName} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
            <View style={styles.habitDetails}>
        <Text style={styles.habitType} numberOfLines={1} ellipsizeMode="tail">
          {item.type === 'quantitative' ? 'كمي' : 'التزام'}
          {item.type === 'quantitative' && ` • ${item.goal} ${item.unit}`}
              </Text>
              {item.type === 'commitment' && 'commitmentPercentage' in item && item.commitmentPercentage !== undefined && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${Math.min(100, item.commitmentPercentage)}%`,
                          backgroundColor: progressColor
                        }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.progressText, { color: progressColor }]}>
                    {item.commitmentPercentage.toFixed(0)}%
        </Text>
                </View>
              )}
            </View>
      </View>
      
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => handleDeleteHabit(item.id, item.name)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.deleteButtonText}>حذف</Text>
      </TouchableOpacity>
    </TouchableOpacity>
      </Animated.View>
    );
  };

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, -50],
    extrapolate: 'clamp'
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp'
  });

  const titleScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.8],
    extrapolate: 'clamp'
  });

  // Add header background color animation
  const headerBackgroundColor = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [COLORS.primary, COLORS.primaryDark],
    extrapolate: 'clamp'
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      
      <Animated.View 
        style={[
          styles.headerContainer, 
          { 
            opacity: headerOpacity,
            backgroundColor: headerBackgroundColor,
            transform: [
              { translateY: headerTranslateY }
            ]
          }
        ]}
      >
        <Animated.Text 
          style={[
            styles.title,
            { 
              transform: [{ scale: titleScale }],
              opacity: headerOpacity
            }
          ]}
        >
          عاداتي
        </Animated.Text>
        <Text style={styles.subtitle}>تتبع عاداتك وحقق أهدافك</Text>
      </Animated.View>
      
      {habits.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
          <Text style={styles.emptyIcon}>🌱</Text>
          </View>
          <Text style={styles.emptyTitle}>لم تقم بإضافة أي عادات بعد</Text>
          <Text style={styles.emptySubtitle}>أضف عادتك الأولى للبدء في تتبع تقدمك</Text>
          <TouchableOpacity 
            style={styles.emptyAddButton}
            onPress={() => navigation.navigate('AddHabit')}
          >
            <Text style={styles.emptyAddButtonText}>إضافة عادة جديدة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.FlatList
          data={habits}
          renderItem={renderHabit}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        />
      )}
      
      {habits.length > 0 && (
        <Animated.View style={[
          styles.addButton,
          {
            transform: [
              { scale: pulseAnim }
            ]
          }
        ]}>
      <TouchableOpacity 
            style={styles.addButtonTouchable}
        onPress={() => navigation.navigate('AddHabit')}
      >
            <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 10,
    height: 170,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.white,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyIconContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(74, 111, 165, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyIcon: {
    fontSize: 70,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 34,
  },
  emptySubtitle: {
    fontSize: 16,
    color: COLORS.textMedium,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 24,
    marginBottom: SPACING.xl,
  },
  emptyAddButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 15,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    marginTop: SPACING.lg
  },
  emptyAddButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  list: {
    padding: SPACING.md,
    paddingTop: SPACING.xl,
  },
  habitCardContainer: {
    marginBottom: SPACING.md,
    width: '100%',
  },
  habitCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    height: 90,
  },
  habitIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    marginLeft: SPACING.xs,
  },
  habitIcon: {
    fontSize: 28,
  },
  habitInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  habitName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textDark,
    marginBottom: 6,
    includeFontPadding: false,
    textAlign: 'right',
  },
  habitDetails: {
    flexDirection: 'column',
  },
  habitType: {
    fontSize: 14,
    color: COLORS.textMedium,
    includeFontPadding: false,
    textAlign: 'right',
    marginBottom: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 3,
    flex: 1,
    overflow: 'hidden',
    marginLeft: SPACING.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginLeft: SPACING.sm,
  },
  deleteButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
    includeFontPadding: false,
  },
  addButton: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 32,
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 36,
  },
  addButtonTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
});

export default HomeScreen;

