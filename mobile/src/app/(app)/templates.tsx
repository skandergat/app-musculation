import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, View, useColorScheme,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/api';

type Template = { id:number; nom:string; nombre_exercices:number };
type Exercise = { id:number; nom:string; groupe_musculaire?:string|null; categorie?:string };
type TemplateExercise = Exercise & { exercice_id:number; position:number };

export default function TemplatesScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadTemplates = useCallback(async () => {
    try {
      setError(null);
      const r = await fetch(API_URL + '/templates', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('Impossible de charger les templates.');
      setTemplates(await r.json());
    } catch (e:any) {
      setError(e?.message ?? 'Erreur de connexion.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const openTemplate = async (template: Template) => {
    setSelected(template);
    setShowLibrary(false);
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/templates/${template.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('Impossible de charger le template.');
      const data = await r.json();
      setTemplateExercises(data.exercices ?? []);
    } catch (e:any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de charger le template.');
      setSelected(null);
    } finally {
      setBusy(false);
    }
  };

  const createTemplate = async () => {
    const nom = newName.trim();
    if (!nom || creating) return;
    setCreating(true);
    try {
      const r = await fetch(API_URL + '/templates', { method:'POST', headers, body:JSON.stringify({ nom }) });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? 'Impossible de créer le template.');
      }
      const data = await r.json();
      setNewName('');
      await loadTemplates();
      await openTemplate(data);
    } catch (e:any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de créer le template.');
    } finally {
      setCreating(false);
    }
  };

  const loadLibrary = async () => {
    setShowLibrary(true);
    try {
      const r = await fetch(API_URL + '/exercices?categorie=all');
      if (!r.ok) throw new Error('Impossible de charger les exercices.');
      setLibrary(await r.json());
    } catch (e:any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de charger les exercices.');
    }
  };

  const addExercise = async (exercise: Exercise) => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/templates/${selected.id}/exercices`, {
        method:'POST', headers, body:JSON.stringify({ exercice_id: exercise.id }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? 'Impossible d’ajouter cet exercice.');
      }
      await openTemplate(selected);
    } catch (e:any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible d’ajouter cet exercice.');
      setBusy(false);
    }
  };

  const removeExercise = async (exerciseId:number) => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/templates/${selected.id}/exercices/${exerciseId}`, { method:'DELETE', headers });
      if (!r.ok) throw new Error('Impossible de retirer cet exercice.');
      await openTemplate(selected);
    } catch (e:any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de retirer cet exercice.');
      setBusy(false);
    }
  };

  const moveExercise = async (index:number, direction:number) => {
    if (!selected || busy) return;
    const target = index + direction;
    if (target < 0 || target >= templateExercises.length) return;
    const next = [...templateExercises];
    [next[index], next[target]] = [next[target], next[index]];
    setTemplateExercises(next.map((x,i) => ({ ...x, position:i })));
    try {
      const r = await fetch(`${API_URL}/templates/${selected.id}/exercices/reorder`, {
        method:'PUT', headers,
        body:JSON.stringify({ exercices: next.map(x => ({ exercice_id:x.exercice_id })) }),
      });
      if (!r.ok) throw new Error('Impossible de réorganiser les exercices.');
    } catch (e:any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de réorganiser les exercices.');
      openTemplate(selected);
    }
  };

  const startTemplate = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/templates/${selected.id}/start`, { method:'POST', headers });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? 'Impossible de démarrer la séance.');
      router.push('/(app)/seance');
    } catch (e:any) {
      Alert.alert('Séance', e?.message ?? 'Impossible de démarrer la séance.');
    } finally {
      setBusy(false);
    }
  };

  const deleteTemplate = () => {
    if (!selected) return;
    Alert.alert('Supprimer le template', `Supprimer « ${selected.nom} » ?`, [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive', onPress: async () => {
        setBusy(true);
        try {
          const r = await fetch(`${API_URL}/templates/${selected.id}`, { method:'DELETE', headers });
          if (!r.ok) throw new Error('Impossible de supprimer le template.');
          setSelected(null);
          setTemplateExercises([]);
          await loadTemplates();
        } catch (e:any) {
          Alert.alert('Erreur', e?.message ?? 'Impossible de supprimer le template.');
        } finally { setBusy(false); }
      }},
    ]);
  };

  if (loading) return <SafeAreaView style={[styles.center, dark && styles.darkBg]}><ActivityIndicator size="large" color="#0A84FF"/></SafeAreaView>;

  if (selected) {
    const ids = new Set(templateExercises.map(x => x.exercice_id));
    return (
      <SafeAreaView style={[styles.container, dark && styles.darkBg]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => { setSelected(null); setShowLibrary(false); }}><Text style={styles.back}>‹</Text></Pressable>
            <View style={{flex:1}}>
              <Text style={[styles.title, dark && styles.white]}>{selected.nom}</Text>
              <Text style={[styles.subtitle, dark && styles.muted]}>{templateExercises.length} exercice(s)</Text>
            </View>
            <Pressable onPress={startTemplate} disabled={busy} style={styles.start}><Text style={styles.startText}>DÉMARRER</Text></Pressable>
          </View>

          <View style={[styles.card, dark && styles.cardDark]}>
            {templateExercises.length === 0 ? (
              <Text style={[styles.empty, dark && styles.muted]}>Ce template est vide. Ajoute les exercices que tu veux.</Text>
            ) : templateExercises.map((ex, index) => (
              <View key={ex.exercice_id} style={styles.exerciseRow}>
                <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
                <View style={{flex:1}}>
                  <Text style={[styles.exerciseName, dark && styles.white]}>{ex.nom}</Text>
                  {!!ex.groupe_musculaire && <Text style={[styles.muted, dark && styles.muted]}>{ex.groupe_musculaire}</Text>}
                </View>
                <Pressable onPress={() => moveExercise(index,-1)} disabled={index===0 || busy}><Text style={styles.action}>↑</Text></Pressable>
                <Pressable onPress={() => moveExercise(index,1)} disabled={index===templateExercises.length-1 || busy}><Text style={styles.action}>↓</Text></Pressable>
                <Pressable onPress={() => removeExercise(ex.exercice_id)} disabled={busy}><Text style={styles.delete}>×</Text></Pressable>
              </View>
            ))}
          </View>

          <Pressable style={[styles.addButton, dark && styles.cardDark]} onPress={showLibrary ? () => setShowLibrary(false) : loadLibrary}>
            <Text style={styles.addText}>{showLibrary ? 'FERMER LA BIBLIOTHÈQUE' : '+ AJOUTER UN EXERCICE'}</Text>
          </Pressable>

          {showLibrary && (
            <View style={[styles.card, dark && styles.cardDark]}>
              {library.map(ex => (
                <Pressable key={ex.id} disabled={ids.has(ex.id) || busy} onPress={() => addExercise(ex)} style={styles.libraryRow}>
                  <View style={{flex:1}}>
                    <Text style={[styles.exerciseName, dark && styles.white]}>{ex.nom}</Text>
                    {!!ex.groupe_musculaire && <Text style={[styles.muted, dark && styles.muted]}>{ex.groupe_musculaire}</Text>}
                  </View>
                  <Text style={[styles.plus, ids.has(ex.id) && styles.disabled]}>{ids.has(ex.id) ? '✓' : '+'}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable onPress={deleteTemplate} disabled={busy} style={styles.deleteTemplate}>
            <Text style={styles.deleteTemplateText}>SUPPRIMER LE TEMPLATE</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, dark && styles.darkBg]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTemplates(); }}/>}
      >
        <Text style={[styles.title, dark && styles.white]}>Mes templates</Text>
        <Text style={[styles.subtitle, dark && styles.muted]}>Crée tes séances types. Les modifier ici ne modifie jamais une séance déjà commencée.</Text>

        <View style={[styles.createCard, dark && styles.cardDark]}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Nom du template (ex. Push A)"
            placeholderTextColor="#8A8A8E"
            style={[styles.input, dark && styles.inputDark]}
            maxLength={100}
            onSubmitEditing={createTemplate}
          />
          <Pressable onPress={createTemplate} disabled={!newName.trim() || creating} style={styles.createButton}>
            <Text style={styles.createText}>{creating ? '...' : 'CRÉER'}</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {templates.length === 0 ? (
          <View style={[styles.card, dark && styles.cardDark]}><Text style={[styles.empty, dark && styles.muted]}>Aucun template. Crée ton premier entraînement type.</Text></View>
        ) : templates.map(template => (
          <Pressable key={template.id} onPress={() => openTemplate(template)} style={[styles.templateCard, dark && styles.cardDark]}>
            <View style={styles.templateIcon}><Text style={styles.templateIconText}>L</Text></View>
            <View style={{flex:1}}>
              <Text style={[styles.templateName, dark && styles.white]}>{template.nom}</Text>
              <Text style={[styles.muted, dark && styles.muted]}>{template.nombre_exercices} exercice(s)</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#F5F5F7'},
  darkBg:{backgroundColor:'#0B0B0D'},
  center:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#F5F5F7'},
  content:{padding:20,paddingBottom:50},
  headerRow:{flexDirection:'row',alignItems:'center',marginBottom:18,gap:10},
  back:{fontSize:40,lineHeight:40,color:'#0A84FF'},
  title:{fontSize:30,fontWeight:'800',color:'#111'},
  subtitle:{fontSize:14,color:'#8A8A8E',marginTop:4,marginBottom:18},
  white:{color:'#FFF'},
  muted:{color:'#8A8A8E'},
  card:{backgroundColor:'#FFF',borderRadius:16,padding:12,marginBottom:14},
  cardDark:{backgroundColor:'#1C1C1E'},
  createCard:{backgroundColor:'#FFF',borderRadius:16,padding:12,marginBottom:16,flexDirection:'row',gap:10},
  input:{flex:1,height:46,backgroundColor:'#F2F2F7',borderRadius:10,paddingHorizontal:12,color:'#111'},
  inputDark:{backgroundColor:'#2C2C2E',color:'#FFF'},
  createButton:{backgroundColor:'#0A84FF',borderRadius:10,paddingHorizontal:18,justifyContent:'center'},
  createText:{color:'#FFF',fontWeight:'800'},
  templateCard:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginBottom:10,flexDirection:'row',alignItems:'center'},
  templateIcon:{width:44,height:44,borderRadius:12,backgroundColor:'#111',alignItems:'center',justifyContent:'center',marginRight:12},
  templateIconText:{color:'#FFF',fontSize:20,fontWeight:'900'},
  templateName:{fontSize:18,fontWeight:'700',color:'#111'},
  chevron:{fontSize:32,color:'#8A8A8E'},
  exerciseRow:{flexDirection:'row',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#E5E5EA',gap:8},
  number:{width:32,height:32,borderRadius:9,backgroundColor:'#F2F2F7',alignItems:'center',justifyContent:'center'},
  numberText:{fontSize:12,fontWeight:'700',color:'#8A8A8E'},
  exerciseName:{fontSize:16,fontWeight:'700',color:'#111'},
  action:{fontSize:20,color:'#0A84FF',paddingHorizontal:4},
  delete:{fontSize:25,color:'#FF3B30',paddingHorizontal:4},
  addButton:{backgroundColor:'#FFF',borderRadius:14,paddingVertical:16,alignItems:'center',marginBottom:12},
  addText:{color:'#0A84FF',fontWeight:'800'},
  libraryRow:{flexDirection:'row',alignItems:'center',paddingVertical:13,borderBottomWidth:1,borderBottomColor:'#E5E5EA'},
  plus:{fontSize:25,color:'#0A84FF'},
  disabled:{color:'#34C759'},
  start:{backgroundColor:'#0A84FF',borderRadius:10,paddingHorizontal:12,paddingVertical:11},
  startText:{color:'#FFF',fontSize:12,fontWeight:'800'},
  deleteTemplate:{padding:18,alignItems:'center'},
  deleteTemplateText:{color:'#FF3B30',fontWeight:'800'},
  empty:{color:'#8A8A8E',fontSize:15,lineHeight:22,padding:10},
  error:{color:'#FF3B30',marginBottom:12},
});
