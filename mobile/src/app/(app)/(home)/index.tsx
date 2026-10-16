import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useI18n } from '@/context/I18nContext';
import { useAppColorScheme } from '@/context/ColorSchemeContext';

export default function HomeScreen() {
  const { t } = useI18n();
  const dark = useAppColorScheme() === 'dark';

  const ouvrirCategorie = (categorie: 'gym' | 'calisthenics') => {
    router.push({
      pathname: '/(app)/(home)/exercices',
      params: { categorie },
    });
  };

  return (
    <SafeAreaView style={[styles.container, dark && styles.containerDark]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={styles.contenu}>
        <Text style={[styles.titreHome, dark && styles.textDark]}>LIFTELY</Text>
        <Text style={[styles.sousTitreHome, dark && styles.mutedDark]}>{t('chooseWorkout')}</Text>

        <Pressable style={({ pressed }) => [styles.carte, pressed && styles.presse]} onPress={() => ouvrirCategorie('gym')}>
          <View style={styles.icone}>
            <View style={styles.halteres}>
              <View style={styles.plateGauche} />
              <View style={styles.barreHalteres} />
              <View style={styles.plateDroite} />
            </View>
          </View>
          <View style={styles.texteCarte}>
            <Text style={styles.titreCarte}>{t('gym')}</Text>
            <Text style={styles.descriptionCarte}>{t('gymDescription')}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [styles.carte, styles.carteCalisthenics, pressed && styles.presse]} onPress={() => ouvrirCategorie('calisthenics')}>
          <View style={styles.icone}>
            <View style={styles.barreCalisthenics} />
            <View style={styles.corpsCalisthenics} />
            <View style={styles.brasCalisthenics} />
          </View>
          <View style={styles.texteCarte}>
            <Text style={styles.titreCarte}>{t('calisthenics')}</Text>
            <Text style={styles.descriptionCarte}>{t('calisthenicsDescription')}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  containerDark: { backgroundColor: '#0B0B0D' },
  textDark: { color: '#FFFFFF' },
  mutedDark: { color: '#A1A1A6' },
  contenu: { flex: 1, padding: 20 },
  titreHome: { fontSize: 32, fontWeight: '700', color: '#111', marginTop: 8 },
  sousTitreHome: { fontSize: 16, color: '#8A8A8E', marginTop: 4, marginBottom: 24 },
  carte: { minHeight: 170, backgroundColor: '#111', borderRadius: 22, padding: 22, flexDirection: 'row', alignItems: 'flex-end', marginBottom: 14 },
  carteCalisthenics: { backgroundColor: '#1A1A1C' },
  icone: { width: 76, height: 76, borderRadius: 18, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' },
  halteres: { width: 52, height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  plateGauche: { width: 10, height: 28, borderRadius: 3, backgroundColor: '#FFF' },
  barreHalteres: { width: 26, height: 7, borderRadius: 3, backgroundColor: '#FFF' },
  plateDroite: { width: 10, height: 28, borderRadius: 3, backgroundColor: '#FFF' },
  barreCalisthenics: { position: 'absolute', top: 18, width: 42, height: 5, borderRadius: 3, backgroundColor: '#FFF' },
  corpsCalisthenics: { width: 9, height: 30, borderRadius: 5, backgroundColor: '#FFF', transform: [{ rotate: '18deg' }] },
  brasCalisthenics: { position: 'absolute', width: 44, height: 7, borderRadius: 4, backgroundColor: '#FFF', transform: [{ rotate: '-28deg' }], marginTop: 5 },
  texteCarte: { flex: 1, marginLeft: 16 },
  titreCarte: { color: '#FFF', fontSize: 26, fontWeight: '800' },
  descriptionCarte: { color: '#D1D1D6', fontSize: 14, marginTop: 4 },
  chevron: { color: '#FFF', fontSize: 36, fontWeight: '300', marginLeft: 12 },
  presse: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});
