#!/usr/bin/env python3
"""Indicateurs simples à partir d'un CSV de prix (colonnes date, close[, volume])."""
import csv, sys

if len(sys.argv) < 2:
    print("Usage : indicators.py prix.csv"); raise SystemExit(1)
rows = list(csv.DictReader(open(sys.argv[1], newline="", encoding="utf-8-sig")))
key = {k.lower().strip(): k for k in rows[0]} if rows else {}
ck = key.get("close") or key.get("adj close") or key.get("clôture")
if not ck:
    print("Colonne 'close' introuvable."); raise SystemExit(1)
closes = [float(r[ck]) for r in rows if r[ck] not in ("", "null")]
n = len(closes)
last = closes[-1]

def sma(k):
    return sum(closes[-k:]) / k if n >= k else None

def rsi(k=14):
    if n <= k: return None
    gains = losses = 0.0
    for i in range(1, k + 1):
        d = closes[i] - closes[i - 1]
        gains += max(d, 0); losses += max(-d, 0)
    ag, al = gains / k, losses / k
    for i in range(k + 1, n):  # lissage de Wilder
        d = closes[i] - closes[i - 1]
        ag = (ag * (k - 1) + max(d, 0)) / k
        al = (al * (k - 1) + max(-d, 0)) / k
    return 100.0 if al == 0 else 100 - 100 / (1 + ag / al)

m20, m50, m200, r = sma(20), sma(50), sma(200), rsi()
fmt = lambda v: "n/a (pas assez de données)" if v is None else f"{v:.4f}"
print(f"Points de données : {n}  |  Dernier prix : {last}")
print(f"MM20  : {fmt(m20)}\nMM50  : {fmt(m50)}\nMM200 : {fmt(m200)}")
print(f"RSI14 : {fmt(r)}" + ("" if r is None else ("  (suracheté)" if r > 70 else "  (survendu)" if r < 30 else "")))
w = closes[-20:]
print(f"Plus haut / bas 20 périodes : {max(w)} / {min(w)}")
if m50 and m200:
    t = "haussière" if last > m50 > m200 else "baissière" if last < m50 < m200 else "indécise / latérale"
    print(f"Tendance (prix vs MM50 vs MM200) : {t}")
print("Rappel : ces indicateurs décrivent le passé, ils ne prédisent rien avec certitude.")
