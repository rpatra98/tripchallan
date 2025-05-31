import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

const Navbar = () => {
  const { data: session, update: updateSession } = useSession();
  const [userCoins, setUserCoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserCoins();
    }
  }, [session?.user?.id]);

  const fetchUserCoins = async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('coins')
        .eq('id', session.user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user coins:', error);
        setUserCoins(0);
        return;
      }
      
      setUserCoins(data?.coins || 0);
      
      // Update session with correct coin balance
      if (session?.user && updateSession) {
        await updateSession({
          ...session,
          user: {
            ...session.user,
            coins: data?.coins || 0
          }
        });
      }
    } catch (err) {
      console.error('Error fetching user coins:', err);
      setUserCoins(0);
    } finally {
      setLoading(false);
    }
  };
  
  // Return your navbar component JSX here
  return (
    <div>
      {/* Your navbar JSX */}
      {!loading && userCoins !== null && (
        <div className="user-coins">
          Coins: {userCoins}
        </div>
      )}
    </div>
  );
};

export default Navbar; 