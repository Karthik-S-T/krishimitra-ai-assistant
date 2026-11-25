"""
KrishiMitra AI — trains the real scikit-learn crop model.

Downloads the standard 22-crop Crop Recommendation dataset
(2,200 records x 8 columns), cross-validates a Gaussian Naive Bayes
classifier, and saves the fitted model + class list to models/crop_nb.pkl.

    python train_crop_model.py
"""
from __future__ import annotations

import os

import joblib
import pandas as pd
from sklearn.model_selection import ShuffleSplit, cross_val_score
from sklearn.naive_bayes import GaussianNB
from sklearn.preprocessing import LabelEncoder

DATASET_URL = (
    "https://raw.githubusercontent.com/Gladiator07/Harvestify/"
    "master/Data-processed/crop_recommendation.csv"
)
OUT_PATH = os.path.join("models", "crop_nb.pkl")


def main() -> None:
    print(f"Downloading dataset: {DATASET_URL}")
    df = pd.read_csv(DATASET_URL)
    print(f"Loaded {len(df)} records, {df['label'].nunique()} crop classes")

    X = df.drop(columns=["label"])
    y = LabelEncoder().fit_transform(df["label"])

    model = GaussianNB()
    cv = ShuffleSplit(n_splits=5, test_size=0.2, random_state=42)
    scores = cross_val_score(model, X, y, cv=cv)
    print(f"5-fold CV accuracy: {scores.mean():.4f} (+/- {scores.std():.4f})")

    model.fit(X, y)
    classes = LabelEncoder().fit(df["label"]).classes_.tolist()

    os.makedirs("models", exist_ok=True)
    joblib.dump({"model": model, "classes": classes}, OUT_PATH)
    print(f"Saved {OUT_PATH} — app.py will now use the trained sklearn model.")


if __name__ == "__main__":
    main()
