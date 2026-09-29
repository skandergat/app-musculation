import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Appearance, Linking, Modal, Pressable, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View, useColorScheme,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Language, useI18n } from '@/context/I18nContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/config/api';

const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'fr', label: 'Français', native: 'Français' },
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ar', label: 'العربية', native: 'العربية' },
  { code: 'de', label: 'Deutsch', native: 'Deutsch' },
];

export default function ParametresScreen() {
  const { user, logout, deleteAccount } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const [darkMode, setDarkMode] = useState(false);
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);
  const [deconnexionOuverte, setDeconnexionOuverte] = useState(false);
  const [languesOuvertes, setLanguesOuvertes] = useState(false);
  const [suppressionOuverte, setSuppressionOuverte] = useState(false);
  const [motDePasseSuppression, setMotDePasseSuppression] = useState('');
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState('');
  const [erreurLien, setErreurLien] = useState('');

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
    setDeconnexionOuverte(true);
  };

  const confirmerDeconnexion = async () => {
    try {
      setDeconnexionEnCours(true);
      await logout();
      setDeconnexionOuverte(false);
    } finally {
      setDeconnexionEnCours(false);
    }
  };

  const supprimerMonCompte = async () => {
    if (!motDePasseSuppression) {
      setErreurSuppression(t('deleteAccountConfirm'));
      return;
    }
    try {
      setSuppressionEnCours(true);
      await deleteAccount(motDePasseSuppression);
      setSuppressionOuverte(false);
      setMotDePasseSuppression('');
      setErreurSuppression('');
    } catch (error) {
      setErreurSuppression(
        error instanceof Error ? error.message : t('unexpectedError'),
      );
    } finally {
      setSuppressionEnCours(false);
    }
  };

  const ouvrirLien = (path: string) => {
    setErreurLien('');
    void Linking.openURL(API_URL + path).catch(() => {
      setErreurLien(t('connectionImpossible'));
    });
  };

  const langueActuelle =
    LANGUAGES.find((item) => item.code === language)?.native ?? 'Français';

  return (
    <SafeAreaView style={[styles.container, dark && styles.containerDark]}>
        <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.contenu}>
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

        <View style={[styles.liensConfidentialite, dark && styles.cardDark]}>
          <Pressable onPress={() => ouvrirLien('/privacy')} style={styles.lienLegal}>
            <Text style={styles.lienLegalTexte}>{t('privacyPolicy')}</Text>
          </Pressable>
          <Pressable onPress={() => ouvrirLien('/account-deletion')} style={styles.lienLegal}>
            <Text style={styles.lienLegalTexte}>{t('requestDeletion')}</Text>
          </Pressable>
        </View>
        {erreurLien ? (
          <Text style={[styles.erreur, dark && styles.erreurDark]} accessibilityLiveRegion="polite">
            {erreurLien}
          </Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.boutonSuppression,
            pressed && styles.presse,
          ]}
          onPress={() => {
            setErreurSuppression('');
            setSuppressionOuverte(true);
          }}
          disabled={suppressionEnCours}
        >
          <Text style={styles.texteSuppression}>{t('deleteAccount')}</Text>
        </Pressable>

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
      </ScrollView>

      <Modal
        visible={suppressionOuverte}
        transparent
        animationType="fade"
        onRequestClose={() => setSuppressionOuverte(false)}
      >
        <View style={styles.modalFond}>
          <View style={[styles.modalCarte, dark && styles.cardDark]}>
            <Text style={[styles.modalTitre, dark && styles.textDark]}>
              {t('deleteAccountTitle')}
            </Text>
            <Text style={[styles.modalDescription, dark && styles.mutedDark]}>
              {t('deleteAccountDescription')}
            </Text>
            <Text style={[styles.modalDescription, dark && styles.mutedDark]}>
              {t('deleteAccountConfirm')}
            </Text>
            <TextInput
              style={[styles.inputSuppression, dark && styles.inputDark]}
              placeholder={t('password')}
              placeholderTextColor={dark ? '#8E8E93' : '#8A8A8E'}
              value={motDePasseSuppression}
              onChangeText={(value) => {
                setMotDePasseSuppression(value);
                setErreurSuppression('');
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
            />
            {erreurSuppression ? (
              <Text style={[styles.erreur, dark && styles.erreurDark]} accessibilityLiveRegion="polite">
                {erreurSuppression}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setSuppressionOuverte(false);
                  setMotDePasseSuppression('');
                  setErreurSuppression('');
                }}
                disabled={suppressionEnCours}
              >
                <Text style={styles.modalCancel}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDelete, suppressionEnCours && styles.presse]}
                onPress={() => void supprimerMonCompte()}
                disabled={suppressionEnCours}
              >
                {suppressionEnCours ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalDeleteText}>{t('deleteAccountButton')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deconnexionOuverte}
        transparent
        animationType="fade"
        onRequestClose={() => setDeconnexionOuverte(false)}
      >
        <View style={styles.modalFond}>
          <View style={[styles.modalCarte, dark && styles.cardDark]}>
            <Text style={[styles.modalTitre, dark && styles.textDark]}>
              {t('logout')}
            </Text>
            <Text style={[styles.modalDescription, dark && styles.mutedDark]}>
              {t('logoutQuestion')}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setDeconnexionOuverte(false)}
                disabled={deconnexionEnCours}
              >
                <Text style={styles.modalCancel}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDelete, deconnexionEnCours && styles.presse]}
                onPress={() => void confirmerDeconnexion()}
                disabled={deconnexionEnCours}
              >
                {deconnexionEnCours ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalDeleteText}>{t('logout')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#F5F5F7'},
  containerDark:{backgroundColor:'#0B0B0D'},
  contenu:{flexGrow:1,padding:20,paddingBottom:36},
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
  liensConfidentialite:{backgroundColor:'#FFF',borderRadius:12,paddingHorizontal:16,marginTop:8,marginBottom:14},
  lienLegal:{paddingVertical:14,borderBottomWidth:1,borderBottomColor:'#E5E5EA'},
  lienLegalTexte:{color:'#0A84FF',fontSize:15,fontWeight:'600'},
  boutonSuppression:{borderRadius:12,paddingVertical:14,alignItems:'center',borderWidth:1,borderColor:'#FF3B30',marginBottom:12},
  texteSuppression:{color:'#FF3B30',fontSize:15,fontWeight:'600'},
  boutonDeconnexion:{backgroundColor:'#FFF',borderRadius:12,paddingVertical:16,alignItems:'center',borderWidth:1,borderColor:'#FF3B30'},
  texteDeconnexion:{color:'#FF3B30',fontSize:16,fontWeight:'600'},
  presse:{opacity:0.6},
  modalFond:{flex:1,backgroundColor:'rgba(0,0,0,0.55)',justifyContent:'center',padding:22},
  modalCarte:{backgroundColor:'#FFF',borderRadius:18,padding:22},
  modalTitre:{fontSize:21,fontWeight:'700',color:'#111',marginBottom:10},
  modalDescription:{fontSize:14,color:'#555',lineHeight:21,marginBottom:10},
  inputSuppression:{height:50,backgroundColor:'#F5F5F7',borderRadius:12,paddingHorizontal:14,fontSize:16,color:'#111',marginTop:6},
  inputDark:{backgroundColor:'#2C2C2E',color:'#FFF'},
  modalActions:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:18},
  modalCancel:{color:'#0A84FF',fontSize:16,fontWeight:'600',padding:10},
  modalDelete:{backgroundColor:'#FF3B30',borderRadius:10,paddingVertical:12,paddingHorizontal:14,minWidth:132,alignItems:'center'},
  modalDeleteText:{color:'#FFF',fontSize:14,fontWeight:'700'},
  erreur:{color:'#C62828',fontSize:14,lineHeight:20,marginTop:8},
  erreurDark:{color:'#FF8A80'},
  cardDark:{backgroundColor:'#1C1C1E'},
  textDark:{color:'#FFFFFF'},
  mutedDark:{color:'#A1A1A6'},
  borderDark:{borderTopColor:'#38383A'},
  darkModeText:{flex:1},
});
