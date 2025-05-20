import React from 'react';
import { View, Text, StyleSheet, Image, SafeAreaView, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { COLORS, SPACING } from '../theme';

const AboutScreen = () => {
  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} />
        </View>
        
        <Text style={styles.title}>متتبع العادات</Text>
        <Text style={styles.subtitle}>نسخة 1.6.0</Text>
        
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>عن التطبيق</Text>
          <Text style={styles.description}>
            تطبيق متخصص لمساعدتك في بناء عادات إيجابية ومتابعة تقدمك من خلال
            إحصائيات ورسوم بيانية تفاعلية. يمكنك تتبع عاداتك اليومية سواء كانت
            كمية أو التزامات بسيطة، ومراقبة أدائك وتحسينه مع مرور الوقت.
          </Text>
        </View>
        
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>المطورون</Text>
          <Text style={styles.description}>
            تم تطوير هذا التطبيق بواسطة{' '}
            <Text style={styles.link} onPress={() => openLink('https://hashimi.vercel.app/')}>
              هاشمي
            </Text>
            .
          </Text>
        </View>
        
        <Text style={styles.footer}>جميع الحقوق محفوظة © 2025</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  logoContainer: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMedium,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    marginBottom: SPACING.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 24,
    textAlign: 'center',
  },
  link: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  footer: {
    marginTop: SPACING.xl,
    fontSize: 14,
    color: COLORS.textMedium,
    textAlign: 'center',
  },
});

export default AboutScreen;
