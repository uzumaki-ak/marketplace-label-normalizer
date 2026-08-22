# Golden fixtures

Only anonymized or synthetic PDFs may be committed. Each fixture needs a sidecar manifest describing marketplace, source pages, expected page kinds, printable-label count, ignored-page count, expected PDF-point crop bounds/tolerance, target dimensions, and machine-readable-code expectations.

Final PDF bytes are not snapshot-tested because object ordering and metadata can differ. Tests compare semantic page counts/dimensions, crop geometry, decode results, and tolerance-based rendered structure.
