import { useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Language, useI18n } from '@/context/I18nContext';

const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'fr', label: 'Français', native: 'Français' },
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ar', label: 'العربية', native: 'العربية' },
];

export default function ParametresScreen() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);
  const [languesOuvertes, setLanguesOuvertes] = useState(false);

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
    <SafeAreaView style={styles.container}>
      <View style={styles.contenu}>
        <Text style={styles.titre}>{t('settings')}</Text>

        <Text style={styles.section}>{t('profile')}</Text>
        <View style={styles.carte}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTexte}>
              {user?.nom?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={styles.profilTexte}>
            <Text style={styles.nom}>{user?.nom ?? t('user')}</Text>
            <Text style={styles.email}>{user?.email ?? ''}</Text>
          </View>
        </View>

        <Text style={styles.section}>{t('language')}</Text>
        <View style={styles.carteLangue}>
          <Pressable
            style={styles.ligne}
            onPress={() => setLanguesOuvertes((value) => !value)}
          >
            <View>
              <Text style={styles.ligneTitre}>{t('language')}</Text>
              <Text style={styles.ligneSousTitre}>{langueActuelle}</Text>
            </View>
            <Text style={styles.chevron}>{languesOuvertes ? '⌃' : '›'}</Text>
          </Pressable>

          {languesOuvertes && (
            <View style={styles.choix}>
              {LANGUAGES.map((item) => (
                <Pressable
                  key={item.code}
                  style={styles.langueOption}
                  onPress={async () => {
                    await setLanguage(item.code);
                    setLanguesOuvertes(false);
                  }}
                >
                  <Text style={styles.langueNom}>{item.label}</Text>
                  <Text style={styles.check}>
                    {language === item.code ? '✓' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
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
});
