#!/usr/bin/env python3
"""Run the STE 4-condition experiment against the OpenAI Chat Completions API.
Key is injected via `vaulted run --with-global OPENAI_API_KEY`. The key is used
only in the Authorization header and is never printed.
"""
import urllib.request, urllib.error, json, os, time, sys, collections
import ste_lint

HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
MODEL = sys.argv[1] if len(sys.argv) > 1 else "gpt-5.5"
LIMIT = int(sys.argv[2]) if len(sys.argv) > 2 else 999
CONDS = {"baseline":"sys_baseline.md","banwords":"sys_banwords.md","orwell":"sys_orwell.md","ste":"skill_ste.md"}
prompts = json.load(open("prompts.json"))[:LIMIT]
os.makedirs("outputs_openai", exist_ok=True)
KEY = os.environ.get("OPENAI_API_KEY", "")
if not KEY:
    print("NO OPENAI_API_KEY IN ENV"); sys.exit(1)

def call(system, user):
    payload = {"model": MODEL, "messages": [
        {"role": "system", "content": system}, {"role": "user", "content": user}]}
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    for attempt in (1, 2):
        try:
            d = json.load(urllib.request.urlopen(req, timeout=240))
            return d["choices"][0]["message"]["content"].strip()
        except urllib.error.HTTPError as e:
            print(f"    HTTP {e.code}: {e.read().decode()[:160]}", flush=True)
        except Exception as e:
            print(f"    ERR {type(e).__name__}: {str(e)[:120]}", flush=True)
        time.sleep(2)
    return None

results = {c: {} for c in CONDS}
t0 = time.time()
for p in prompts:
    for c, sf in CONDS.items():
        out = call(open(sf).read(), p["prompt"])
        if out is None:
            print(f"[FAIL] {p['id']}/{c}", flush=True); continue
        open(f"outputs_openai/{p['id']}__{c}.txt", "w").write(out)
        L = ste_lint.lint(out); results[c][p["id"]] = L
        print(f"[ok] {p['id']:15}/{c:9} words={L['words']:4d} total={L['total']:3d} "
              f"per100w={L['total_per100w']:6.2f} em={L['em_dash(slop-marker)']}", flush=True)

CATS = ["long_sentence(>20w)","semicolon","contraction","passive_voice","ing_main_verb",
        "nominalization","phrasal_verb","banned_word","marketing_adjective","modal_hedge","long_paragraph(>6s)"]
order = ["baseline","banwords","orwell","ste"]
agg = {}
for c in order:
    L = results[c]; words = sum(x["words"] for x in L.values()) or 1
    total = sum(x["total"] for x in L.values()); em = sum(x["em_dash(slop-marker)"] for x in L.values())
    cats = {k: sum(x["violations"].get(k,0) for x in L.values()) for k in CATS}
    agg[c] = {"words":words,"total":total,"per100w":round(total*100.0/words,2),"em":em,
              "cats_per100w":{k:round(v*100.0/words,2) for k,v in cats.items()}}
json.dump({"model":MODEL,"agg":agg}, open("results_openai.json","w"), indent=2)
base = agg["baseline"]["per100w"] or 1
lines = [f"# STE experiment results — OpenAI ({MODEL})","",
         "6 prompts x 4 conditions. Violations per 100 words (lower = cleaner). em-dash = true dash chars only.","",
         "| Condition | words | violations | per 100w | vs baseline | em-dashes |","|---|---|---|---|---|---|"]
for c in order:
    a = agg[c]; red = "—" if c=="baseline" else f"-{round((1-a['per100w']/base)*100)}%"
    lines.append(f"| {c} | {a['words']} | {a['total']} | **{a['per100w']}** | {red} | {a['em']} |")
lines += ["","## Per-category (per 100 words)","","| category | "+" | ".join(order)+" |","|---|"+"|".join(["---"]*4)+"|"]
for k in CATS:
    lines.append(f"| {k} | "+" | ".join(str(agg[c]['cats_per100w'][k]) for c in order)+" |")
lines += ["",f"**Headline: STE cut violations by {round((1-agg['ste']['per100w']/base)*100)}% vs baseline "
          f"({base} -> {agg['ste']['per100w']} per 100 words). Ban-words {round((1-agg['banwords']['per100w']/base)*100)}%, "
          f"Orwell {round((1-agg['orwell']['per100w']/base)*100)}%.**"]
open("results_openai.md","w").write("\n".join(lines))
print("\n".join(lines[:8]))
print(f"\nDONE in {time.time()-t0:.0f}s ({MODEL}) -> results_openai.md, outputs_openai/")
