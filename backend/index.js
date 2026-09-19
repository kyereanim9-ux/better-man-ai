// Point d'entrée UNIQUE à la racine, exigé par le mode zero-config "Express"
// de Vercel : ce framework ignore api/ et vercel.json (rewrites/functions)
// et cherche un fichier importer express() directement à la racine du projet.
// Découvert en lisant les logs de build ("WARNING! Internal rewrites... ignored",
// puis "No entrypoint found which imports express").
import express from 'express';
import { app } from './src/app.js';

export default app;
