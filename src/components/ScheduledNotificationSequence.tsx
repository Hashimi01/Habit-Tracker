import React, { useState, useEffect, useRef } from 'react';
import { Text, View, Button, Platform, StyleSheet, ScrollView, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// تعريف نوع مؤقت setTimeout لتجنب أخطاء TypeScript
type TimeoutID = ReturnType<typeof setTimeout>;

// --- إعداد معالج الإشعارات (نسخة محدثة بإعدادات العرض الصحيحة) ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // shouldShowAlert: true, // <-- مهمل (Deprecated)
    shouldShowBanner: true, // إظهار الإشعار كـ Banner (أعلى الشاشة) - بديل لـ shouldShowAlert
    shouldShowList: true,   // إظهار الإشعار في قائمة الإشعارات - بديل لـ shouldShowAlert
    shouldPlaySound: true, // تشغيل الصوت الافتراضي
    shouldSetBadge: false, // عدم تغيير عدد الأيقونة
  }),
});

// --- المكون الرئيسي للمثال (نسخة مصححة ومحدثة) ---
export default function ScheduledNotificationSequenceFinal() {
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const [scheduledNotificationIds, setScheduledNotificationIds] = useState<string[]>([]);
  const numberOfNotifications = 5; // Reduced number for testing
  const intervalSeconds = 30; // Increased to 30 seconds between notifications
  const startTimeOffsetSeconds = 120; // Increased to 2 minutes for the first notification

  useEffect(() => {
    registerForPushNotificationsAsync();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
      console.log('Notification received while app is foregrounded:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      cancelAllScheduledNotifications();
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      cancelAllScheduledNotifications(); 
    };
  }, []);

  // --- وظيفة جدولة سلسلة من التنبيهات (فاصل 3 ثوانٍ) ---
  async function scheduleSequenceAtSpecificTime() {
    await cancelAllScheduledNotifications(); 
    
    console.log('Setting up delayed notifications...');
    Alert.alert(
      'جاري الإعداد...',
      `سيتم إعداد ${numberOfNotifications} تنبيهات متتالية. سيظهر أول تنبيه بعد ${startTimeOffsetSeconds} ثانية.`
    );

    // استخدام المؤقت المتتبع
    setTimeoutWithRef(async () => {
      // جدولة التنبيه الأول فقط
      await scheduleNextNotification(0);
    }, startTimeOffsetSeconds * 1000);
  }
  
  // وظيفة لجدولة التنبيه التالي في السلسلة
  async function scheduleNextNotification(index: number) {
    if (index >= numberOfNotifications) return;
    
    try {
      // إظهار التنبيه الحالي فوراً
      const now = new Date();
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
          title: `تنبيه رقم (${index + 1}/${numberOfNotifications}) ⏰`,
          body: `تنبيه مجدول للوقت ${now.toLocaleTimeString()}. انقر للإيقاف.`,
          sound: 'default',
          priority: 'max',
          data: { index, total: numberOfNotifications },
          },
        trigger: null, // ظهور فوري
        });
      
      console.log(`تم إظهار التنبيه ${index+1}/${numberOfNotifications} في ${now.toLocaleTimeString()}`);
      
      // حفظ معرف التنبيه
      setScheduledNotificationIds(prev => [...prev, identifier]);
      
      // إذا كان هناك تنبيه تالي، نجدول ظهوره بعد الفاصل الزمني
      if (index < numberOfNotifications - 1) {
        setTimeoutWithRef(() => {
          scheduleNextNotification(index + 1);
        }, intervalSeconds * 1000);
      } else {
        // آخر تنبيه تم عرضه
        Alert.alert(
          'اكتملت السلسلة',
          'تم عرض جميع التنبيهات المجدولة.'
        );
      }
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  }

  // --- وظيفة إلغاء جميع التنبيهات المجدولة ---
  async function cancelAllScheduledNotifications() {
    if (scheduledNotificationIds.length > 0) {
      console.log('Cancelling all scheduled notifications:', scheduledNotificationIds);
      await Promise.all(scheduledNotificationIds.map(id => Notifications.cancelScheduledNotificationAsync(id)));
      setScheduledNotificationIds([]); 
      console.log('All scheduled notifications cancelled.');
    } else {
      console.log('No scheduled notifications to cancel.');
    }
    
    // مسح أي مؤقتات زمنية متبقية
    clearAllTimeouts();
  }
  
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>تنبيهات متتابعة مع فاصل زمني</Text>
      <Text style={styles.info}>
        سيتم إرسال {numberOfNotifications} تنبيهات متتالية بفاصل {intervalSeconds} ثانية.
        التنبيه الأول سيظهر بعد {startTimeOffsetSeconds} ثانية من الضغط على الزر.
      </Text>
      <Text style={styles.info}>
        تم تصميم هذه الطريقة للعمل مع EAS Build، حيث يتم استخدام نظام مؤقتات داخلي للتحكم الدقيق في توقيت التنبيهات.
      </Text>

      <View style={styles.buttonContainer}>
        <Button
          title={`جدولة ${numberOfNotifications} تنبيهات (تبدأ بعد ${startTimeOffsetSeconds} ثانية، فاصل ${intervalSeconds} ثوانٍ)`}
          onPress={scheduleSequenceAtSpecificTime}
          disabled={scheduledNotificationIds.length > 0} 
        />
      </View>
      <View style={styles.buttonContainer}>
        <Button
          title="إلغاء جميع التنبيهات المجدولة"
          onPress={cancelAllScheduledNotifications}
          disabled={scheduledNotificationIds.length === 0} 
          color="red"
        />
      </View>
    </ScrollView>
  );
}

// --- وظيفة طلب الأذونات وإنشاء القناة (محدثة) ---
async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('scheduled-sequence', { 
      name: 'Scheduled Sequence Alarms',
      importance: Notifications.AndroidImportance.MAX, 
      vibrationPattern: [0, 250, 250, 250], 
      sound: 'default', 
      bypassDnd: true, 
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableLights: true,
      lightColor: '#FF0000',
      enableVibrate: true,
    });
    
    // Check if the channel was created properly
    const channel = await Notifications.getNotificationChannelAsync('scheduled-sequence');
    console.log('Notification channel settings:', JSON.stringify(channel));
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
      Alert.alert('فشل الحصول على إذن الإشعارات!', 'لا يمكن جدولة التنبيهات بدون إذن.');
      return;
    }
  } else {
    // لا يزال من المفيد التنبيه، لكن Expo Go له قيود أخرى
    // Alert.alert('تنبيه', 'يجب استخدام جهاز حقيقي لاختبار الإشعارات بشكل كامل.');
  }
  return token; 
}

// --- الأنماط ---
const styles = StyleSheet.create({
  container: {
    flexGrow: 1, 
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  info: {
    textAlign: 'center',
    marginBottom: 10,
  },
  warning: {
    textAlign: 'center',
    marginBottom: 10, 
    color: 'red',
    fontWeight: 'bold',
  },
  buttonContainer: {
    marginVertical: 10,
    width: '90%', 
  },
});

