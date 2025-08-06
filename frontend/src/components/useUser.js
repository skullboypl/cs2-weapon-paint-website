import { useState, useEffect } from 'react';

export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || "/api/";
  useEffect(() => {
    fetch(`${API_URL}/getUserProfile.php`, {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setUser(data);
        //  console.log('User profile fetched successfully:', data);
        }else{
          console.error('Error fetching user profile:', data.error);
        }
        //clear get parameter from URL
        const url = new URL(window.location);
        url.searchParams.delete('steamid');
        window.history.replaceState({}, document.title, url);
        setLoading(false);
      });
  }, []);

  return { user, loading };
}
