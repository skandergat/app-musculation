import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { useAppColorScheme } from '@/context/ColorSchemeContext';
import { API_URL, apiFetch } from '@/config/api';

type ProfileData = {
  photoUri: string | null;
  startWeight: string;
  currentWeight: string;
  targetWeight: string;
  height: string;
};

type HistoriquePoint = {
  date_debut: string;
  poids_max: number | null;
  repetitions_max: number | null;
  volume: number;
};

type ProgressionItem = {
  exercice_id: number;
  exercice_nom: string;
  groupe_musculaire: string | null;
  total_seances: number;
  meilleur_poids: number | null;
  meilleures_repetitions: number | null;
  volume_total: number;
  historique: HistoriquePoint[];
};

const EMPTY_PROFILE: ProfileData = {
  photoUri: null,
  startWeight: '',
  currentWeight: '',
  targetWeight: '',
  height: '',
};

const numberValue = (value: number | null | undefined) => {
  if (value == null) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const copy = {
  fr: {
    title: 'Mon profil', subtitle: 'Tes informations et tes objectifs',
    photo: 'Modifier la photo', choosePhoto: 'Choisir une photo',
    permission: 'Autorise l’accès aux photos pour choisir ton avatar.',
    start: 'Poids de départ (kg)', current: 'Poids actuel (kg)',
    target: 'Poids objectif (kg)', height: 'Taille (cm)',
    bmi: 'Indice de masse corporelle (IMC)', bmiNote: 'Calculé à partir du poids actuel et de la taille.',
    progress: 'Progression vers ton objectif', remaining: 'Restant',
    reached: 'Objectif atteint !', enterWeights: 'Renseigne tes poids pour calculer la progression.',
    saved: 'Les données du profil sont sauvegardées sur cet appareil.',
    performances: 'Progression sportive', performancesSubtitle: 'Tes performances exercice par exercice.',
    bestWeight: 'Meilleur poids', bestReps: 'Meilleures reps', workouts: 'Séances',
    totalVolume: 'Volume total', recent: 'Dernières séances', empty: 'Pas encore de progression',
    emptyHelp: 'Termine quelques séances pour voir tes performances ici.',
    loadingError: 'Impossible de charger la progression.', retry: 'Réessayer',
    photoError: 'Impossible d’ouvrir la galerie de photos.',
  },
  en: {
    title: 'My profile', subtitle: 'Your information and goals',
    photo: 'Change photo', choosePhoto: 'Choose a photo',
    permission: 'Allow photo access to choose your avatar.',
    start: 'Starting weight (kg)', current: 'Current weight (kg)',
    target: 'Target weight (kg)', height: 'Height (cm)',
    bmi: 'Body mass index (BMI)', bmiNote: 'Calculated from current weight and height.',
    progress: 'Progress toward your goal', remaining: 'Remaining',
    reached: 'Goal reached!', enterWeights: 'Enter your weights to calculate progress.',
    saved: 'Your profile data is saved on this device.',
    performances: 'Workout progress', performancesSubtitle: 'Track performance exercise by exercise.',
    bestWeight: 'Best weight', bestReps: 'Best reps', workouts: 'Workouts',
    totalVolume: 'Total volume', recent: 'Recent workouts', empty: 'No progress yet',
    emptyHelp: 'Complete a few workouts to see your performance here.',
    loadingError: 'Could not load workout progress.', retry: 'Retry',
    photoError: 'Could not open the photo library.',
  },
  ar: {
    title: 'ملفي الشخصي', subtitle: 'معلوماتك وأهدافك',
    photo: 'تغيير الصورة', choosePhoto: 'اختر صورة',
    permission: 'اسمح بالوصول إلى الصور لاختيار صورتك.',
    start: 'وزن البداية (كغ)', current: 'الوزن الحالي (كغ)',
    target: 'الوزن المستهدف (كغ)', height: 'الطول (سم)',
    bmi: 'مؤشر كتلة الجسم', bmiNote: 'يُحسب باستخدام الوزن الحالي والطول.',
    progress: 'التقدم نحو هدفك', remaining: 'المتبقي',
    reached: 'تم تحقيق الهدف!', enterWeights: 'أدخل أوزانك لحساب التقدم.',
    saved: 'يتم حفظ بياناتك على هذا الجهاز.',
    performances: 'تقدم التمارين', performancesSubtitle: 'تابع أداءك في كل تمرين.',
    bestWeight: 'أفضل وزن', bestReps: 'أفضل تكرارات', workouts: 'التمارين',
    totalVolume: 'الحجم الإجمالي', recent: 'آخر التمارين', empty: 'لا توجد بيانات تقدم بعد',
    emptyHelp: 'أكمل بعض التمارين لرؤية أدائك هنا.',
    loadingError: 'تعذر تحميل تقدم التمارين.', retry: 'إعادة المحاولة',
    photoError: 'تعذر فتح معرض الصور.',
  },
  de: {
    title: 'Mein Profil', subtitle: 'Deine Angaben und Ziele',
    photo: 'Foto ändern', choosePhoto: 'Foto auswählen',
    permission: 'Erlaube den Fotozugriff, um ein Profilbild auszuwählen.',
    start: 'Startgewicht (kg)', current: 'Aktuelles Gewicht (kg)',
    target: 'Zielgewicht (kg)', height: 'Größe (cm)',
    bmi: 'Body-Mass-Index (BMI)', bmiNote: 'Berechnet aus aktuellem Gewicht und Körpergröße.',
    progress: 'Fortschritt zum Ziel', remaining: 'Noch',
    reached: 'Ziel erreicht!', enterWeights: 'Gib deine Gewichte ein, um den Fortschritt zu berechnen.',
    saved: 'Deine Profildaten werden auf diesem Gerät gespeichert.',
    performances: 'Trainingsfortschritt', performancesSubtitle: 'Verfolge deine Leistung für jede Übung.',
    bestWeight: 'Bestes Gewicht', bestReps: 'Beste Wiederholungen', workouts: 'Einheiten',
    totalVolume: 'Gesamtvolumen', recent: 'Letzte Einheiten', empty: 'Noch kein Fortschritt',
    emptyHelp: 'Absolviere einige Einheiten, um deine Leistung hier zu sehen.',
    loadingError: 'Trainingsfortschritt konnte nicht geladen werden.', retry: 'Erneut versuchen',
    photoError: 'Die Fotogalerie konnte nicht geöffnet werden.',
  },
};

export default function ProfilScreen() {
  const { user, token } = useAuth();
  const { language, exerciseName, muscleGroupName } = useI18n();
  const dark = useAppColorScheme() === 'dark';
  const lang = language in copy ? (language as keyof typeof copy) : 'fr';
  const t = copy[lang];
  const isArabic = lang === 'ar';

  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null);
  const [items, setItems] = useState<ProgressionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);

  const storageKey = 'liftely.profile.v1.' + (user?.id ?? 'local');

  const profileLoaded = profileLoadedFor === storageKey;
  const displayedProfile = profileLoaded ? profile : EMPTY_PROFILE;

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      let nextProfile = EMPTY_PROFILE;
      try {
        const saved = await AsyncStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<ProfileData>;
          nextProfile = { ...EMPTY_PROFILE, ...parsed };
        }
      } catch {
        if (active) {
          Alert.alert('LIFTELY', 'Impossible de charger les données du profil.');
        }
      }
      if (active) {
        setProfile(nextProfile);
        setProfileLoadedFor(storageKey);
      }
    };
    void loadProfile();
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    if (!profileLoaded) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(profile)).catch(() => {
      Alert.alert('LIFTELY', 'Impossible de sauvegarder le profil.');
    });
  }, [profile, profileLoaded, storageKey]);

  const loadProgress = useCallback(async () => {
    try {
      setProgressError(null);
      const response = await apiFetch(API_URL + '/progression', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!response.ok) throw new Error(t.loadingError);
      setItems(await response.json());
    } catch (error: any) {
      setProgressError(error?.message || t.loadingError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, t.loadingError]);

  useFocusEffect(useCallback(() => {
    void loadProgress();
  }, [loadProgress]));

  const choosePhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t.choosePhoto, t.permission);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setProfile((previous) => ({ ...previous, photoUri: result.assets[0].uri }));
      }
    } catch {
      Alert.alert(t.title, t.photoError);
    }
  };

  const updateField = (
    field: 'startWeight' | 'currentWeight' | 'targetWeight' | 'height',
    value: string,
  ) => setProfile((previous) => ({ ...previous, [field]: value }));

  const n = (value: string) => Number.parseFloat(value.replace(',', '.'));
  const start = n(displayedProfile.startWeight);
  const current = n(displayedProfile.currentWeight);
  const target = n(displayedProfile.targetWeight);
  const height = n(displayedProfile.height);
  const validCurrent = Number.isFinite(current) && current > 0;
  const validHeight = Number.isFinite(height) && height > 0;
  const validWeights = [start, current, target].every((value) => Number.isFinite(value) && value > 0);
  const bmi = validCurrent && validHeight ? current / ((height / 100) ** 2) : null;
  const delta = target - start;
  const goalProgress = validWeights && delta !== 0
    ? Math.max(0, Math.min(100, ((current - start) / delta) * 100))
    : null;
  const remaining = validWeights && goalProgress !== null ? Math.abs(target - current) : null;
  const weightLossGoal = target < start;

  const card = [styles.card, dark && styles.cardDark];
  const text = [styles.text, dark && styles.textDark];
  const muted = [styles.muted, dark && styles.mutedDark];
  const rtl = isArabic ? styles.rtl : undefined;

  const renderInput = (
    label: string,
    field: 'startWeight' | 'currentWeight' | 'targetWeight' | 'height',
    placeholder: string,
  ) => (
    <View style={styles.field} key={field}>
      <Text style={[styles.label, text, rtl]}>{label}</Text>
      <TextInput
        value={displayedProfile[field]}
        onChangeText={(value) => updateField(field, value)}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={dark ? '#8E8E93' : '#8A8A8E'}
        style={[styles.input, dark && styles.inputDark, text, rtl]}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.screen, dark && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadProgress(); }} />}
      >
        <Text style={[styles.title, text, rtl]}>{t.title}</Text>
        <Text style={[styles.subtitle, muted, rtl]}>{t.subtitle}</Text>

        <View style={card}>
          <View style={styles.avatarSection}>
            <Pressable onPress={choosePhoto} accessibilityRole="button" accessibilityLabel={t.choosePhoto} style={[styles.avatar, dark && styles.avatarDark]}>
              {displayedProfile.photoUri
                ? <Image source={{ uri: displayedProfile.photoUri }} style={styles.avatarImage} />
                : <Text style={styles.avatarPlaceholder}>👤</Text>}
            </Pressable>
            <Pressable onPress={choosePhoto} accessibilityRole="button">
              <Text style={[styles.photoButton, text]}>{t.photo}</Text>
            </Pressable>
          </View>
          {!!user?.nom && <Text style={[styles.userName, text, rtl]}>{user.nom}</Text>}
          {!!user?.email && <Text style={[styles.email, muted, rtl]}>{user.email}</Text>}
          {renderInput(t.start, 'startWeight', '100')}
          {renderInput(t.current, 'currentWeight', '90')}
          {renderInput(t.target, 'targetWeight', '80')}
          {renderInput(t.height, 'height', '180')}
        </View>

        <View style={card}>
          <Text style={[styles.sectionTitle, text, rtl]}>{t.bmi}</Text>
          <Text style={[styles.bigValue, text]}>{bmi !== null && Number.isFinite(bmi) ? bmi.toFixed(1) : '—'}</Text>
          <Text style={[styles.note, muted, rtl]}>{t.bmiNote}</Text>
        </View>

        <View style={card}>
          <Text style={[styles.sectionTitle, text, rtl]}>{t.progress}</Text>
          {goalProgress === null ? (
            <Text style={[styles.note, muted, rtl]}>{t.enterWeights}</Text>
          ) : (
            <>
              <View style={styles.progressHeader}>
                <Text style={[styles.bigValue, text]}>{Math.round(goalProgress)}%</Text>
                <Text style={[styles.note, muted, rtl]}>
                  {goalProgress >= 100 ? t.reached : `${t.remaining}: ${remaining?.toFixed(1)} kg`}
                </Text>
              </View>
              <View style={[styles.track, dark && styles.trackDark]}>
                <View style={[styles.fill, { width: goalProgress + '%', backgroundColor: dark ? '#8BD3A8' : '#23864B' }]} />
              </View>
              <Text style={[styles.note, muted, rtl]}>
                {weightLossGoal
                  ? (lang === 'fr' ? 'Objectif de perte de poids' : lang === 'en' ? 'Weight-loss goal' : lang === 'ar' ? 'هدف فقدان الوزن' : 'Abnehmziel')
                  : (lang === 'fr' ? 'Objectif de prise de poids' : lang === 'en' ? 'Weight-gain goal' : lang === 'ar' ? 'هدف زيادة الوزن' : 'Zunehmziel')}
              </Text>
            </>
          )}
        </View>

        <Text style={[styles.saved, muted, rtl]}>{t.saved}</Text>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, text, rtl]}>{t.performances}</Text>
          <Text style={[styles.subtitle, muted, rtl]}>{t.performancesSubtitle}</Text>
        </View>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator size="large" color="#0A84FF" /></View>
        ) : progressError ? (
          <View style={card}>
            <Text style={[styles.note, muted, rtl]}>{progressError}</Text>
            <Pressable style={styles.retry} onPress={() => { setLoading(true); void loadProgress(); }}>
              <Text style={styles.retryText}>{t.retry}</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={card}>
            <Text style={[styles.sectionTitle, text, rtl]}>{t.empty}</Text>
            <Text style={[styles.note, muted, rtl]}>{t.emptyHelp}</Text>
          </View>
        ) : items.map((item) => {
          const open = selected === item.exercice_id;
          return (
            <Pressable
              key={item.exercice_id}
              onPress={() => setSelected(open ? null : item.exercice_id)}
              style={card}
            >
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseInfo}>
                  <Text style={[styles.exerciseName, text]}>{exerciseName(item.exercice_nom)}</Text>
                  {!!item.groupe_musculaire && <Text style={[styles.note, muted]}>{muscleGroupName(item.groupe_musculaire)}</Text>}
                </View>
                <Text style={[styles.chevron, muted]}>{open ? '⌃' : '⌄'}</Text>
              </View>
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, text]}>{numberValue(item.meilleur_poids)} kg</Text>
                  <Text style={[styles.statLabel, muted]}>{t.bestWeight}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, text]}>{numberValue(item.meilleures_repetitions)}</Text>
                  <Text style={[styles.statLabel, muted]}>{t.bestReps}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, text]}>{item.total_seances}</Text>
                  <Text style={[styles.statLabel, muted]}>{t.workouts}</Text>
                </View>
              </View>
              <Text style={[styles.note, muted, { marginTop: 10 }]}>{t.totalVolume}: {numberValue(item.volume_total)} kg</Text>
              {open && (
                <View style={[styles.history, dark && styles.historyDark]}>
                  <Text style={[styles.label, text]}>{t.recent}</Text>
                  {item.historique.map((point, index) => (
                    <View key={point.date_debut + index} style={styles.historyRow}>
                      <Text style={[styles.historyDate, muted]}>{new Date(point.date_debut).toLocaleDateString()}</Text>
                      <Text style={[styles.historyValue, text]}>{numberValue(point.poids_max)} kg × {numberValue(point.repetitions_max)}</Text>
                      <Text style={[styles.historyVolume, muted]}>{numberValue(point.volume)} kg</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F7' },
  containerDark: { backgroundColor: '#0B0B0D' },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  title: { fontSize: 30, fontWeight: '800', marginTop: 8, color: '#111' },
  subtitle: { fontSize: 14, color: '#8A8A8E', marginTop: -7 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 2, gap: 14 },
  cardDark: { backgroundColor: '#1C1C1E' },
  text: { color: '#111' },
  textDark: { color: '#FFF' },
  muted: { color: '#8A8A8E' },
  mutedDark: { color: '#A1A1A6' },
  avatarSection: { alignItems: 'center', gap: 10, paddingBottom: 4 },
  avatar: { width: 108, height: 108, borderRadius: 54, overflow: 'hidden', backgroundColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center' },
  avatarDark: { backgroundColor: '#38383A' },
  avatarImage: { width: '100%', height: '100%' },
  avatarPlaceholder: { fontSize: 46 },
  photoButton: { fontSize: 14, fontWeight: '600' },
  userName: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  email: { fontSize: 13, textAlign: 'center', marginTop: -10 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#111' },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#D1D1D6', backgroundColor: '#FFF', borderRadius: 11, paddingHorizontal: 12, fontSize: 16 },
  inputDark: { borderColor: '#3A3A3C', backgroundColor: '#2C2C2E' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  bigValue: { fontSize: 30, fontWeight: '800', color: '#111' },
  note: { fontSize: 13, lineHeight: 19, color: '#8A8A8E' },
  progressHeader: { gap: 4 },
  track: { height: 12, borderRadius: 8, overflow: 'hidden', backgroundColor: '#E5E5EA' },
  trackDark: { backgroundColor: '#3A3A3C' },
  fill: { height: '100%', borderRadius: 8 },
  saved: { fontSize: 12, textAlign: 'center' },
  sectionHeading: { gap: 8, marginTop: 8, marginBottom: 2 },
  loading: { padding: 28, alignItems: 'center' },
  retry: { backgroundColor: '#111', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, alignSelf: 'flex-start' },
  retryText: { color: '#FFF', fontWeight: '700' },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center' },
  exerciseInfo: { flex: 1, gap: 3 },
  exerciseName: { fontSize: 17, fontWeight: '700', color: '#111' },
  chevron: { fontSize: 20, marginLeft: 10 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1 },
  statValue: { fontSize: 15, fontWeight: '800', color: '#111' },
  statLabel: { fontSize: 11, marginTop: 3, color: '#8A8A8E' },
  history: { marginTop: 2, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E5EA', gap: 8 },
  historyDark: { borderTopColor: '#3A3A3C' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  historyDate: { width: 82, fontSize: 11, color: '#8A8A8E' },
  historyValue: { flex: 1, fontSize: 12, fontWeight: '700', color: '#111' },
  historyVolume: { width: 60, textAlign: 'right', fontSize: 11, color: '#8A8A8E' },
  rtl: { textAlign: 'right' },
});
