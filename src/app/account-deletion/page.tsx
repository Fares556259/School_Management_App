'use client';
import { useState } from 'react';
export default function AccountDeletionPage() {
  const [role,setRole]=useState('parent'); const [identifier,setIdentifier]=useState(''); const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false); const [result,setResult]=useState('');
  async function submit(event:React.FormEvent) {
    event.preventDefault(); setBusy(true);setResult('');
    try {
      const login=await fetch('/api/mobile/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:identifier.trim(),password,role,action:'signin'})});
      const session=await login.json();
      if(!login.ok || !session.token) throw new Error('Connexion impossible. Vérifiez vos identifiants ou contactez votre école pour récupérer votre accès.');
      const response=await fetch('/api/mobile/privacy-request',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.token}`},body:JSON.stringify({kind:'ACCOUNT_DELETION'})});
      const data=await response.json(); if(!response.ok || !data.success) throw new Error('Envoi impossible. Veuillez réessayer.');
      setResult(`Demande enregistrée, référence ${data.reference}. Votre établissement examinera la suppression de votre compte et des données personnelles associées. Cette demande ne supprime pas immédiatement votre compte.`);setPassword('');
    } catch(error) {setResult(error instanceof Error ? error.message : 'Envoi impossible.');}
    finally {setBusy(false);}
  }
  return <main className="max-w-xl mx-auto p-6 py-12 space-y-6">
    <h1 className="text-3xl font-bold">SnapSchool — Suppression de compte</h1>
    <p>Demandez la suppression de votre compte et de vos données personnelles associées. Connectez-vous ci-dessous pour vérifier votre identité, sans installer l’application.</p>
    <p>Les informations de connexion et données personnelles non nécessaires seront supprimées ou anonymisées après vérification. Les dossiers scolaires, pièces comptables et preuves nécessaires à des obligations légales peuvent être conservés par l’établissement. Il vous indiquera les données conservées, le motif et la durée applicable.</p>
    <p>Si vous ne pouvez plus vous connecter, contactez directement votre établissement pour vérifier votre identité et demander la suppression.</p>
    <form onSubmit={submit} className="space-y-4">
      <label className="block">Profil<select className="block border rounded p-3 w-full" value={role} onChange={e=>setRole(e.target.value)}><option value="parent">Parent</option><option value="teacher">Enseignant</option><option value="admin">Administration</option></select></label>
      <label className="block">Téléphone / identifiant (email pour la direction)<input required autoComplete="username" className="block border rounded p-3 w-full" value={identifier} onChange={e=>setIdentifier(e.target.value)}/></label>
      <label className="block">Mot de passe<input required type="password" autoComplete="current-password" className="block border rounded p-3 w-full" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button disabled={busy} className="bg-blue-700 text-white rounded p-3 w-full disabled:opacity-50">{busy?'Envoi…':'Demander la suppression du compte'}</button>
    </form>
    <p role="status">{result}</p><a href="/privacy" className="text-blue-700 underline">Politique de confidentialité</a>
  </main>;
}
