import { useState, useEffect } from 'react'
import { apiUrl } from '../lib/api'
export function useUser() {
 const [user,setUser]=useState(null), [loading,setLoading]=useState(true), [error,setError]=useState(false)
 useEffect(()=>{
  let active=true
  const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),15000)
  fetch(apiUrl('getUserProfile.php'),{credentials:'include',signal:ctrl.signal}).then(async res=>{
   if (!res.ok) throw new Error('Profile unavailable')
   const data=await res.json()
   if (active && !data.error && data.steamid) setUser(data)
  }).catch(()=>{if(active)setError(true)}).finally(()=>{clearTimeout(timer);if(active)setLoading(false)})
  return ()=>{active=false;clearTimeout(timer);ctrl.abort()}
 },[])
 return {user,loading,error}
}
