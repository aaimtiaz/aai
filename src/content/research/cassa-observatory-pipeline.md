---
title: "An automated reduction and photometry pipeline for the CASSA observatory"
date: 2026-04-15
supervisor: "Dr. Syed Ashraf Uddin"
status: "ongoing"
order: 5
excerpt: "Instrumentation work for CASSA's first optical observatory: automated reduction, seeing measurement, and camera characterisation for transient follow-up."
tags: ["instrumentation", "pipelines", "transients", "photometry", "Python"]
---

CASSA is building its first optical observatory, aimed at transient phenomena — supernovae in particular. Transient work lives or dies on turnaround, so the reduction cannot be a manual process.

I am building the automated image reduction and photometry pipeline for it, along with documentation of what it does and how to use it. Two supporting pieces sit alongside the pipeline:

**Seeing measurement.** I wrote the Python for Differential Image Motion Monitor (DIMM) estimation using a Sky-Watcher 8" telescope, which will characterise the atmospheric seeing at the observatory site. Knowing the seeing is what turns a raw measurement into a calibrated one.

**Camera characterisation.** Code to measure the detector's behaviour, so that future observational data can be corrected properly rather than approximately.

All of the observatory work is pending on-sky testing and will be refined once real observations start arriving.
