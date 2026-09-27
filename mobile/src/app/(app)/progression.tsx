import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { API_URL, apiFetch } from '@/config/api';

type HistoriquePoint = {
  date_debut: string;
  poids_max: number | null;
  repetitions_max: number | null;
  volume: number;
};

type Progression = {
  exercice_id: number;
  exercice_nom: string;
  groupe_musculaire: string | null;
  total_series: number;
  total_seances: number;
  meilleur_poids: number | null;
  meilleures_repetitions: number | null;
  meilleure_serie: number | null;
  volume_total: number;
  historique: HistoriquePoint[];
};

const formatNumber = (value: number | null | undefined) => {
  if (value == null) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

export default function ProgressionScreen() {
  const { token } = useAuth();
  const { t, exerciseName, muscleGroupName } = useI18n();
  const dark = useColorScheme() === 'dark';
  const [items, setItems] = useState<Progression[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const response = await apiFetch(API_URL + '/progression', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(t('connectionImpossible'));
      setItems(await response.json());
    } catch (err: any) {
      setError(err?.message ?? t('connectionImpossible'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, dark && styles.containerDark]}>
        <ActivityIndicator size="large" color="#0A84FF" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.center, dark && styles.containerDark]}>
        <Text style={[styles.errorTitle, dark && styles.textDark]}>{t('connectionImpossible')}</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryText}>{t('retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, dark && styles.containerDark]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.exercice_id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={[styles.title, dark && styles.textDark]}>{t('progression')}</Text>
            <Text style={[styles.subtitle, dark && styles.mutedDark]}>{t('progressionSubtitle')}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, dark && styles.textDark]}>{t('noProgression')}</Text>
            <Text style={[styles.emptyText, dark && styles.mutedDark]}>{t('noProgressionHelp')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const open = selected === item.exercice_id;
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSelected(open ? null : item.exercice_id)}
              style={[styles.card, dark && styles.cardDark]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.flex}>
                  <Text style={[styles.exercise, dark && styles.textDark]}>{exerciseName(item.exercice_nom)}</Text>
                  {!!item.groupe_musculaire && (
                    <Text style={[styles.group, dark && styles.mutedDark]}>{muscleGroupName(item.groupe_musculaire)}</Text>
                  )}
                </View>
                <Text style={[styles.chevron, dark && styles.mutedDark]}>{open ? '⌃' : '⌄'}</Text>
              </View>

              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={[styles.value, dark && styles.textDark]}>{formatNumber(item.meilleur_poids)} kg</Text>
                  <Text style={[styles.label, dark && styles.mutedDark]}>{t('bestWeight')}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.value, dark && styles.textDark]}>{formatNumber(item.meilleures_repetitions)}</Text>
                  <Text style={[styles.label, dark && styles.mutedDark]}>{t('bestReps')}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.value, dark && styles.textDark]}>{item.total_seances}</Text>
                  <Text style={[styles.label, dark && styles.mutedDark]}>{t('workoutsLabel')}</Text>
                </View>
              </View>

              <Text style={[styles.volume, dark && styles.mutedDark]}>
                {t('totalVolume')}: {formatNumber(item.volume_total)} kg
              </Text>

              {open && (
                <View style={styles.history}>
                  <Text style={[styles.historyTitle, dark && styles.textDark]}>{t('recentProgress')}</Text>
                  {item.historique.map((point, index) => (
                    <View key={point.date_debut + index} style={styles.historyRow}>
                      <Text style={[styles.historyDate, dark && styles.mutedDark]}>
                        {new Date(point.date_debut).toLocaleDateString()}
                      </Text>
                      <Text style={[styles.historyValue, dark && styles.textDark]}>
                        {formatNumber(point.poids_max)} kg × {formatNumber(point.repetitions_max)}
                      </Text>
                      <Text style={[styles.historyVolume, dark && styles.mutedDark]}>
                        {formatNumber(point.volume)} kg
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  containerDark: { backgroundColor: '#0B0B0D' },
  cardDark: { backgroundColor: '#1C1C1E' },
  textDark: { color: '#FFFFFF' },
  mutedDark: { color: '#A1A1A6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F5F5F7' },
  list: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: '800', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#8A8A8E', marginBottom: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  exercise: { fontSize: 18, fontWeight: '700', color: '#111' },
  group: { fontSize: 13, color: '#8A8A8E', marginTop: 3 },
  chevron: { fontSize: 20, color: '#8A8A8E', marginLeft: 10 },
  stats: { flexDirection: 'row', marginTop: 16 },
  stat: { flex: 1 },
  value: { fontSize: 16, fontWeight: '800', color: '#111' },
  label: { fontSize: 11, color: '#8A8A8E', marginTop: 3 },
  volume: { fontSize: 12, color: '#8A8A8E', marginTop: 12 },
  history: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  historyTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  historyDate: { width: 82, fontSize: 11, color: '#8A8A8E' },
  historyValue: { flex: 1, fontSize: 12, fontWeight: '700', color: '#111' },
  historyVolume: { width: 65, textAlign: 'right', fontSize: 11, color: '#8A8A8E' },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111', textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#8A8A8E', textAlign: 'center', marginTop: 8 },
  errorTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorText: { color: '#FF3B30', textAlign: 'center', marginBottom: 18 },
  retry: { backgroundColor: '#111', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#FFF', fontWeight: '700' },
});
