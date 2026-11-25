import sys

P = "src/lib/i18n.ts"
src = open(P, encoding="utf-8").read()

# (anchor_literal, insertion_lines) — insert AFTER anchor line, per dict.
EDITS = [
    # ---- en: after en dfClickHint line -----------------------------------
    (
        '  dfClickHint: "Click crop, water, soil or house",',
        '''  dfNoCrop: "Save a field with crop and sowing date to bring your farm alive.",
  dfSoilNoData: "Exact N, P, K and pH values require a soil test.",
  dfSoilInfo: "Location-based soil characteristics — qualitative, from open location data",
  dfInfoAge: "Age: {day} days",
  dfInfoStatus: "Status: {status}",
  dfInfoSoil: "Soil: no measured N-P-K — needs a soil test",
  calSowingDate: "Sowing date",
  calDayN: "Day {day}",''',
    ),
    # ---- kn: after kn dfClickHint line -----------------------------------
    (
        '  dfClickHint: "ಬೆಳೆ, ನೀರು, ಮಣ್ಣು ಅಥವಾ ಮನೆ ಒತ್ತಿರಿ",',
        '''  dfNoCrop: "ಬೆಳೆ ಮತ್ತು ಬಿತ್ತನೆ ದಿನಾಂಕ ಉಳಿಸಿ — ನಿಮ್ಮ ಜಮೀನು ಜೀವಂತವಾಗುತ್ತದೆ.",
  dfSoilNoData: "N, P, K ಮತ್ತು pH ನ ನಿಖರವಾದ ಮೌಲ್ಯಗಳಿಗೆ ಮಣ್ಣಿನ ಪರೀಕ್ಷೆ ಬೇಕು.",
  dfSoilInfo: "ಸ್ಥಳ ಆಧಾರಿತ ಮಣ್ಣಿನ ಗುಣಲಕ್ಷಣಗಳು — ಸಾಮಾನ್ಯ ಮಾಹಿತಿ, ನಿಖರವಲ್ಲ",
  dfInfoAge: "ವಯಸ್ಸು: {day} ದಿನ",
  dfInfoStatus: "ಸ್ಥಿತಿ: {status}",
  dfInfoSoil: "ಮಣ್ಣು: ಅಳೆದ N-P-K ಇಲ್ಲ — ಮಣ್ಣಿನ ಪರೀಕ್ಷೆ ಬೇಕು",
  calSowingDate: "ಬಿತ್ತನೆ ದಿನಾಂಕ",
  calDayN: "{day} ದಿನ",
''',
    ),
    # ---- hi: after hi dfClickHint line -----------------------------------
    (
        '  dfClickHint: "फसल, पानी, मिट्टी या घर पर क्लिक करें",',
        '''  dfNoCrop: "फसल और बुवाई की तारीख सहेजें — आपका खेत जीवंत हो उठेगा.",
  dfSoilNoData: "N, P, K और pH के सटीक मूल्यों के लिए मिट्टी परीक्षण आवश्यक है.",
  dfSoilInfo: "स्थान आधारित मिट्टी विशेषताएं — सामान्य जानकारी, सटीक नहीं",
  dfInfoAge: "उम्र: {day} दिन",
  dfInfoStatus: "स्थिति: {status}",
  dfInfoSoil: "मिट्टी: मापी गई N-P-K नहीं — मिट्टी परीक्षण आवश्यक",
  calSowingDate: "बुवाई की तारीख",
  calDayN: "दिन {day}",
''',
    ),
]

out = src
for anchor, add in EDITS:
    if anchor not in out:
        print("ANCHOR NOT FOUND:", anchor[:60])
        sys.exit(1)
    out = out.replace(anchor, anchor + "\n" + add.rstrip("\n"), 1)

open(P, "w", encoding="utf-8").write(out)
print("inserted OK")
