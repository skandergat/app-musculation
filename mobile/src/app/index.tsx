import { useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView,
  StatusBar, StyleSheet, Text, View, useColorScheme,
} from 'react-native';
import { useI18n } from '@/context/I18nContext';

const API_URL = 'http://192.168.100.200:5001';
type Category = 'gym' | 'calisthenics';
type Exercice = { id:number; nom?:string; name?:string; groupe_musculaire?:string; categorie?:Category };

export default function HomeScreen() {
  const { t } = useI18n();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const [categorieOuverte, setCategorieOuverte] = useState<Category|null>(null);
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [erreur, setErreur] = useState<string|null>(null);

  const chargerExercices = async (categorie: Category) => {
    try {
      setErreur(null);
      const response = await fetch(API_URL + '/exercices?categorie=' + categorie);
      if (!response.ok) throw new Error('Erreur ' + response.status);
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
    setErreur(null);
  };

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
        <FlatList
          data={exercices}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={actualiser} />}
          contentContainerStyle={styles.liste}
          renderItem={({item, index}) => (
            <View style={[styles.carteExercice, dark && styles.cardDark]}>
              <View style={styles.numero}><Text style={styles.numeroTexte}>{index + 1}</Text></View>
              <View style={styles.exerciceInfo}>
                <Text style={[styles.nomExercice, dark && styles.textDark]}>{item.nom ?? item.name ?? t('exercise')}</Text>
                {!!item.groupe_musculaire && <Text style={[styles.muscle, dark && styles.mutedDark]}>{item.groupe_musculaire}</Text>}
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.vide, dark && styles.mutedDark]}>{t('noExercises')}</Text>}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, dark && styles.containerDark]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.contenu}>
        <Text style={[styles.titreHome, dark && styles.textDark]}>{t('home')}</Text>
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
  carteExercice:{backgroundColor:'#FFF',borderRadius:12,paddingVertical:14,paddingHorizontal:14,marginBottom:8,flexDirection:'row',alignItems:'center'},
  numero:{width:34,height:34,borderRadius:10,backgroundColor:'#F2F2F7',justifyContent:'center',alignItems:'center',marginRight:12},
  numeroTexte:{fontSize:11,fontWeight:'600',color:'#8A8A8E'},
  exerciceInfo:{flex:1},
  nomExercice:{fontSize:16,fontWeight:'600',color:'#111'},
  muscle:{fontSize:12,color:'#8A8A8E',marginTop:3},
  vide:{fontSize:14,color:'#8A8A8E',textAlign:'center',marginTop:30},
  erreurTitre:{fontSize:18,fontWeight:'700',marginBottom:8},
  erreurTexte:{fontSize:14,color:'#FF3B30',textAlign:'center',marginBottom:18},
  boutonReessayer:{backgroundColor:'#111',paddingHorizontal:22,paddingVertical:12,borderRadius:12},
  texteReessayer:{color:'#FFF',fontSize:15,fontWeight:'600'},
});
