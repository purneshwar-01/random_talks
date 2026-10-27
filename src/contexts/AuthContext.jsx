import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsub = () => {};

    const authUnsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // Cancel any previous profile listener.
      profileUnsub();

      if (currentUser) {
        setLoading(true);
        // Live listener — updates profile state in real-time across all tabs
        // and immediately reflects trustScore/ban/profileComplete changes.
        profileUnsub = onSnapshot(
          doc(db, 'users', currentUser.uid),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              const isComplete = Boolean(
                data.isProfileComplete ||
                data.setupCompleted ||
                (data.username && data.username.trim().length > 0)
              );
              setProfile({
                ...data,
                isProfileComplete: isComplete,
                setupCompleted: isComplete,
              });
            } else {
              setProfile(null);
            }
            setLoading(false);
          },
          (err) => {
            console.error('[AuthContext] profile snapshot error:', err);
            setProfile(null);
            setLoading(false);
          }
        );
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsub();
      profileUnsub();
    };
  }, []);

  const signUp = async (email, password) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const signIn = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const logout = async () => {
    await signOut(auth);
  };

  /**
   * Send a Firebase password-reset email to the given address.
   * Firebase Auth handles OTP generation, email delivery, and expiry —
   * no Nodemailer or server required.
   */
  const sendPasswordReset = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  /**
   * Update the current user's Firestore profile document.
   * Uses setDoc+merge so partial updates don't wipe other fields.
   * The live onSnapshot listener above will push the change back into state.
   */
  const updateProfile = async (data) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), data, { merge: true });
    // No local setProfile needed — the onSnapshot listener handles it.
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, signUp, signIn, logout, sendPasswordReset, updateProfile, loading }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
