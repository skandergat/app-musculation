import { useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView,
  StatusBar, StyleSheet, Text, View, useColorScheme, TextInput,
} from 'react-native';
import { useI18n } from '@/context/I18nContext';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import { API_URL, apiFetch } from '@/config/api';

type Category = 'gym' | 'calisthenics';
type Exercice = { id:number; nom?:string; name?:string; groupe_musculaire?:string; categorie?:Category };

export default function HomeScreen() {
  const { t, exerciseName, muscleGroupName } = useI18n();
  const { token } = useAuth();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const [categorieOuverte, setCategorieOuverte] = useState<Category|null>(null);
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [erreur, setErreur] = useState<string|null>(null);
  const [recherche, setRecherche] = useState('');
  const [demarrageId, setDemarrageId] = useState<number | null>(null);
  const [exerciceInfo, setExerciceInfo] = useState<Exercice | null>(null);

  const chargerExercices = async (categorie: Category) => {
    try {
      setErreur(null);
      const response = await apiFetch(API_URL + '/exercices?categorie=' + categorie);
      if (!response.ok) throw new Error(t('connectionImpossible'));
      setExercices(await response.json());
    } catch (err:any) {
      setErreur(err?.message ?? t('connectionImpossible'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const ouvrirCategorie = (categorie: Category) => {
    setCategorieOuverte(categorie);
    setLoading(true);
    chargerExercices(categorie);
  };

  const fermerCategorie = () => {
    setCategorieOuverte(null);
    setExercices([]);
    setRecherche('');
    setErreur(null);
  };

  const demarrerAvecExercice = async (exercice: Exercice) => {
    if (!token || demarrageId !== null) return;

    try {
      setDemarrageId(exercice.id);

      const response = await apiFetch(API_URL + '/seances', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.seance_id) {
        throw new Error(data.error || t('cannotStartExercise'));
      }

      const ajoutResponse = await apiFetch(
        API_URL + '/seances/' + data.seance_id + '/exercices',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ exercice_id: exercice.id }),
        }
      );

      const ajoutData = await ajoutResponse.json().catch(() => ({}));

      if (!ajoutResponse.ok && ajoutResponse.status !== 409) {
        throw new Error(ajoutData.error || t('cannotAddExercise'));
      }

      // Même lorsqu'une séance existante est réutilisée, l'exercice
      // choisi doit être ajouté à cette séance avant d'ouvrir l'écran.
      router.push('/seance');
    } catch (error: any) {
      setDemarrageId(null);
      setErreur(error?.message || t('cannotStartExercise'));
    }
  };

  const exercicesFiltres = useMemo(() => {
    const terme = recherche.trim().toLocaleLowerCase();
    if (!terme) return exercices;

    return exercices.filter((item) => {
      const nom = exerciseName(item.nom ?? item.name ?? '').toLocaleLowerCase();
      const muscle = muscleGroupName(item.groupe_musculaire ?? '').toLocaleLowerCase();
      return nom.includes(terme) || muscle.includes(terme);
    });
  }, [exercices, recherche, exerciseName, muscleGroupName]);

  const actualiser = () => {
    if (!categorieOuverte) return;
    setRefreshing(true);
    chargerExercices(categorieOuverte);
  };

  if (categorieOuverte) {
    const nomCategorie = categorieOuverte === 'gym' ? t('gym') : t('calisthenics');

    if (loading) return (
      <SafeAreaView style={[styles.centered, dark && styles.containerDark]}>
        <ActivityIndicator size="large" color="#0A84FF" />
      </SafeAreaView>
    );

    if (erreur) return (
      <SafeAreaView style={[styles.centered, dark && styles.containerDark]}>
        <Pressable style={[styles.boutonRetourErreur, dark && styles.cardDark]} onPress={fermerCategorie}>
          <Text style={styles.retour}>‹</Text>
        </Pressable>
        <Text style={[styles.erreurTitre, dark && styles.textDark]}>{t('connectionImpossible')}</Text>
        <Text style={styles.erreurTexte}>{erreur}</Text>
        <Pressable style={styles.boutonReessayer} onPress={() => { setLoading(true); chargerExercices(categorieOuverte); }}>
          <Text style={styles.texteReessayer}>{t('retry')}</Text>
        </Pressable>
      </SafeAreaView>
    );

    return (
      <SafeAreaView style={[styles.container, dark && styles.containerDark]}>
        <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
        <View style={styles.entete}>
          <Pressable style={[styles.boutonRetour, dark && styles.cardDark]} onPress={fermerCategorie}><Text style={styles.retour}>‹</Text></Pressable>
          <View>
            <Text style={[styles.titre, dark && styles.textDark]}>{nomCategorie}</Text>
            <Text style={[styles.sousTitre, dark && styles.mutedDark]}>{exercices.length} {t('exercises')}</Text>
          </View>
        </View>
        <TextInput
          value={recherche}
          onChangeText={setRecherche}
          placeholder={t('searchExercises')}
          placeholderTextColor={dark ? '#8E8E93' : '#8A8A8E'}
          style={[styles.recherche, dark && styles.rechercheDark]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {exerciceInfo && (
          <View style={styles.infoOverlay}>
            <Pressable style={styles.infoBackdrop} onPress={() => setExerciceInfo(null)} />
            <View style={[styles.infoCarte, dark && styles.infoCarteDark]}>
              <View style={styles.infoEntete}>
                <View style={styles.infoTitreBloc}>
                  <Text style={[styles.infoTitre, dark && styles.textDark]}>
                    {exerciseName(exerciceInfo.nom ?? exerciceInfo.name ?? t('exercise'))}
                  </Text>
                  {!!exerciceInfo.groupe_musculaire && (
                    <Text style={[styles.infoSousTitre, dark && styles.mutedDark]}>
                      {muscleGroupName(exerciceInfo.groupe_musculaire)}
                    </Text>
                  )}
                </View>
                <Pressable
                  hitSlop={10}
                  onPress={() => setExerciceInfo(null)}
                  accessibilityLabel={t('close')}
                >
                  <Text style={[styles.infoFermer, dark && styles.textDark]}>×</Text>
                </Pressable>
              </View>
              <Text style={[styles.infoTexte, dark && styles.mutedDark]}>
                {t('exerciseInfoComingSoon')}
              </Text>
            </View>
          </View>
        )}
        <FlatList
          data={exercicesFiltres}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={actualiser} />}
          contentContainerStyle={styles.liste}
          renderItem={({item, index}) => (
            <View style={[styles.carteExercice, dark && styles.cardDark]}>
              <View style={styles.numero}><Text style={styles.numeroTexte}>{index + 1}</Text></View>
              <View style={styles.exerciceInfo}>
                <Text style={[styles.nomExercice, dark && styles.textDark]}>{exerciseName(item.nom ?? item.name ?? t('exercise'))}</Text>
                {!!item.groupe_musculaire && <Text style={[styles.muscle, dark && styles.mutedDark]}>{muscleGroupName(item.groupe_musculaire)}</Text>}
              </View>
              <View style={styles.actionsExercice}>
                <Pressable
                  hitSlop={10}
                  style={[styles.actionBouton, dark && styles.actionBoutonDark]}
                  onPress={() => setExerciceInfo(item)}
                  accessibilityLabel={t('exerciseInfo')}
                >
                  <Text style={[styles.infoIcon, dark && styles.textDark]}>ⓘ</Text>
                </Pressable>
                <Pressable
                  hitSlop={10}
                  style={[styles.actionBouton, dark && styles.actionBoutonDark]}
                  onPress={() => demarrerAvecExercice(item)}
                  disabled={demarrageId !== null}
                  accessibilityLabel={t('startExercise')}
                >
                  <Text style={[styles.plusIcon, dark && styles.textDark]}>
                    {demarrageId === item.id ? '…' : '+'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.vide, dark && styles.mutedDark]}>{recherche.trim() ? t('noSearchResults') : t('noExercises')}</Text>}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, dark && styles.containerDark]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={styles.contenu}>
        <Text style={[styles.titreHome, dark && styles.textDark]}>LIFTELY</Text>
        <Text style={[styles.sousTitreHome, dark && styles.mutedDark]}>{t('chooseWorkout')}</Text>

        <Pressable style={({pressed}) => [styles.carte, pressed && styles.presse]} onPress={() => ouvrirCategorie('gym')}>
          <View style={styles.icone}>
            <View style={styles.halteres}>
              <View style={styles.plateGauche}/><View style={styles.barreHalteres}/><View style={styles.plateDroite}/>
            </View>
          </View>
          <View style={styles.texteCarte}>
            <Text style={styles.titreCarte}>{t('gym')}</Text>
            <Text style={styles.descriptionCarte}>{t('gymDescription')}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable style={({pressed}) => [styles.carte, styles.carteCalisthenics, pressed && styles.presse]} onPress={() => ouvrirCategorie('calisthenics')}>
          <View style={styles.icone}>
            <View style={styles.barreCalisthenics}/>
            <View style={styles.corpsCalisthenics}/>
            <View style={styles.brasCalisthenics}/>
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
  container:{flex:1,backgroundColor:'#F5F5F7'},
  containerDark:{backgroundColor:'#0B0B0D'},
  cardDark:{backgroundColor:'#1C1C1E'},
  textDark:{color:'#FFFFFF'},
  mutedDark:{color:'#A1A1A6'},
  centered:{flex:1,backgroundColor:'#F5F5F7',justifyContent:'center',alignItems:'center',padding:24},
  contenu:{flex:1,padding:20},
  titreHome:{fontSize:32,fontWeight:'700',color:'#111',marginTop:8},
  sousTitreHome:{fontSize:16,color:'#8A8A8E',marginTop:4,marginBottom:24},
  carte:{minHeight:170,backgroundColor:'#111',borderRadius:22,padding:22,flexDirection:'row',alignItems:'flex-end',marginBottom:14},
  carteCalisthenics:{backgroundColor:'#1A1A1C'},
  icone:{width:76,height:76,borderRadius:18,backgroundColor:'#2C2C2E',justifyContent:'center',alignItems:'center'},
  halteres:{width:52,height:34,flexDirection:'row',alignItems:'center',justifyContent:'center'},
  plateGauche:{width:10,height:28,borderRadius:3,backgroundColor:'#FFF'},
  barreHalteres:{width:26,height:7,borderRadius:3,backgroundColor:'#FFF'},
  plateDroite:{width:10,height:28,borderRadius:3,backgroundColor:'#FFF'},
  barreCalisthenics:{position:'absolute',top:18,width:42,height:5,borderRadius:3,backgroundColor:'#FFF'},
  corpsCalisthenics:{width:9,height:30,borderRadius:5,backgroundColor:'#FFF',transform:[{rotate:'18deg'}]},
  brasCalisthenics:{position:'absolute',width:44,height:7,borderRadius:4,backgroundColor:'#FFF',transform:[{rotate:'-28deg'}],marginTop:5},
  texteCarte:{flex:1,marginLeft:16},
  titreCarte:{color:'#FFF',fontSize:26,fontWeight:'800'},
  descriptionCarte:{color:'#D1D1D6',fontSize:14,marginTop:4},
  chevron:{color:'#FFF',fontSize:36,fontWeight:'300',marginLeft:12},
  presse:{opacity:0.75,transform:[{scale:0.99}]},
  entete:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingTop:10,paddingBottom:14},
  boutonRetour:{width:42,height:42,borderRadius:21,backgroundColor:'#FFF',justifyContent:'center',alignItems:'center',marginRight:12},
  boutonRetourErreur:{position:'absolute',top:20,left:16,width:42,height:42,borderRadius:21,backgroundColor:'#FFF',justifyContent:'center',alignItems:'center'},
  retour:{fontSize:34,lineHeight:36,color:'#111',marginTop:-3},
  titre:{fontSize:28,fontWeight:'800',color:'#111'},
  sousTitre:{fontSize:13,color:'#8A8A8E',marginTop:1},
  liste:{paddingHorizontal:16,paddingBottom:24},
  recherche:{marginHorizontal:16,marginBottom:10,backgroundColor:'#FFF',borderRadius:12,paddingHorizontal:14,height:46,fontSize:15,color:'#111'},
  rechercheDark:{backgroundColor:'#1C1C1E',color:'#FFF'},
  carteExercice:{backgroundColor:'#FFF',borderRadius:12,paddingVertical:14,paddingHorizontal:14,marginBottom:8,flexDirection:'row',alignItems:'center'},
  numero:{width:34,height:34,borderRadius:10,backgroundColor:'#F2F2F7',justifyContent:'center',alignItems:'center',marginRight:12},
  numeroTexte:{fontSize:11,fontWeight:'600',color:'#8A8A8E'},
  exerciceInfo:{flex:1},
  nomExercice:{fontSize:16,fontWeight:'600',color:'#111'},
  muscle:{fontSize:12,color:'#8A8A8E',marginTop:3},
  actionsExercice:{flexDirection:'row',alignItems:'center',marginLeft:10,gap:8},
  actionBouton:{width:38,height:38,borderRadius:19,backgroundColor:'#F2F2F7',justifyContent:'center',alignItems:'center'},
  actionBoutonDark:{backgroundColor:'#2C2C2E'},
  infoIcon:{fontSize:23,color:'#111',lineHeight:25},
  plusIcon:{fontSize:28,fontWeight:'500',color:'#111',lineHeight:30},
  infoOverlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:20,justifyContent:'flex-end'},
  infoBackdrop:{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.45)'},
  infoCarte:{backgroundColor:'#FFF',borderTopLeftRadius:24,borderTopRightRadius:24,padding:22,paddingBottom:32,minHeight:190},
  infoCarteDark:{backgroundColor:'#1C1C1E'},
  infoEntete:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},
  infoTitreBloc:{flex:1,paddingRight:12},
  infoTitre:{fontSize:22,fontWeight:'800',color:'#111'},
  infoSousTitre:{fontSize:14,color:'#8A8A8E',marginTop:5},
  infoFermer:{fontSize:32,lineHeight:32,color:'#111'},
  infoTexte:{fontSize:15,color:'#6E6E73',lineHeight:22,marginTop:22},
  vide:{fontSize:14,color:'#8A8A8E',textAlign:'center',marginTop:30},
  erreurTitre:{fontSize:18,fontWeight:'700',marginBottom:8},
  erreurTexte:{fontSize:14,color:'#FF3B30',textAlign:'center',marginBottom:18},
  boutonReessayer:{backgroundColor:'#111',paddingHorizontal:22,paddingVertical:12,borderRadius:12},
  texteReessayer:{color:'#FFF',fontSize:15,fontWeight:'600'},
});
