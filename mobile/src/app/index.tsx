import { StyleSheet, Text, View, SafeAreaView, StatusBar, Pressable } from 'react-native';
import { router } from 'expo-router';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.contenu}>
        <Text style={styles.titre}>Home</Text>
        <Text style={styles.sousTitre}>Choisis ton entraînement</Text>

        <Pressable
          style={({ pressed }) => [
            styles.carteGym,
            pressed && styles.presse,
          ]}
          onPress={() => router.push('/gym')}
        >
          <View style={styles.icone}>
            <Text style={styles.iconeTexte}>GYM</Text>
          </View>

          <View style={styles.texteCarte}>
            <Text style={styles.titreCarte}>GYM</Text>
            <Text style={styles.descriptionCarte}>
              Tous les exercices de musculation
            </Text>
          </View>

          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  contenu: {
    flex: 1,
    padding: 20,
  },
  titre: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
    marginTop: 8,
  },
  sousTitre: {
    fontSize: 16,
    color: '#8A8A8E',
    marginTop: 4,
    marginBottom: 24,
  },
  carteGym: {
    minHeight: 190,
    backgroundColor: '#111',
    borderRadius: 22,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  icone: {
    width: 76,
    height: 76,
    borderRadius: 18,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconeTexte: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  texteCarte: {
    flex: 1,
    marginLeft: 16,
  },
  titreCarte: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  descriptionCarte: {
    color: '#D1D1D6',
    fontSize: 14,
    marginTop: 4,
  },
  chevron: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '300',
    marginLeft: 12,
  },
  presse: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
});
