import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  ScrollView, 
  Switch, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert,
  Modal,
  FlatList,
  Platform,
  Dimensions,
  I18nManager
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import uuid from 'react-native-uuid';
import { addHabit } from '../utils/habitStorage';
import { Habit, HabitType, QuantitativeHabit, CommitmentHabit, RootStackParamList } from '../types';
import { COLORS, SPACING } from '../theme';

// Force RTL layout direction
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const { width } = Dimensions.get('window');

// Define navigation prop type specifically for AddHabitScreen
type AddHabitScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'AddHabit'
>;

const AddHabitScreen = () => {
  const navigation = useNavigation<AddHabitScreenNavigationProp>();
  const [name, setName] = useState('');
  const [type, setType] = useState<HabitType>('quantitative'); // Default to quantitative
  const [goal, setGoal] = useState(''); // Goal for quantitative
  const [unit, setUnit] = useState(''); // Unit for quantitative
  const [reminder, setReminder] = useState(false);
  const [frequency, setFrequency] = useState('daily'); // New frequency option
  
  // Multiple reminder times
  const [reminderTimes, setReminderTimes] = useState<string[]>(['09:00']);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [tempTime, setTempTime] = useState('');

  const handleAddHabit = async () => {
    if (!name.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم العادة');
      return;
    }

    const newHabitBase = {
      id: uuid.v4() as string,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      reminderTimes: reminder ? reminderTimes : [], // Use selected reminder times
    };

    let newHabit: Habit;

    if (type === 'quantitative') {
      const goalValue = parseInt(goal, 10);
      if (isNaN(goalValue) || goalValue <= 0 || !unit.trim()) {
        Alert.alert('تنبيه', 'يرجى إدخال هدف ووحدة صحيحة للعادة الكمية');
        return;
      }
      newHabit = {
        ...newHabitBase,
        type: 'quantitative',
        goal: goalValue,
        unit: unit.trim(),
        frequency: frequency,
        logs: [],
      } as QuantitativeHabit;
    } else {
      newHabit = {
        ...newHabitBase,
        type: 'commitment',
        logs: [],
        currentStreak: 0,
        longestStreak: 0,
      } as CommitmentHabit;
    }

    try {
      await addHabit(newHabit);
      Alert.alert('تم بنجاح', 'تمت إضافة العادة بنجاح', [
        { text: 'حسناً', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Failed to add habit:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إضافة العادة.');
    }
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }

    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      if (editingTimeIndex !== null) {
        // Edit existing time
        const updatedTimes = [...reminderTimes];
        updatedTimes[editingTimeIndex] = timeString;
        setReminderTimes(updatedTimes);
        setEditingTimeIndex(null);
      } else {
        // Add new time if it doesn't exist already
        if (!reminderTimes.includes(timeString)) {
          setReminderTimes([...reminderTimes, timeString]);
        }
      }
    }
  };

  const showTimePickerModal = (index?: number) => {
    if (index !== undefined) {
      // Edit existing time
      setEditingTimeIndex(index);
      const timeToEdit = reminderTimes[index];
      const [hours, minutes] = timeToEdit.split(':').map(Number);
      const newDate = new Date();
      newDate.setHours(hours, minutes, 0, 0);
      setSelectedTime(newDate);
    } else {
      // Add new time
      setEditingTimeIndex(null);
      setSelectedTime(new Date());
    }
    setShowTimePicker(true);
  };

  const removeReminderTime = (index: number) => {
    const updatedTimes = reminderTimes.filter((_, i) => i !== index);
    setReminderTimes(updatedTimes);
  };

  const formatTimeForDisplay = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    
    return date.toLocaleTimeString('ar-SA', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
  };

  const handleAddTime = () => {
    if (!tempTime.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      Alert.alert('تنبيه', 'يرجى إدخال وقت صحيح بتنسيق HH:MM');
      return;
    }

    if (!reminderTimes.includes(tempTime)) {
      setReminderTimes([...reminderTimes, tempTime].sort());
    }
    setTempTime('');
  };

  const handleEditTime = (index: number, newTime: string) => {
    if (!newTime.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      Alert.alert('تنبيه', 'يرجى إدخال وقت صحيح بتنسيق HH:MM');
      return;
    }

    const updatedTimes = [...reminderTimes];
    updatedTimes[index] = newTime;
    setReminderTimes(updatedTimes.sort());
  };

  const formatTimeInput = (text: string) => {
    // تنسيق النص أثناء الكتابة
    let formatted = text.replace(/[^0-9:]/g, '');
    if (formatted.length === 2 && !formatted.includes(':') && !tempTime.includes(':')) {
      formatted += ':';
    }
    if (formatted.length > 5) {
      formatted = formatted.slice(0, 5);
    }
    return formatted;
  };

  const renderFrequencySelector = () => {
    return (
      <View style={styles.frequencyContainer}>
        <Text style={styles.label}>تكرار العادة:</Text>
        <View style={styles.frequencyOptions}>
          <TouchableOpacity 
            style={[styles.frequencyOption, frequency === 'daily' && styles.frequencyOptionSelected]}
            onPress={() => setFrequency('daily')}
          >
            <Text style={[styles.frequencyText, frequency === 'daily' && styles.frequencyTextSelected]}>يومي</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.frequencyOption, frequency === 'weekly' && styles.frequencyOptionSelected]}
            onPress={() => setFrequency('weekly')}
          >
            <Text style={[styles.frequencyText, frequency === 'weekly' && styles.frequencyTextSelected]}>أسبوعي</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.frequencyOption, frequency === 'monthly' && styles.frequencyOptionSelected]}
            onPress={() => setFrequency('monthly')}
          >
            <Text style={[styles.frequencyText, frequency === 'monthly' && styles.frequencyTextSelected]}>شهري</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderReminderTimes = () => {
    if (!reminder) return null;

    return (
      <View style={styles.reminderTimesContainer}>
        <View style={styles.reminderTimesHeader}>
          <Text style={styles.reminderTimesTitle}>أوقات التذكير</Text>
        </View>

        <View style={styles.timeInputContainer}>
          <TextInput
            style={[styles.timeInput, { direction: 'ltr' }]}
            value={tempTime}
            onChangeText={(text) => setTempTime(formatTimeInput(text))}
            placeholder="09:30"
            placeholderTextColor={COLORS.textLight}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            textAlign="center"
          />
          <TouchableOpacity 
            style={[
              styles.addTimeButton,
              !tempTime.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/) && styles.addTimeButtonDisabled
            ]}
            onPress={handleAddTime}
            disabled={!tempTime.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)}
          >
            <Text style={styles.addTimeButtonText}>إضافة</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.timeInputHint}>
          أدخل الوقت بتنسيق 24 ساعة. مثال: 13:30 للساعة 1:30 مساءً
        </Text>

        {reminderTimes.length > 0 ? (
          <FlatList
            data={reminderTimes}
            renderItem={({ item, index }) => (
              <View style={styles.timeItem}>
                <TextInput
                  style={[styles.timeItemInput, { direction: 'ltr' }]}
                  value={item}
                  onChangeText={(text) => handleEditTime(index, formatTimeInput(text))}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  textAlign="center"
                />
                <TouchableOpacity 
                  style={styles.removeTimeButton}
                  onPress={() => removeReminderTime(index)}
                >
                  <Text style={styles.removeTimeButtonText}>حذف</Text>
                </TouchableOpacity>
              </View>
            )}
            keyExtractor={(item, index) => `time-${index}`}
            contentContainerStyle={styles.reminderTimesList}
          />
        ) : (
          <Text style={styles.noTimesText}>لم يتم إضافة أوقات تذكير بعد</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>إضافة عادة جديدة</Text>
        
        <View style={styles.card}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>اسم العادة:</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="مثال: المشي، قراءة كتاب، الإقلاع عن شيء"
              placeholderTextColor={COLORS.textLight}
              textAlign="right"
              multiline={false}
            />
          </View>

          <View style={styles.typeContainer}>
            <Text style={styles.label}>نوع العادة:</Text>
            <View style={styles.switchContainer}>
              <Text style={[styles.typeLabel, type !== 'quantitative' && styles.activeTypeLabel, styles.typeLabelRight]}>
                التزام (مثل الإقلاع عن شيء)
              </Text>
              <Switch
                value={type === 'quantitative'}
                onValueChange={(value) => setType(value ? 'quantitative' : 'commitment')}
                trackColor={{ false: COLORS.grayLight, true: COLORS.primaryLight }}
                thumbColor={type === 'quantitative' ? COLORS.primary : COLORS.secondary}
                ios_backgroundColor={COLORS.grayLight}
              />
              <Text style={[styles.typeLabel, type === 'quantitative' && styles.activeTypeLabel, styles.typeLabelLeft]}>
                كمي (مثل المشي 4 كم)
              </Text>
            </View>
          </View>
        </View>

        {type === 'quantitative' && (
          <View style={styles.card}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>الهدف الكمي:</Text>
              <TextInput
                style={[styles.input, styles.quantitativeInput]}
                value={goal}
                onChangeText={setGoal}
                placeholder="مثال: 4"
                keyboardType="numeric"
                placeholderTextColor={COLORS.textLight}
                textAlign="right"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>الوحدة:</Text>
              <TextInput
                style={[styles.input, styles.quantitativeInput]}
                value={unit}
                onChangeText={setUnit}
                placeholder="مثال: كم، صفحة، دقيقة"
                placeholderTextColor={COLORS.textLight}
                textAlign="right"
              />
            </View>
            
            {renderFrequencySelector()}
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.reminderContainer}>
            <Text style={styles.label}>تفعيل التذكير:</Text>
            <View style={styles.switchContainer}>
              <Text style={styles.reminderText}>
                {reminder ? 'مفعل' : 'غير مفعل'}
              </Text>
              <Switch
                value={reminder}
                onValueChange={setReminder}
                trackColor={{ false: COLORS.grayLight, true: COLORS.primaryLight }}
                thumbColor={reminder ? COLORS.primary : COLORS.grayMedium}
                ios_backgroundColor={COLORS.grayLight}
              />
            </View>
          </View>
          
          {renderReminderTimes()}
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleAddHabit}>
          <Text style={styles.addButtonText}>إضافة العادة</Text>
        </TouchableOpacity>

        {showTimePicker && (
          <Modal
            transparent={true}
            animationType="fade"
            visible={showTimePicker}
            onRequestClose={() => setShowTimePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {editingTimeIndex !== null ? 'تعديل وقت التذكير' : 'إضافة وقت تذكير جديد'}
                </Text>
                
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleTimeChange}
                  style={styles.timePicker}
                  locale="ar-SA"
                />
                
                {Platform.OS === 'ios' && (
                  <View style={styles.modalButtons}>
                    <TouchableOpacity 
                      style={styles.modalCancelButton}
                      onPress={() => setShowTimePicker(false)}
                    >
                      <Text style={styles.modalCancelButtonText}>إلغاء</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.modalConfirmButton}
                      onPress={() => {
                        handleTimeChange({ type: 'set' }, selectedTime);
                        setShowTimePicker(false);
                      }}
                    >
                      <Text style={styles.modalConfirmButtonText}>تأكيد</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </Modal>
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
    padding: SPACING.lg,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: SPACING.lg,
    textAlign: 'center',
    color: COLORS.primary,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputContainer: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    textAlign: 'right',
    color: COLORS.textDark,
    includeFontPadding: false,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 15,
    backgroundColor: COLORS.white,
    textAlign: 'right',
    fontSize: 16,
    color: COLORS.textDark,
    includeFontPadding: false,
    textAlignVertical: 'center',
    minHeight: 52,
  },
  quantitativeInput: {
    paddingHorizontal: SPACING.lg,
    textAlign: 'right',
  },
  typeContainer: {
    marginBottom: SPACING.sm,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 15,
  },
  typeLabel: {
    fontSize: 15,
    color: COLORS.textMedium,
    includeFontPadding: false,
    paddingVertical: 2,
    flex: 1,
  },
  typeLabelRight: {
    textAlign: 'right',
    paddingRight: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  typeLabelLeft: {
    textAlign: 'left',
    paddingLeft: SPACING.sm,
    marginRight: SPACING.xs,
  },
  activeTypeLabel: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  reminderContainer: {
    marginBottom: SPACING.md,
  },
  reminderText: {
    fontSize: 15,
    color: COLORS.textDark,
    includeFontPadding: false,
  },
  frequencyContainer: {
    marginBottom: SPACING.sm,
  },
  frequencyOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  frequencyOption: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  frequencyOptionSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  frequencyText: {
    color: COLORS.textDark,
    fontWeight: '500',
    includeFontPadding: false,
    textAlign: 'center',
    fontSize: 14,
  },
  frequencyTextSelected: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: COLORS.primary,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  reminderTimesContainer: {
    marginTop: SPACING.sm,
  },
  reminderTimesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  reminderTimesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
    includeFontPadding: false,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  timeInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    backgroundColor: COLORS.white,
    marginRight: SPACING.sm,
  },
  timeInputHint: {
    fontSize: 12,
    color: COLORS.textMedium,
    textAlign: 'center',
    marginBottom: SPACING.md,
    fontStyle: 'italic',
  },
  timeItemInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    fontSize: 16,
    backgroundColor: COLORS.white,
    marginRight: SPACING.sm,
  },
  addTimeButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
  },
  addTimeButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  addTimeButtonDisabled: {
    backgroundColor: COLORS.grayLight,
    opacity: 0.5,
  },
  reminderTimesList: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.sm,
  },
  timeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  removeTimeButton: {
    backgroundColor: COLORS.error,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  removeTimeButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  noTimesText: {
    textAlign: 'center',
    color: COLORS.textMedium,
    fontStyle: 'italic',
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.8,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.md,
    textAlign: 'center',
    includeFontPadding: false,
  },
  timePicker: {
    width: width * 0.7,
    height: 200,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: SPACING.md,
  },
  modalCancelButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    backgroundColor: COLORS.grayLight,
  },
  modalCancelButtonText: {
    color: COLORS.textDark,
    fontWeight: '600',
  },
  modalConfirmButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  modalConfirmButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  }
});

export default AddHabitScreen;

