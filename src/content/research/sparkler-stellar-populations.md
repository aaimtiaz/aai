---
title: "Star clusters in the Sparkler galaxy and the CANUCS survey"
date: 2026-06-01
supervisor: "Dr. Lamiya Mowla"
status: "ongoing"
order: 3
cover: "./images/sparkler-stellar-populations.webp"
coverAlt: "Stellar population analysis of the Sparkler galaxy"
excerpt: "Photometry and SED fitting of 182 star clusters across 43 lensed galaxies, and what they say about how globular clusters formed."
tags: ["JWST", "SED fitting", "globular clusters", "strong lensing", "CANUCS"]
publication:
  venue: "CANUCS collaboration paper (in preparation)"
  role: "Co-author"
---

The Sparkler is a strongly lensed galaxy at z ≈ 1.4 whose compact "sparkles" are candidate globular clusters caught early — a follow-up to Mowla & Iyer et al. (2022). I began this work during the ICTP PWF Bangladesh Summer Internship and have continued it as a Graduate Research Assistant at CASSA.

I estimate photometry of the sparkles with `photutils`, and model the point spread function for point-like sources using `STARRED`, which matters because at this magnification the clusters are barely resolved and the PSF sets the floor on what can be measured.

For the CANUCS collaboration I have run SED fitting with `dense-basis` for **182 sparkles across 43 galaxies in five lensing clusters**, in both medium and broad bands. That analysis feeds a collaboration paper now in preparation.

Characterising these systems tells us how galaxies with LMC-like progenitor masses evolved around cosmic noon, and gives context for how present-day globular cluster populations came to be.
