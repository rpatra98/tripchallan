import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const [userCoins, setUserCoins] = useState<number | null>(null);

useEffect(() => {
  if (session?.user?.id) {
    fetchUserCoins();
  }
}, [session?.user?.id]);

const fetchUserCoins = async () => {
  if (!session?.user?.id) return;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('coins')
      .eq('id', session.user.id)
      .single();
    
    if (error) {
      console.error('Error fetching user coins:', error);
      return;
    }
    
    setUserCoins(data?.coins || 0);
  } catch (err) {
    console.error('Error fetching user coins:', err);
  }
}; 