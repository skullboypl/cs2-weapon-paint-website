import { useUser } from './components/useUser';
import Login from './components/Login';
import Page from './pages/Page';
import { useState } from 'react';

export default function App() {
  const { user, loading } = useUser();
  const [team, setTeam] = useState(null); //if CT or T is selected

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      {user ? (
        <Page user={user} team={team} setTeam={setTeam} />
      ) : (
        <Login />
      )}
    </div>
  );
}
