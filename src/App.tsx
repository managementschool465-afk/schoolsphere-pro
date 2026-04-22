/**
 * Topper AI Guru - Main App Container
 * ✅ Production-Ready Fixes: Relative Path, Brand Consistency, and XP Sync
 */

import React, { useState, useEffect } from "react";
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  updateDoc 
} from "firebase/firestore";
import { auth, db } from "./lib/firebase"; // पक्का करें कि path सही है
import { StudentProfile, LessonProgress } from "./types";
import { 
  GraduationCap, 
  Menu,
  ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Components
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import ClassBoard from "./components/ClassBoard";
import { InteractButton } from "./components/InteractButton";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<"dashboard" | "learn" | "settings">("dashboard");
  const [initialLesson, setInitialLesson] = useState<LessonProgress | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🏆 XP और Level को ट्रैक करने के लिए Helper
  const syncXP = async (newXP: number) => {
    if (!profile) return;
    const newPoints = Math.floor(newXP / 5); // Example calculation
    await updateProfile({ xp: newXP, points: newPoints });
  };

  const startNewLesson = (lesson?: LessonProgress) => {
    setInitialLesson(lesson || null);
    setCurrentView("learn");
  };

  const updateProfile = async (updates: Partial<StudentProfile>) => {
    if (!profile) return;
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    
    if (user && user.uid !== "guest-user") {
      try {
        await updateDoc(doc(db, "profiles", user.uid), updates);
      } catch (err) {
        console.error("Firestore Update Error:", err);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      if (u) {
        setUser(u);
        try {
          const profileDoc = await getDoc(doc(db, "profiles", u.uid));
          if (profileDoc.exists()) {
            setProfile(profileDoc.data() as StudentProfile);
          } else {
            // Default profile for new users
            setProfile({
              userId: u.uid,
              classLevel: "Class 10",
              preferredLanguage: "English",
              learningStyle: "Storytelling",
              onboardingComplete: false,
              xp: 0,
              points: 0,
              level: 1,
              streak: 0,
              mistakeHistory: [],
              weakAreas: []
            } as any);
          }
        } catch (err) {
          setError("Profile load nahi ho paya. Internet check karein.");
        }
      } else {
        setUser(null);
        // Direct testing/Guest mode data
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = () => signOut(auth).then(() => {
    setUser(null);
    setProfile(null);
    window.location.reload(); // Clean state
  });

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0f172a] text-white">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        >
          <GraduationCap className="w-16 h-16 text-indigo-500" />
        </motion.div>
        <h2 className="mt-6 font-bold tracking-[0.2em] animate-pulse">TOPPER AI GURU</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold">{error}</h2>
        <button onClick={() => window.location.reload()} className="mt-4 bg-indigo-600 text-white px-8 py-2 rounded-xl">Retry</button>
      </div>
    );
  }

  // Handle Landing (If no user and not in guest/test mode)
  if (!user && !profile) {
     return (
       <div className="h-screen flex flex-col items-center justify-center bg-indigo-600 text-white p-10">
          <h1 className="text-4xl font-black mb-4 italic">Topper AI Guru 🏆</h1>
          <p className="mb-8 font-medium">Bano Desh ka Agla Topper! 🚀</p>
          <button 
             onClick={() => window.location.reload()} 
             className="bg-white text-indigo-600 font-bold px-10 py-4 rounded-3xl shadow-2xl"
          >
            Start Learning Now
          </button>
       </div>
     );
  }

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden relative font-sans">
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        onSignOut={handleSignOut} 
        user={user!}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 relative overflow-y-auto pt-20">
        {/* Production Header */}
        <div className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-b border-zinc-100 flex items-center justify-between px-6 z-30">
          <div className="flex items-center gap-4">
            <InteractButton 
              onClick={() => setIsSidebarOpen(true)}
              className="p-3 hover:bg-zinc-100 rounded-2xl transition-colors"
            >
              <Menu className="w-6 h-6 text-zinc-900" />
            </InteractButton>
            <div className="flex items-center gap-2">
              <span className="font-black text-2xl tracking-tighter text-indigo-600">TOPPER AI GURU</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
                <span className="text-xs font-black text-indigo-600 uppercase">Level {profile?.level}</span>
             </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {currentView === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 lg:p-8"
            >
              <Dashboard profile={profile!} onStartLesson={startNewLesson} />
            </motion.div>
          )}

          {currentView === "learn" && (
            <motion.div
              key="learn"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full"
            >
              <ClassBoard 
                profile={profile!} 
                initialLesson={initialLesson} 
                onClearInitial={() => setInitialLesson(null)} 
                onUpdateProfile={updateProfile}
                onXPGain={syncXP}
              />
            </motion.div>
          )}

          {currentView === "settings" && (
            <div className="p-8 max-w-2xl mx-auto">
              <h1 className="text-4xl font-black mb-8 italic tracking-tight">Settings</h1>
              <div className="bg-white rounded-[40px] p-10 shadow-xl border border-zinc-100">
                <div className="space-y-8">
                  <div className="flex justify-between items-center pb-4 border-b border-zinc-50">
                    <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Class</label>
                    <span className="font-black text-zinc-900">{profile?.classLevel}</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-zinc-50">
                    <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Language</label>
                    <span className="font-black text-zinc-900">{profile?.preferredLanguage}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Learning Style</label>
                    <span className="font-black text-indigo-600">{profile?.learningStyle}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
