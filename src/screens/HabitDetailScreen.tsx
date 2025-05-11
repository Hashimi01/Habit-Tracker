import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView,
  SectionList, 
  TextInput,
  Alert,
  Animated,
  Dimensions,
  I18nManager,
  StatusBar,
  Modal,
  Platform
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Habit, Achievement } from '../types';
import { updateHabit, getHabits } from '../utils/habitStorage';
import { COLORS, SPACING } from '../theme';
import uuid from 'react-native-uuid';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// إعداد معالج الإشعارات
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Force RTL layout direction
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const { width } = Dimensions.get('window');

// Define route prop type for HabitDetailScreen
type HabitDetailScreenRouteProp = RouteProp<RootStackParamList, 'HabitDetail'>;

// Define navigation prop type for HabitDetailScreen
type HabitDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'HabitDetail'
>;

// تعريف نوع مؤقت setTimeout لتجنب أخطاء TypeScript
type TimeoutID = ReturnType<typeof setTimeout>;

const HabitDetailScreen = () => {
  const route = useRoute<HabitDetailScreenRouteProp>();
  const navigation = useNavigation<HabitDetailScreenNavigationProp>();
  const { habitId } = route.params;
  const [habit, setHabit] = useState<Habit | null>(null);
  const [quantityValue, setQuantityValue] = useState('');
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [achievementName, setAchievementName] = useState('');
  
  // حالة الإشعارات والمنبهات
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTime, setReminderTime] = useState('');
  const [scheduledNotifications, setScheduledNotifications] = useState<{[key: string]: string[]}>({});
  const [expoPushToken, setExpoPushToken] = useState('');
  const [showStopAlarmModal, setShowStopAlarmModal] = useState(false);
  const [activeAlarmTimeKey, setActiveAlarmTimeKey] = useState<string | null>(null);
  
  // Animations
  const successAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  
  // مستمعي الإشعارات
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  // مجموعة لتخزين معرفات المؤقتات الزمنية
  const timeoutRefs = useRef<TimeoutID[]>([]);
  
  // وظيفة لحفظ المؤقت الزمني ومسحه عند الحاجة
  function setTimeoutWithRef(callback: () => void, delay: number) {
    const timeoutId = setTimeout(callback, delay);
    timeoutRefs.current.push(timeoutId);
    return timeoutId;
  }
  
  // مسح جميع المؤقتات
  function clearAllTimeouts() {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];
  }

  useEffect(() => {
    const loadHabitDetails = async () => {
      const allHabits = await getHabits();
      const currentHabit = allHabits.find(h => h.id === habitId);
      
      // Calculate commitment percentage for commitment habits if not already set
      if (currentHabit && currentHabit.type === 'commitment' && currentHabit.logs.length > 0) {
        if (currentHabit.commitmentPercentage === undefined) {
          const totalLogs = currentHabit.logs.length;
          const committedLogs = currentHabit.logs.filter(log => log.committed).length;
          const commitmentPercentage = (committedLogs / totalLogs) * 100;
          
          // Update the habit with the calculated percentage
          currentHabit.commitmentPercentage = commitmentPercentage;
          await updateHabit(currentHabit);
        }
      }

      setHabit(currentHabit || null);
      
      // Run entrance animations
      Animated.parallel([
        Animated.timing(headerAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeInAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        })
      ]).start();
    };
    loadHabitDetails();
    
    // إعداد الإشعارات
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token || ''));
    
    // مستمع لاستقبال الإشعارات أثناء تشغيل التطبيق
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('تم استلام إشعار:', notification);
    });

    // مستمع للتفاعل مع الإشعارات
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('تم التفاعل مع الإشعار:', response);
      
      // إذا كان الإشعار من سلسلة الإشعارات السريعة، إلغاء جميع الإشعارات المتبقية
      const data = response.notification.request.content.data;
      if (data && data.isRapidSequence && data.timeKey) {
        // إلغاء سلسلة الإشعارات عند النقر على أي إشعار منها
        cancelAlarmSequence(data.timeKey as string);
        
        // إلغاء جميع الإشعارات الظاهرة حاليًا
        Notifications.dismissAllNotificationsAsync().catch(err => 
          console.error('فشل إلغاء جميع الإشعارات الظاهرة:', err)
        );

        // عرض رسالة توضيحية
        Alert.alert(
          'تم إيقاف التنبيهات',
          `تم إيقاف سلسلة التنبيهات المتبقية بنجاح.`
        );
      }
    });
    
    // تنظيف المستمعات عند إلغاء تحميل المكون
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
      
      // مسح جميع المؤقتات الزمنية عند مغادرة الشاشة
      clearAllTimeouts();
      
      // لا تلغي الإشعارات المجدولة عند مغادرة الشاشة
      // حتى تستمر التنبيهات في العمل في الخلفية
      // Object.keys(scheduledNotifications).forEach(timeKey => {
      //   cancelAlarmSequence(timeKey);
      // });
    };
  }, [habitId]);

  // وظيفة طلب أذونات الإشعارات
  async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default', // تأكد من وجود قناة بصوت
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('تنبيه', 'فشل الحصول على إذن الإشعارات!');
        return;
      }
    } else {
      Alert.alert('تنبيه', 'يجب استخدام جهاز حقيقي لاختبار الإشعارات');
    }
    
    return (await Notifications.getExpoPushTokenAsync()).data;
  }

  // جدولة سلسلة من الإشعارات السريعة لمحاكاة منبه مستمر
  const scheduleAlarmSequence = async (time: string) => {
    if (!habit) return;
    
    try {
      // تحليل الوقت (ساعة:دقيقة)
      const [hoursStr, minutesStr] = time.split(':');
      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      
      if (isNaN(hours) || isNaN(minutes)) {
        Alert.alert('خطأ', 'تنسيق الوقت غير صالح. يرجى استخدام تنسيق HH:MM');
        return;
      }
      
      // إلغاء أي تنبيهات سابقة بنفس وقت التذكير
      if (scheduledNotifications[time]) {
        await cancelAlarmSequence(time);
      }
      
      // إعداد قناة الإشعارات لأندرويد
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('rapid-fire', { 
          name: 'Habit Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250],
          sound: 'default',
          bypassDnd: true,
        });
      }

      // تحديد وقت التنبيه
      const now = new Date();
      const targetDate = new Date();
      targetDate.setHours(hours, minutes, 0, 0);
      
      // إذا كان الوقت في الماضي، جدوله لليوم التالي
      if (targetDate.getTime() <= now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      
      // حساب المدة حتى وقت التنبيه (بالمللي ثانية)
      const timeUntilAlarm = targetDate.getTime() - now.getTime();
      
      console.log(`جدولة سلسلة من الإشعارات للظهور في ${targetDate.toLocaleString()}`);
      console.log(`التنبيه سيبدأ بعد ${Math.floor(timeUntilAlarm / (1000 * 60))} دقيقة و ${Math.floor((timeUntilAlarm / 1000) % 60)} ثانية`);
      
      // عدد الإشعارات والفاصل الزمني
      const numberOfNotifications = 50; // تحديد عدد الإشعارات إلى 50
      const intervalSeconds = 1.5; // زيادة الفاصل الزمني إلى 1.5 ثانية
      const autoDismissSeconds = 3; // كل إشعار سيختفي تلقائيًا بعد 3 ثوان
      
      // مصفوفة لتخزين معرفات الإشعارات
      const notificationIdentifiers: string[] = [];
      
      // حفظ مرجع للمؤقت الرئيسي لإمكانية إلغائه لاحقًا
      const mainTimerId = setTimeoutWithRef(async () => {
        console.log(`حان وقت التنبيه! بدء سلسلة الإشعارات...`);
        
        // التأكد من إلغاء أي إشعارات قديمة قبل البدء
        await Notifications.dismissAllNotificationsAsync().catch(err => 
          console.error('فشل إلغاء الإشعارات القديمة:', err)
        );
        
        // عرض النافذة المنبثقة لإيقاف التنبيه
        setActiveAlarmTimeKey(time);
        setShowStopAlarmModal(true);
        
        // عرض الإشعارات بشكل متتالي باستخدام مؤقتات داخلية
      for (let i = 0; i < numberOfNotifications; i++) {
          // استخدام دالة مساعدة لإنشاء إغلاق مناسب (closure) للمتغير i
          const showNotification = async (index: number) => {
            try {
              const notificationTime = new Date(targetDate.getTime() + (index * intervalSeconds * 1000));
              console.log(`عرض الإشعار ${index + 1}/${numberOfNotifications} في: ${notificationTime.toLocaleTimeString()}`);
        
              // إنشاء معرف فريد وثابت لكل إشعار
              const notificationId = `habit-${habit.id}-time-${time}-index-${index}`;
              
              // إلغاء الإشعار من نفس المعرف أولا إذا كان موجودا
              try {
                await Notifications.cancelScheduledNotificationAsync(notificationId);
              } catch (err) {
                // تجاهل أي خطأ هنا
              }
              
              // إظهار الإشعار 
          const identifier = await Notifications.scheduleNotificationAsync({
            content: {
                  title: `تذكير: ${habit.name} (${index + 1}/${numberOfNotifications}) ⚡`,
              body: `حان وقت ${habit.type === 'quantitative' ? `${habit.goal} ${habit.unit}` : 'الالتزام'} - انقر هنا لإيقاف التنبيهات.`,
              sound: 'default',
              priority: 'max',
              data: { 
                habitId: habit.id,
                timeKey: time,
                isRapidSequence: true,
                    notificationIndex: index,
                    expireAt: new Date(Date.now() + (autoDismissSeconds * 1000)).getTime()
              },
            },
                identifier: notificationId, // استخدام المعرف الثابت
                trigger: null, // عرض فوري
          });
          
              console.log(`تم عرض الإشعار ${index + 1} بمعرف: ${identifier}`);
          notificationIdentifiers.push(identifier);
              
              // إعداد مؤقت لإلغاء الإشعار تلقائيًا بعد فترة محددة
              setTimeoutWithRef(async () => {
                try {
                  // محاولة إلغاء الإشعار بمعرف ثابت
                  await Notifications.cancelScheduledNotificationAsync(notificationId);
                  console.log(`تم إلغاء الإشعار ${index + 1} تلقائيًا بعد ${autoDismissSeconds} ثوان`);
                  
                  // محاولة إلغاء بالمعرف الذي أرجعه النظام إذا كان مختلفًا
                  if (identifier !== notificationId) {
                    await Notifications.cancelScheduledNotificationAsync(identifier);
      }
      
                  // للتأكد من إزالة الإشعار، نقوم أيضًا بمحاولة إزالة جميع الإشعارات الظاهرة حاليًا
                  if (index % 5 === 0) { // كل 5 إشعارات لتقليل الضغط على النظام
                    await Notifications.dismissAllNotificationsAsync();
                  }
                } catch (err) {
                  console.error(`فشل إلغاء الإشعار التلقائي ${identifier}:`, err);
                  // محاولة إلغاء جميع الإشعارات في حالة الفشل
                  try {
                    await Notifications.dismissAllNotificationsAsync();
                  } catch (dismissErr) {
                    console.error('فشل إلغاء جميع الإشعارات:', dismissErr);
                  }
                }
              }, autoDismissSeconds * 1000);
              
              // تحديث قائمة الإشعارات في الحالة
              setScheduledNotifications(prev => {
                const updated = { ...prev };
                if (!updated[time]) {
                  updated[time] = [];
                }
                // أضف المعرف الجديد وتأكد من عدم تكرار المعرفات
                if (!updated[time].includes(identifier)) {
                  updated[time].push(identifier);
                }
                return updated;
              });
            } catch (err) {
              console.error(`خطأ في عرض الإشعار ${index + 1}:`, err);
            }
          };
          
          // جدولة الإشعارات مع فاصل زمني
          setTimeoutWithRef(() => showNotification(i), i * intervalSeconds * 1000);
        }
        
        // إلغاء جميع الإشعارات بعد انتهاء السلسلة تلقائيًا
        const totalDuration = numberOfNotifications * intervalSeconds * 1000 + 5000; // إضافة 5 ثوان كهامش أمان
        setTimeoutWithRef(async () => {
          try {
            // محاولة إلغاء جميع الإشعارات المجدولة بشكل فردي
            for (const id of notificationIdentifiers) {
              await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
            }
            
            // ثم إلغاء جميع الإشعارات الظاهرة
            await Notifications.dismissAllNotificationsAsync();
            console.log('تم إلغاء جميع الإشعارات تلقائيًا بعد انتهاء السلسلة');
            
            // إخفاء نافذة إيقاف التنبيه تلقائيًا
            if (activeAlarmTimeKey === time) {
              setShowStopAlarmModal(false);
              setActiveAlarmTimeKey(null);
            }
          } catch (err) {
            console.error('فشل إلغاء الإشعارات تلقائيًا بعد السلسلة:', err);
          }
        }, totalDuration);
        
        // إعداد مؤقت للتأكد من إلغاء جميع الإشعارات كل 5 ثوان
        let cleanupCounter = 0;
        const maxCleanups = 10; // عدد مرات التنظيف
        
        const cleanupInterval = setInterval(async () => {
          try {
            await Notifications.dismissAllNotificationsAsync();
            console.log(`تنظيف الإشعارات رقم ${cleanupCounter + 1}/${maxCleanups}`);
            
            cleanupCounter++;
            if (cleanupCounter >= maxCleanups) {
              clearInterval(cleanupInterval);
            }
          } catch (err) {
            console.error('فشل تنظيف الإشعارات:', err);
          }
        }, 5000); // كل 5 ثوان
        
        // حفظ معرف الفاصل الزمني لإمكانية إلغائه لاحقًا
        timeoutRefs.current.push(cleanupInterval as unknown as TimeoutID);
      }, timeUntilAlarm);
      
      // تحديث العادة مع وقت التذكير الجديد
      if (habit) {
        const reminderTimes = [...(habit.reminderTimes || [])];
        if (!reminderTimes.includes(time)) {
          reminderTimes.push(time);
        }
        
        const updatedHabit = {
          ...habit,
          reminderTimes,
        };
        
        await updateHabit(updatedHabit);
        setHabit(updatedHabit);
        
        // تأكيد للمستخدم
        const formattedTime = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isToday = targetDate.getDate() === now.getDate();
        const timeUntilNotification = Math.floor((targetDate.getTime() - now.getTime()) / (1000 * 60)); // بالدقائق
        
        let timeMessage = '';
        if (isToday) {
          if (timeUntilNotification < 60) {
            timeMessage = `بعد ${timeUntilNotification} دقيقة`;
          } else {
            timeMessage = `بعد ${Math.floor(timeUntilNotification/60)} ساعة و ${timeUntilNotification % 60} دقيقة`;
          }
        } else {
          timeMessage = `غدًا الساعة ${formattedTime}`;
        }
        
        Alert.alert(
          'تمت جدولة التذكير',
          `تم جدولة ${numberOfNotifications} تنبيهات متتالية ${timeMessage} مع فاصل زمني قدره ${intervalSeconds} ثانية بين كل تنبيه. كل إشعار سيختفي تلقائيًا بعد ${autoDismissSeconds} ثوان.`,
          [{ text: 'حسناً' }]
        );
      }
    } catch (error) {
      console.error('خطأ في جدولة التنبيهات:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء جدولة التنبيهات. يرجى المحاولة مرة أخرى.');
    }
  };
  
  // إلغاء سلسلة الإشعارات السريعة
  const cancelAlarmSequence = async (time: string) => {
    if (!scheduledNotifications[time] || scheduledNotifications[time].length === 0) {
      console.log(`لا توجد إشعارات مخزنة للوقت ${time} للإلغاء`);
      return;
    }
    
    try {
      // مسح جميع المؤقتات أولاً
      clearAllTimeouts();
      
      // إغلاق النافذة المنبثقة إذا كانت مفتوحة
      if (activeAlarmTimeKey === time) {
        setShowStopAlarmModal(false);
        setActiveAlarmTimeKey(null);
      }
      
      // ثم إلغاء أي إشعارات قد تكون ظهرت بالفعل
      const identifiers = scheduledNotifications[time];
      if (identifiers && identifiers.length > 0) {
        console.log(`إلغاء ${identifiers.length} إشعارات لوقت ${time}...`);
        
        // تعيين عدد محاولات إلغاء الإشعارات
        const maxRetries = 3;
        let attemptsCount = 0;
        let allCancelled = false;
        
        // محاولة إلغاء الإشعارات عدة مرات للتأكد من توقفها
        while (!allCancelled && attemptsCount < maxRetries) {
          attemptsCount++;
          console.log(`محاولة إلغاء الإشعارات رقم ${attemptsCount}...`);
        
        // إلغاء كل إشعار مجدول على حدة
          let failedCancellations = 0;
        for (const id of identifiers) {
          try {
            await Notifications.cancelScheduledNotificationAsync(id);
            console.log(`تم إلغاء الإشعار بمعرف: ${id}`);
          } catch (innerError) {
            console.error(`فشل إلغاء الإشعار ${id}:`, innerError);
              failedCancellations++;
          }
        }
        
          // إلغاء الإشعارات الظاهرة
        try {
            await Notifications.dismissAllNotificationsAsync();
            console.log('تم إلغاء جميع الإشعارات الظاهرة');
        } catch (error) {
            console.error('فشل إلغاء الإشعارات الظاهرة:', error);
            failedCancellations++;
          }
          
          // التحقق مما إذا كانت كل الإشعارات قد تم إلغاؤها بنجاح
          if (failedCancellations === 0) {
            allCancelled = true;
            console.log('تم إلغاء جميع الإشعارات بنجاح');
          } else {
            console.log(`فشل إلغاء ${failedCancellations} إشعارات، محاولة مرة أخرى...`);
            // انتظار قصير قبل المحاولة مرة أخرى
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // تعيين مؤقت للتحقق المستمر من عدم وجود إشعارات نشطة بعد عملية الإلغاء
        const verificationTimeout = setTimeoutWithRef(async () => {
          try {
            // التحقق من عدم وجود إشعارات مجدولة متبقية
            const scheduledNotifs = await Notifications.getAllScheduledNotificationsAsync();
            const remainingNotifs = scheduledNotifs.filter(notif => 
              notif.content.data && 
              notif.content.data.timeKey === time
            );
            
            if (remainingNotifs.length > 0) {
              console.log(`لا تزال هناك ${remainingNotifs.length} إشعارات متبقية، محاولة إلغائها...`);
              for (const notif of remainingNotifs) {
                await Notifications.cancelScheduledNotificationAsync(notif.identifier);
              }
              // إلغاء جميع الإشعارات الظاهرة مرة أخرى للتأكد
              await Notifications.dismissAllNotificationsAsync();
            }
          } catch (error) {
            console.error('خطأ في التحقق من الإشعارات المتبقية:', error);
        }
        }, 2000); // التحقق بعد ثانيتين
        
        console.log('تم إلغاء إشعارات السلسلة بنجاح');
      }
      
      // حذف وقت التذكير من قائمة الأوقات المحفوظة
      const updatedScheduledNotifications = { ...scheduledNotifications };
      delete updatedScheduledNotifications[time];
      setScheduledNotifications(updatedScheduledNotifications);
      
      console.log(`تم إلغاء التذكير في الساعة ${time}`);
    } catch (error) {
      console.error('خطأ في إلغاء الإشعارات:', error);
      console.log('فشلت محاولة إلغاء الإشعارات المحددة.');
    }
  };
  
  // إضافة وقت تذكير جديد
  const addReminderTime = () => {
    if (!reminderTime || !reminderTime.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      Alert.alert('خطأ', 'يرجى إدخال وقت صحيح بتنسيق HH:MM');
      return;
    }
    
    scheduleAlarmSequence(reminderTime);
    setReminderTime('');
    setShowReminderModal(false);
  };

  // إلغاء إشعار تذكير
  const cancelNotification = async (time: string) => {
    if (!habit) return;
    
    try {
      // إلغاء وقت التذكير
      await cancelAlarmSequence(time);
      
      // حذف وقت التذكير من العادة
      if (habit && habit.reminderTimes) {
        const updatedReminderTimes = habit.reminderTimes.filter(t => t !== time);
        
        const updatedHabit = {
          ...habit,
          reminderTimes: updatedReminderTimes,
        };
        
        await updateHabit(updatedHabit);
        setHabit(updatedHabit);
        
        Alert.alert('نجاح', `تم إلغاء وقت التذكير في الساعة ${time}`);
      }
    } catch (error) {
      console.error('خطأ في إلغاء وقت التذكير:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إلغاء وقت التذكير');
    }
  };

  const runSuccessAnimation = () => {
    successAnim.setValue(0);
    Animated.sequence([
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(successAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handleLogQuantitative = async () => {
    if (!habit || habit.type !== 'quantitative') return;

    const value = parseFloat(quantityValue);
    if (isNaN(value) || value <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال قيمة صحيحة');
      return;
    }

    try {
    const newLog = {
        id: uuid.v4() as string,
      date: new Date().toISOString(),
      value: value,
    };

    const updatedHabit = {
      ...habit,
      logs: [...habit.logs, newLog],
    };

      // حفظ التحديث في التخزين
    await updateHabit(updatedHabit);
      
      // تحديث الحالة المحلية للعادة
      setHabit(updatedHabit);
      
      // مسح حقل الإدخال
      setQuantityValue('');
      
      // عرض رسالة النجاح
      runSuccessAnimation();
    } catch (error) {
      console.error('فشل تسجيل التقدم:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تسجيل التقدم');
    }
  };

  const handleLogCommitment = async (committed: boolean) => {
    if (!habit || habit.type !== 'commitment') return;

    const today = new Date().toISOString().split('T')[0];
    const lastLogDate = habit.logs.length > 0 ? habit.logs[habit.logs.length - 1].date.split('T')[0] : null;

    if (lastLogDate === today) {
      Alert.alert('تنبيه', 'لقد سجلت التزامك لهذا اليوم بالفعل');
        return;
    }

    // إنشاء سجل الالتزام الجديد
    const newLog = {
      id: uuid.v4() as string,
      date: new Date().toISOString(),
      committed: committed,
    };

    // تحديث قيم الاستمرارية
    let currentStreak = habit.currentStreak || 0;
    let longestStreak = habit.longestStreak || 0;
    
    if (committed) {
        currentStreak += 1;
    if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
    } else {
      currentStreak = 0;
    }

    // حساب النسبة المئوية للالتزام (عدد مرات الالتزام / إجمالي السجلات)
    const totalLogs = habit.logs.length + 1; // إضافة السجل الجديد
    const committedLogs = habit.logs.filter(log => log.committed).length + (committed ? 1 : 0);
    const commitmentPercentage = (committedLogs / totalLogs) * 100;

    const updatedHabit = {
      ...habit,
      logs: [...habit.logs, newLog],
      currentStreak: currentStreak,
      longestStreak: longestStreak,
      lastCheckIn: new Date().toISOString(),
      commitmentPercentage: commitmentPercentage, // إضافة نسبة الالتزام
    };

    try {
    await updateHabit(updatedHabit);
      setHabit(updatedHabit);
      runSuccessAnimation();
      
      // عرض النتيجة المحدثة
      Alert.alert(
        committed ? 'تم تسجيل الالتزام' : 'تم تسجيل عدم الالتزام',
        `النسبة المئوية للالتزام الإجمالي: ${commitmentPercentage.toFixed(1)}%\nاستمرارية الالتزام الحالية: ${currentStreak} أيام`
      );
    } catch (error) {
      console.error('فشل تسجيل الالتزام:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء محاولة تسجيل الالتزام');
    }
  };

  const openAchievementModal = () => {
    setAchievementName('');
    setShowAchievementModal(true);
  };

  const handleRecordAchievement = async () => {
    if (!habit) return;
    
    if (!achievementName.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم الإنجاز');
      return;
    }

    try {
      // إنشاء سجل إنجاز جديد
      const newAchievement: Achievement = {
        id: uuid.v4() as string,
        date: new Date().toISOString(),
        name: achievementName.trim(),
      };

      // نسخة محدثة من العادة مع الإنجاز الجديد
      const achievements = habit.achievements || [];
      const updatedHabit = {
        ...habit,
        achievements: [...achievements, newAchievement],
      };

      console.log('تسجيل إنجاز جديد:', newAchievement);
      console.log('العادة المحدثة:', updatedHabit);

      // حفظ التحديث في التخزين
      await updateHabit(updatedHabit);
      
      // تحديث الحالة المحلية للعادة
      setHabit(updatedHabit);
      
      // إعادة تعيين حقل الإدخال وإغلاق النافذة المنبثقة
      setAchievementName('');
      setShowAchievementModal(false);
      
      // عرض رسالة النجاح
      runSuccessAnimation();
      
      // إعادة تحميل بيانات العادة من التخزين للتأكد من التحديث
      setTimeout(() => {
        refreshHabitData();
      }, 500);
    } catch (error) {
      console.error('فشل تسجيل الإنجاز:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تسجيل الإنجاز');
    }
  };

  // تعديل دالة refreshHabitData لعرض رسالة نجاح
  const refreshHabitData = async () => {
    if (!habitId) return;
    
    try {
      console.log('تحديث بيانات العادة...');
      const allHabits = await getHabits();
      const currentHabit = allHabits.find(h => h.id === habitId);
      
      if (currentHabit) {
        // Calculate commitment percentage for commitment habits if not already set
        if (currentHabit.type === 'commitment' && currentHabit.logs.length > 0) {
          if (currentHabit.commitmentPercentage === undefined) {
            const totalLogs = currentHabit.logs.length;
            const committedLogs = currentHabit.logs.filter(log => log.committed).length;
            const commitmentPercentage = (committedLogs / totalLogs) * 100;
            
            // Update the habit with the calculated percentage
            currentHabit.commitmentPercentage = commitmentPercentage;
            await updateHabit(currentHabit);
          }
        }

        console.log('تم تحديث بيانات العادة:', currentHabit);
        setHabit(currentHabit);
        
        // إظهار تأثير متحرك للتحديث
        successAnim.setValue(0);
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    } catch (error) {
      console.error('فشل تحديث بيانات العادة:', error);
    }
  };

  // Success Animation Component
  const SuccessMessage = () => (
    <Animated.View style={[
      styles.successMessage, 
      { 
        opacity: successAnim,
        transform: [
          { 
            translateY: successAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0]
            })
          },
          {
            scale: successAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.8, 1.1, 1]
            })
          }
        ]
      }
    ]}>
      <Text style={styles.successText}>✅ تم تسجيل الإنجاز بنجاح</Text>
    </Animated.View>
  );

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('ar', options);
  };

  // Generate a gradient color based on habit type
  const getHeaderBackground = () => {
    if (!habit) return COLORS.primary;
    
    return habit.type === 'quantitative' 
      ? 'linear-gradient(135deg, #4A6FA5 0%, #6B8DB9 100%)' 
      : 'linear-gradient(135deg, #FF7E67 0%, #FF9F91 100%)';
  };
  
  // Calculate progress percentage for quantitative habits
  const calculateProgress = () => {
    if (!habit || habit.type !== 'quantitative') {
      return 0;
    }
    
    // إذا لم تكن هناك أي سجلات، فالنسبة المئوية هي 0
    if (habit.logs.length === 0) {
      return 0;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = habit.logs.filter(log => log.date.split('T')[0] === today);
    
    // إذا لم تكن هناك سجلات اليوم، فالنسبة المئوية هي 0
    if (todayLogs.length === 0) {
      return 0;
    }
    
    // حساب إجمالي القيم المسجلة اليوم
    const totalValue = todayLogs.reduce((sum, log) => sum + log.value, 0);
    
    // حساب النسبة المئوية بالنسبة للهدف (بحد أقصى 100%)
    const progressPercentage = Math.min((totalValue / habit.goal) * 100, 100);
    
    return progressPercentage;
  };

  // إضافة مكون عرض الإنجازات
  const AchievementsSection = ({ habit, openModal, refresh }: { 
    habit: Habit, 
    openModal: () => void, 
    refresh: () => void 
  }) => {
    return (
      <View style={styles.achievementSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>إنجازاتي:</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={refresh}>
            <Text style={styles.refreshButtonText}>🔄</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.achievementButton}
          onPress={openModal}
        >
          <Text style={styles.achievementButtonText}>+ إضافة إنجاز جديد</Text>
        </TouchableOpacity>

        {habit && habit.achievements && habit.achievements.length > 0 ? (
          <View style={styles.achievementsContainer}>
            {habit.achievements.slice().reverse().map((achievement: Achievement, index: number) => (
              <View key={achievement.id} style={[styles.achievementItem, index === 0 && styles.latestLogItem]}>
                <Text style={styles.achievementItemName}>{achievement.name}</Text>
                <Text style={styles.achievementItemDate}>{formatDate(achievement.date)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyAchievementBox}>
            <Text style={styles.emptyLogText}>لا توجد إنجازات مسجلة</Text>
          </View>
        )}
      </View>
    );
  };

  // تصيير أوقات التذكير
  const ReminderTimesSection = () => {
    if (!habit) return null;
    
    return (
      <View style={styles.reminderSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>أوقات التنبيه:</Text>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => setShowReminderModal(true)}
          >
            <Text style={styles.addButtonText}>+ إضافة</Text>
          </TouchableOpacity>
        </View>
        
        {habit.reminderTimes && habit.reminderTimes.length > 0 ? (
          <View style={styles.reminderList}>
            {habit.reminderTimes.map((time, index) => (
              <View key={index} style={styles.reminderItem}>
                <View style={styles.reminderItemContent}>
                  <Text style={styles.reminderTime}>{time}</Text>
                  <Text style={styles.reminderType}>
                    تنبيه متكرر (50 إشعار)
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => cancelNotification(time)}
                >
                  <Text style={styles.deleteButtonText}>x</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyReminderBox}>
            <Text style={styles.emptyText}>لا توجد تنبيهات مضبوطة</Text>
          </View>
        )}
      </View>
    );
  };

  if (!habit) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>جار تحميل تفاصيل العادة...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={habit.type === 'quantitative' ? COLORS.primary : COLORS.secondary} />
      
      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.header,
          { 
            backgroundColor: habit.type === 'quantitative' ? COLORS.primary : COLORS.secondary,
            opacity: headerAnim,
            transform: [
              { 
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 0]
                })
              }
            ]
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>↩</Text>
        </TouchableOpacity>
        
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{habit.name}</Text>
        
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {habit.type === 'quantitative' ? 'كمي' : 'التزام'}
          </Text>
        </View>
      </Animated.View>

      {habit ? (
        <SectionList
          sections={[
            { title: 'habit', data: [1] }, // Dummy data for habit section
            { title: 'reminders', data: [1] }, // Dummy data for reminders section
            { title: 'achievements', data: [1] }, // Dummy data for achievements section
          ]}
          keyExtractor={(item, index) => index.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={() => null}
          renderItem={({ section, item, index }) => {
            if (section.title === 'habit') {
              return (
                <Animated.View style={{
                  opacity: fadeInAnim,
                  transform: [{ scale: scaleAnim }]
                }}>
                  {habit.type === 'quantitative' ? (
                    <View style={styles.section}>
                      <View style={styles.goalCard}>
                        <Text style={styles.sectionHeading}>الهدف</Text>
                        <Text style={styles.goalText}>{habit.goal} {habit.unit}</Text>
                        <Text style={styles.frequencyText}>
                          {habit.frequency === 'daily' ? 'يومياً' : 
                          habit.frequency === 'weekly' ? 'أسبوعياً' : 'شهرياً'}
                        </Text>
                        
                        {/* Progress Bar */}
                        <View style={styles.progressContainer}>
                          <View style={styles.progressBar}>
                            <View 
                              style={[
                                styles.progressFill, 
                                { width: `${calculateProgress()}%` }
                              ]}
                            />
                          </View>
                          <Text style={styles.progressText}>
                            {calculateProgress().toFixed(0)}%
                          </Text>
                          <TouchableOpacity style={styles.refreshButton} onPress={refreshHabitData}>
                            <Text style={styles.refreshButtonText}>🔄</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>تسجيل إنجاز جديد:</Text>
                        <View style={styles.inputRow}>
                          <TextInput
                            style={styles.quantityInput}
                            value={quantityValue}
                            onChangeText={setQuantityValue}
                            placeholder={`أدخل القيمة`}
                            keyboardType="numeric"
                            placeholderTextColor={COLORS.textLight}
                            textAlign="center"
                          />
                          <Text style={styles.unitText}>{habit.unit}</Text>
                          <TouchableOpacity 
                            style={styles.logButton}
                            onPress={() => {
                              handleLogQuantitative();
                              setTimeout(() => {
                                refreshHabitData();
                              }, 500);
                            }}
                          >
                            <Text style={styles.logButtonText}>تسجيل</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={styles.sectionHeading}>سجل التقدم اليومي</Text>
                      {habit.logs.length > 0 ? (
                        <View style={styles.logsContainer}>
                          {habit.logs.slice().reverse().map((log: any, index: number) => (
                            <View 
                              key={log.id} 
                              style={[
                                styles.logItem,
                                index === 0 && styles.latestLogItem
                              ]}
                            >
                              <Text style={styles.logValue}>{log.value} {habit.unit}</Text>
                              <Text style={styles.logDate}>{formatDate(log.date)}</Text>
                            </View>
          ))}
        </View>
                      ) : (
                        <View style={styles.emptyLogBox}>
                          <Text style={styles.emptyLogText}>لا توجد سجلات تقدم بعد</Text>
        </View>
      )}
                    </View>
                  ) : (
                    <View style={styles.section}>
                      <View style={styles.statsCards}>
                        <View style={[styles.statsCard, styles.currentStreakCard]}>
                          <Text style={styles.statsLabel}>الاستمرارية الحالية</Text>
                          <Text style={styles.statsValue}>{habit.currentStreak}</Text>
                          <Text style={styles.statsUnit}>أيام</Text>
                        </View>
                        
                        <View style={[styles.statsCard, styles.longestStreakCard]}>
                          <Text style={styles.statsLabel}>أطول استمرارية</Text>
                          <Text style={styles.statsValue}>{habit.longestStreak}</Text>
                          <Text style={styles.statsUnit}>أيام</Text>
                        </View>
                      </View>

                      <View style={styles.commitmentProgressContainer}>
                        <Text style={styles.commitmentProgressLabel}>
                          نسبة الالتزام الإجمالية:
                        </Text>
                        <View style={styles.commitmentProgressBar}>
                          <View 
                            style={[
                              styles.commitmentProgressFill, 
                              { 
                                width: `${habit.commitmentPercentage ? habit.commitmentPercentage : 0}%`,
                                backgroundColor: (habit.commitmentPercentage || 0) > 50 
                                  ? COLORS.success 
                                  : (habit.commitmentPercentage || 0) > 25 
                                    ? '#FFA726' // Orange for medium progress 
                                    : COLORS.error
                              }
                            ]}
                          />
                        </View>
                        <Text style={[
                          styles.commitmentProgressText, 
                          { 
                            color: (habit.commitmentPercentage || 0) > 50 
                              ? COLORS.success 
                              : (habit.commitmentPercentage || 0) > 25 
                                ? '#FFA726' // Orange for medium progress
                                : COLORS.error  
                          }
                        ]}>
                          {(habit.commitmentPercentage || 0).toFixed(1)}%
                        </Text>
                      </View>

                      <View style={styles.commitmentButtons}>
                        <TouchableOpacity 
                          style={[styles.commitButton, styles.commitYesButton]}
                          onPress={() => handleLogCommitment(true)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.commitButtonText}>✓ لقد التزمت اليوم</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.commitButton, styles.commitNoButton]}
                          onPress={() => handleLogCommitment(false)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.commitButtonText}>✗ لم ألتزم اليوم</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.sectionHeading}>سجل الالتزام</Text>
                      {habit.logs.length > 0 ? (
                        <View style={styles.logsContainer}>
                          {habit.logs.slice().reverse().map((log, index) => (
                            <View 
                              key={log.id} 
                              style={[
                                styles.logItem, 
                                log.committed ? styles.committedLog : styles.notCommittedLog,
                                index === 0 && styles.latestLogItem
                              ]}
                            >
                              <View style={styles.statusIconContainer}>
                                <Text style={[
                                  styles.statusIcon, 
                                  log.committed ? styles.committedIcon : styles.notCommittedIcon
                                ]}>
                                  {log.committed ? '✓' : '✗'}
                                </Text>
                                <Text style={styles.logStatus}>
                                  {log.committed ? 'ملتزم' : 'غير ملتزم'}
                                </Text>
                              </View>
                              <Text style={styles.logDate}>{formatDate(log.date)}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.emptyLogBox}>
                          <Text style={styles.emptyLogText}>لا توجد سجلات التزام بعد</Text>
                        </View>
                      )}
                    </View>
                  )}
                </Animated.View>
              );
            } else if (section.title === 'reminders') {
              return <ReminderTimesSection />;
            } else if (section.title === 'achievements') {
              return (
                <AchievementsSection 
                  habit={habit} 
                  openModal={openAchievementModal} 
                  refresh={refreshHabitData} 
                />
              );
            }
            return null;
          }}
        />
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>جار تحميل تفاصيل العادة...</Text>
        </View>
      )}

      <SuccessMessage />

      {/* Achievement Modal */}
      <Modal
        transparent={true}
        animationType="fade"
        visible={showAchievementModal}
        onRequestClose={() => setShowAchievementModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تسجيل إنجاز جديد</Text>
            
            <View style={styles.achievementInputContainer}>
              <Text style={styles.inputLabel}>أدخل اسم الإنجاز للـ {habit?.name}:</Text>
              <TextInput
                style={styles.fullWidthInput}
                placeholder="مثال: قراءة 30 صفحة"
                placeholderTextColor={COLORS.textLight}
                textAlign="right"
                value={achievementName}
                onChangeText={setAchievementName}
              />
    </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowAchievementModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={handleRecordAchievement}
              >
                <Text style={styles.modalConfirmButtonText}>تسجيل</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* نافذة منبثقة لإيقاف التنبيه */}
      {showStopAlarmModal && (
        <View style={styles.stopAlarmModal}>
          <View style={styles.stopAlarmContent}>
            <Text style={styles.stopAlarmTitle}>⏰ تنبيه!</Text>
            <Text style={styles.alarmHabitName}>{habit.name}</Text>
            <Text style={styles.stopAlarmMessage}>
              {habit.type === 'quantitative' 
                ? `حان وقت ${habit.goal} ${habit.unit}` 
                : 'حان وقت الالتزام بهذه العادة'}
            </Text>
            
            <TouchableOpacity 
              style={styles.stopButton}
              onPress={() => {
                if (activeAlarmTimeKey) {
                  cancelAlarmSequence(activeAlarmTimeKey);
                }
              }}
            >
              <Text style={styles.stopButtonText}>إيقاف التنبيه</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Reminder Time Modal */}
      <Modal
        transparent={true}
        animationType="fade"
        visible={showReminderModal}
        onRequestClose={() => setShowReminderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إضافة وقت تذكير</Text>
            
            <View style={styles.achievementInputContainer}>
              <Text style={styles.inputLabel}>أدخل وقت التذكير (HH:MM):</Text>
              <TextInput
                style={styles.fullWidthInput}
                placeholder="مثال: 09:30"
                placeholderTextColor={COLORS.textLight}
                textAlign="center"
                value={reminderTime}
                onChangeText={setReminderTime}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={styles.reminderNote}>
                سيتم جدولة سلسلة من 50 إشعارًا متتاليًا بفاصل نصف ثانية بين كل منها عند حلول الوقت المحدد. ستظهر شاشة تمكنك من إيقاف التنبيهات.
              </Text>
              <Text style={styles.reminderWarning}>
                ملاحظة: هذه الطريقة تجريبية وقد تتأخر الإشعارات أو تتوقف بسبب قيود نظام التشغيل.
              </Text>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowReminderModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={addReminderTime}
              >
                <Text style={styles.modalConfirmButtonText}>إضافة</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  contentContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontSize: 18,
    color: COLORS.textMedium,
    includeFontPadding: false,
  },
  header: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    position: 'relative',
    zIndex: 10,
  },
  backButton: {
    position: 'absolute',
    left: SPACING.md,
    top: SPACING.lg + 2,
    padding: SPACING.xs,
    zIndex: 10,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
    includeFontPadding: false,
    maxWidth: width - 150, // Account for back button and badge
  },
  typeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 50,
  },
  typeBadgeText: {
    color: COLORS.white,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textDark,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
    textAlign: 'right',
    includeFontPadding: false,
  },
  goalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  goalText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginVertical: SPACING.sm,
    includeFontPadding: false,
  },
  frequencyText: {
    fontSize: 16,
    color: COLORS.textMedium,
    marginBottom: SPACING.md,
    includeFontPadding: false,
  },
  progressContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  progressBar: {
    flex: 1,
    height: 12,
    backgroundColor: COLORS.grayLight,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.success,
    width: 40,
    textAlign: 'right',
    includeFontPadding: false,
  },
  inputContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textDark,
    marginBottom: SPACING.md,
    textAlign: 'right',
    includeFontPadding: false,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityInput: {
    flex: 1,
    height: 60,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
      fontSize: 18,
    textAlignVertical: 'center',
  },
  unitText: {
    marginHorizontal: SPACING.sm,
    fontSize: 18,
    color: COLORS.textDark,
    includeFontPadding: false,
    textAlignVertical: 'center',
    minWidth: 30,
    textAlign: 'center',
  },
  logButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    height: 60,
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 100,
  },
  logButtonText: {
    color: COLORS.white,
    fontSize: 16,
      fontWeight: 'bold',
    includeFontPadding: false,
    textAlign: 'center',
  },
  logsContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  logItem: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  latestLogItem: {
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
    borderRightWidth: 3,
    borderRightColor: COLORS.info,
  },
  logValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    includeFontPadding: false,
  },
  statusIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: SPACING.xs,
    fontSize: 18,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  committedIcon: {
    color: COLORS.success,
  },
  notCommittedIcon: {
    color: COLORS.error,
  },
  logStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  logDate: {
    fontSize: 14,
    color: COLORS.textMedium,
    includeFontPadding: false,
  },
  committedLog: {
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
  },
  notCommittedLog: {
    backgroundColor: 'rgba(244, 67, 54, 0.05)',
  },
  statsCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  statsCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    marginHorizontal: SPACING.xs,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  currentStreakCard: {
    borderTopWidth: 3,
    borderTopColor: COLORS.primary,
  },
  longestStreakCard: {
    borderTopWidth: 3,
    borderTopColor: COLORS.secondary,
  },
  statsLabel: {
    fontSize: 14,
    color: COLORS.textMedium,
    marginBottom: SPACING.xs,
    textAlign: 'center',
    includeFontPadding: false,
  },
  statsValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.textDark,
    includeFontPadding: false,
  },
  statsUnit: {
    fontSize: 14,
    color: COLORS.textMedium,
    includeFontPadding: false,
  },
  commitmentButtons: {
    marginBottom: SPACING.lg,
  },
  commitButton: {
    padding: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: SPACING.sm,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    height: 60,
  },
  commitYesButton: {
    backgroundColor: COLORS.success,
  },
  commitNoButton: {
    backgroundColor: COLORS.error,
  },
  commitButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  emptyLogBox: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  emptyLogText: {
    textAlign: 'center',
    color: COLORS.textMedium,
    fontStyle: 'italic',
    padding: SPACING.md,
    includeFontPadding: false,
  },
  successMessage: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: COLORS.success,
    padding: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  successText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  achievementSection: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  achievementButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  achievementButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  achievementsContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  achievementItem: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  achievementItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textDark,
    includeFontPadding: false,
  },
  achievementItemDate: {
    fontSize: 14,
    color: COLORS.textMedium,
    includeFontPadding: false,
  },
  emptyAchievementBox: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  achievementInputContainer: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  fullWidthInput: {
    width: '100%',
    height: 60,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: 16,
    textAlign: 'right',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: 16,
    width: '85%',
    alignItems: 'center',
  },
  modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.md,
    textAlign: 'center',
    includeFontPadding: false,
    width: '100%',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: SPACING.lg,
  },
  modalCancelButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    backgroundColor: COLORS.grayLight,
    minWidth: 80,
    alignItems: 'center',
    height: 44,
  },
  modalCancelButtonText: {
    color: COLORS.textDark,
    fontWeight: '600',
    includeFontPadding: false,
  },
  modalConfirmButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    minWidth: 80,
    alignItems: 'center',
    height: 44,
  },
  modalConfirmButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    includeFontPadding: false,
  },
  refreshButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  refreshButtonText: {
    fontSize: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  reminderSection: {
    marginVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.md,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  reminderList: {
    marginTop: SPACING.md,
  },
  reminderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  reminderItemContent: {
    flex: 1,
  },
  reminderTime: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textDark,
    includeFontPadding: false,
  },
  reminderType: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginLeft: SPACING.sm,
    fontStyle: 'italic',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyReminderBox: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMedium,
    fontStyle: 'italic',
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    height: 40,
  },
  addButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  reminderNote: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginTop: SPACING.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  reminderWarning: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: SPACING.sm,
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: 'bold',
  },
  reminderActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: COLORS.secondary,
    marginRight: SPACING.sm,
  },
  commitmentProgressContainer: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.md,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  commitmentProgressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: SPACING.md,
    textAlign: 'right',
    includeFontPadding: false,
  },
  commitmentProgressBar: {
    height: 16,
    backgroundColor: COLORS.grayLight,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  commitmentProgressFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 8,
  },
  commitmentProgressText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
    includeFontPadding: false,
  },
  stopAlarmModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  stopAlarmContent: {
    backgroundColor: COLORS.error,
    padding: SPACING.lg,
    borderRadius: 20,
    width: '80%',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
  },
  stopAlarmTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  stopAlarmMessage: {
    fontSize: 16,
    color: COLORS.white,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  stopButton: {
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 30,
    marginTop: SPACING.md,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stopButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.error,
  },
  alarmHabitName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
    marginVertical: SPACING.md,
    textAlign: 'center',
  },
});

export default HabitDetailScreen;


