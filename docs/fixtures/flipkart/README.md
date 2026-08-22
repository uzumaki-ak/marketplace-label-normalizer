# Flipkart fixtures

The local fixture set contains three real multi-page A4 layouts with 10 total pages. Each page contains one E-Kart shipping-label enclosure above a separate Tax Invoice.

Raw PDFs are ignored by Git because they contain customer/seller data. `manifest.json` records non-PII hashes, page counts, expected candidate counts, and crop tolerance. The golden test runs when the authorized local fixtures are present.
