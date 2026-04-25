import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/FirebaseProvider';
import { handleFirestoreError } from '../lib/firestoreUtils';

export interface DiaryData {
  years: Record<string, string>;
  images?: Record<string, string[]>;
}

export function useDiaryEntry(dateId: string) {
  const { user } = useAuth();
  const [data, setData] = useState<DiaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !dateId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const fetchEntry = async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'entries', dateId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setData(docSnap.data() as DiaryData);
        } else {
          setData({ years: {}, images: {} });
        }
      } catch (error: any) {
        if (error.code !== 'permission-denied') {
             console.error("Error fetching diary entry:", error);
        }
        handleFirestoreError(error, 'get', `/users/${user.uid}/entries/${dateId}`, user);
      } finally {
        setLoading(false);
      }
    };

    fetchEntry();
  }, [user, dateId]);

  const updateEntry = async (year: string, content: string, newImages?: string[]) => {
    if (!user || !dateId) return;
    
    // Optimistic UI update
    const prevData = data;
    const newYears = { ...data?.years, [year]: content };
    const updatedImages = newImages ? { ...data?.images, [year]: newImages } : data?.images;
    
    setData({ 
      years: newYears, 
      images: updatedImages 
    });

    try {
      const docRef = doc(db, 'users', user.uid, 'entries', dateId);
      const docSnap = await getDoc(docRef);
      
      const updatePayload: any = {
        years: newYears,
        updatedAt: serverTimestamp()
      };
      
      if (newImages) {
        updatePayload.images = updatedImages;
      }

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          userId: user.uid,
          dateId: dateId,
          ...updatePayload
        });
      } else {
        await updateDoc(docRef, updatePayload);
      }
    } catch (error) {
      // Revert optimistic update
      setData(prevData);
      console.error("Error updating entry:", error);
      handleFirestoreError(error, 'update', `/users/${user.uid}/entries/${dateId}`, user);
    }
  };

  return { data, loading, updateEntry };
}
