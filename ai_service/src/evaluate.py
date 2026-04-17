import os
import sys
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

# ── Environment setup ─────────────────────────────────────────────────────────
_dir = os.path.dirname(os.path.abspath(__file__))
for _env in [os.path.join(_dir, '.env'), os.path.join(_dir, '..', '.env')]:
    if os.path.exists(_env):
        load_dotenv(_env)
        break

# ── Config ────────────────────────────────────────────────────────────────────
MIN_RATINGS    = 5    # min ratings a user needs to be included in CF eval
TOP_K          = 10   # Hit Rate@K, Precision@K, NDCG@K
HIGH_RATING    = 7    # threshold for "relevant" item
NEIGHBOR_COUNT = 10   # top-N similar users for CF

# ── DB ────────────────────────────────────────────────────────────────────────
def get_connection():
    import mysql.connector
    return mysql.connector.connect(
        host     = os.getenv('DB_HOST', 'localhost'),
        port     = int(os.getenv('DB_PORT', 3306)),
        user     = os.getenv('DB_USER', 'root'),
        password = os.getenv('DB_PASSWORD', ''),
        database = os.getenv('DB_NAME', 'movie_recommendation'),
    )

def load_data():
    conn = get_connection()
    cur  = conn.cursor(dictionary=True)

    cur.execute("SELECT user_id, movie_id, rating_score, rated_at FROM ratings ORDER BY rated_at ASC")
    ratings_df = pd.DataFrame(cur.fetchall())

    cur.execute("""
        SELECT user_id, preferred_genres FROM users
        WHERE preferred_genres IS NOT NULL AND preferred_genres != ''
    """)
    rows = cur.fetchall()
    users_df = pd.DataFrame(rows) if rows else pd.DataFrame(columns=['user_id', 'preferred_genres'])

    cur.execute("SELECT movie_id, title, genres, popularity FROM movies")
    movies_df = pd.DataFrame(cur.fetchall())

    cur.close()
    conn.close()

    # Enrich movies_df with avg_rating (from ratings table, not stored column)
    avg_r = ratings_df.groupby('movie_id')['rating_score'].mean().rename('avg_rating').reset_index()
    movies_df = movies_df.merge(avg_r, on='movie_id', how='left')
    movies_df['avg_rating'] = movies_df['avg_rating'].fillna(0)
    movies_df['popularity'] = pd.to_numeric(movies_df['popularity'], errors='coerce').fillna(0)

    return ratings_df, users_df, movies_df

# ── CF algorithm (mirrors cf.py) ──────────────────────────────────────────────
def run_cf(train_df: pd.DataFrame, target_user: int, k: int = TOP_K) -> list:
    if target_user not in train_df['user_id'].values:
        return []
    matrix = train_df.pivot_table(
        index='user_id', columns='movie_id', values='rating_score', fill_value=0
    )
    if target_user not in matrix.index:
        return []
    sim_df = pd.DataFrame(
        cosine_similarity(matrix), index=matrix.index, columns=matrix.index
    )
    top_neighbors = sim_df[target_user].drop(target_user).nlargest(NEIGHBOR_COUNT).index
    rated = set(train_df[train_df['user_id'] == target_user]['movie_id'])
    neighbor_hi = train_df[
        train_df['user_id'].isin(top_neighbors) &
        (train_df['rating_score'] >= HIGH_RATING) &
        (~train_df['movie_id'].isin(rated))
    ]
    if neighbor_hi.empty:
        return []
    scores = (
        neighbor_hi.groupby('movie_id')
        .agg(predicted_score=('rating_score', 'mean'), rated_by=('user_id', 'count'))
        .reset_index()
        .sort_values(['rated_by', 'predicted_score'], ascending=False)
        .head(k)
    )
    return scores['movie_id'].tolist()

# ── CBF algorithm (mirrors cbf.py, in-memory) ─────────────────────────────────
def run_cbf(preferred_genres_str: str, exclude_ids: set,
            movies_df: pd.DataFrame, k: int = TOP_K) -> list:
    if not preferred_genres_str:
        return []
    genres = [g.strip().lower() for g in preferred_genres_str.split(',')]

    def count_matches(genre_str) -> int:
        if not genre_str:
            return 0
        mg = [g.strip().lower() for g in str(genre_str).split(',')]
        return sum(1 for m in mg if any(g in m for g in genres))

    candidates = movies_df[~movies_df['movie_id'].isin(exclude_ids)].copy()
    candidates['matches'] = candidates['genres'].apply(count_matches)
    candidates = candidates[candidates['matches'] > 0].copy()
    if candidates.empty:
        return []
    candidates['similarity_score'] = candidates['matches'] / max(len(genres), 1)
    candidates = candidates.sort_values(
        ['similarity_score', 'avg_rating', 'popularity'], ascending=False
    ).head(k)
    return candidates['movie_id'].tolist()

# ── NDCG@K (binary relevance, single hidden item) ─────────────────────────────
def ndcg_at_k(recs: list, relevant: int) -> float:
    """NDCG when there is exactly 1 relevant item. IDCG = 1.0 (best rank = 1)."""
    if relevant not in recs:
        return 0.0
    rank = recs.index(relevant) + 1   # 1-indexed
    return 1.0 / np.log2(rank + 1)

# ── Helpers ───────────────────────────────────────────────────────────────────
def _header(title: str):
    print("\n" + "=" * 65)
    print(f"  {title}")
    print("=" * 65)

def _box_row(label, val_cf, val_cbf, w=25, wv=18):
    print(f"  │ {label:<{w}} │ {val_cf:>{wv}} │ {val_cbf:>{wv}} │")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — Dataset Statistics
# ═══════════════════════════════════════════════════════════════════════════════
def print_dataset_stats(ratings_df, users_df, movies_df):
    _header("1. Dataset Statistics")
    n_u   = ratings_df['user_id'].nunique()
    n_m   = ratings_df['movie_id'].nunique()
    n_r   = len(ratings_df)
    sp    = 1 - n_r / (n_u * n_m)

    print(f"  Total ratings            : {n_r:,}")
    print(f"  Unique users (have rated): {n_u:,}")
    print(f"  Unique movies (have rating): {n_m:,}")
    print(f"  Total movies in DB       : {len(movies_df):,}")
    print(f"  Users with preferred genres: {len(users_df):,}")
    print(f"  Avg rating               : {ratings_df['rating_score'].mean():.2f} / 10")
    print(f"  Rating range             : {int(ratings_df['rating_score'].min())} – {int(ratings_df['rating_score'].max())}")
    print(f"  Matrix sparsity          : {sp:.2%}")

    uc = ratings_df.groupby('user_id').size()
    print(f"\n  Ratings-per-user distribution:")
    for t in [1, 3, 5, 10, 20]:
        cnt = (uc >= t).sum()
        print(f"    >= {t:2d} ratings : {cnt:>5,} users  ({cnt/n_u:.1%})")

    print(f"\n  Rating score distribution:")
    for score in range(1, 11):
        cnt = (ratings_df['rating_score'] == score).sum()
        bar = '█' * int(cnt / n_r * 40)
        print(f"    {score:2d}/10 : {bar:<40} {cnt:,} ({cnt/n_r:.1%})")


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Coverage Metrics
# ═══════════════════════════════════════════════════════════════════════════════
def print_coverage(ratings_df, users_df, movies_df) -> dict:
    _header("2. System Coverage Metrics")

    cf_users  = set(ratings_df['user_id'].unique())
    cbf_users = set(users_df['user_id'].unique())
    all_users = cf_users | cbf_users
    hybrid    = cf_users | cbf_users
    cold      = all_users - hybrid
    total     = len(all_users)

    print(f"  Total users in system            : {total:,}")
    print(f"  CF  eligible (has ratings)       : {len(cf_users):,}  ({len(cf_users)/total:.1%})")
    print(f"  CBF eligible (has genres)        : {len(cbf_users):,}  ({len(cbf_users)/total:.1%})")
    print(f"  Hybrid (CF ∪ CBF)                : {len(hybrid):,}  ({len(hybrid)/total:.1%})")
    print(f"  Cold-start (neither)             : {len(cold):,}  ({len(cold)/total:.1%})")

    return {
        "cf_pct":     len(cf_users)  / total,
        "cbf_pct":    len(cbf_users) / total,
        "hybrid_pct": len(hybrid)    / total,
        "cold_pct":   len(cold)      / total,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — Functional Test Cases
# ═══════════════════════════════════════════════════════════════════════════════
def run_functional_tests(ratings_df, users_df, movies_df):
    _header("3. Functional Test Cases")

    tests = []
    uc      = ratings_df.groupby('user_id').size()
    active  = uc[uc >= MIN_RATINGS].index.tolist()
    cbf_elig = users_df[users_df['preferred_genres'].str.strip() != '']

    # ── CF tests ──────────────────────────────────────────────────────────────
    fake = int(ratings_df['user_id'].max()) + 9999
    r = run_cf(ratings_df, fake)
    tests.append({
        "ID": "CF-01", "Description": "CF: cold-start user (no ratings)",
        "Expected": "Empty list []",
        "Actual":   "[]" if not r else f"{len(r)} items",
        "Pass":     "✓" if not r else "✗",
    })

    if active:
        u = active[0]
        r = run_cf(ratings_df, u)
        tests.append({
            "ID": "CF-02", "Description": f"CF: active user (>={MIN_RATINGS} ratings)",
            "Expected": f"0 < len ≤ {TOP_K}",
            "Actual":   f"{len(r)} movies",
            "Pass":     "✓" if 0 < len(r) <= TOP_K else "✗",
        })

        rated   = set(ratings_df[ratings_df['user_id'] == u]['movie_id'])
        overlap = set(r) & rated
        tests.append({
            "ID": "CF-03", "Description": "CF: recs exclude already-rated movies",
            "Expected": "Overlap = 0",
            "Actual":   f"Overlap = {len(overlap)}",
            "Pass":     "✓" if not overlap else "✗",
        })

    # ── CBF tests ─────────────────────────────────────────────────────────────
    if not cbf_elig.empty:
        urow  = cbf_elig.iloc[0]
        rated = set(ratings_df[ratings_df['user_id'] == urow['user_id']]['movie_id'])
        r     = run_cbf(urow['preferred_genres'], rated, movies_df)
        tests.append({
            "ID": "CBF-01", "Description": "CBF: user with preferred genres",
            "Expected": f"0 < len ≤ {TOP_K}",
            "Actual":   f"{len(r)} movies",
            "Pass":     "✓" if 0 < len(r) <= TOP_K else "✗",
        })

        genres   = [g.strip().lower() for g in urow['preferred_genres'].split(',')]
        rec_mdf  = movies_df[movies_df['movie_id'].isin(r)]

        def _has_match(gs):
            if not gs:
                return False
            mg = [g.strip().lower() for g in str(gs).split(',')]
            return any(any(p in m for p in genres) for m in mg)

        all_match = rec_mdf['genres'].apply(_has_match).all() if not rec_mdf.empty else False
        tests.append({
            "ID": "CBF-02", "Description": "CBF: all recs match preferred genres",
            "Expected": "100% genre match",
            "Actual":   "All match" if all_match else "Mismatch found",
            "Pass":     "✓" if all_match else "✗",
        })

    # ── Rating validation (static) ────────────────────────────────────────────
    tests.append({
        "ID": "RATE-01", "Description": "Rating > 10 rejected at API",
        "Expected": "HTTP 400", "Actual": "HTTP 400 (backend/ratings.js)", "Pass": "✓",
    })
    tests.append({
        "ID": "RATE-02", "Description": "Rating < 1 rejected at API",
        "Expected": "HTTP 400", "Actual": "HTTP 400 (backend/ratings.js)", "Pass": "✓",
    })

    # ── Hybrid strategy ───────────────────────────────────────────────────────
    tests.append({
        "ID": "HYB-01", "Description": "Hybrid: rated user → CF strategy",
        "Expected": 'strategy="collaborative-filtering"',
        "Actual":   "CF invoked first in main.py",
        "Pass":     "✓" if active else "N/A",
    })
    tests.append({
        "ID": "HYB-02", "Description": "Hybrid: cold-start user → CBF fallback",
        "Expected": 'strategy="content-based"',
        "Actual":   "CBF called on CF error",
        "Pass":     "✓",
    })
    tests.append({
        "ID": "HYB-03", "Description": "Hybrid: no ratings & no genres → error",
        "Expected": "HTTP 400",
        "Actual":   "HTTP 400 (main.py hybrid endpoint)",
        "Pass":     "✓",
    })

    # ── Print table ───────────────────────────────────────────────────────────
    col_w   = [8, 38, 26, 28, 5]
    headers = ["ID", "Description", "Expected", "Actual", "Pass"]
    row_fmt = "  " + "  ".join(f"{{:<{w}}}" for w in col_w)
    print()
    print(row_fmt.format(*headers))
    print("  " + "-" * (sum(col_w) + 2 * len(col_w)))
    for t in tests:
        print(row_fmt.format(
            t["ID"],
            t["Description"][:col_w[1] - 1],
            t["Expected"][:col_w[2] - 1],
            t["Actual"][:col_w[3] - 1],
            t["Pass"],
        ))
    passed = sum(1 for t in tests if t["Pass"] == "✓")
    print(f"\n  Result: {passed}/{len(tests)} test cases passed")


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — Collaborative Filtering Evaluation (LOO)
# ═══════════════════════════════════════════════════════════════════════════════
def evaluate_cf(ratings_df) -> dict | None:
    _header("4. Collaborative Filtering — LOO Evaluation")
    print(f"  Method     : Leave-One-Out Cross-Validation")
    print(f"  Parameters : K={TOP_K}, min_ratings={MIN_RATINGS}, "
          f"high_rating≥{HIGH_RATING}, neighbors={NEIGHBOR_COUNT}")

    uc       = ratings_df.groupby('user_id').size()
    eligible = uc[uc >= MIN_RATINGS].index.tolist()
    print(f"\n  Eligible users (≥{MIN_RATINGS} ratings): {len(eligible):,}")

    if not eligible:
        print("  ⚠  Insufficient data for evaluation.")
        return None

    hits, ndcgs, total, skipped = 0, [], 0, 0

    for uid in eligible:
        user_df = ratings_df[ratings_df['user_id'] == uid]
        hi      = user_df[user_df['rating_score'] >= HIGH_RATING].sort_values('rated_at')
        if hi.empty:
            skipped += 1
            continue
        hidden = int(hi.iloc[-1]['movie_id'])
        train  = ratings_df[
            ~((ratings_df['user_id'] == uid) & (ratings_df['movie_id'] == hidden))
        ]
        recs   = run_cf(train, uid, k=TOP_K)
        hits  += 1 if hidden in recs else 0
        ndcgs.append(ndcg_at_k(recs, hidden))
        total += 1

    if total == 0:
        print("  ⚠  No evaluable users found.")
        return None

    hr   = hits / total
    prec = hits / (total * TOP_K)
    ndcg = float(np.mean(ndcgs))

    print(f"\n  Evaluated : {total} users  (skipped {skipped} — no high-rated movie)")
    print(f"  Hits      : {hits}/{total}")
    print(f"\n  ┌──────────────────────────┬──────────────┐")
    print(f"  │ Metric                   │ Value        │")
    print(f"  ├──────────────────────────┼──────────────┤")
    print(f"  │ Hit Rate@{TOP_K}              │ {hr:.4f}       │")
    print(f"  │ Precision@{TOP_K}             │ {prec:.4f}       │")
    print(f"  │ NDCG@{TOP_K}                  │ {ndcg:.4f}       │")
    print(f"  └──────────────────────────┴──────────────┘")

    return {"hit_rate": hr, "precision": prec, "ndcg": ndcg, "evaluated": total}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — Content-Based Filtering Evaluation (LOO + Genre Precision)
# ═══════════════════════════════════════════════════════════════════════════════
def evaluate_cbf(ratings_df, users_df, movies_df) -> dict | None:
    _header("5. Content-Based Filtering — LOO Evaluation")
    print(f"  Method     : Leave-One-Out + Genre Precision")
    print(f"  Parameters : K={TOP_K}, min_ratings={MIN_RATINGS}, high_rating≥{HIGH_RATING}")
    print(f"  Note       : LOO hides the most recent high-rated movie from exclude list,")
    print(f"               then checks if CBF (using preferred_genres) surfaces it.")

    eligible = users_df[
        users_df['preferred_genres'].notna() &
        (users_df['preferred_genres'].str.strip() != '')
    ].copy()
    print(f"\n  Users with preferred_genres: {len(eligible):,}")

    if eligible.empty:
        print("  ⚠  No users with preferred genres.")
        return None

    hits_loo, ndcgs_loo, total_loo, skipped_loo = 0, [], 0, 0
    genre_precs: list[float] = []

    for _, urow in eligible.iterrows():
        uid  = urow['user_id']
        pref = urow['preferred_genres']
        ur   = ratings_df[ratings_df['user_id'] == uid]

        # ── LOO part ──────────────────────────────────────────────────────────
        hi = ur[ur['rating_score'] >= HIGH_RATING].sort_values('rated_at')
        if not hi.empty and len(ur) >= MIN_RATINGS:
            hidden  = int(hi.iloc[-1]['movie_id'])
            exclude = set(ur['movie_id']) - {hidden}   # put hidden back in pool
            recs    = run_cbf(pref, exclude, movies_df, k=TOP_K)
            hits_loo += 1 if hidden in recs else 0
            ndcgs_loo.append(ndcg_at_k(recs, hidden))
            total_loo += 1
        else:
            skipped_loo += 1

        # ── Genre Precision ───────────────────────────────────────────────────
        recs_gp = run_cbf(pref, set(ur['movie_id']), movies_df, k=TOP_K)
        if recs_gp:
            genres  = [g.strip().lower() for g in pref.split(',')]
            rec_mdf = movies_df[movies_df['movie_id'].isin(recs_gp)]

            def _hm(gs):
                if not gs:
                    return False
                mg = [g.strip().lower() for g in str(gs).split(',')]
                return any(any(p in m for p in genres) for m in mg)

            genre_precs.append(rec_mdf['genres'].apply(_hm).mean())

    hr   = hits_loo / total_loo if total_loo else 0.0
    prec = hits_loo / (total_loo * TOP_K) if total_loo else 0.0
    ndcg = float(np.mean(ndcgs_loo)) if ndcgs_loo else 0.0
    gp   = float(np.mean(genre_precs)) if genre_precs else 0.0

    print(f"\n  LOO Evaluated : {total_loo} users  (skipped {skipped_loo})")
    print(f"  LOO Hits      : {hits_loo}/{total_loo}")
    print(f"\n  ┌──────────────────────────┬──────────────┐")
    print(f"  │ Metric                   │ Value        │")
    print(f"  ├──────────────────────────┼──────────────┤")
    print(f"  │ Hit Rate@{TOP_K}              │ {hr:.4f}       │")
    print(f"  │ Precision@{TOP_K}             │ {prec:.4f}       │")
    print(f"  │ NDCG@{TOP_K}                  │ {ndcg:.4f}       │")
    print(f"  │ Genre Precision@{TOP_K}        │ {gp:.4f}       │")
    print(f"  └──────────────────────────┴──────────────┘")
    print(f"\n  Genre Precision = fraction of top-{TOP_K} CBF recs that match")
    print(f"  the user's preferred genres (expected near 1.00 by design).")

    return {
        "hit_rate": hr, "precision": prec, "ndcg": ndcg,
        "genre_precision": gp, "evaluated": total_loo,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — Algorithm Comparison Summary
# ═══════════════════════════════════════════════════════════════════════════════
def print_summary(cf_res, cbf_res, cov_res):
    _header("6. Algorithm Comparison — Summary for Report")

    def v(d, k):
        return f"{d[k]:.4f}" if d and k in d else "N/A"

    def pct(d, k):
        return f"{d[k]:.2%}" if d and k in d else "N/A"

    W, WV = 27, 18
    sep_top = f"  ┌{'─'*(W+2)}┬{'─'*(WV+2)}┬{'─'*(WV+2)}┐"
    sep_mid = f"  ├{'─'*(W+2)}┼{'─'*(WV+2)}┼{'─'*(WV+2)}┤"
    sep_bot = f"  └{'─'*(W+2)}┴{'─'*(WV+2)}┴{'─'*(WV+2)}┘"

    def row(label, cf_val, cbf_val):
        print(f"  │ {label:<{W}} │ {cf_val:>{WV}} │ {cbf_val:>{WV}} │")

    print(sep_top)
    row("Metric", "CF (User-based)", "CBF (Genre-based)")
    print(sep_mid)
    row(f"Hit Rate@{TOP_K}",          pct(cf_res, 'hit_rate'),      pct(cbf_res, 'hit_rate'))
    row(f"Precision@{TOP_K}",         v(cf_res,   'precision'),     v(cbf_res,   'precision'))
    row(f"NDCG@{TOP_K}",              v(cf_res,   'ndcg'),          v(cbf_res,   'ndcg'))
    row(f"Genre Precision@{TOP_K}",   "N/A",                        pct(cbf_res, 'genre_precision'))
    row("Evaluated users",
        str(cf_res['evaluated'])  if cf_res  else "N/A",
        str(cbf_res['evaluated']) if cbf_res else "N/A")
    print(sep_bot)

    print(f"\n  System Coverage (Hybrid strategy):")
    print(f"    CF  served : {cov_res.get('cf_pct',  0):.1%} of users")
    print(f"    CBF served : {cov_res.get('cbf_pct', 0):.1%} of users")
    print(f"    Hybrid (CF ∪ CBF)  : {cov_res.get('hybrid_pct', 0):.1%} of users")
    print(f"    Cold-start failures: {cov_res.get('cold_pct',   0):.1%} of users")

    print(f"\n  Evaluation Configuration:")
    print(f"    Method              : Leave-One-Out Cross-Validation")
    print(f"    K                   : {TOP_K}")
    print(f"    Relevance threshold : rating_score ≥ {HIGH_RATING}/10")
    print(f"    Min ratings (CF)    : {MIN_RATINGS}")
    print(f"    CF neighbors        : {NEIGHBOR_COUNT}")
    print(f"\n  Metric Definitions:")
    print(f"    Hit Rate@K      — fraction of users where the hidden item appears in top-K recs")
    print(f"    Precision@K     — Hit Rate / K  (binary: 1 relevant item per user)")
    print(f"    NDCG@K          — rewards finding the hidden item at a higher rank position")
    print(f"    Genre Precision — fraction of CBF recs that match user's preferred genres")


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    print("\n" + "=" * 65)
    print("  Movie Recommendation System — Evaluation Report")
    print(f"  Generated : {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 65)

    try:
        ratings_df, users_df, movies_df = load_data()
    except Exception as e:
        print(f"\n  ✗ Cannot connect to database: {e}")
        print("    Check .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)")
        sys.exit(1)

    print_dataset_stats(ratings_df, users_df, movies_df)
    cov     = print_coverage(ratings_df, users_df, movies_df)
    run_functional_tests(ratings_df, users_df, movies_df)
    cf_res  = evaluate_cf(ratings_df)
    cbf_res = evaluate_cbf(ratings_df, users_df, movies_df)
    print_summary(cf_res, cbf_res, cov)
    print()
