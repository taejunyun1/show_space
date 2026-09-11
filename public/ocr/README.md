# Local OCR assets

Tesseract.js 7.0.0 worker and its locked tesseract.js-core assets are copied from npm by scripts/sync-ocr-assets.mjs (also postinstall). Keep adjacent licenses.

Language models downloaded 2026-09-11 from official tessdata_fast main, gzip mtime=0. Compressed SHA256 pins the bundled bytes; upstream main may change.

- https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata
  SHA256 gzip: 384e37bf0f5ddcc4a1e24802322a837e0b5692e18150e6078ff1d4379b191f98
- https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/kor.traineddata
  SHA256 gzip: 067e6bdfa70935c3593a4bc5ed1d1ab6d2a5144ae0888770c0282f49d8524457
- License: lang/LICENSE, https://github.com/tesseract-ocr/tessdata_fast/blob/main/LICENSE

Models are served from this application, not fetched from a third-party CDN at recognition time. OCR remains fallible; confidence scores are not calibrated accuracy.
