#!/usr/bin/env python3
"""Statistiques du journal de trading (colonnes resultat_eur et R)."""
import csv, sys

if len(sys.argv) < 2:
    print("Usage : journal_stats.py journal.csv"); raise SystemExit(1)
rows = [r for r in csv.DictReader(open(sys.argv[1], newline="", encoding="utf-8")) if r.get("resultat_eur")]
if not rows:
    print("Aucun trade clôturé dans le journal."); raise SystemExit(0)
res = [float(r["resultat_eur"]) for r in rows]
R = [float(r["R"]) for r in rows if r.get("R")]
wins = [x for x in res if x > 0]; losses = [x for x in res if x <= 0]
streak = worst = 0
for x in res:
    streak = streak + 1 if x <= 0 else 0
    worst = max(worst, streak)
print(f"Trades clôturés     : {len(res)}")
print(f"Taux de réussite    : {len(wins) / len(res) * 100:.1f} %")
print(f"Résultat total      : {sum(res):.2f}")
print(f"Gain moyen / perte moyenne : {(sum(wins)/len(wins) if wins else 0):.2f} / {(sum(losses)/len(losses) if losses else 0):.2f}")
if R:
    print(f"Espérance (R moyen) : {sum(R) / len(R):.2f} R par trade")
print(f"Pire série de pertes: {worst}")
if len(res) < 20:
    print("Moins de 20 trades : échantillon trop petit pour conclure.")
elif R and sum(R) / len(R) < 0:
    print("Espérance négative : revenir en mode papier et revoir la méthode.")
