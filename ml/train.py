import os
import pandas as pd
from joblib import dump

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# LIAR columns (tab-separated, no header)
COLS = [
    "id", "label", "statement", "subject", "speaker", "job_title",
    "state", "party", "barely_true_counts", "false_counts",
    "half_true_counts", "mostly_true_counts", "pants_on_fire_counts",
    "context"
]

# Map 6-class LIAR labels into binary
POS = {"true", "mostly-true"}  # more reliable-ish
NEG = {"false", "pants-fire", "barely-true", "half-true"}  # misleading-ish

def load_split(path: str) -> pd.DataFrame:
    df = pd.read_csv(path, sep="\t", header=None, names=COLS, dtype=str)
    df["statement"] = df["statement"].fillna("").astype(str)
    df["label"] = df["label"].fillna("").astype(str).str.strip()

    df = df[df["label"].isin(POS | NEG)].copy()
    df["y"] = df["label"].apply(lambda x: 1 if x in POS else 0)
    return df[["statement", "y"]]

def main():
    train_df = load_split(os.path.join(DATA_DIR, "train.tsv"))
    valid_df = load_split(os.path.join(DATA_DIR, "valid.tsv"))
    test_df  = load_split(os.path.join(DATA_DIR, "test.tsv"))

    # train on train+valid, evaluate on test
    X_train = pd.concat([train_df["statement"], valid_df["statement"]], ignore_index=True)
    y_train = pd.concat([train_df["y"], valid_df["y"]], ignore_index=True)
    X_test = test_df["statement"]
    y_test = test_df["y"]

    model = Pipeline([
        ("tfidf", TfidfVectorizer(
            lowercase=True,
            stop_words="english",
            ngram_range=(1, 2),
            max_features=50000
        )),
        ("clf", LogisticRegression(
            max_iter=2000,
            class_weight="balanced"
        ))
    ])

    model.fit(X_train, y_train)
    pred = model.predict(X_test)

    print(classification_report(y_test, pred, target_names=["fake-ish", "true-ish"]))

    out_dir = os.path.join(os.path.dirname(__file__), "artifacts")
    os.makedirs(out_dir, exist_ok=True)

    out_path = os.path.join(out_dir, "liar_tfidf_logreg.joblib")
    dump(model, out_path)
    print("Saved:", out_path)

if __name__ == "__main__":
    main()
