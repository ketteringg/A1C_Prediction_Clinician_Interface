# Diabetes Glycemic Control Prediction Pipeline

An end-to-end machine-learning project predicting which patients with diabetes are at risk of uncontrolled HbA1c in the following year using longitudinal electronic health record data.

The central challenge was not simply building the most accurate model. It was building what would be most useful and implementable in a clinical setting. Accuracy plays a very large part in the value of a clinical model but is not the sole metric for clinical effectiveness. 

Built for the Washington University Institute for Informatics, Data Science and Biostatistics Datathon.

## Project links

* **Python machine-learning pipeline:** [`diabetes_a1c_prediction_pipeline.ipynb`](./diabetes_a1c_prediction_pipeline.ipynb)
* **Live clinician dashboard:** [Open the deployed application](https://a1-c-prediction-interface-clinician-zeta.vercel.app/login?next=%2F)

The live application can be reviewed directly in a browser. No local setup is required.

> **All patient data displayed in the public dashboard is artificially generated.** The application contains fabricated patients with clinically plausible distributions for model-sharing and demonstration purposes. No real patient rows, identifiers, protected health information, or actual population trends are displayed.

## The modeling problem

The goal was to predict which patients would experience dangerously elevated HbA1c levels in 2025 using their 2024 electronic health record data.

HbA1c is a blood test used to assess average blood glucose control over time, particularly in patients with diabetes. The intended use case was prospective clinical intervention: identifying patients who may need closer monitoring, follow-up testing, or additional support before their condition deteriorates.

The supplied clinical dataset required substantial cleaning, but the most important issue involved the outcome labels.

Approximately 43% of the cohort had no recorded HbA1c measurement in 2025. Under the supplied labeling convention, every one of those patients was deterministically classified as having controlled HbA1c.

That assumption produced a model with an AUC of approximately 0.95.

Normally, an AUC of 0.95 would appear exceptional. In this case, however, much of that performance reflected the model learning a flawed labeling convention rather than learning clinically meaningful risk.

A missing future test does not demonstrate that a patient's HbA1c remained controlled. It may instead indicate incomplete follow-up, fragmented care, loss to follow-up, or an unobserved outcome.

## Why we intentionally submitted a less accurate model

We intentionally submitted a model with an AUC of approximately 0.88 instead of the model with an AUC of approximately 0.95.

This was a principled decision made with clinical implementation as the priority.

Accuracy is not useful when the target used to measure that accuracy is flawed. A model that reproduces an invalid labeling rule may appear highly predictive while being less useful in practice.

To address this issue, we:

1. Trained the model only on the 57% of patients who had an observed HbA1c measurement during the outcome year.
2. Applied the trained model to the full cohort.
3. Preserved missing follow-up testing as clinically relevant information rather than treating it as proof of control.
4. Flagged patients who had elevated predicted risk and no recorded follow-up measurement.
5. Used the dashboard to show both predicted risk and the factors contributing most to each patient's score.

The lower AUC was more credible because it measured prediction against observed clinical outcomes rather than a deterministic missing-data artifact.

## What this repository contains

This repository includes both the full Python machine-learning workflow and a clinician-facing application.

### 1. Python machine-learning pipeline

[`diabetes_a1c_prediction_pipeline.ipynb`](./diabetes_a1c_prediction_pipeline.ipynb) contains the complete analytical workflow, including:

* Data loading and descriptive analysis
* Clinical data cleaning
* Missingness investigation
* Outcome-label auditing
* Feature engineering
* Comparison of six statistical and machine-learning models
* Stratified five-fold cross-validation
* Permutation-importance analysis
* Feature reduction
* CatBoost model training
* Out-of-fold probability generation
* Threshold selection
* ROC and precision-recall evaluation
* Calibration analysis
* Patient-level risk scoring
* Honest versus artifact-inflated performance comparison

### 2. Clinician-facing application

The `app/` directory contains a Next.js dashboard that translates the model outputs into a workflow designed for clinical review.

**[Open the live clinician dashboard](https://a1-c-prediction-interface-clinician-zeta.vercel.app/login?next=%2F)**

The public dashboard uses entirely synthetic patient data and can be reviewed without cloning or running the repository locally.

## Model comparison

The Python pipeline evaluates six approaches:

* Linear regression
* Logistic regression
* Random forest
* LightGBM
* XGBoost
* CatBoost

CatBoost performed best in the model comparisons and was selected as the final model.

## Why we did not use an ensemble

An ensemble model produced only a small improvement in predictive performance compared with CatBoost alone.

We chose not to use the ensemble because the marginal gain did not justify the additional disadvantages:

* Higher computational cost
* Greater deployment complexity
* More difficult maintenance
* Less transparent patient-level explainability
* More complicated integration into a hospital EHR environment

For a model intended to support clinical workflows, predictive performance is only one consideration. Compute requirements, reproducibility, interpretability, maintenance, and implementation burden also matter.

The final model therefore uses CatBoost rather than a more complex ensemble.

## Validation summary

* **Development cohort:** 62,425 patients
* **Model:** CatBoost
* **Cross-validation:** Stratified five-fold
* **Candidate features:** 97
* **Retained features:** 25
* **Mean cross-validated ROC-AUC:** 0.8759
* **Sensitivity:** 83.3%
* **Negative predictive value:** 95.3%
* **Decision threshold:** 0.1725

The decision threshold was selected using out-of-fold predictions with additional emphasis on sensitivity.

In this use case, the potential harm associated with a false negative is greater than the operational burden associated with a false positive. A patient who is incorrectly classified as low risk may miss an opportunity for monitoring or intervention, while a false-positive result generally leads to additional clinical review or follow-up.

## Risk stratification

Rather than presenting the result as a binary controlled-versus-uncontrolled prediction, patients were grouped into four risk categories:

* Low
* Moderate
* High
* Extremely high

This approach better reflects the clinical context.

A single HbA1c result is only a snapshot within a longer disease trajectory. A patient whose diabetes appears controlled at one visit may deteriorate before the next measurement.

The risk bins were intentionally aggressive because the consequences of failing to identify a deteriorating patient may outweigh the burden of reviewing a patient whose risk does not ultimately materialize.

## Dashboard functionality

The clinician-facing application includes:

* Patient search and filtering
* Low, moderate, high, and extremely high risk tiers
* Sorting by predicted risk
* Patient-level contributing factors
* Follow-up status indicators
* Pagination across the patient panel
* Flags for elevated-risk patients without recorded follow-up testing
* A lightweight server-side access gate for the public demonstration

The access gate is intended only to limit casual access to the demonstration. It is not production-grade healthcare authentication.

A production implementation would require:

* Institutional identity management
* Signed sessions
* Role-based authorization
* Audit logging
* Security review
* EHR integration
* Prospective validation
* Ongoing model monitoring

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
├── middleware.js                           # demonstration access gate
├── .env.example
├── .gitignore
└── app/
    ├── layout.jsx
    ├── page.jsx
    ├── login/
    │   └── page.jsx
    ├── api/
    │   ├── login/
    │   │   └── route.js
    │   └── logout/
    │       └── route.js
    └── dashboard/
        ├── page.jsx
        ├── App.jsx
        └── data.js                         # fully synthetic patients
```

## Reviewing the machine-learning work

The primary technical artifact in this repository is:

[`diabetes_a1c_prediction_pipeline.ipynb`](./diabetes_a1c_prediction_pipeline.ipynb)

The notebook is organized into sequential phases covering:

1. Setup and data loading
2. Descriptive analysis
3. Data-quality investigation
4. Label and missingness analysis
5. Cleaning and feature engineering
6. Six-model comparison
7. Feature reduction
8. CatBoost validation
9. Threshold and calibration analysis
10. Final model training
11. Honest versus artifact-inflated performance comparison
12. Patient-level prediction generation

The original datathon CSV files are not included in the public repository. The notebook documents the modeling workflow and validation methodology without publishing patient-level source data.

## Reviewing the live application

The deployed dashboard can be opened directly in a browser:

### [Open the live clinician dashboard](https://a1-c-prediction-interface-clinician-zeta.vercel.app/login?next=%2F)

No local installation is required.

## Optional local setup

Developers who want to inspect or modify the Next.js interface can run it locally:

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

## Limitations

This project is a research and portfolio demonstration, not a validated medical device.

Important limitations include:

* The public dashboard uses synthetic patient data.
* The model was developed using a datathon dataset rather than a prospective clinical implementation.
* Performance has not been externally validated at another institution.
* Missing outcome-year measurements create uncertainty that cannot be resolved through modeling alone.
* Predicted risk should support clinical review, not replace professional judgment.
* The selected risk threshold reflects the priorities of this use case and would require additional evaluation before clinical deployment.
* A production implementation would require prospective validation, fairness assessment, monitoring, governance, security review, and EHR integration.

## Project context

This project was completed by the **Me, Myself, and AI** team for the Washington University Institute for Informatics, Data Science and Biostatistics Datathon.

**Team members:**

* Gabriel Kettering
* Susie Kim
* Rishab Haldar
* Anthony Kirchner

I led the team and focused on the modeling strategy, data-quality investigation, validation decisions, and translation of patient-level predictions into a clinician-facing application.

The most important outcome of the project was not achieving the highest possible AUC. It was identifying when a high AUC was misleading and choosing the model that more honestly represented the clinical problem.
