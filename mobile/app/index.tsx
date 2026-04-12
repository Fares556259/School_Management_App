import { View, Text, ScrollView, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import { Stack } from 'expo-router';
import { ArrowLeft, BookOpen, MapPin, Clock } from 'lucide-react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BlurView } from 'expo-blur';
import "../../global.css";

const SESSIONS = [
  {
    id: 1,
    subject: "Arabe",
    room: "Salle 1",
    time: "08:00 - 10:00",
    status: "Pres",
    color: "emerald"
  },
  {
    id: 2,
    subject: "Français",
    room: "Salle 4",
    time: "10:00 - 12:00",
    status: "Abs",
    color: "rose"
  },
  {
    id: 3,
    subject: "Histoire",
    room: "Salle 6",
    time: "12:00 - 13:00",
    status: "Rtr",
    color: "amber"
  },
  {
    id: 4,
    subject: "Anglais",
    room: "Salle 5",
    time: "14:00 - 15:00",
    status: "Exclu",
    color: "slate"
  },
  {
    id: 5,
    subject: "Physique",
    room: "Labo",
    time: "16:00 - 17:00",
    status: null,
    color: "sky"
  }
];

const DAYS = [
  { day: "23", label: "Lu", active: true },
  { day: "24", label: "Ma", active: false },
  { day: "25", label: "Me", active: false },
  { day: "26", label: "Je", active: false },
  { day: "27", label: "Ve", active: false },
  { day: "28", label: "Sa", active: false },
];

export default function ScheduleScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* ─── HEADER ─── */}
      <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
        <TouchableOpacity className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-sm border border-slate-100">
          <ArrowLeft size={20} color="#64748b" />
        </TouchableOpacity>
        
        <Text className="text-xl font-black text-slate-800 tracking-tight">Emploi du temps</Text>
        
        <TouchableOpacity className="w-10 h-10 rounded-full overflow-hidden border-2 border-indigo-200">
          <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} 
            className="w-full h-full"
          />
        </TouchableOpacity>
      </View>

      {/* ─── WEEK PICKER ─── */}
      <View className="px-6 py-4">
        <View className="flex-row items-center justify-center bg-white rounded-full py-2 px-4 shadow-sm border border-slate-100 self-center mb-6">
          <TouchableOpacity><Text className="text-slate-400 font-bold px-2">{"<"}</Text></TouchableOpacity>
          <Text className="text-slate-500 font-bold px-4">01 Oct - 06 oct 2024</Text>
          <TouchableOpacity><Text className="text-slate-400 font-bold px-2">{">"}</Text></TouchableOpacity>
        </View>

        <View className="flex-row justify-between">
          {DAYS.map((d, i) => (
            <TouchableOpacity key={i} className="items-center gap-1">
              <Text className={`text-2xl font-black ${d.active ? 'text-sky-500' : 'text-slate-400'}`}>{d.day}</Text>
              <Text className={`text-xs font-bold uppercase ${d.active ? 'text-sky-500' : 'text-slate-400'}`}>{d.label}</Text>
              {d.active && <View className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1" />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ─── SESSIONS ─── */}
      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        <Text className="text-base font-black text-slate-800 uppercase tracking-tight mb-4">Sessions d'aujourd'hui</Text>
        
        <View className="gap-4 pb-12">
          {SESSIONS.map((session) => (
            <TouchableOpacity 
              key={session.id}
              activeOpacity={0.7}
              className="bg-white rounded-3xl border border-slate-100 flex-row overflow-hidden shadow-sm shadow-slate-200"
            >
              <View className={`w-1 bg-${session.color}-500`} />
              
              <View className="flex-1 p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <BookOpen size={14} color="#94a3b8" />
                    <Text className="text-sm font-bold text-slate-700">{session.subject}</Text>
                  </View>
                  
                  {session.status && (
                    <View className={`px-3 py-1 rounded-full bg-${session.color}-500`}>
                      <Text className="text-[10px] font-black text-white uppercase">{session.status}</Text>
                    </View>
                  )}
                </View>
                
                <View className="flex-row items-center gap-4">
                  <View className="flex-row items-center gap-1.5">
                    <MapPin size={12} color="#94a3b8" />
                    <Text className="text-[11px] font-bold text-slate-400">{session.room}</Text>
                  </View>
                  
                  <View className="flex-row items-center gap-1.5">
                    <Clock size={12} color="#94a3b8" />
                    <Text className="text-[11px] font-bold text-slate-400">{session.time}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
