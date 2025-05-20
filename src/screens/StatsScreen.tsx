import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  SafeAreaView, 
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StatusBar,
  TouchableWithoutFeedback,
  Image
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { getHabits } from '../utils/habitStorage';
import { Habit, QuantitativeHabit, CommitmentHabit } from '../types';
import { COLORS, SPACING } from '../theme';

const { width } = Dimensions.get('window');

type PeriodType = 'week' | 'month' | 'all';
type ViewMode = 'all' | 'quantitative' | 'commitment';

type ActivityDataPoint = {
  date: string;
  value: number;
  label: string;
  committed?: boolean;
  completedTasks?: number;
};

// Define proper tooltip position types
type TooltipPosition = {
  x: number;
  y: number;
  index: number;
};

const StatsScreen = () => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('week');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [quantitativeData, setQuantitativeData] = useState<any[]>([]);
  const [commitmentData, setCommitmentData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [activityData, setActivityData] = useState<ActivityDataPoint[]>([]);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const chartFadeAnim = useRef(new Animated.Value(0)).current;

  // تعديل نمط عرض التلميحات
  const [commitmentTooltip, setCommitmentTooltip] = useState<{
    visible: boolean;
    label?: string;
    value?: number;
    position?: number;
  }>({ visible: false });
  
  const [activityTooltip, setActivityTooltip] = useState<{
    visible: boolean;
    label?: string;
    value?: number;
    date?: string;
    position?: number;
  }>({ visible: false });

  // أضف هذه المراجع
  const commitmentChartRef = useRef<View>(null);
  const activityChartRef = useRef<View>(null);
  
  // إضافة متغيرات لتتبع حالة الزر النشط
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null); // 'commitment' أو 'activity' أو null
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Run entrance animations when view changes
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, [viewMode]);

  useEffect(() => {
    // Run chart animation when data changes
    Animated.timing(chartFadeAnim, {
      toValue: 1,
      duration: 800,
      delay: 300,
      useNativeDriver: true,
    }).start();
    
    return () => {
      chartFadeAnim.setValue(0);
    };
  }, [quantitativeData, commitmentData]);

  const processData = useCallback((loadedHabits: Habit[]) => {
    // Filter habits based on viewMode
    const filteredHabits = viewMode === 'all' 
      ? loadedHabits 
      : loadedHabits.filter(h => h.type === viewMode);
    
    // Process pie chart data for habit types
    const typeCountMap = loadedHabits.reduce((acc, habit) => {
      acc[habit.type] = (acc[habit.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const pieChartData = [
      {
        value: typeCountMap['quantitative'] || 0,
        color: COLORS.primary,
        text: 'كمية',
        focused: viewMode === 'quantitative',
        gradientCenterColor: COLORS.primaryLight,
      },
      {
        value: typeCountMap['commitment'] || 0,
        color: COLORS.secondary,
        text: 'التزام',
        focused: viewMode === 'commitment',
        gradientCenterColor: COLORS.secondaryLight,
      }
    ];
    setPieData(pieChartData);

    // Get time period constraint
    const now = new Date();
    const cutoffDate = new Date();
    if (period === 'week') {
      cutoffDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      cutoffDate.setMonth(now.getMonth() - 1);
    } else {
      // 'all' - use a very old date to include everything
      cutoffDate.setFullYear(2000);
    }

    // Process quantitative data
    let processedQuantData: any[] = [];
    const quantHabits = filteredHabits.filter(h => h.type === 'quantitative') as QuantitativeHabit[];
    
    // Filter by selectedHabitId or take the first habit
    const habitToProcess = selectedHabitId 
      ? quantHabits.find(h => h.id === selectedHabitId) 
      : quantHabits[0];
    
    if (habitToProcess && habitToProcess.logs.length > 0) {
      // Filter logs by time period
      const filteredLogs = habitToProcess.logs.filter(
        log => new Date(log.date) > cutoffDate
      );
      
      // Group logs by date and sum values
      const dailyTotals: { [key: string]: number } = {};
      filteredLogs.forEach(log => {
        const dateStr = new Date(log.date).toLocaleDateString();
        dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + log.value;
      });
      
      // Get max value for better bar heights
      const maxValue = Math.max(...Object.values(dailyTotals), habitToProcess.goal);
      
      // Convert to chart format
      processedQuantData = Object.entries(dailyTotals).map(([date, value], index) => {
        // Calculate if goal is met
        const goalMet = value >= habitToProcess.goal;
        
        return {
          value: value,
          label: date.substring(0, 5),
          frontColor: goalMet ? COLORS.success : COLORS.primary,
          topLabelComponent: () => (
            <Text style={[
              styles.barLabel, 
              { color: goalMet ? COLORS.success : COLORS.primary }
            ]}>
              {value}
            </Text>
          ),
          // Add gradients
          gradientColor: goalMet ? 'rgba(76, 175, 80, 0.5)' : 'rgba(33, 150, 243, 0.5)',
        };
      });
    }
    setQuantitativeData(processedQuantData);

    // Process commitment data
    let processedCommitData: any[] = [];
    const commitHabits = filteredHabits.filter(h => h.type === 'commitment') as CommitmentHabit[];
    
    // Filter by selectedHabitId or take the first habit
    const commitHabitToProcess = selectedHabitId
      ? commitHabits.find(h => h.id === selectedHabitId)
      : commitHabits[0];
      
    if (commitHabitToProcess) {
      // إنشاء مجموعة من التواريخ المسجلة بالفعل للتحقق لاحقًا
      const recordedDates = new Map<string, boolean>();
      
      // إذا كانت هناك سجلات نضيفها للمجموعة
      if (commitHabitToProcess.logs.length > 0) {
        // Filter logs by time period
        const filteredLogs = commitHabitToProcess.logs.filter(
          log => new Date(log.date) > cutoffDate
        );
        
        filteredLogs.forEach(log => {
          const dateStr = new Date(log.date).toLocaleDateString();
          recordedDates.set(dateStr, log.committed);
        });
      }
      
      // إنشاء فترة التواريخ المطلوبة بناء على الفترة المحددة
      const dateRange: Date[] = [];
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // احتساب عدد الأيام بناء على الفترة المحددة
      let daysToInclude = 7; // الافتراضي أسبوع
      if (period === 'month') {
        daysToInclude = 30;
      } else if (period === 'all') {
        // بالنسبة للفترة "الكل"، نستخدم تاريخ القطع فقط
        const timeDiff = today.getTime() - cutoffDate.getTime();
        daysToInclude = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      }
      
      // إنشاء مصفوفة التواريخ
      for (let i = daysToInclude - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        dateRange.push(date);
      }
      
      // تحويل إلى تنسيق الرسم البياني مع إدراج جميع الأيام
      processedCommitData = dateRange.map((date) => {
        const dateStr = date.toLocaleDateString();
        const isRecorded = recordedDates.has(dateStr);
        const isCommitted = isRecorded ? recordedDates.get(dateStr) : false; // إذا لم يسجل، يعتبر غير ملتزم
        
        return {
          value: isCommitted ? 1 : 0,
          label: dateStr.substring(0, 5),
          committed: isCommitted,
          date: dateStr,
          dataPointLabelComponent: () => (
            <Text style={{
              color: isCommitted ? COLORS.success : COLORS.error, 
              fontSize: 14, 
              fontWeight: 'bold',
              backgroundColor: isCommitted ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
              width: 20,
              height: 20,
              textAlign: 'center',
              borderRadius: 10,
              overflow: 'hidden',
              lineHeight: 20
            }}>
              {isCommitted ? '✓' : '✗'}
            </Text>
          ),
          dataPointLabelShiftY: -15,
          dataPointLabelShiftX: 0,
          // Styling
          customDataPoint: () => (
            <View
              style={{
                width: 16,
                height: 16,
                backgroundColor: isCommitted ? COLORS.success : COLORS.error,
                borderRadius: 8
              }}
            />
          ),
          dataPointColor: isCommitted ? COLORS.success : COLORS.error,
        };
      });
    }
    setCommitmentData(processedCommitData);

    // إضافة معالجة لبيانات النشاط اليومي
    if (loadedHabits.length > 0) {
      // إنشاء فترة 7 أيام
      const activityPoints: ActivityDataPoint[] = [];
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // إنشاء نقاط لآخر 7 أيام
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString();
        const dateLabel = `${date.getDate()}/${date.getMonth() + 1}`;
        
        // ابحث عن السجلات في هذا التاريخ
        const dayLogs = loadedHabits.flatMap(habit => 
          habit.logs.filter(log => {
            const logDate = new Date(log.date);
            return logDate.getDate() === date.getDate() && 
                   logDate.getMonth() === date.getMonth() && 
                   logDate.getFullYear() === date.getFullYear();
          })
        );
        
        // احسب عدد السجلات لهذا اليوم
        activityPoints.push({
          date: dateStr,
          value: dayLogs.length,
          label: dateLabel,
        });
      }
      
      setActivityData(activityPoints);
    }

    setLoading(false);
  }, [period, viewMode, selectedHabitId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const storedHabits = await getHabits();
    setHabits(storedHabits);
    processData(storedHabits);
  }, [processData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriod(newPeriod);
    chartFadeAnim.setValue(0);
  };

  const handleViewModeChange = (newMode: ViewMode) => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    chartFadeAnim.setValue(0);
    setViewMode(newMode);
    // Reset selected habit when changing view mode
    setSelectedHabitId(null);
  };

  const handleHabitSelect = (habitId: string) => {
    chartFadeAnim.setValue(0);
    setSelectedHabitId(habitId === selectedHabitId ? null : habitId);
  };

  const renderHabitSelector = () => {
    const relevantHabits = habits.filter(h => 
      viewMode === 'all' || h.type === viewMode
    );
    
    if (relevantHabits.length === 0) return null;
    
    return (
      <Animated.View 
        style={[
          styles.habitSelector,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Text style={styles.selectorTitle}>اختر عادة لعرض إحصائياتها:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {relevantHabits.map(habit => (
            <TouchableOpacity
              key={habit.id}
              style={[
                styles.habitChip,
                selectedHabitId === habit.id && styles.habitChipSelected,
                { 
                  backgroundColor: habit.type === 'quantitative' 
                    ? 'rgba(74, 111, 165, 0.1)' 
                    : 'rgba(255, 126, 103, 0.1)' 
                }
              ]}
              onPress={() => handleHabitSelect(habit.id)}
              activeOpacity={0.7}
            >
              <Text 
                style={[
                  styles.habitChipText,
                  { 
                    color: habit.type === 'quantitative' ? COLORS.primary : COLORS.secondary 
                  },
                  selectedHabitId === habit.id && styles.habitChipTextSelected
                ]}
              >
                {habit.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    );
  };

  const getHabitSummary = () => {
    if (habits.length === 0) return null;
    
    const totalHabits = habits.length;
    const activeHabits = habits.filter(h => {
      const lastLog = h.logs.length > 0 ? h.logs[h.logs.length - 1] : null;
      if (!lastLog) return false;
      
      const lastLogDate = new Date(lastLog.date);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - lastLogDate.getTime()) / (1000 * 60 * 60 * 24));
      
      return daysDiff < 3; // Active if logged in the last 3 days
    }).length;
    
    const completedLogsCount = habits.reduce((sum, habit) => sum + habit.logs.length, 0);
    
    const longestStreak = habits
      .filter(h => h.type === 'commitment')
      .reduce((max, h) => Math.max(max, (h as CommitmentHabit).longestStreak), 0);
    
    return (
      <Animated.View style={[
        styles.summaryContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}>
        <View style={[styles.summaryCard, styles.cardGlow]}>
          <Text style={styles.summaryValue}>{totalHabits}</Text>
          <Text style={styles.summaryLabel}>العادات الكلية</Text>
          <View style={styles.cardIconContainer}>
            <Text style={styles.cardIcon}>📊</Text>
          </View>
        </View>
        
        <View style={[styles.summaryCard, styles.cardGlow]}>
          <Text style={styles.summaryValue}>{activeHabits}</Text>
          <Text style={styles.summaryLabel}>العادات النشطة</Text>
          <View style={[styles.cardIconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
            <Text style={styles.cardIcon}>✅</Text>
          </View>
        </View>
        
        <View style={[styles.summaryCard, styles.cardGlow]}>
          <Text style={styles.summaryValue}>{completedLogsCount}</Text>
          <Text style={styles.summaryLabel}>إجمالي الإنجازات</Text>
          <View style={[styles.cardIconContainer, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
            <Text style={styles.cardIcon}>🏆</Text>
          </View>
        </View>
        
        <View style={[styles.summaryCard, styles.cardGlow]}>
          <Text style={styles.summaryValue}>{longestStreak}</Text>
          <Text style={styles.summaryLabel}>أطول استمرارية</Text>
          <View style={[styles.cardIconContainer, { backgroundColor: 'rgba(255, 152, 0, 0.1)' }]}>
            <Text style={styles.cardIcon}>🔥</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  // Helper function to format dates
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  // We need to import or define t function for translations
  const t = (key: string): string => {
    const translations: Record<string, string> = {
      'committed': 'الالتزام',
      'yes': 'نعم',
      'no': 'لا',
      'completedTasks': 'المهام المكتملة'
    };
    return translations[key] || key;
  };

  // أضف وظيفة لإدارة عرض التلميحات
  const showTooltip = useCallback((type: 'commitment' | 'activity', index: number) => {
    // إذا كان هناك مؤقت سابق، قم بإلغائه
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    
    // تحديث الزر النشط
    setActiveTooltip(type);
    
    // إذا كان النوع هو 'commitment'، قم بتحديث تلميح الالتزام
    if (type === 'commitment') {
      const item = commitmentData[index];
      if (item) {
        setCommitmentTooltip({
          visible: true,
          label: item.label,
          value: item.value,
          position: index
        });
        
        // إعادة تعيين تلميح النشاط
        setActivityTooltip(prev => ({...prev, visible: false}));
      }
    } 
    // إذا كان النوع هو 'activity'، قم بتحديث تلميح النشاط
    else if (type === 'activity') {
      const item = activityData[index];
      if (item) {
        setActivityTooltip({
          visible: true,
          label: item.label,
          value: item.value,
          date: item.date,
          position: index
        });
        
        // إعادة تعيين تلميح الالتزام
        setCommitmentTooltip(prev => ({...prev, visible: false}));
      }
    }
    
    // تعيين مؤقت لإخفاء التلميح بعد 5 ثوان
    tooltipTimeoutRef.current = setTimeout(() => {
      if (type === 'commitment') {
        setCommitmentTooltip(prev => ({...prev, visible: false}));
      } else {
        setActivityTooltip(prev => ({...prev, visible: false}));
      }
      setActiveTooltip(null);
      tooltipTimeoutRef.current = null;
    }, 5000);
  }, [commitmentData, activityData]);
  
  // أضف وظيفة لإخفاء جميع التلميحات
  const hideAllTooltips = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setCommitmentTooltip(prev => ({...prev, visible: false}));
    setActivityTooltip(prev => ({...prev, visible: false}));
    setActiveTooltip(null);
  }, []);
  
  // تأكد من تنظيف المؤقت عند إلغاء تحميل المكون
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // تحديث استدعاءات showCommitmentTooltip وshowActivityTooltip
  const showCommitmentTooltip = useCallback((index: number) => {
    showTooltip('commitment', index);
  }, [showTooltip]);

  const showActivityTooltip = useCallback((index: number) => {
    showTooltip('activity', index);
  }, [showTooltip]);

  const renderCommitmentChart = () => (
    <LineChart
      areaChart
      curved={false}
      data={commitmentData}
      height={180}
      spacing={40}
      thickness={1.5}
      color={COLORS.success}
      dataPointsHeight={6}
      dataPointsWidth={6}
      dataPointsColor={COLORS.success}
      startFillColor="rgba(76, 175, 80, 0.15)"
      endFillColor="rgba(76, 175, 80, 0.02)"
      startOpacity={0.7}
      endOpacity={0.1}
      noOfSections={5}
      maxValue={1}
      yAxisColor={COLORS.border}
      xAxisColor={COLORS.border}
      rulesColor="rgba(0,0,0,0.05)"
      rulesType="solid"
      width={Math.max(width - 24, 600)}
      yAxisLabelTexts={['0', '0.2', '0.4', '0.6', '0.8', '1.0']}
      showYAxisIndices
      hideRules={false}
      yAxisLabelWidth={35}
      adjustToWidth={true}
      xAxisLabelTextStyle={{
        color: COLORS.textDark,
        fontSize: 10,
        fontWeight: '500',
      }}
      yAxisTextStyle={{
        color: COLORS.textDark,
        fontSize: 10,
        fontWeight: '500',
      }}
      onPress={(item: any, index: number) => showCommitmentTooltip(index)}
      pointerConfig={{
        pointerStripHeight: 160,
        pointerStripColor: 'rgba(0,0,0,0.1)',
        pointerStripWidth: 1,
        pointerColor: COLORS.primary,
        radius: 4,
        pointerLabelWidth: 100,
        pointerLabelHeight: 80,
        activatePointersOnLongPress: false,
        autoAdjustPointerLabelPosition: true,
        pointerLabelComponent: (items: any) => {
          const item = items[0];
          return (
            <View style={styles.tooltipContainer}>
              <Text style={styles.tooltipHeaderText}>{item.label}</Text>
              <Text style={[
                styles.tooltipValueText,
                { color: item.value === 1 ? COLORS.success : COLORS.error }
              ]}>
                {item.value === 1 ? '✓ ملتزم' : '✕ غير ملتزم'}
              </Text>
            </View>
          );
        },
      }}
    />
  );

  const renderActivityChart = () => (
    <LineChart
      areaChart
      curved={false}
      data={activityData.map(point => ({
        value: point.value,
        label: point.label,
      }))}
      height={180}
      spacing={40}
      thickness={1.5}
      color="#FFC107"
      startFillColor="rgba(255, 193, 7, 0.15)"
      endFillColor="rgba(255, 193, 7, 0.02)"
      startOpacity={0.7}
      endOpacity={0.1}
      noOfSections={4}
      maxValue={Math.ceil(Math.max(...activityData.map(d => d.value)))}
      yAxisColor={COLORS.border}
      xAxisColor={COLORS.border}
      rulesColor="rgba(0,0,0,0.05)"
      rulesType="solid"
      width={Math.max(width - 24, 600)}
      showYAxisIndices
      yAxisTextStyle={{
        color: COLORS.textDark,
        fontSize: 10,
        fontWeight: '500',
      }}
      xAxisLabelTextStyle={{
        color: COLORS.textDark,
        fontSize: 10,
        fontWeight: '500',
      }}
      dataPointsHeight={6}
      dataPointsWidth={6}
      dataPointsColor="#FFC107"
      hideRules={false}
      adjustToWidth={true}
      onPress={(item: any, index: number) => showActivityTooltip(index)}
      pointerConfig={{
        pointerStripHeight: 160,
        pointerStripColor: 'rgba(0,0,0,0.1)',
        pointerStripWidth: 1,
        pointerColor: "#FFC107",
        radius: 4,
        pointerLabelWidth: 100,
        pointerLabelHeight: 80,
        activatePointersOnLongPress: false,
        autoAdjustPointerLabelPosition: true,
        pointerLabelComponent: (items: any) => {
          const item = items[0];
          const date = activityData.find(point => point.label === item.label)?.date || '';
          return (
            <View style={styles.tooltipContainer}>
              <Text style={styles.tooltipHeaderText}>{date}</Text>
              <Text style={[styles.tooltipValueText, { color: '#FFC107' }]}>
                {item.value} إنجاز
              </Text>
            </View>
          );
        },
      }}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.background} barStyle="dark-content" />
      
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} />
        </View>
        <Text style={styles.title}>الإحصائيات والتحليلات</Text>

        {/* المربعات المعلوماتية المستمرة */}
        {commitmentTooltip.visible && commitmentTooltip.position !== undefined && (
          <View style={[
            styles.fixedTooltipAlt, 
            { 
              backgroundColor: commitmentData[commitmentTooltip.position]?.value === 1 ? 
                'rgba(76, 175, 80, 0.12)' : 'rgba(244, 67, 54, 0.12)',
              borderColor: commitmentData[commitmentTooltip.position]?.value === 1 ? 
                'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)'
            }
          ]}>
            <View style={styles.tooltipHeader}>
              <Image source={require('../../assets/logo.png')} style={styles.tooltipLogo} />
              <Text style={[
                styles.tooltipTitleAlt, 
                { 
                  color: commitmentData[commitmentTooltip.position]?.value === 1 ? 
                    COLORS.success : COLORS.error 
                }
              ]}>
                {commitmentData[commitmentTooltip.position]?.value === 1 ? 
                  '✓ تفاصيل الالتزام' : '⊗ تفاصيل الالتزام'}
              </Text>
            </View>
            
            <View style={styles.tooltipRow}>
              <View style={styles.tooltipIconContainer}>
                <Text style={styles.tooltipIcon}>📅</Text>
              </View>
              <Text style={styles.tooltipLabel}>اليوم:</Text>
              <Text style={styles.tooltipValue}>{commitmentData[commitmentTooltip.position]?.label || ""}</Text>
            </View>

            <View style={styles.tooltipRow}>
              <View style={styles.tooltipIconContainer}>
                <Text style={styles.tooltipIcon}>🔔</Text>
              </View>
              <Text style={styles.tooltipLabel}>الحالة:</Text>
              <Text style={[
                styles.tooltipStatusValue, 
                { 
                  color: commitmentData[commitmentTooltip.position]?.value === 1 ? 
                    COLORS.success : COLORS.error,
                  backgroundColor: commitmentData[commitmentTooltip.position]?.value === 1 ?
                    'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)'
                }
              ]}>
                {commitmentData[commitmentTooltip.position]?.value === 1 ? '✓ ملتزم' : '✕ غير ملتزم'}
              </Text>
            </View>

            {/* اعرض المزيد من المعلومات إذا كانت متوفرة */}
            {commitmentData[commitmentTooltip.position]?.notes && (
              <View style={styles.tooltipRow}>
                <View style={styles.tooltipIconContainer}>
                  <Text style={styles.tooltipIcon}>📝</Text>
                </View>
                <Text style={styles.tooltipLabel}>ملاحظات:</Text>
                <Text style={styles.tooltipValue}>{commitmentData[commitmentTooltip.position]?.notes}</Text>
              </View>
            )}

            <TouchableOpacity 
              style={[
                styles.closeButtonContainerAlt,
                {
                  backgroundColor: commitmentData[commitmentTooltip.position]?.value === 1 ? 
                    'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
                  borderWidth: 1,
                  borderColor: commitmentData[commitmentTooltip.position]?.value === 1 ? 
                    'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)'
                }
              ]}
              onPress={() => hideAllTooltips()}
            >
              <Text style={[styles.closeButtonText, {fontSize: 18}]}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        {activityTooltip.visible && activityTooltip.position !== undefined && (
          <View style={[
            styles.fixedTooltipAlt, 
            {
              backgroundColor: 'rgba(255, 193, 7, 0.12)',
              borderColor: 'rgba(255, 193, 7, 0.5)'
            }
          ]}>
            <View style={styles.tooltipHeader}>
              <Text style={[styles.tooltipTitleAlt, { color: '#FFC107' }]}>
                🔥 تفاصيل النشاط اليومي
              </Text>
            </View>
            
            <View style={styles.tooltipRow}>
              <View style={styles.tooltipIconContainer}>
                <Text style={styles.tooltipIcon}>📅</Text>
              </View>
              <Text style={styles.tooltipLabel}>التاريخ:</Text>
              <Text style={styles.tooltipValue}>{activityTooltip.date || ""}</Text>
            </View>
            
            <View style={styles.tooltipRow}>
              <View style={styles.tooltipIconContainer}>
                <Text style={styles.tooltipIcon}>🏆</Text>
              </View>
              <Text style={styles.tooltipLabel}>الإنجازات:</Text>
              <Text style={[styles.tooltipStatusValue, { 
                color: '#FFC107',
                backgroundColor: 'rgba(255, 193, 7, 0.1)'
              }]}>
                {activityTooltip.value || 0}
              </Text>
            </View>
            
            <View style={styles.tooltipRow}>
              <View style={styles.tooltipIconContainer}>
                <Text style={styles.tooltipIcon}>📊</Text>
              </View>
              <Text style={styles.tooltipLabel}>النسبة:</Text>
              <View style={styles.progressBarContainer}>
                <View 
                  style={[
                    styles.progressBar, 
                    { 
                      width: `${Math.min(100, (activityTooltip.value || 0) * 10)}%`,
                      backgroundColor: '#FFC107'
                    }
                  ]} 
                />
                <Text style={styles.progressText}>
                  {Math.min(100, (activityTooltip.value || 0) * 10)}%
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[
                styles.closeButtonContainerAlt, 
                { 
                  backgroundColor: 'rgba(255, 193, 7, 0.2)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 193, 7, 0.5)'
                }
              ]}
              onPress={() => hideAllTooltips()}
            >
              <Text style={[styles.closeButtonText, {fontSize: 18}]}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Filter Controls */}
        <View style={styles.filterContainer}>
          <View style={[styles.periodSelector, styles.cardGlow]}>
            <TouchableOpacity
              style={[styles.periodOption, period === 'week' && styles.periodOptionSelected]}
              onPress={() => handlePeriodChange('week')}
            >
              <Text style={[styles.periodText, period === 'week' && styles.periodTextSelected]}>أسبوع</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.periodOption, period === 'month' && styles.periodOptionSelected]}
              onPress={() => handlePeriodChange('month')}
            >
              <Text style={[styles.periodText, period === 'month' && styles.periodTextSelected]}>شهر</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.periodOption, period === 'all' && styles.periodOptionSelected]}
              onPress={() => handlePeriodChange('all')}
            >
              <Text style={[styles.periodText, period === 'all' && styles.periodTextSelected]}>الكل</Text>
            </TouchableOpacity>
          </View>
          
          <View style={[styles.viewModeSelector, styles.cardGlow]}>
            <TouchableOpacity
              style={[styles.viewModeOption, viewMode === 'all' && styles.viewModeOptionSelected]}
              onPress={() => handleViewModeChange('all')}
            >
              <Text style={[styles.viewModeText, viewMode === 'all' && styles.viewModeTextSelected]}>الكل</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.viewModeOption, viewMode === 'quantitative' && styles.viewModeOptionSelected]}
              onPress={() => handleViewModeChange('quantitative')}
            >
              <Text style={[styles.viewModeText, viewMode === 'quantitative' && styles.viewModeTextSelected]}>كمي</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.viewModeOption, viewMode === 'commitment' && styles.viewModeOptionSelected]}
              onPress={() => handleViewModeChange('commitment')}
            >
              <Text style={[styles.viewModeText, viewMode === 'commitment' && styles.viewModeTextSelected]}>التزام</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Habit Selector */}
        {renderHabitSelector()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>جاري تحميل الإحصائيات...</Text>
          </View>
        ) : (
          <>
            {/* Summary Statistics */}
            {getHabitSummary()}

            {/* Distribution Pie Chart */}
            <Animated.View style={[
              styles.chartCard, 
              styles.cardGlow,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>توزيع أنواع العادات</Text>
                <View style={styles.chartIconContainer}>
                  <View style={styles.fancyIconCircle}>
                  <Text style={styles.chartIcon}>📊</Text>
                  </View>
                </View>
              </View>
              
              <Animated.View 
                style={[
                  styles.pieChartContainer,
                  { opacity: chartFadeAnim }
                ]}
              >
                {pieData[0].value + pieData[1].value > 0 ? (
                  <PieChart
                    data={pieData}
                    donut
                    showGradient
                    sectionAutoFocus
                    radius={90}
                    innerRadius={60}
                    innerCircleColor={COLORS.background}
                    centerLabelComponent={() => (
                      <Text style={styles.pieChartCenterLabel}>{habits.length}</Text>
                    )}
                  />
                ) : (
                  <Text style={styles.noDataText}>لا توجد بيانات كافية</Text>
                )}
              </Animated.View>
              
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, {backgroundColor: COLORS.primary}]} />
                  <Text style={styles.legendText}>كمية</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, {backgroundColor: COLORS.secondary}]} />
                  <Text style={styles.legendText}>التزام</Text>
                </View>
              </View>
            </Animated.View>

            {/* Quantitative Chart */}
            {(viewMode === 'all' || viewMode === 'quantitative') && (
              <Animated.View style={[
                styles.chartCard, 
                styles.cardGlow,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>
                    إنجازات العادات الكمية
                    {selectedHabitId && habits.find(h => h.id === selectedHabitId) && 
                      ` - ${habits.find(h => h.id === selectedHabitId)?.name}`
                    }
                  </Text>
                  <View style={styles.chartIconContainer}>
                    <View style={[styles.fancyIconCircle, {backgroundColor: 'rgba(33, 150, 243, 0.15)'}]}>
                    <Text style={styles.chartIcon}>📈</Text>
                    </View>
                  </View>
                </View>
                
                {quantitativeData.length > 0 ? (
                  <Animated.View 
                    style={[
                      styles.barChartContainer,
                      { opacity: chartFadeAnim }
                    ]}
                  >
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={true}
                    >
                      <BarChart
                        data={quantitativeData}
                        barWidth={30}
                        spacing={20}
                        roundedTop
                        roundedBottom
                        hideRules
                        xAxisThickness={1}
                        yAxisThickness={1}
                        yAxisTextStyle={styles.axisText}
                        xAxisLabelTextStyle={styles.axisText}
                        noOfSections={5}
                        barBorderRadius={8}
                        width={Math.max(width - 40, 600)}
                        disablePress={false}
                        frontColor={COLORS.primary}
                        yAxisColor={COLORS.border}
                        xAxisColor={COLORS.border}
                        dashWidth={0}
                        backgroundColor={'transparent'}
                        showGradient
                        showReferenceLine1
                        referenceLine1Position={0}
                        referenceLine1Config={{
                          color: COLORS.border,
                          dashWidth: 2,
                          dashGap: 3,
                        }}
                        showFractionalValues
                        horizontalRulesStyle={{
                          strokeDasharray: '3,3',
                          opacity: 0.5
                        }}
                        adjustToWidth={true}
                        isAnimated={true}
                        animationDuration={800}
                      />
                    </ScrollView>
                  </Animated.View>
                ) : (
                  <Text style={styles.noDataText}>
                    {habits.some(h => h.type === 'quantitative') 
                      ? 'لا توجد بيانات كافية للفترة المحددة'
                      : 'لم تقم بإضافة عادات كمية بعد'}
                  </Text>
                )}
              </Animated.View>
            )}

            {/* Commitment Chart */}
            {(viewMode === 'all' || viewMode === 'commitment') && (
              <Animated.View style={[
                styles.chartCard, 
                styles.cardGlow,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>
                    سجل الالتزام
                    {selectedHabitId && habits.find(h => h.id === selectedHabitId) && 
                      ` - ${habits.find(h => h.id === selectedHabitId)?.name}`
                    }
                  </Text>
                  <View style={styles.chartIconContainer}>
                    <View style={[styles.fancyIconCircle, {backgroundColor: 'rgba(76, 175, 80, 0.15)'}]}>
                    <Text style={styles.chartIcon}>📅</Text>
                    </View>
                  </View>
                </View>
                
                {commitmentData.length > 0 ? (
                  <Animated.View 
                    style={[
                      styles.lineChartContainer,
                      { opacity: chartFadeAnim }
                    ]}
                  >
                    {renderCommitmentChart()}
                  </Animated.View>
                ) : (
                  <Text style={styles.noDataText}>
                    {habits.some(h => h.type === 'commitment') 
                      ? 'لا توجد بيانات كافية للفترة المحددة'
                      : 'لم تقم بإضافة عادات التزام بعد'}
                  </Text>
                )}
              </Animated.View>
            )}

            {/* مخطط النشاط اليومي - جديد */}
            <Animated.View style={[
              styles.chartCard, 
              styles.cardGlow,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>النشاط اليومي</Text>
                <View style={styles.chartIconContainer}>
                  <View style={[styles.fancyIconCircle, {backgroundColor: 'rgba(255, 193, 7, 0.15)'}]}>
                    <Text style={styles.chartIcon}>🔥</Text>
                  </View>
                </View>
              </View>
              
              {activityData.length > 0 ? (
                <Animated.View 
                  style={[
                    styles.activityChartContainer,
                    { opacity: chartFadeAnim }
                  ]}
                >
                  {renderActivityChart()}
                </Animated.View>
              ) : (
                <Text style={styles.noDataText}>
                  لا توجد بيانات نشاط كافية للفترة المحددة
                </Text>
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: SPACING.md,
    textAlign: 'center',
    color: COLORS.primary,
  },
  filterContainer: {
    marginBottom: SPACING.md,
    paddingHorizontal: 4,
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.sm,
  },
  periodOption: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.xs,
    borderRadius: 15,
    backgroundColor: 'transparent',
  },
  periodOptionSelected: {
    backgroundColor: COLORS.primary,
  },
  periodText: {
    color: COLORS.textDark,
    fontWeight: '500',
  },
  periodTextSelected: {
    color: COLORS.white,
  },
  viewModeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.sm,
  },
  viewModeOption: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.xs,
    borderRadius: 15,
    backgroundColor: 'transparent',
  },
  viewModeOptionSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  viewModeText: {
    color: COLORS.textDark,
    fontWeight: '500',
  },
  viewModeTextSelected: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  habitSelector: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.md,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  habitChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 6,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  habitChipSelected: {
    borderColor: COLORS.primary,
  },
  habitChipText: {
    fontWeight: '600',
  },
  habitChipTextSelected: {
    fontWeight: 'bold',
  },
  chartCard: {
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginHorizontal: 4,
  },
  cardGlow: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 6,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  chartIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartIcon: {
    fontSize: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  pieChartContainer: {
    alignItems: 'center',
    marginVertical: SPACING.md,
    height: 200,
    justifyContent: 'center',
  },
  pieChartCenterLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  barChartContainer: {
    marginVertical: SPACING.sm,
    height: 220,
    alignItems: 'center',
  },
  lineChartContainer: {
    marginVertical: SPACING.sm,
    height: 220,
    alignItems: 'center',
  },
  barLabel: {
    color: COLORS.textDark,
    fontSize: 12,
    fontWeight: 'bold',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
  },
  legendColor: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: SPACING.xs,
  },
  legendText: {
    color: COLORS.textDark,
    fontSize: 14,
    fontWeight: '500',
  },
  noDataText: {
    textAlign: 'center',
    color: COLORS.textMedium,
    fontStyle: 'italic',
    marginVertical: SPACING.xl,
  },
  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  cardIconContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 16,
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textMedium,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textMedium,
    fontSize: 16,
  },
  axisText: {
    color: COLORS.textMedium,
    fontSize: 12,
  },
  pointerLabel: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  pointerLabelText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
    textAlign: 'center',
    color: '#333',
  },
  pointerValueText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  activityChartContainer: {
    marginVertical: SPACING.sm,
    height: 220,
    alignItems: 'center',
  },
  activityPointerLabel: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  pointerDateText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  pointerValueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointerValueLabel: {
    fontSize: 14,
    color: '#555',
    marginRight: 5,
  },
  pointerActivityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  closeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textDark,
    lineHeight: 20,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  tooltipText: {
    color: COLORS.textDark,
    fontSize: 14,
  },
  closeButtonContainer: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedTooltipAlt: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    transform: [{ translateX: -110 }, { translateY: -80 }],
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 12,
    padding: 12,
    zIndex: 1000,
    width: 220,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
  },
  tooltipHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingBottom: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  tooltipTitleAlt: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textDark,
    marginBottom: 8,
    textAlign: 'center',
  },
  tooltipTextAlt: {
    fontSize: 14,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  closeButtonContainerAlt: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  tooltipIconContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tooltipIcon: {
    fontSize: 14,
  },
  tooltipLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textMedium,
    marginRight: 8,
    minWidth: 60,
  },
  tooltipValue: {
    fontSize: 14,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'right',
  },
  tooltipStatusValue: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    overflow: 'hidden',
  },
  progressBarContainer: {
    height: 16,
    width: 100,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    borderRadius: 8,
  },
  progressText: {
    position: 'absolute',
    right: 6,
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    top: 2.5,
  },
  fancyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  logo: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
  tooltipLogo: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
    marginBottom: 5,
  },
  tooltipContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 8,
    padding: 8,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  tooltipHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 4,
  },
  tooltipValueText: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default StatsScreen;

