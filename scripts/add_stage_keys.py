import sys

P = "src/lib/i18n.ts"
src = open(P, encoding="utf-8").read()

EDITS = [
    (
        '  calDayN: "Day {day}",',
        '''  dfStageGermination: "Germination",
  dfStageVegetative: "Vegetative growth",
  dfStageFlowering: "Flowering",
  dfStageFruiting: "Fruiting",
  dfStageMaturity: "Maturity / harvest",''',
    ),
    (
        '  calDayN: "{day} ದಿನ",',
        '''  dfStageGermination: "ಮೊಳಕೆ ಹೊರಡುವಿಕೆ",
  dfStageVegetative: "ಬೆಳವಣಿಗೆ ಹಂತ",
  dfStageFlowering: "ಹೂ ಬಿಡುವಿಕೆ",
  dfStageFruiting: "ಹಣ್ಣು ಬಿಡುವಿಕೆ",
  dfStageMaturity: "ಪಕ್ವತೆ / ಕೊಯ್ಲು",''',
    ),
    (
        '  calDayN: "दिन {day}",',
        '''  dfStageGermination: "अंकुरण",
  dfStageVegetative: "वानस्पतिक वृद्धि",
  dfStageFlowering: "पुष्पन",
  dfStageFruiting: "फलन",
  dfStageMaturity: "परिपक्वता / कटाई",''',
    ),
]

out = src
for anchor, add in EDITS:
    if anchor not in out:
        print("ANCHOR NOT FOUND:", anchor)
        sys.exit(1)
    out = out.replace(anchor, anchor + "\n" + add, 1)

open(P, "w", encoding="utf-8").write(out)
print("stage labels inserted OK")
