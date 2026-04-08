import React, { createContext, useContext, useState, useEffect } from 'react';
import pb from '../lib/pocketbase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(pb.authStore.model);
  const [isValid, setIsValid] = useState(pb.authStore.isValid);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auth state on mount
    setUser(pb.authStore.model);
    setIsValid(pb.authStore.isValid);
    setLoading(false);

    // Listen to auth changes
    return pb.authStore.onChange((token, model) => {
      setUser(model);
      setIsValid(!!token);
    });
  }, []);

  const login = async (email, password) => {
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData;
  };

  const register = async (email, password, name) => {
    const data = {
        email,
        password,
        passwordConfirm: password,
        name,
        username: email.split('@')[0] + Math.floor(Math.random() * 1000),
    };
    const newUser = await pb.collection('users').create(data);
    
    // Auto-link pending invites
    try {
      const pendingInvites = await pb.collection('members').getFullList({
        filter: `email = "${email.toLowerCase().trim()}" && id_usuario = ""`,
      });
      
      for (const invite of pendingInvites) {
        await pb.collection('members').update(invite.id, {
          id_usuario: newUser.id
        });
      }
    } catch (err) {
      console.error('Error linking invites:', err);
    }

    return newUser;
  };

  const refresh = async () => {
    try {
      const model = await pb.collection('users').authRefresh();
      setUser(model.record);
      return model.record;
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setUser(null);
    setIsValid(false);
  };

  return (
    <AuthContext.Provider value={{ user, isValid, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
