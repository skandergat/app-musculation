import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Appearance, Pressable, SafeAreaView, StyleSheet, Switch, Text, View, useColorScheme,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Language, useI18n } from '@/context/I18nContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'fr', label: 'Français', native: 'Français' },
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ar', label: 'العربية', native: 'العربية' },
  { code: 'de', label: 'Deutsch', native: 'Deutsch' },
];

export default function ParametresScreen() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const [darkMode, setDarkMode] = useState(false);
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);
  const [languesOuvertes, setLanguesOuvertes] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@app_musculation_dark_mode').then((value) => {
      const enabled = value === 'true';
      setDarkMode(enabled);
      Appearance.setColorScheme(enabled ? 'dark' : 'light');
    });
  }, []);

  const basculerModeSombre = async (enabled: boolean) => {
    setDarkMode(enabled);
    await AsyncStorage.setItem('@app_musculation_dark_mode', String(enabled));
    Appearance.setColorScheme(enabled ? 'dark' : 'light');
  };

  const demanderDeconnexion = () => {
    Alert.alert(t('logout'), t('logoutQuestion'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('logout'),
        style: 'destructive',
        onPress: async () => {
          try {
            setDeconnexionEnCours(true);
            await logout();
          } finally {
            setDeconnexionEnCours(false);
          }
        },
      },
    ]);
  };

  const langueActuelle =
    LANGUAGES.find((item) => item.code === language)?.native ?? 'Français';

  return (
    <SafeAreaView style={[styles.container, dark && styles.containerDark]}>
      <View style={styles.contenu}>
        <Text style={[styles.titre, dark && styles.textDark]}>{t('settings')}</Text>

        <Text style={[styles.section, dark && styles.mutedDark]}>{t('profile')}</Text>
        <View style={[styles.carte, dark && styles.cardDark]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTexte}>
              {user?.nom?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={styles.profilTexte}>
            <Text style={[styles.nom, dark && styles.textDark]}>{user?.nom ?? t('user')}</Text>
            <Text style={[styles.email, dark && styles.mutedDark]}>{user?.email ?? ''}</Text>
          </View>
        </View>

        <Text style={[styles.section, dark && styles.mutedDark]}>{t('language')}</Text>
        <View style={[styles.carteLangue, dark && styles.cardDark]}>
          <Pressable
            style={styles.ligne}
            onPress={() => setLanguesOuvertes((value) => !value)}
          >
            <View>
              <Text style={[styles.ligneTitre, dark && styles.textDark]}>{t('language')}</Text>
              <Text style={[styles.ligneSousTitre, dark && styles.mutedDark]}>{langueActuelle}</Text>
            </View>
            <Text style={styles.chevron}>{languesOuvertes ? '⌃' : '›'}</Text>
          </Pressable>

          {languesOuvertes && (
            <View style={[styles.choix, dark && styles.borderDark]}>
              {LANGUAGES.map((item) => (
                <Pressable
                  key={item.code}
                  style={styles.langueOption}
                  onPress={async () => {
                    await setLanguage(item.code);
                    setLanguesOuvertes(false);
                  }}
                >
                  <Text style={[styles.langueNom, dark && styles.textDark]}>{item.label}</Text>
                  <Text style={styles.check}>
                    {language === item.code ? '✓' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>


        <Text style={[styles.section, dark && styles.mutedDark]}>{t('darkMode')}</Text>
        <View style={[styles.carteLangue, dark && styles.cardDark]}>
          <View style={styles.ligne}>
            <View style={styles.darkModeText}>
              <Text style={[styles.ligneTitre, dark && styles.textDark]}>{t('darkMode')}</Text>
              <Text style={[styles.ligneSousTitre, dark && styles.mutedDark]}>{t('darkModeDescription')}</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={basculerModeSombre}
              accessibilityLabel={t('darkMode')}
            />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.boutonDeconnexion,
            pressed && styles.presse,
          ]}
          onPress={demanderDeconnexion}
          disabled={deconnexionEnCours}
        >
          {deconnexionEnCours ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <Text style={styles.texteDeconnexion}>{t('logout')}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#F5F5F7'},
  containerDark:{backgroundColor:'#0B0B0D'},
  contenu:{flex:1,padding:20},
  titre:{fontSize:32,fontWeight:'700',color:'#111',marginTop:8,marginBottom:24},
  section:{fontSize:13,fontWeight:'700',color:'#8A8A8E',textTransform:'uppercase',marginBottom:8,marginTop:6},
  carte:{backgroundColor:'#FFF',borderRadius:16,padding:18,flexDirection:'row',alignItems:'center',marginBottom:22},
  avatar:{width:58,height:58,borderRadius:29,backgroundColor:'#0A84FF',justifyContent:'center',alignItems:'center',marginRight:14},
  avatarTexte:{color:'#FFF',fontSize:24,fontWeight:'700'},
  profilTexte:{flex:1},
  nom:{fontSize:19,fontWeight:'700',color:'#111'},
  email:{fontSize:14,color:'#8A8A8E',marginTop:4},
  carteLangue:{backgroundColor:'#FFF',borderRadius:16,marginBottom:24,overflow:'hidden'},
  ligne:{minHeight:64,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  ligneTitre:{fontSize:16,fontWeight:'600',color:'#111'},
  ligneSousTitre:{fontSize:13,color:'#8A8A8E',marginTop:3},
  chevron:{fontSize:26,color:'#8A8A8E'},
  choix:{borderTopWidth:1,borderTopColor:'#E5E5EA'},
  langueOption:{height:52,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  langueNom:{fontSize:15,color:'#111'},
  check:{fontSize:18,color:'#0A84FF',fontWeight:'700'},
  boutonDeconnexion:{backgroundColor:'#FFF',borderRadius:12,paddingVertical:16,alignItems:'center',borderWidth:1,borderColor:'#FF3B30'},
  texteDeconnexion:{color:'#FF3B30',fontSize:16,fontWeight:'600'},
  presse:{opacity:0.6},
  cardDark:{backgroundColor:'#1C1C1E'},
  textDark:{color:'#FFFFFF'},
  mutedDark:{color:'#A1A1A6'},
  borderDark:{borderTopColor:'#38383A'},
  darkModeText:{flex:1},
});
