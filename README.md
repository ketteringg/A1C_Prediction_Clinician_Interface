# Diabetes Glycemic Control Dashboard

A clinician-facing tool that predicts which patients are at risk of dangerous HbA1c levels in the coming year, built for the WashU I2DB Datathon.

**Live demo:** [Diabetes A1C Prediction Dashboard](https://a1-c-prediction-interface-clinician-zeta.vercel.app/login?next=%2F)

> **All data shown in the live demo is artificially generated.** `app/dashboard/data.js` contains 1,000 fabricated patients with clinically plausible distributions, scored through the actual trained CatBoost model. No real patient data, rows, or IDs are committed to this repo or displayed anywhere in the dashboard.

## The problem

HbA1c is a blood test that measures blood sugar control over time, and it's the primary way clinicians track whether a diabetic patient's condition is managed. This model predicts, using a patient's 2024 electronic health record data, whether they're likely to have a dangerous HbA1c reading in 2025, so care teams can flag and follow up with at-risk patients before that happens.

## Why this isn't just a modeling exercise

The clinical data behind this project was messy in the usual ways, but one issue mattered more than the rest: 43% of the cohort had no recorded HbA1c test in 2025 at all, and the dataset's labeling convention marked every one of those patients as "controlled" by default. That's not a neutral assumption. A patient with no test result isn't necessarily fine, they may simply not have come in.

Training on that convention produces a model that looks excellent and isn't. Our most accurate version scored an AUC of about 0.95, but that number was inflated by nearly half the cohort being labeled "controlled" for having skipped a test rather than for any clinical reason. We treated that as a flaw in the label, not a result to report, and made a few deliberate choices instead of optimizing around it:

- **We trained only on the 57% of the cohort with real 2025 test data**, then applied the resulting model to the full cohort. The model that shipped scored an AUC of about 0.88, lower than the 0.95 version, and we chose it anyway because it was trained on ground truth rather than a labeling artifact.
- **We used a single CatBoost model instead of an ensemble.** The ensemble added negligible predictive power over CatBoost alone, at meaningfully higher compute cost and with murkier explainability, both real costs for a model meant to plug into hospital EHR infrastructure someday, not just perform well in a notebook.
- **We binned risk into four tiers (low, moderate, high, extremely high) instead of a binary controlled/uncontrolled call**, and biased the binning aggressively toward flagging risk. A single A1c reading is one point on a longer trajectory, a patient who's controlled today can deteriorate by their next visit, and the cost of a false positive here is a follow-up call, while the cost of a false negative is a missed deterioration. Those aren't symmetric, so the model isn't tuned as if they were.

## Dashboard features

- Risk-tier view (low / moderate / high / extremely high) across the patient panel
- Automatic follow-up flagging: patients with no recorded 2025 test **and** an elevated risk score are flagged `Urgent: Schedule Follow-Up` rather than silently defaulted to "controlled"
- Per-patient breakdown of the top contributing factors behind each risk score

## Model summary

- **Model:** CatBoost, 500 iterations, depth 5, learning rate 0.03
- **Features:** 25 engineered (A1c trajectory stats, medication orders, demographics, ADI)
- **Decision threshold:** 0.1725
- **AUC:** 0.889 (training, evaluated only on patients with real 2025 labels)

## Running locally

```bash
git clone https://github.com/ketteringg/A1C_Prediction_Clinician_Interface.git
cd A1C_Prediction_Clinician_Interface
npm install
cp .env.example .env.local   # edit with your chosen credentials
npm run dev
```

Open `http://localhost:3000`. You'll be redirected to `/login`.

To deploy your own copy: push to GitHub, import into Vercel (it auto-detects Next.js), and set `AUTH_USER` and `AUTH_PASS` as environment variables under Project Settings. Authentication runs entirely server-side via `middleware.js`, credentials never reach the browser bundle.

## Project layout

```
.
├── package.json
├── middleware.js              # auth gate on every request
├── .env.example
├── .gitignore
├── README.md
└── app/
    ├── layout.jsx
    ├── page.jsx               # → redirects to /dashboard
    ├── login/page.jsx         # login UI
    ├── api/
    │   ├── login/route.js     # validates credentials, sets cookie
    │   └── logout/route.js    # clears cookie
    └── dashboard/
        ├── page.jsx           # dashboard wrapper with logout button
        ├── App.jsx            # main React dashboard (client component)
        └── data.js            # 1,000 synthetic patients
```

## Context

Built for the WashU I2DB Datathon, where I led the team. Full pipeline and training code: `DM_Glycemic_Control_Full_Pipeline.ipynb`.
