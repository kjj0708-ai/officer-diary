import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/FirebaseProvider';
import { handleFirestoreError } from '../lib/firestoreUtils';

export interface Promotion {
  rank: string;
  date: string;
}

export interface Assignment {
  department: string;
  date: string;
  role: string;
}

export interface CareerData {
  appointmentDate: string;
  promotions: Promotion[];
  assignments: Assignment[];
  updatedAt?: any;
}

export function useCareerProfile() {
  const { user } = useAuth();
  const [data, setData] = useState<CareerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'career', 'profile');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setData(docSnap.data() as CareerData);
        } else {
          setData({
            appointmentDate: '',
            promotions: [],
            assignments: []
          });
        }
      } catch (error: any) {
        handleFirestoreError(error, 'get', `/users/${user.uid}/career/profile`, user);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const updateProfile = async (newData: Partial<CareerData>) => {
    if (!user) return;
    
    const prevData = data;
    const updatedData = { ...data, ...newData } as CareerData;
    setData(updatedData);

    try {
      const docRef = doc(db, 'users', user.uid, 'career', 'profile');
      const docSnap = await getDoc(docRef);
      
      const payload = {
        ...updatedData,
        userId: user.uid,
        updatedAt: serverTimestamp()
      };

      if (!docSnap.exists()) {
        await setDoc(docRef, payload);
      } else {
        await updateDoc(docRef, payload);
      }
    } catch (error) {
      setData(prevData);
      handleFirestoreError(error, 'update', `/users/${user.uid}/career/profile`, user);
    }
  };

  return { data, loading, updateProfile };
}
