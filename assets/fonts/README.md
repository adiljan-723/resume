# Resume fonts

This website self-hosts three open-source families under the SIL Open Font License 1.1. Their full copyright and license notices are included here as `*-OFL.txt`.

- **Noto Sans SC** supplies Chinese interface and body text. Source: https://github.com/google/fonts/tree/main/ofl/notosanssc
- **Noto Serif SC** supplies the name, section headings and reading titles. Source: https://github.com/google/fonts/tree/main/ofl/notoserifsc
- **Inter Variable 4.1** supplies Latin text and consistent numerals. Source: https://github.com/rsms/inter/tree/v4.1

The Noto files are WOFF2 subsets generated from the official variable TTF files on 2026-11-08. All Chinese characters currently present in the resume and project descriptions are retained, along with Latin, punctuation, Greek and common mathematical symbols available in the source fonts. Source checksums, output names and weight axes are recorded in `manifest.json`. No artificial bold is used. System fallbacks cover characters outside the subsets.

Rebuild when adding resume content using `tools/build_resume_fonts.py`, with `fonttools` and `brotli` installed in a build environment. These tools are not website runtime dependencies. The build reads `index.html` and the JavaScript assets and verifies Chinese glyph coverage in both output fonts.

Official TTF download paths:

- https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf

Font loading uses `font-display: swap` and versioned local files. Visitors do not need to install any fonts, and font requests do not contact external font services.
