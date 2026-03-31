import React, { useEffect, useState, createContext, useContext, Component, ErrorInfo, ReactNode } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, orderBy, limit, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { UserProfile, UserRole, Message, BusLocation, School, Student, Attendance, Fee, SecurityAlert, Homework, Mark, Subscription } from './types';
import { Toaster, toast } from 'sonner';
import { LogIn, LogOut, Shield, School as SchoolIcon, User as UserIcon, Bell, MessageSquare, Camera, FileText, Settings, Plus, Download, Trash2, BookOpen, TrendingUp, CreditCard, BarChart2, Briefcase, GraduationCap, Calculator, Truck, Users, LayoutDashboard, Github } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { saveFileLocally, getLocalFile, LocalFile } from './lib/idb';
import imageCompression from 'browser-image-compression';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { GitHubSetup } from './components/GitHubSetup';

// Haversine formula for distance calculation
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

// Custom Icons for Map
const busIcon = new L.DivIcon({
  html: `<div class="w-10 h-10 gold-gradient rounded-full flex items-center justify-center shadow-2xl border-2 border-white/20"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s1-1 1-2V10s0-1-1-1h-3"/><path d="M12 18h2"/><path d="M3 18h2"/><path d="M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z"/><path d="M15 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z"/><path d="M4 6h12s1 0 1 1v2s0 1-1 1H4s-1 0-1-1V7s0-1 1-1Z"/></svg></div>`,
  className: 'custom-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const schoolIcon = new L.DivIcon({
  html: `<div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-2xl border-2 border-white/20"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 10 9h-3v8H5v-8H2l10-9z"/><path d="M9 21v-6a3 3 0 0 1 6 0v6"/></svg></div>`,
  className: 'custom-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// --- Auth Context ---
const AuthContext = createContext<{
  profile: UserProfile | null;
  loading: boolean;
  signIn: (id: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}>({
  profile: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUserId = localStorage.getItem('school_user_id');
    if (savedUserId && db) {
      const fetchUser = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', savedUserId));
          if (userDoc.exists()) {
            const userData = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
            // Fetch School Name for Dynamic Branding
            if (userData.schoolId) {
              const schoolDoc = await getDoc(doc(db, 'schools', userData.schoolId));
              if (schoolDoc.exists()) {
                userData.schoolName = (schoolDoc.data() as School).name;
              }
            }
            setProfile(userData);
          } else {
            localStorage.removeItem('school_user_id');
          }
        } catch (error) {
          console.error('Auth error:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (id: string, password: string) => {
    if (!db) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', id));
      if (!userDoc.exists()) {
        toast.error('User not found');
        return;
      }

      const userData = userDoc.data() as UserProfile;
      if (userData.password !== password) {
        toast.error('Invalid password');
        return;
      }

      // Device Lock Check
      const deviceId = localStorage.getItem('school_device_id') || Math.random().toString(36).substring(7);
      localStorage.setItem('school_device_id', deviceId);

      if (userData.deviceId && userData.deviceId !== deviceId) {
        await setDoc(doc(db, 'users', id), { ...userData, status: 'blocked' });
        toast.error('Unauthorized device! Account blocked.');
        return;
      }

      if (!userData.deviceId) {
        await setDoc(doc(db, 'users', id), { ...userData, deviceId });
      }

      let schoolName = '';
      if (userData.schoolId) {
        const schoolDoc = await getDoc(doc(db, 'schools', userData.schoolId));
        if (schoolDoc.exists()) {
          schoolName = (schoolDoc.data() as School).name;
        }
      }

      localStorage.setItem('school_user_id', id);
      setProfile({ uid: id, ...userData, deviceId, schoolName });
      toast.success('Welcome back!');
    } catch (error) {
      toast.error('Login failed');
    }
  };

  const signOut = async () => {
    localStorage.removeItem('school_user_id');
    setProfile(null);
    toast.success('Logged out');
  };

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
import React, { useEffect, useState, createContext, useContext, Component, ErrorInfo, ReactNode } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, orderBy, limit, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { UserProfile, UserRole, Message, BusLocation, School, Student, Attendance, Fee, SecurityAlert, Homework, Mark, Subscription } from './types';
import { Toaster, toast } from 'sonner';
import { LogIn, LogOut, Shield, School as SchoolIcon, User as UserIcon, Bell, MessageSquare, Camera, FileText, Settings, Plus, Download, Trash2, BookOpen, TrendingUp, CreditCard, BarChart2, Briefcase, GraduationCap, Calculator, Truck, Users, LayoutDashboard, Github } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { saveFileLocally, getLocalFile, LocalFile } from './lib/idb';
import imageCompression from 'browser-image-compression';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { GitHubSetup } from './components/GitHubSetup';

// Haversine formula for distance calculation
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

// Custom Icons for Map
const busIcon = new L.DivIcon({
  html: `<div class="w-10 h-10 gold-gradient rounded-full flex items-center justify-center shadow-2xl border-2 border-white/20"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s1-1 1-2V10s0-1-1-1h-3"/><path d="M12 18h2"/><path d="M3 18h2"/><path d="M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z"/><path d="M15 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z"/><path d="M4 6h12s1 0 1 1v2s0 1-1 1H4s-1 0-1-1V7s0-1 1-1Z"/></svg></div>`,
  className: 'custom-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const schoolIcon = new L.DivIcon({
  html: `<div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-2xl border-2 border-white/20"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 10 9h-3v8H5v-8H2l10-9z"/><path d="M9 21v-6a3 3 0 0 1 6 0v6"/></svg></div>`,
  className: 'custom-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// --- Auth Context ---
const AuthContext = createContext<{
  profile: UserProfile | null;
  loading: boolean;
  signIn: (id: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}>({
  profile: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUserId = localStorage.getItem('school_user_id');
    if (savedUserId && db) {
      const fetchUser = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', savedUserId));
          if (userDoc.exists()) {
            const userData = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
            // Fetch School Name for Dynamic Branding
            if (userData.schoolId) {
              const schoolDoc = await getDoc(doc(db, 'schools', userData.schoolId));
              if (schoolDoc.exists()) {
                userData.schoolName = (schoolDoc.data() as School).name;
              }
            }
            setProfile(userData);
          } else {
            localStorage.removeItem('school_user_id');
          }
        } catch (error) {
          console.error('Auth error:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (id: string, password: string) => {
    if (!db) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', id));
      if (!userDoc.exists()) {
        toast.error('User not found');
        return;
      }

      const userData = userDoc.data() as UserProfile;
      if (userData.password !== password) {
        toast.error('Invalid password');
        return;
      }

      // Device Lock Check
      const deviceId = localStorage.getItem('school_device_id') || Math.random().toString(36).substring(7);
      localStorage.setItem('school_device_id', deviceId);

      if (userData.deviceId && userData.deviceId !== deviceId) {
        await setDoc(doc(db, 'users', id), { ...userData, status: 'blocked' });
        toast.error('Unauthorized device! Account blocked.');
        return;
      }

      if (!userData.deviceId) {
        await setDoc(doc(db, 'users', id), { ...userData, deviceId });
      }

      let schoolName = '';
      if (userData.schoolId) {
        const schoolDoc = await getDoc(doc(db, 'schools', userData.schoolId));
        if (schoolDoc.exists()) {
          schoolName = (schoolDoc.data() as School).name;
        }
      }

      localStorage.setItem('school_user_id', id);
      setProfile({ uid: id, ...userData, deviceId, schoolName });
      toast.success('Welcome back!');
    } catch (error) {
      toast.error('Login failed');
    }
  };

  const signOut = async () => {
    localStorage.removeItem('school_user_id');
    setProfile(null);
    toast.success('Logged out');
  };

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
// --- Marks, Reports, Subscription, etc. ---

const MarksPage = () => {
  const { profile } = useAuth();
  const [marks, setMarks] = useState<Mark[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [subject, setSubject] = useState('');
  const [score, setScore] = useState('');
  const [total, setTotal] = useState('');
  const [examName, setExamName] = useState('');

  useEffect(() => {
    if (!profile?.schoolId || !db) return;
    
    let marksQuery = query(
      collection(db, 'marks'),
      where('schoolId', '==', profile.schoolId),
      orderBy('timestamp', 'desc')
    );

    if (profile.role === 'parent') {
      marksQuery = query(
        collection(db, 'marks'),
        where('schoolId', '==', profile.schoolId),
        where('studentName', '==', profile.displayName),
        orderBy('timestamp', 'desc')
      );
    }

    const unsubscribeMarks = onSnapshot(marksQuery, (snapshot) => {
      setMarks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mark)));
    });

    const studentsQuery = query(collection(db, 'students'), where('schoolId', '==', profile.schoolId));
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    });

    return () => {
      unsubscribeMarks();
      unsubscribeStudents();
    };
  }, [profile]);

  const addMark = async () => {
    if (!selectedStudent || !subject || !score || !total || !examName || !profile?.schoolId || !db) {
      toast.error('Please fill all fields');
      return;
    }
    const student = students.find(s => s.id === selectedStudent);
    try {
      await addDoc(collection(db, 'marks'), {
        studentId: selectedStudent,
        studentName: student?.name || 'Unknown',
        subject,
        marks: Number(score),
        totalMarks: Number(total),
        examName,
        schoolId: profile.schoolId,
        timestamp: Date.now(),
      });
      setShowAdd(false);
      setSubject('');
      setScore('');
      setTotal('');
      setExamName('');
      toast.success('Marks recorded!');
    } catch (error) {
      toast.error('Failed to record marks');
    }
  };

  return (
    <div className="p-4 flex-1 overflow-y-auto pb-20">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="text-gold"><Plus className="rotate-45" /></button>
          <h2 className="text-2xl font-bold text-gold-gradient">Marks</h2>
        </div>
        {['teacher', 'owner', 'principal'].includes(profile?.role || '') && (
          <button onClick={() => setShowAdd(true)} className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center text-black">
            <Plus size={20} />
          </button>
        )}
      </header>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass p-6 rounded-3xl mb-8 border border-gold/20"
          >
            <h3 className="font-bold mb-4">Record Marks</h3>
            <div className="space-y-4">
              <select 
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none"
              >
                <option value="">Select Student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
              </select>
              <input 
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="Exam Name (e.g. Midterm)"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none"
              />
              <input 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none"
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="number"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="Obtained Marks"
                  className="bg-white/5 border border-white/10 rounded-xl p-3 outline-none"
                />
                <input 
                  type="number"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="Total Marks"
                  className="bg-white/5 border border-white/10 rounded-xl p-3 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={addMark} className="btn-gold flex-1">Record</button>
                <button onClick={() => setShowAdd(false)} className="btn-glass">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {marks.map(m => (
          <div key={m.id} className="glass p-5 rounded-3xl border border-white/5 flex justify-between items-center">
            <div>
              <h4 className="font-bold text-lg">{m.studentName}</h4>
              <p className="text-xs text-white/50">{m.examName} • {m.subject}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gold">{m.marks}<span className="text-sm text-white/30">/{m.totalMarks}</span></div>
              <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                {((m.marks / m.totalMarks) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Device ID helper
const getDeviceId = () => {
  let deviceId = localStorage.getItem('schoolsphere_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('schoolsphere_device_id', deviceId);
  }
  return deviceId;
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-[#0f2027] text-white font-sans selection:bg-gold/30">
            <Toaster position="top-center" richColors />
            <AuthWrapper selectedRole={selectedRole} setSelectedRole={setSelectedRole} />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const Sidebar = () => {
  const { profile, signOut: logOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: <LayoutDashboard />, label: 'Dashboard', path: '/' },
    { icon: <Users />, label: 'Students', path: '/students', roles: ['owner', 'principal', 'teacher'] },
    { icon: <FileText />, label: 'Attendance', path: '/attendance', roles: ['teacher', 'owner', 'principal'] },
    { icon: <CreditCard />, label: 'Fees', path: '/fees', roles: ['accountant', 'parent', 'owner', 'principal'] },
    { icon: <MessageSquare />, label: 'Messages', path: '/messages' },
    { icon: <Shield />, label: 'Security', path: '/security', roles: ['owner', 'principal'] },
    { icon: <Settings />, label: 'Settings', path: '/settings' },
  ];

  const filteredNav = navItems.filter(item => !item.roles || item.roles.includes(profile?.role || ''));

  return (
    <div className="w-20 md:w-64 bg-[#0a151a] border-r border-white/5 flex flex-col h-full transition-all">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center shadow-lg shrink-0">
          <SchoolIcon size={24} className="text-black" />
        </div>
        <span className="hidden md:block font-black text-xl tracking-tighter text-gold">SCHOOLSPHERE</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {filteredNav.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group ${
              location.pathname === item.path 
                ? 'bg-gold text-black shadow-[0_10px_20px_rgba(212,175,55,0.2)]' 
                : 'text-white/50 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className="shrink-0">{item.icon}</div>
            <span className="hidden md:block font-bold text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto">
        <button 
          onClick={logOut}
          className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-400 hover:bg-red-400/10 transition-all"
        >
          <LogOut size={24} className="shrink-0" />
          <span className="hidden md:block font-bold text-sm">Logout</span>
        </button>
      </div>
    </div>
  );
};

const AuthWrapper = ({ selectedRole, setSelectedRole }: { selectedRole: UserRole | null; setSelectedRole: (role: UserRole | null) => void }) => {
  const { profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!profile) {
    if (!selectedRole) {
      return <RoleSelection onSelect={setSelectedRole} />;
    }
    return <Login role={selectedRole} onBack={() => setSelectedRole(null)} />;
  }

  if (profile.status === 'blocked') {
    return <BlockedScreen profile={profile} />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/fees" element={<FeesPage />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/notices" element={<NoticesPage />} />
          <Route path="/receipts" element={<DriverReceipts />} />
          <Route path="/track-bus" element={<BusTracker />} />
          <Route path="/homework" element={['owner', 'principal', 'teacher', 'parent'].includes(profile.role) ? <HomeworkPage /> : <Navigate to="/" />} />
          <Route path="/marks" element={['owner', 'principal', 'teacher', 'parent'].includes(profile.role) ? <MarksPage /> : <Navigate to="/" />} />
          <Route path="/reports" element={['owner', 'principal', 'accountant'].includes(profile.role) ? <ReportsPage /> : <Navigate to="/" />} />
          <Route path="/subscription" element={profile.role === 'owner' ? <SubscriptionPage /> : <Navigate to="/" />} />
          <Route path="/school-settings" element={profile.role === 'owner' ? <SchoolSettingsPage /> : <Navigate to="/" />} />
          <Route path="/security" element={['owner', 'principal'].includes(profile.role) ? <SecurityManagement /> : <Navigate to="/" />} />
          <Route path="/driver-duty" element={profile.role === 'driver' ? <TrackingModule /> : <Navigate to="/" />} />
          <Route path="/super-admin" element={profile.role === 'super_admin' ? <SuperAdminDashboard /> : <Navigate to="/" />} />
          <Route path="/id-card" element={<IDCard />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
};
