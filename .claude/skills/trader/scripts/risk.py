#!/usr/bin/env python3
"""Calcul de la taille de position et vérification des règles de risque."""
import argparse, math

p = argparse.ArgumentParser(description="Taille de position selon le risque")
p.add_argument("--capital", type=float, required=True, help="capital de trading")
p.add_argument("--risk", type=float, default=1.0, help="risque en %% du capital (défaut 1)")
p.add_argument("--entry", type=float, required=True)
p.add_argument("--stop", type=float, required=True)
p.add_argument("--target", type=float, help="objectif de prix")
p.add_argument("--fees", type=float, default=0.0, help="frais estimés aller-retour (montant)")
p.add_argument("--fractional", action="store_true", help="quantités décimales permises (crypto)")
a = p.parse_args()

if a.risk > 2:
    print("REFUS : risque > 2 % du capital par trade. Maximum autorisé : 2 %.")
    raise SystemExit(1)
dist = abs(a.entry - a.stop)
if dist == 0:
    print("REFUS : le stop est égal à l'entrée.")
    raise SystemExit(1)
sens = "achat" if a.stop < a.entry else "vente"
budget = a.capital * a.risk / 100 - a.fees
if budget <= 0:
    print("REFUS : les frais dépassent le risque autorisé.")
    raise SystemExit(1)
qty = budget / dist
qty = round(qty, 6) if a.fractional else math.floor(qty)
if qty <= 0:
    print("REFUS : stop trop loin pour ce capital (quantité = 0). Rapproche le stop ou passe.")
    raise SystemExit(1)
exposure = qty * a.entry
print(f"Sens                : {sens}")
print(f"Risque autorisé     : {a.capital * a.risk / 100:.2f} ({a.risk} % de {a.capital:.2f})")
print(f"Distance au stop    : {dist:.4f} ({dist / a.entry * 100:.2f} %)")
print(f"Quantité            : {qty}")
print(f"Montant engagé      : {exposure:.2f} ({exposure / a.capital * 100:.1f} % du capital)")
print(f"Perte si stop       : {qty * dist + a.fees:.2f}")
ok = True
if exposure > a.capital:
    print("ATTENTION : position plus grande que le capital = levier. Déconseillé.")
    ok = False
if a.target is not None:
    if (sens == "achat" and a.target <= a.entry) or (sens == "vente" and a.target >= a.entry):
        print("REFUS : l'objectif est du mauvais côté de l'entrée.")
        raise SystemExit(1)
    rr = abs(a.target - a.entry) / dist
    print(f"Gain si objectif    : {qty * abs(a.target - a.entry) - a.fees:.2f}")
    print(f"Ratio gain/risque   : {rr:.2f}")
    if rr < 2:
        print("VERDICT : PAS DE TRADE — ratio < 2.")
        ok = False
else:
    print("Pas d'objectif donné : impossible de vérifier le ratio ≥ 2.")
    ok = False
if ok:
    print("VERDICT : plan conforme aux règles de risque (ce n'est pas une garantie de gain).")
