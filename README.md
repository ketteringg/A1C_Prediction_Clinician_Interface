# Diabetes Glycemic Control Prediction Pipeline and Clinician Dashboard

An end-to-end machine-learning project that predicts which patients with diabetes are at risk of uncontrolled HbA1c in the following year and translates those predictions into a clinician-facing dashboard.

Built for the 2026 Washington University Institute for Informatics, Data Science and Biostatistics Datathon.

## Project components

This repository contains both the analytical pipeline and the clinical application:

### 1. Python machine-learning pipeline

[`diabetes_a1c_prediction_pipeline.ipynb`](./diabetes_a1c_prediction_pipeline.ipynb) contains the complete analytical workflow, including:

* Data loading and descriptive analysis
* Missingness and label-quality investigation
* Clinical data cleaning
* Feature engineering from 97 candidate features to 25 retained features
* Comparison of six statistical and machine-learning models
* Stratified five-fold cross-validation
* Permutation-importance analysis and feature reduction
* CatBoost model training
* Out-of-fold threshold selection
* Calibration and performance evaluation
* Honest versus artifact-inflated AUC comparison
* Patient-level risk scoring

### 2. Clinician-facing dashboard

The `app/` directory contains a Next.js application that presents model predictions in a workflow designed for clinical review.

**Live demonstration:** [Diabetes A1C Prediction Dashboard](https://a1-c-prediction-interface-clinician-zeta.vercel.app/login?next=%2F)

> **All patient data shown in the public dashboard is artificially generated.** The application contains 1,000 fabricated patients with clinically plausible distributions that were scored using the trained CatBoost model. No real patient rows, identifiers, or protected health information are committed to this repository or displayed in the application.

## Clinical problem

HbA1c reflects average blood glucose over time and is one of the primary measures used to evaluate diabetes control.

The goal of this project was to use 12 months of prior electronic health record data to predict whether a patient would have uncontrolled HbA1c, defined as greater than 8%, during the following year.

The intended use case is prospective care management. Rather than waiting for a future laboratory result, a clinical team could identify patients whose prior laboratory history, medications, utilization, demographics, and other characteristics suggest elevated risk of deterioration.

## The central data-quality finding

The most important result was not the highest-performing model.

Approximately 43% of the cohort had no recorded HbA1c measurement during the outcome year. The supplied labeling convention classified every one of those patients as controlled by default.

That assumption was not clinically neutral. A missing future measurement does not establish that a patient's diabetes remained controlled. It may instead reflect incomplete follow-up, fragmented care, or an unobserved outcome.

Training directly on that convention produced an apparently stronger model with an AUC of approximately 0.95. Much of that performance came from learning the dataset's labeling rule rather than learning genuine clinical risk.

We therefore made several deliberate modeling decisions:

1. **Train on observed outcomes.**
   Model development was restricted to patients with an actual outcome-year HbA1c measurement.

2. **Score the broader cohort honestly.**
   The trained model was applied to the full cohort without automatically assigning patients with missing follow-up measurements a zero-risk probability.

3. **Prefer the defensible model.**
   The selected model had lower apparent performance than the artifact-driven alternative, but its validation reflected observed clinical outcomes rather than a hardcoded missingness rule.

4. **Preserve missing follow-up as an actionable signal.**
   Patients with elevated predicted risk and no recorded follow-up measurement are flagged for scheduling rather than silently labeled controlled.

This choice reflects the central principle of the project: a lower but credible performance estimate is more valuable than a higher metric produced by an invalid target definition.

## Machine-learning pipeline

The Python notebook evaluates six approaches:

* Linear regression
* Logistic regression
* Random forest
* LightGBM
* XGBoost
* CatBoost

Models were compared using stratified five-fold cross-validation. CatBoost was selected based on predictive performance, ability to handle mixed clinical features, and suitability for patient-level interpretation.

The pipeline also includes:

* Clinical binning and descriptive statistics
* Missingness profiling
* A1c trajectory engineering
* Medication, utilization, demographic, and area-level features
* Feature reduction using permutation importance
* Out-of-fold probability generation
* ROC and precision-recall evaluation
* Calibration assessment
* Clinically informed threshold analysis
* Reusable training and prediction functions

## Validation summary

* **Development cohort:** 62,425 patients
* **Model:** CatBoost
* **Cross-validation:** Stratified five-fold
* **Retained features:** 25
* **Mean cross-validated ROC-AUC:** 0.8759
* **Sensitivity:** 83.3%
* **Negative predictive value:** 95.3%
* **Decision threshold:** 0.1725

The decision threshold was selected from out-of-fold predictions with additional emphasis on sensitivity because false negatives carry a greater clinical cost in a prospective care-management setting.

## Why CatBoost instead of an ensemble?

An ensemble produced only a small performance improvement over CatBoost alone while adding computational cost and reducing interpretability.

Because the intended use case involves integration into clinical workflows, the team prioritized:

* Reproducibility
* Efficient scoring
* Transparent feature contributions
* Easier maintenance
* Clinically useful sensitivity
* Honest validation

The final result was therefore based on a single CatBoost model rather than a more complex ensemble.

## Dashboard functionality

The clinician-facing application includes:

* Patient search and filtering
* Low, moderate, high, and extremely high risk tiers
* Sorting by predicted risk
* Patient-level contributing factors
* Follow-up status indicators
* Pagination across the patient panel
* Automatic scheduling flags for elevated-risk patients without recorded follow-up testing
* A lightweight server-side access gate for the public demonstration

The access gate is intended only to limit casual access to the demonstration. It is not presented as production-grade healthcare authentication. A production deployment would require an established identity provider, signed sessions, role-based authorization, audit logging, and integration with the host organization's security infrastructure.

## Technology

### Machine learning and analysis

* Python
* pandas
* NumPy
* scikit-learn
* CatBoost
* LightGBM
* XGBoost
* Matplotlib
* Google Colab

### Clinical application

* React
* Next.js
* JavaScript
* Vercel

## Repository structure

```text
.
├── diabetes_a1c_prediction_pipeline.ipynb  # complete Python ML workflow
├── README.md
├── package.json
├── middleware.js                           # lightweight demonstration access gate
├── .env.example
├── .gitignore
└── app/
    ├── layout.jsx
    ├── page.jsx                            # redirects to /dashboard
    ├── login/
    │   └── page.jsx                        # demonstration login interface
    ├── api/
    │   ├── login/
    │   │   └── route.js                    # validates demo credentials
    │   └── logout/
    │       └── route.js                    # clears the session cookie
    └── dashboard/
        ├── page.jsx                        # dashboard wrapper
        ├── App.jsx                         # primary React dashboard
        └── data.js                         # 1,000 fully synthetic patients
```

## Reviewing the machine-learning work

The fastest way to review the analytical work is to open:

[`diabetes_a1c_prediction_pipeline.ipynb`](./diabetes_a1c_prediction_pipeline.ipynb)

The notebook is organized into sequential phases covering:

1. Setup and data loading
2. Descriptive statistics
3. Data-quality investigation
4. Cleaning and feature engineering
5. Six-model comparison
6. Feature reduction
7. CatBoost validation
8. Threshold and calibration analysis
9. Final model training
10. Honest versus artifact-inflated performance comparison

The original datathon CSV files are not included in this public repository. The notebook is provided to document the complete Python workflow, modeling decisions, and validation methodology without publishing patient-level source records.

## Running the dashboard locally

```bash
git clone https://github.com/ketteringg/A1C_Prediction_Clinician_Interface.git
cd A1C_Prediction_Clinician_Interface

npm install
cp .env.example .env.local
npm run dev
```

Edit `.env.local` with demonstration credentials before starting the application.

Then open:

```text
http://localhost:3000
```

The application will redirect to the login page.

## Deployment

To deploy a separate demonstration:

1. Fork or clone the repository.
2. Import the repository into Vercel.
3. Add `AUTH_USER` and `AUTH_PASS` under the Vercel environment-variable settings.
4. Deploy the Next.js application.

The demonstration credentials are validated server-side and are not included in the browser bundle.

## Limitations

This project is a research and portfolio demonstration, not a validated medical device.

Important limitations include:

* The public dashboard uses synthetic patient data.
* The model was developed using a datathon dataset rather than a prospective clinical implementation.
* Performance has not been externally validated at another institution.
* Missing outcome-year measurements create uncertainty that cannot be resolved through modeling alone.
* Predicted risk should support clinical review, not replace professional judgment.
* A production implementation would require prospective validation, bias assessment, monitoring, governance, security review, and EHR integration.

## Project context

This project was completed by the **Me, Myself, and AI** team for the WashU I2DB Datathon.

**Team members:**

* Gabriel Kettering
* Susie Kim
* Rishab Haldar
* Anthony Kirchner

I led the project and focused on the modeling strategy, data-quality investigation, validation decisions, and translation of patient-level predictions into a clinician-facing application.
